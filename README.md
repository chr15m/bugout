<p align="center"><img src="docs/bugout-logo.svg"/></p>

Build back-end web services that **run in a browser tab**, and:

 * Don't require a domain name.
 * Don't require an SSL certificate.
 * Can be reached by other browsers via WebRTC.
 * Can be deployed by users by simply opening a browser tab.

Bugout is a small attempt to re-decentralize the web.

This is a functional prototype. It's pre-alpha quality software. Be careful.

### Quick start

Try the [demo server](https://chr15m.github.io/bugout/) and [client](https://chr15m.github.io/bugout/client.html) to get started.

### How to use it

To create a server in a tab:

```javascript
var b = new Bugout();

// register an API call the remote user can make
b.register("ping", function(pk, args, callback) {
  // modify the message and reply
  args.hello = "Hello from " + b.pk;
  callback(message);
});

// save this server's session key seed to re-use
localStorage["bugout-seed"] = b.seed;

// passing this back in to Bugout() means the
// server-public-key stays the same between reloads
// for example:
// b = new Bugout({seed: localStorage["bugout-seed"]});
```

To start a client connection specify the server's public key to connect to:

```javascript
var b = new Bugout("server-public-key");

// wait to seen the server's pk
// (can take a minute to tunnel through firewalls etc.)
b.on("server", function(pk) {
  // once we can see the server
  // make an API call on it
  b.rpc("ping", {"hello": "world"}, function(result) {
    console.log(result);
    // {"hello": "world", "pong": true}
    // also check result.error
  });
});

// save this client instance's session key seed to re-use
localStorage["bugout-seed"] = JSON.stringify(b.seed);
```

Both clients and servers can interact with other connected peers:

```javascript
// receive all out-of-band messages from the server
// or from another client
b.on("message", function(pk, message) {
  console.log("message from", pk, "is", message);
});

// broadcast an unecrypted message to all connected peers
b.send({"hello": "all!"});

// send an encrypted message to a specific peer
b.send(some-pk, "Hello!");

// whenever we see a new peer in this group
b.on("seen", function(pk) {
  // e.g. send a message to the peer we've seen with this pk
});

// you can also close a bugout channel to stop receiving messages etc.
b.close();
```

Note that you can connect to a generic group without a server by simply using a non-public-key identifier which can be any string as long as it's the same for every client connecting:

```javascript
var b = new Bugout("some shared group identifier");
```

### Options

 * `wt` - a [WebTorrent instance](https://webtorrent.io/docs) to re-use. Pass this in if you're making connections to multiple Bugout channels.
 * `seed` - bs58 encoded seed used to generate an [nacl signing key pair](https://github.com/dchest/tweetnacl-js#signatures).
 * `keyPair` - pass [nacl signing key pair](https://github.com/dchest/tweetnacl-js#signatures) directly rather than a seed.
 * `iceServers` - pass in custom STUN / TURN servers e.g.: `iceServers: [{urls: "stun:stun.l.google.com:19305"} ... ]`

### Turn on debug logging

```javascript
localStorage.debug = "bugout";
```
