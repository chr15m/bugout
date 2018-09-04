<p align="center"><img src="docs/bugout-logo.svg"/></p>

Build back-end web services that **run in a browser tab**. **[Live demo](https://chr15m.github.io/bugout)**.

 * Host backend services without a VPS, domain or SSL cert.
 * Anyone can deploy by simply opening a browser tab.
 * Can be "self-hosted" by leaving a browser tab open on a PC.
 * Client-server over WebRTC instead of HTTPS.

### The old way:

<p align="center"><img src="docs/bugout-old-way.svg"/></p>

### The new way:

<p align="center"><img src="docs/bugout-new-way.svg"/></p>

[Bugout is a humble attempt to re-decentralize the web a little](https://chr15m.github.io/on-self-hosting-and-decentralized-software.html).

This is a functional prototype. It's pre-alpha quality software. Be careful.

Try the [demo](https://chr15m.github.io/bugout), leave a message on the [message board demo](https://chr15m.github.io/bugout/examples/messageboard.html), or [run you own server-in-a-tab](https://chr15m.github.io/bugout/server.html).

## Install

Using npm:

```shell
npm i chr15m/bugout
```

Script tag:

```html
<script src="https://chr15m.github.io/bugout/bugout.min.js"></script>
```

Clojurescript:

```clojure
:install-deps false
:npm-deps {"bugout" "chr15m/bugout"}
:foreign-libs [{:file "node_modules/bugout/docs/bugout.min.js"
		:provides ["cljsjs.bugout"]
		:global-exports {cljsjs.bugout Bugout}}]

(:require [cljsjs.bugout :as Bugout])
```

## Use

To create a Bugout server that runs in a browser tab:

```javascript
var b = new Bugout();

// get the server address (public key hash) to share with clients
// this is what clients will use to connect back to this server
alert(b.address());

// register an API call the remote user can make
b.register("ping", function(address, args, callback) {
  // modify the passed arguments and reply
  args.hello = "Hello from " + b.address();
  callback(message);
});

// save this server's session key seed to re-use
localStorage["bugout-server-seed"] = b.seed;

// passing this back in to Bugout() means the
// server-public-key stays the same between reloads
// for example:
// b = new Bugout({seed: localStorage["bugout-server-seed"]});
```

To start a client connection specify the server's public key to connect to (`b.address()` from the server):

```javascript
var b = new Bugout("server-public-key");

// wait until we see the server
// (can take a minute to tunnel through firewalls etc.)
b.on("server", function(address) {
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
b.on("message", function(address, message) {
  console.log("message from", address, "is", message);
});

// broadcast an unecrypted message to all connected clients
b.send({"hello": "all!"});

// send an encrypted message to a specific client
b.send(clientaddress, "Hello!");

// whenever we see a new client in this swarm
b.on("seen", function(address) {
  // e.g. send a message to the client we've seen with this address
});

// you can also close a bugout channel to stop receiving messages etc.
b.close();
```

Note that you can connect to a generic peer-to-peer swarm without a server by simply using a non-public-key identifier which can be any string as long as it's the same for every client connecting:

```javascript
var b = new Bugout("some shared swarm identifier");
```

### Options

 * `wt` - a [WebTorrent instance](https://webtorrent.io/docs) to re-use. Pass this in if you're making connections to multiple Bugout channels.
 * `seed` - base58 encoded seed used to generate an [nacl signing key pair](https://github.com/dchest/tweetnacl-js#signatures).
 * `keyPair` - pass [nacl signing key pair](https://github.com/dchest/tweetnacl-js#signatures) directly rather than a seed.
 * `iceServers` - pass in custom STUN / TURN servers e.g.: `iceServers: [{urls: "stun:server.com:111"} ... ]`
 * `announce` - use custom announce trackers to introduce peers. Only peers using the same trackers will find eachother.

### Turn on debug logging

```javascript
localStorage.debug = "bugout";
```

### The FAMGA virus

> Infected with the [FAMGA](https://duckduckgo.com/?q=FAMGA) virus everybody's eating brains. Time to grab yr bugout box & hit the forest.

