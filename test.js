var test = require("tape");
var WebTorrent = require("webtorrent");
var Bugout = require("./index.js");

var wtest = new WebTorrent({dht: false, tracker: false});

test.onFinish(function() {
  wtest.destroy();
});

test('Instantiation', function (t) {
  t.plan(6);

  var b1 = new Bugout({seed: "BohNtZ24TrgMwZTLx9VDKtcZARNVuCt5tnecAAxYtTBC8pC61uGN", wt: wtest});
  t.equal(b1.identifier, "bYSkTy24xXJj6dWe79ZAQXKJZrn2n983SQ", "server identifier");
  t.equal(b1.pk, "CXENBY9X3x5TN1yjRyu1U1WkGuujuVBNiqxA16oAYbFo", "server public key");
  b1.torrent.on("infoHash", function() {
    t.equal(b1.torrent.infoHash, "28d878040b7d2f5215409373b415fb99bc0e6d88", "server infoHash");
  });

  try {
    var b2 = new Bugout({seed: "BohNtZ24TrgMwZTLx9VDLtcZARNVuCt5tnecAAxYtTBC8pC61uGN", wt: wtest});
  } catch(e) {
    t.equal(e.toString(), "Error: Invalid checksum", "invalid seed checksum");
  }
  
  var b3 = new Bugout("bMuHpwCxcD5vhC5u7VKuajYu5RU7FUnaGJ", {wt: wtest});
  t.equal(b3.identifier, "bMuHpwCxcD5vhC5u7VKuajYu5RU7FUnaGJ", "client identifier");
  b3.torrent.on("infoHash", function() {
    t.equal(b3.torrent.infoHash, "d96fe55834a62d86e48573c132345c01a38f5ffd", "client infoHash");
  });
});
