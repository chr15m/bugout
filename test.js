var test = require("tape");
var WebTorrent = require("webtorrent");
var Bugout = require("./index.js");

var wtest = new WebTorrent({dht: false, tracker: false});

test.onFinish(function() {
  wtest.destroy();
});

test('Testing instantiation', function (t) {
  t.plan(4);

  var b = new Bugout({seed: "BohNtZ24TrgMwZTLx9VDKtcZARNVuCt5tnecAAxYtTBC8pC61uGN", wt: wtest});
  t.equal(b.identifier, "bYSkTy24xXJj6dWe79ZAQXKJZrn2n983SQ", "identifier");
  t.equal(b.pk, "CXENBY9X3x5TN1yjRyu1U1WkGuujuVBNiqxA16oAYbFo", "public key");
  b.torrent.on("infoHash", function() {
    t.equal(b.torrent.infoHash, "28d878040b7d2f5215409373b415fb99bc0e6d88", "infoHash");
  });

  try {
    var b = new Bugout({seed: "BohNtZ24TrgMwZTLx9VDLtcZARNVuCt5tnecAAxYtTBC8pC61uGN", wt: wtest});
  } catch(e) {
    t.equal(e.toString(), "Error: Invalid checksum", "invalid seed checksum");
  }
})
