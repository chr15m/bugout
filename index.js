module.exports = Bugout;

var debug = require("debug")("bugout");
var WebTorrent = require("webtorrent");
var bencode = require("bencode");
var nacl = require("tweetnacl");
var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var bs58 = require("bs58");

inherits(Bugout, EventEmitter);

var EXT = "bo_channel";
var PEERTIMEOUT = 5 * 60 * 1000;

/**
 * Multi-party data channels on WebTorrent extension.
 */
function Bugout(identifier, opts) {
  // TODO: option to pass shared secret to encrypt swarm traffic
  if (identifier && typeof(identifier) == "object") {
    opts = identifier;
    identifier = null;
  }
  var opts = opts || {};
  if (!(this instanceof Bugout)) return new Bugout(identifier, opts);
  
  this.wt = opts.wt || new WebTorrent(opts.iceServers ? {tracker: {rtcConfig: {iceServers: opts.iceServers}}} : null);
  this.nacl = nacl;

  
  if (opts["seed"]) {
    this.seed = opts["seed"];
  } else {
    this.seed = bs58.encode(nacl.randomBytes(32));
  }

  this.timeout = PEERTIMEOUT;
  
  this.keyPair = opts["keyPair"] || nacl.sign.keyPair.fromSeed(bs58.decode(this.seed));
  // ephemeral encryption key only used for this session
  this.keyPairEncrypt = nacl.box.keyPair();

  this.pk = bs58.encode(this.keyPair.publicKey);
  this.ek = bs58.encode(this.keyPairEncrypt.publicKey);
  
  // TODO: generate identifier & address from hash of pk
  this.identifier = identifier || this.pk;
  this.peers = {}; // list of peers seen recently: pk -> ek, timestamp
  this.seen = {}; // messages we've seen recently: hash -> timestamp

  // rpc api functions and pending callback functions
  this.api = {};
  this.callbacks = {};
  this.serverpk = null;
  
  debug("identifier", this.identifier);
  debug("public key", this.pk);
  debug("encryption key", this.ek);
  
  var blob = new File([this.identifier], this.identifier);
  var torrent = this.wt.seed(blob, {"name": this.identifier}, (debug, "joined", this.identifier));
  torrent.on("wire", partial(attach, this, this.identifier));
  this.torrent = torrent;
  // TODO: background task to purge old .peers table of entries older than this.timeout
  // TODO: send ping/keepalive message
}

Bugout.prototype.close = function(struct) {
  this.wt.remove(struct.torrent)
}

Bugout.prototype.send = function(pk, message) {
  if (!message) {
    var message = pk;
    var pk = null;
  }
  var packet = makePacket(this, {"y": "m", "v": JSON.stringify(message)});
  if (pk) {
    packet = encryptPacket(this, pk, packet);
  }
  sendRaw(this, packet);
}

Bugout.prototype.register = function(call, fn, docstring) {
  this.api[call] = fn;
  this.api[call].docstring = docstring;
}

Bugout.prototype.rpc = function(pk, call, args, callback) {
  // my kingdom for multimethods lol
  // calling styles:
  // pk, call, args, callback
  // pk, call, callback (no args)
  // call, args, callback (implicit server pk)
  // call, callback (no args, implicit server pk)
  if (this.serverpk && typeof(args) == "function") {
    callback = args;
    args = call;
    call = pk;
    pk = this.serverpk;
  }
  var callnonce = nacl.randomBytes(8);
  var packet = makePacket(this, {"y": "r", "c": call, "a": JSON.stringify(args), "rn": callnonce});
  this.callbacks[toHex(callnonce)] = callback;
  packet = encryptPacket(this, pk, packet);
  sendRaw(this, packet);
}

// outgoing

function makePacket(bugout, params) {
  var p = {
    "t": now(),
    "i": bugout.identifier,
    "pk": bugout.pk,
    "ek": bugout.ek,
    "n": nacl.randomBytes(8),
  };
  for (var k in params) {
    p[k] = params[k];
  }
  pe = bencode.encode(p);
  return bencode.encode({
    "s": nacl.sign.detached(pe, bugout.keyPair.secretKey),
    "p": pe,
  });
}

function encryptPacket(bugout, pk, packet) {
  if (bugout.peers[pk]) {
    var nonce = nacl.randomBytes(nacl.box.nonceLength);
    packet = bencode.encode({
      "n": nonce,
      "ek": bs58.encode(bugout.keyPairEncrypt.publicKey),
      "e": nacl.box(packet, nonce, bs58.decode(bugout.peers[pk].ek), bugout.keyPairEncrypt.secretKey),
    });
  } else {
    throw pk + " not seen - no encryption key.";
  }
  return packet;
}

function sendRaw(bugout, message) {
  var wires = bugout.torrent.wires;
  for (var w=0; w<wires.length; w++) {
    wires[w].extended(EXT, message);
  }
  var hash = toHex(nacl.hash(message).slice(16));
  debug("sent", hash, "to", wires.length, "wires");
}

// incoming

function onMessage(bugout, identifier, wire, message) {
  // hash to reference incoming message
  var hash = toHex(nacl.hash(message).slice(16));
  var t = now();
  debug("raw message", identifier, message.length, hash);
  if (!bugout.seen[hash]) {
    var unpacked = bencode.decode(message);
    // if this is an encrypted packet first try to decrypt it
    if (unpacked.e && unpacked.n && unpacked.ek) {
      var ek = unpacked.ek.toString();
      debug("message encrypted by", ek, unpacked);
      var decrypted = nacl.box.open(unpacked.e, unpacked.n, bs58.decode(ek), bugout.keyPairEncrypt.secretKey);
      if (decrypted) {
        unpacked = bencode.decode(decrypted);
      } else {
        unpacked = null;
      }
    }
    // if there's no data decryption failed
    if (unpacked && unpacked.p) {
      debug("unpacked message", unpacked);
      var packet = bencode.decode(unpacked.p);
      var pk = packet.pk.toString();
      var id = packet.i.toString();
      var checksig = nacl.sign.detached.verify(unpacked.p, unpacked.s, bs58.decode(pk));
      var checkid = id == identifier;
      var checktime = packet.t + bugout.timeout > t;
      debug("packet", packet);
      if (checksig && checkid && checktime) {
        // message is authenticated
        var ek = packet.ek.toString();
        sawPeer(bugout, pk, ek, identifier);
        // check packet types
        if (packet.y == "m") {
          debug("message", identifier, packet);
          var messagestring = packet.v.toString();
          try {
            bugout.emit("message", pk, JSON.parse(messagestring), packet);
          } catch(e) {
            debug("Malformed message JSON: " + messagestring);
          }
        } else if (packet.y == "r") { // rpc call
          debug("rpc", identifier, packet);
          var call = packet.c.toString();
          var argsstring = packet.a.toString();
          try {
            var args = JSON.parse(argsstring);
          } catch(e) {
            var args = null;
            debug("Malformed args JSON: " + argsstring);
          }
          var nonce = packet.rn;
          bugout.emit("rpc", pk, call, args, toHex(nonce));
          // make the API call and send back response
          rpcCall(bugout, pk, call, args, nonce);
        } else if (packet.y == "rr") { // rpc response
          var nonce = toHex(packet.rn);
          if (bugout.callbacks[nonce]) {
            var responsestring = packet.rr.toString();
            try {
              bugout.callbacks[nonce](JSON.parse(responsestring));
            } catch(e) {
              debug("Malformed response JSON: " + responsestring);
            }
            delete bugout.callbacks[nonce];
          } else {
            debug("dropped response with no callback.", nonce);
          }
        } else if (packet.y == "p") {
          debug("ping from", pk);
          bugout.emit("ping", pk);
        } else {
          // TODO: handle ping/keep-alive message
          debug("unknown packet type");
        }
      } else {
        debug("dropping bad packet", hash, checksig, checkid, checktime);
      }
    } else {
      debug("skipping packet with no payload", hash, unpacked);
    }
    // forward first-seen message to all connected wires
    // TODO: block flooders
    sendRaw(bugout, message);
  } else {
    debug("already seen", hash);
  }
  // refresh last-seen timestamp on this message
  bugout.seen[hash] = now();
}

// network functions

function rpcCall(bugout, pk, call, args, nonce, callback) {
  var packet = {"y": "rr", "rn": nonce};
  if (bugout.api[call]) {
    bugout.api[call](pk, args, function(result) {
      packet["rr"] = JSON.stringify(result);
    });
  } else {
    packet["rr"] = JSON.stringify({"error": "No such API call."});
  }
  packet = makePacket(bugout, packet);
  packet = encryptPacket(bugout, pk, packet);
  sendRaw(bugout, packet);
}

function sawPeer(bugout, pk, ek, identifier) {
  debug("sawPeer", pk, ek);
  var t = now();
  // ignore ourself
  if (pk != bugout.pk) {
    // if we haven't seen this peer for a while
    if (!bugout.peers[pk] || bugout.peers[pk].last + bugout.timeout < t) {
      bugout.peers[pk] = {
        "ek": ek,
        "pk": pk,
        "last": t,
      };
      bugout.emit("seen", pk);
      debug("seen", pk);
      if (pk == identifier) {
        bugout.serverpk = pk;
        bugout.emit("server", pk);
        debug("seen server", pk);
      }
      // ping them back so they know about us too
      var packet = makePacket(bugout, {"y": "p"});
      sendRaw(bugout, packet);
    } else {
      bugout.peers[pk].ek = ek;
      bugout.peers[pk].last = t;
    }
  }
}

// extension protocol plumbing

function attach(bugout, identifier, wire, addr) {
  debug("saw wire", wire.peerId, identifier);
  wire.use(extension(bugout, identifier, wire));
  wire.on("close", partial(detach, bugout, identifier, wire));
}

function detach(bugout, identifier, wire) {
  debug("wire left", wire.peerId, identifier);
  bugout.emit("left", bugout.torrent.wires.length, wire);
}

function extension(bugout, identifier, wire) {
  var ext = partial(wirefn, bugout, identifier);
  ext.prototype.name = EXT;
  ext.prototype.onExtendedHandshake = partial(onExtendedHandshake, bugout, identifier, wire);
  ext.prototype.onMessage = partial(onMessage, bugout, identifier, wire);
  return ext;
}

function wirefn(bugout, identifier, wire) {
  wire.extendedHandshake.id = identifier;
  wire.extendedHandshake.pk = bugout.pk;
  wire.extendedHandshake.ek = bugout.ek;
}

function onExtendedHandshake(bugout, identifier, wire, handshake) {
  debug("wire extended handshake", wire.peerId, handshake);
  bugout.emit("wire", bugout.torrent.wires.length, wire);
  sawPeer(bugout, handshake.pk.toString(), handshake.ek.toString(), identifier);
}

// utility fns

function now() {
  return (new Date()).getTime();
}

// https://stackoverflow.com/a/39225475/2131094
function toHex(x) {
  return x.reduce(function(memo, i) {
    return memo + ('0' + i.toString(16)).slice(-2);
  }, '');
}

// javascript why
function partial(fn) {
  var slice = Array.prototype.slice;
  var stored_args = slice.call(arguments, 1);
  return function () {
    var new_args = slice.call(arguments);
    var args = stored_args.concat(new_args);
    return fn.apply(null, args);
  };
}
