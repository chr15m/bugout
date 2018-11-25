var test = require("tape");
var WebTorrent = require("webtorrent");
var Bugout = require("./index.js");

var wtest = new WebTorrent({dht: false, tracker: false});
var wtest2 = new WebTorrent({dht: false, tracker: false});
var wtest3 = new WebTorrent({dht: false, tracker: false});

test.onFinish(function() {
  wtest.destroy();
  wtest2.destroy();
  wtest3.destroy();
});

test('Instantiation', function (t) {
  t.plan(10);

  var b1 = new Bugout({seed: "BohNtZ24TrgMwZTLx9VDKtcZARNVuCt5tnecAAxYtTBC8pC61uGN", wt: wtest});
  t.equal(b1.identifier, "bYSkTy24xXJj6dWe79ZAQXKJZrn2n983SQ", "server identifier");
  t.equal(b1.pk, "CXENBY9X3x5TN1yjRyu1U1WkGuujuVBNiqxA16oAYbFo", "server public key");
  t.equal(b1.identifier, Bugout.address("CXENBY9X3x5TN1yjRyu1U1WkGuujuVBNiqxA16oAYbFo"), "server address from pk");
  t.equal(b1.identifier, Bugout.address(b1.keyPair.publicKey), "server address from pk array");
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

  var b4 = new Bugout({seed: Bugout.encodeseed(Array(32).fill(0x23)), wt: wtest});
  console.log(b4.address());
  t.equal(b4.identifier, "bYwqSagZb5n42M9qXSw2uu3Cpxg9JhZcnd", "encode seed client identifier");
  b4.torrent.on("infoHash", function() {
    console.log(b4.torrent.infoHash);
    t.equal(b4.torrent.infoHash, "5486696a87e91c6c7fcfc6279c9b08709c7aa61f", "client infoHash");
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

  bc.on("wireseen", function(c) {
    t.equal(c, 1, "client wire count");
  });

  bs.on("wireseen", function(c) {
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

test("3 party incomplete graph gossip test", function(t) {
  t.plan(10);
  
  var bs = new Bugout({wt: wtest});
  var bc1 = new Bugout(bs.address(), {wt: wtest2});
  var bc2 = new Bugout(bs.address(), {wt: wtest3});

  var msg = {"Foo": "bar", "meaning": 42};

  bs.register("ping", function(address, args, cb) {
    t.equal(address, bc2.address(), "client rpc address");
    args["pong"] = true;
    cb(args);
  });

  bs.on("rpc", function(address, call, args) {
    // check rpc was from client2
    t.equal(bc2.address(), address, "server check client2 was rpc sender");
  });

  // this should never fire
  bc1.on("rpc", console.log.bind(null, "client1 rpc"));

  bc2.on("server", function(address) {
    t.equal(address, bs.address(), "client2 seen server address");
    // verify we're only acutally connected to other client
    // (getting messages by gossip)
    t.equal(bc2.torrent.wires.length, 1, "client2 only one wire");
    t.equal(bc2.address(bc2.torrent.wires[0].peerExtendedHandshake.pk.toString()), bc1.address(), "client2 is connected to client1");
    bc2.rpc("ping", msg, function(response) {
      t.equal(response.Foo, "bar", "RPC server response check value 1");
      t.equal(response.meaning, 42, "RPC server response check value 2");
      t.ok(response.pong, "RPC server response check pong");
    });
  });

  // connect first client to server
  bs.torrent.on("infoHash", function() {
    bs.torrent.addPeer("127.0.0.1:" + bc1.wt.address().port);

    bs.once("seen", function(address) {
      t.equal(address, bc1.address(), "server seen client1 address");
      // bs.send(address, msg);
      // check the second client's connection
      bs.once("seen", function(address) {
        t.equal(address, bc2.address(), "server seen client2 address");
      });
      // connect second client to first
      setTimeout(function() {
        bc1.torrent.addPeer("127.0.0.1:" + bc2.wt.address().port);
      }, 100);
    });

  });
});

test("heartbeat seen and timeout", function(t) {
  t.plan(20);

  var interval = 100;
  var timeout = 1000;
  var bs = new Bugout({wt: wtest, heartbeat: interval, timeout: timeout});
  var bc1 = new Bugout(bs.address(), {wt: wtest2, heartbeat: interval, timeout: timeout});
  var bc2 = new Bugout(bs.address(), {wt: wtest3, heartbeat: interval, timeout: timeout});

  /*console.log(" ->>> bs:", bs.address());
  console.log(" ->>> bc1:", bc1.address());
  console.log(" ->>> bc2:", bc2.address());*/

  /*bs.on("timeout", console.log.bind(null, "-> bs timeout"));
  bc2.on("timeout", console.log.bind(null, "-> bc2 timeout"));
  bs.on("left", console.log.bind(null, "-> bs left"));
  bc2.on("left", console.log.bind(null, "-> bc2 left"));
  bs.on("ping", console.log.bind(null, "bs ping"));
  bc1.on("ping", console.log.bind(null, "bc1 ping"));
  bc2.on("ping", console.log.bind(null, "bc2 ping"));*/

  var pingers = [
    [bc2.address(), bc1.address(), bs],
    [bs.address(), bc2.address(), bc1],
    [bs.address(), bc1.address(), bc2],
  ];

  // ensure each client receives at least one ping from each other client
  pingers.map(function(pingtest) {
    var src = pingtest.pop();
    var expected = {};
    for (var p=0; p<pingtest.length; p++) {
      expected[pingtest[p]] = true;
    }
    src.on("ping", function(address) {
      if (expected[address]) {
        t.pass("ping from " + address);
        delete expected[address];
      }
    });
  });

  // ensure server sees client 2 timeout
  bs.on("timeout", function(address) {
    // ignore bc1 timeout
    if (address == bc2.address()) {
      t.pass("server saw client2 timeout");
    }
  });

  // ensure client2 sees server timeout
  bc2.on("timeout", function(address) {
    // ignore bc1 timeout
    if (address == bs.address()) {
      t.pass("client2 saw server timeout");
    }
  });

  var leavers = [
    [bc2.address(), bc1.address(), bs],
    [bs.address(), bc1.address(), bc2],
  ];

  // bs and bc2 should see the other two leave each once
  leavers.map(function(leavetest) {
    var src = leavetest.pop();
    var expected = {};
    for (var e=0; e<leavetest.length; e++) {
      expected[leavetest[e]] = true;
    }
    src.on("left", function(address) {
      if (expected[address]) {
        t.pass(address + " left");
        delete expected[address];
      } else {
        t.fail(address + " left unexpectedly");
      }
      // clean up once this test is done
      if (Object.keys(expected).length == 0) {
        src.destroy();
      }
    });
  });

  var msg = {"Goober": "dougal", "question": 42};

  bc2.on("server", function(address) {
    t.equal(address, bs.address(), "client2 seen server address");
    // verify we're only acutally connected to other client
    // (getting messages by gossip)
    t.equal(bc2.torrent.wires.length, 1, "client2 only one wire");
    t.equal(bc2.address(bc2.torrent.wires[0].peerExtendedHandshake.pk.toString()), bc1.address(), "client2 is connected to client1");

    bs.on("wireleft", function() {
      t.equal(bs.torrent.wires.length, 0, "server wires to zero");
    });


    bc2.on("wireleft", function() {
      t.equal(bc2.torrent.wires.length, 0, "client2 wires to zero");
    });

    // disconnect bc2
    setTimeout(function() {
      bc1.destroy(function() {
        t.pass("bc1 destroyed");
      });
    }, 500);
  });

  // connect first client to server
  bs.torrent.on("infoHash", function() {
    bs.torrent.addPeer("127.0.0.1:" + bc1.wt.address().port);

    bs.once("seen", function(address) {
      t.equal(address, bc1.address(), "server seen client1 address");
      // bs.send(address, msg);
      // check the second client's connection
      bs.once("seen", function(address) {
        t.equal(address, bc2.address(), "server seen client2 address");
      });
      // connect second client to first
      setTimeout(function() {
        bc1.torrent.addPeer("127.0.0.1:" + bc2.wt.address().port);
      }, 100);
    });
  });
});

// TODO: test RPC with each type of argument combination
// TODO: test bad RPC with unknown nonce
// TODO: more bad parameters & calls
// TODO: check mutated keys yield cryptographic errors
// TODO: test malformed JSON packets

