var test = require("tape");
var WebTorrent = require("webtorrent");
var Bugout = require("./index.js");

var wtest = new WebTorrent({dht: false, tracker: false});
var wtest2 = new WebTorrent({dht: false, tracker: false});

test.onFinish(function() {
  wtest.destroy();
  wtest2.destroy();
});

test('Instantiation', function (t) {
  t.plan(6);

  var b1 = new Bugout({seed: "BohNtZ24TrgMwZTLx9VDKtcZARNVuCt5tnecAAxYtTBC8pC61uGN", wt: wtest});
  t.equal(b1.identifier, "bYSkTy24xXJj6dWe79ZAQXKJZrn2n983SQ", "server identifier");
  t.equal(b1.pk, "CXENBY9X3x5TN1yjRyu1U1WkGuujuVBNiqxA16oAYbFo", "server public key");
  b1.torrent.on("infoHash", function() {
    t.equal(b1.torrent.infoHash, "28d878040b7d2f5215409373b415fb99bc0e6d88", "server infoHash");
  });

  t.throws(function() {
    var b2 = new Bugout({seed: "BohNtZ24TrgMwZTLx9VDLtcZARNVuCt5tnecAAxYtTBC8pC61uGN", wt: wtest});
  }, "Error: Invalid checksum", "invalid seed checksum");
  
  var b3 = new Bugout("bMuHpwCxcD5vhC5u7VKuajYu5RU7FUnaGJ", {wt: wtest});
  t.equal(b3.identifier, "bMuHpwCxcD5vhC5u7VKuajYu5RU7FUnaGJ", "client identifier");
  b3.torrent.on("infoHash", function() {
    t.equal(b3.torrent.infoHash, "d96fe55834a62d86e48573c132345c01a38f5ffd", "client infoHash");
  });
});

test("Connectivity events", function(t) {
  t.plan(7);

  var bs = new Bugout({wt: wtest});
  var bc = new Bugout(bs.address(), {wt: wtest2});

  var clast = null;
  var times = 2;
  function connectioncounter(c) {
    t.notEqual(clast, c, "connection count");
    times -= 1;
    clast = c;
    if (!times) {
      bs.removeListener("connections", connectioncounter);
    }
  }

  bs.on("connections", connectioncounter);
  bs.connections();
  bs.connections();

  bc.on("wire", function(c) {
    t.equal(c, 1, "client wire count");
  });

  bs.on("wire", function(c) {
    t.equal(c, 1, "server wire count");
  });

  bc.on("seen", function(address) {
    t.equal(address, bs.address(), "client remote address");
  });

  bs.on("seen", function(address) {
    t.equal(address, bc.address(), "server remote address");
  });

  bc.on("server", function(address) {
    t.equal(address, bs.address(), "server seen correct address");
  });

  // connect the two clients together
  bs.torrent.on("infoHash", function() {
    bs.torrent.addPeer("127.0.0.1:" + bc.wt.address().port);
  });
});

test("RPC and message passing", function(t) {
  t.plan(7);

  var bs = new Bugout({wt: wtest});
  var bc = new Bugout(bs.address(), {wt: wtest2});

  var msg = {"Hello": "world"};

  bs.register("ping", function(address, args, cb) {
    t.equal(address, bc.address(), "client rpc address");
    args["pong"] = true;
    cb(args);
  });

  bs.register("rpc", console.log.bind(null, "rpc"));

  bs.on("seen", function(address) {
    t.equal(address, bc.address(), "server seen client address");
    bs.send(address, {"Hello": "world"});
  });

  bc.on("server", function(address) {
    t.equal(address, bs.address(), "client seen server address");
    bc.rpc("ping", msg, function(response) {
      t.equal(response.Hello, "world", "RPC server response check value");
      t.ok(response.pong, "RPC server response check pong");
    });
  });

  bc.on("message", function(address, message) {
    t.equal(address, bs.address(), "server message remote address");
    t.deepEqual(message, msg, "server message content check");
  });

  // connect the two clients together
  bs.torrent.on("infoHash", function() {
    bs.torrent.addPeer("127.0.0.1:" + bc.wt.address().port);
  });
});

// TODO: 3 party incomplete wire graph gossip & message recipientn tests
// TODO: test RPC with each type of argument
// TODO: more bad parameters & calls
// TODO: check mutated keys yield cryptographic errors
// TODO: test malformed JSON packets
