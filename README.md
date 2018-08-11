<p align="center"><img src="docs/bugout-logo.svg"/></p>

Build back-end web services that **run in a browser tab**, and:

 * Don't require a domain name.
 * Don't require an SSL certificate.
 * Can be reached by other browsers via WebRTC.
 * Can be deployed by users by simply opening a browser tab.
 * Can be "self-hosted" by users by leaving a browser tab open on a PC.

### The old way:

<p align="center"><img src="docs/bugout-old-way.svg"/></p>

### The new way:

<p align="center"><img src="docs/bugout-new-way.svg"/></p>

Bugout is a small attempt to re-decentralize the web.

This is a functional prototype. It's pre-alpha quality software. Be careful.

## Quick start

Try the [demo server](https://chr15m.github.io/bugout/) and [client](https://chr15m.github.io/bugout/client.html) to get started.

## API

To create a server in a tab:

```javascript
var b = new Bugout();

// get the server address (public key) to share with clients
alert(b.pk);

// register an API call the remote user can make
b.register("ping", function(pk, args, callback) {
  // modify the passed arguments and reply
  args.hello = "Hello from " + b.pk;
  callback(message);
});

// save this server's session key seed to re-use
localStorage["bugout-server-seed"] = b.seed;

// passing this back in to Bugout() means the
// server-public-key stays the same between reloads
// for example:
// b = new Bugout({seed: localStorage["bugout-server-seed"]});
```

To start a client connection specify the server's public key to connect to:

```javascript
var b = new Bugout("server-public-key");

// wait until we see the server
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

Both clients and servers can interact with other connected clients:

```javascript
// receive all out-of-band messages from the server
// or from any other another connected client
b.on("message", function(pk, message) {
  console.log("message from", pk, "is", message);
});

// broadcast an unecrypted message to all connected clients
b.send({"hello": "all!"});

// send an encrypted message to a specific client
b.send(clientpk, "Hello!");

// whenever we see a new client in this group
b.on("seen", function(pk) {
  // e.g. send a message to the client we've seen with this pk
});

// you can also close a bugout channel to stop receiving messages etc.
b.close();
```

Note that you can connect to a generic peer-to-peer group without a server by simply using a non-public-key identifier which can be any string as long as it's the same for every client connecting:

```javascript
var b = new Bugout("some shared group identifier");
```

### Options

 * `wt` - a [WebTorrent instance](https://webtorrent.io/docs) to re-use. Pass this in if you're making connections to multiple Bugout channels.
 * `seed` - base58 encoded seed used to generate an [nacl signing key pair](https://github.com/dchest/tweetnacl-js#signatures).
 * `keyPair` - pass [nacl signing key pair](https://github.com/dchest/tweetnacl-js#signatures) directly rather than a seed.
 * `iceServers` - pass in custom STUN / TURN servers e.g.: `iceServers: [{urls: "stun:server.com:111"} ... ]`

### Turn on debug logging

```javascript
localStorage.debug = "bugout";
```
