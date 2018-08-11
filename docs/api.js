// demo server API

// respond to ping calls by sending back "pong"
b.register("ping", function(pk, args, cb) {
  args["pong"] = true;
  cb(args);
}, "Respond to ping with 'pong'.");
