var WebTorrent = require("webtorrent");
var Bugout = require("../../index.js");
var wrtc = require("wrtc");

var wt = new WebTorrent({tracker: {wrtc: wrtc}});

var b = Bugout({wt: wt});

b.on("connections", console.log.bind(console, "connection"));
b.on("seen", console.log.bind(console, "seen"));
b.on("rpc", console.log.bind(console, "rpc"));
b.on("message", console.log.bind(console, "message"));

// respond to ping calls by sending back "pong"
b.register("ping", function(pk, args, cb) {
  args["pong"] = true;
  cb(args);
}, "Respond to ping with 'pong'.");

console.log("Address:", b.address());
console.log("Seed:", b.seed);

