module.exports = Bugout;

var debug = require("debug")("bugout");
var WebTorrent = require("webtorrent");
var bencode = require("bencode");
var nacl = require("tweetnacl");
var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var bs58 = require("bs58");
var bs58check = require("bs58check");
var ripemd160 = require("ripemd160");

inherits(Bugout, EventEmitter);

var EXT = "bo_channel";
var PEERTIMEOUT = 5 * 60 * 1000;
var SEEDPREFIX = "490a";
var ADDRESSPREFIX = "55";

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
  
  var trackeropts = opts.tracker || {};
  trackeropts.getAnnounceOpts = trackeropts.getAnnounceOpts || function() { return {numwant: 4}; };
  if (opts.iceServers) {
    trackeropts.rtcConfig = {iceServers: opts.iceServers};
  }
  this.announce = opts.announce || ["wss://hub.bugout.link", "wss://tracker.openwebtorrent.com", "wss://tracker.btorrent.xyz"];
  this.wt = opts.wt || new WebTorrent({tracker: trackeropts});
  this.nacl = nacl;
  
  if (opts["seed"]) {
    this.seed = opts["seed"];
  } else {
    this.seed = this.encodeseed(nacl.randomBytes(32));
  }

  this.timeout = opts["timeout"] || PEERTIMEOUT;
  this.keyPair = opts["keyPair"] || nacl.sign.keyPair.fromSeed(Uint8Array.from(bs58check.decode(this.seed)).slice(2));
  // ephemeral encryption key only used for this session
  this.keyPairEncrypt = nacl.box.keyPair();

  this.pk = bs58.encode(Buffer.from(this.keyPair.publicKey));
  this.ek = bs58.encode(Buffer.from(this.keyPairEncrypt.publicKey));
  
  this.identifier = identifier || this.address();
  this.peers = {}; // list of peers seen recently: address -> pk, ek, timestamp
  this.seen = {}; // messages we've seen recently: hash -> timestamp
  this.lastwirecount = null;

  // rpc api functions and pending callback functions
  this.api = {};
  this.callbacks = {};
  this.serveraddress = null;
  this.heartbeattimer = null;
  
  debug("address", this.address());
  debug("identifier", this.identifier);
  debug("public key", this.pk);
  debug("encryption key", this.ek);
  
  if (typeof(File) == "object") {
    var blob = new File([this.identifier], this.identifier);
  } else {
    var blob = new Buffer.from(this.identifier);
    blob.name = this.identifier;
  }
  var torrent = this.wt.seed(blob, {"name": this.identifier, "announce": this.announce}, partial(function(bugout, torrent) {
    debug("torrent", bugout.identifier, torrent);
    bugout.emit("torrent", bugout.identifier, torrent);
    if (torrent.discovery.tracker) {
      torrent.discovery.tracker.on("update", function(update) { bugout.emit("tracker", bugout.identifier, update); });
    }
    torrent.discovery.on("trackerAnnounce", function() {
      bugout.emit("announce", bugout.identifier);
      bugout.connections();
    });
  }, this));
  torrent.on("wire", partial(attach, this, this.identifier));
  this.torrent = torrent;

  if (opts.heartbeat) {
    this.heartbeat(opts.heartbeat);
  }
}

Bugout.prototype.WebTorrent = WebTorrent;

Bugout.encodeseed = Bugout.prototype.encodeseed = function(material) {
  return bs58check.encode(Buffer.concat([Buffer.from(SEEDPREFIX, "hex"), Buffer.from(material)]));
}

Bugout.encodeaddress = Bugout.prototype.encodeaddress = function(material) {
  return bs58check.encode(Buffer.concat([Buffer.from(ADDRESSPREFIX, "hex"), new ripemd160().update(Buffer.from(nacl.hash(material))).digest()]));
}

// start a heartbeat and expire old "seen" peers who don't send us a heartbeat
Bugout.prototype.heartbeat = function(interval) {
  var interval = interval || 30000;
  this.heartbeattimer = setInterval(partial(function (bugout) {
    // broadcast a 'ping' message
    bugout.ping();
    var t = now();
    // remove any 'peers' entries with timestamps older than timeout
    for (var p in bugout.peers) {
      var pk = bugout.peers[p].pk;
      var address = bugout.address(pk);
      var last = bugout.peers[p].last;
      if (last + bugout.timeout < t) {
        delete bugout.peers[p];
        bugout.emit("timeout", address);
        bugout.emit("left", address);
      }
    }
  }, this), interval);
}

// clean up this bugout instance
Bugout.prototype.destroy = function(cb) {
  clearInterval(this.heartbeattimer);
  var packet = makePacket(this, {"y": "x"});
  sendRaw(this, packet);
  this.wt.remove(this.torrent, cb);
}

Bugout.prototype.close = Bugout.prototype.destroy;

Bugout.prototype.connections = function() {
  if (this.torrent.wires.length != this.lastwirecount) {
    this.lastwirecount = this.torrent.wires.length;
    this.emit("connections", this.torrent.wires.length);
  }
  return this.lastwirecount;
}

Bugout.prototype.address = function(pk) {
  if (pk && typeof(pk) == "string") {
    pk = bs58.decode(pk);
  } else if (pk && pk.length == 32) {
    pk = pk;
  } else {
    pk = this.keyPair.publicKey;
  }
  return this.encodeaddress(pk);
}

Bugout.address = Bugout.prototype.address;

Bugout.prototype.ping = function() {
    // send a ping out so they know about us too
    var packet = makePacket(this, {"y": "p"});
    sendRaw(this, packet);
}

Bugout.prototype.send = function(address, message) {
  if (!message) {
    var message = address;
    var address = null;
  }
  var packet = makePacket(this, {"y": "m", "v": JSON.stringify(message)});
  if (address) {
    if (this.peers[address]) {
      packet = encryptPacket(this, this.peers[address].pk, packet);
    } else {
      throw address + " not seen - no public key.";
    }
  }
  sendRaw(this, packet);
}

Bugout.prototype.register = function(call, fn, docstring) {
  this.api[call] = fn;
  this.api[call].docstring = docstring;
}

Bugout.prototype.rpc = function(address, call, args, callback) {
  // my kingdom for multimethods lol
  // calling styles:
  // address, call, args, callback
  // address, call, callback (no args)
  // call, args, callback (implicit server address)
  // call, callback (no args, implicit server address)
  if (this.serveraddress && typeof(args) == "function") {
    callback = args;
    args = call;
    call = address;
    address = this.serveraddress;
  }
  if (this.peers[address]) {
    var pk = this.peers[address].pk;
    var callnonce = nacl.randomBytes(8);
    var packet = makePacket(this, {"y": "r", "c": call, "a": JSON.stringify(args), "rn": callnonce});
    this.callbacks[toHex(callnonce)] = callback;
    packet = encryptPacket(this, pk, packet);
    sendRaw(this, packet);
  } else {
    throw address + " not seen - no public key.";
  }
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
  if (bugout.peers[bugout.address(pk)]) {
    var nonce = nacl.randomBytes(nacl.box.nonceLength);
    packet = bencode.encode({
      "n": nonce,
      "ek": bs58.encode(Buffer.from(bugout.keyPairEncrypt.publicKey)),
      "e": nacl.box(packet, nonce, bs58.decode(bugout.peers[bugout.address(pk)].ek), bugout.keyPairEncrypt.secretKey),
    });
  } else {
    throw bugout.address(pk) + " not seen - no encryption key.";
  }
  return packet;
}

function sendRaw(bugout, message) {
  var wires = bugout.torrent.wires;
  for (var w=0; w<wires.length; w++) {
    var extendedhandshake = wires[w]["peerExtendedHandshake"];
    if (extendedhandshake && extendedhandshake.m && extendedhandshake.m[EXT]) {
      wires[w].extended(EXT, message);
    }
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
          var messagejson = null;
          try {
            var messagejson = JSON.parse(messagestring);
          } catch(e) {
            debug("Malformed message JSON: " + messagestring);
          }
          if (messagejson) {
            bugout.emit("message", bugout.address(pk), messagejson, packet);
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
          bugout.emit("rpc", bugout.address(pk), call, args, toHex(nonce));
          // make the API call and send back response
          rpcCall(bugout, pk, call, args, nonce);
        } else if (packet.y == "rr") { // rpc response
          var nonce = toHex(packet.rn);
          if (bugout.callbacks[nonce]) {
            var responsestring = packet.rr.toString();
            try {
              var responsestringstruct = JSON.parse(responsestring);
            } catch(e) {
              debug("Malformed response JSON: " + responsestring);
              var responsestringstruct = null;
            }
            if (bugout.callbacks[nonce] && responsestringstruct) {
              debug("rpc-response", bugout.address(pk), nonce, responsestringstruct);
              bugout.emit("rpc-response", bugout.address(pk), nonce, responsestringstruct);
              bugout.callbacks[nonce](responsestringstruct);
              delete bugout.callbacks[nonce];
            } else {
              debug("RPC response nonce not known:", nonce);
            }
          } else {
            debug("dropped response with no callback.", nonce);
          }
        } else if (packet.y == "p") {
          var address = bugout.address(pk);
          debug("ping from", address);
          bugout.emit("ping", address);
        } else if (packet.y == "x") {
          var address = bugout.address(pk);
          debug("got left from", address);
          delete bugout.peers[address];
          bugout.emit("left", address);
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
    bugout.api[call](bugout.address(pk), args, function(result) {
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
  debug("sawPeer", bugout.address(pk), ek);
  var t = now();
  var address = bugout.address(pk);
  // ignore ourself
  if (address != bugout.address()) {
    // if we haven't seen this peer for a while
    if (!bugout.peers[address] || bugout.peers[address].last + bugout.timeout < t) {
      bugout.peers[address] = {
        "ek": ek,
        "pk": pk,
        "last": t,
      };
      debug("seen", bugout.address(pk));
      bugout.emit("seen", bugout.address(pk));
      if (bugout.address(pk) == bugout.identifier) {
        bugout.serveraddress = address;
        debug("seen server", bugout.address(pk));
        bugout.emit("server", bugout.address(pk));
      }
      // send a ping out so they know about us too
      var packet = makePacket(bugout, {"y": "p"});
      sendRaw(bugout, packet);
    } else {
      bugout.peers[address].ek = ek;
      bugout.peers[address].last = t;
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
  bugout.emit("wireleft", bugout.torrent.wires.length, wire);
  bugout.connections();
}

function extension(bugout, identifier, wire) {
  var ext = partial(wirefn, bugout, identifier);
  ext.prototype.name = EXT;
  ext.prototype.onExtendedHandshake = partial(onExtendedHandshake, bugout, identifier, wire);
  ext.prototype.onMessage = partial(onMessage, bugout, identifier, wire);
  return ext;
}

function wirefn(bugout, identifier, wire) {
  // TODO: sign handshake to prove key custody
  wire.extendedHandshake.id = identifier;
  wire.extendedHandshake.pk = bugout.pk;
  wire.extendedHandshake.ek = bugout.ek;
}

function onExtendedHandshake(bugout, identifier, wire, handshake) {
  debug("wire extended handshake", bugout.address(handshake.pk.toString()), wire.peerId, handshake);
  bugout.emit("wireseen", bugout.torrent.wires.length, wire);
  bugout.connections();
  // TODO: check sig and drop on failure - wire.peerExtendedHandshake
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
