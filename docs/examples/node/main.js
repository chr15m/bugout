var WebTorrent = require("webtorrent");
var Bugout = require("bugout");
var wrtc = require("wrtc");

var wt = new WebTorrent({tracker: {wrtc: wrtc}});

var b = Bugout({wt: wt});

// b.on("announce", console.log.bind(console, "Announced:"));
b.on("connections", console.log.bind(console, "Connections:"));
b.on("seen", console.log.bind(console, "Seen:"));
b.on("rpc", console.log.bind(console, "RPC:"));
b.on("message", console.log.bind(console, "Message:"));

// respond to ping calls by sending back "pong"
b.register("ping", function(pk, args, cb) {
  args["pong"] = true;
  cb(args);
}, "Respond to ping with 'pong'.");

console.log("Connect to this Bugout instance:\n");
console.log("https://chr15m.github.io/bugout/#" + b.address() + "\n");

console.log("Address:", b.address());
console.log("Seed:", b.seed);
console.log("Announcing to trackers...");

