<p align="center"><img src="docs/bugout-logo.svg"/></p>

Web service bug-out bag. **[Live demo](https://chr15m.github.io/bugout)**. **[Messageboard demo](https://chr15m.github.io/bugout/examples/messageboard.html)**.

 * Write servers that run in a browser tab.
 * Host backend services without a VPS, domain or SSL cert.
 * Easy to deploy & "self-hosted" servers by leaving a browser tab open.
 * Client-server over WebRTC instead of HTTPS.

### The old way:

<p align="center"><img src="docs/bugout-old-way.svg"/></p>

### The new way:

<p align="center"><img src="docs/bugout-new-way.svg"/></p>

[Bugout is a humble attempt to re-decentralize the web a little](https://chr15m.github.io/on-self-hosting-and-decentralized-software.html).

This is a functional prototype. It's pre-alpha quality software. It will allow people to connect directly to your browser from outside your network. Be careful.

[Demos](#demos) | [Install](#install) | [Use](#use) | [API documentation](./docs/API.md) | [Server boilerplate](#boilerplate) | [Deploy headless](#deploy)

## Demos

 * [Demo client](https://chr15m.github.io/bugout) (good for testing your server API).
 * [Demo server](https://chr15m.github.io/bugout/server.html).
 * Leave a message on the [message board demo](https://chr15m.github.io/bugout/examples/messageboard.html).
 * [Boilerplate single-page server code](https://github.com/chr15m/bugout/blob/master/docs/server-boilerplate.html).

## Install

Using npm:

```shell
npm i bugout
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

```javascript
var Bugout = require("bugout");
```

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

### Boilerplate

The [quick-start boilerplate server in a single HTML file](https://github.com/chr15m/bugout/blob/master/docs/server-boilerplate.html) will quickly get you up and running with your own Bugout server.

### Options

 * `wt` - a [WebTorrent instance](https://webtorrent.io/docs) to re-use. Pass this in if you're making connections to multiple Bugout channels.
 * `seed` - base58 encoded seed used to generate an [nacl signing key pair](https://github.com/dchest/tweetnacl-js#signatures).
 * `keyPair` - pass [nacl signing key pair](https://github.com/dchest/tweetnacl-js#signatures) directly rather than a seed.
 * `iceServers` - pass in custom STUN / TURN servers e.g.: `iceServers: [{urls: "stun:server.com:111"} ... ]`
 * `announce` - use custom announce trackers to introduce peers e.g. `["wss://tracker...", ...]`. Only peers using the same trackers will find eachother.

### Turn on debug logging

```javascript
localStorage.debug = "bugout";
```

## Deploy

Bugout servers can deployed and run inside of browser tabs on long running PCs but you can also deploy them "headless" more like traditional servers. There are a couple of ways of doing that as follows:

### Headless browser server

[Bugout launcher](https://github.com/chr15m/bugout-launcher) is a nodejs based helper script to launch and run your Bugout servers from the command line using a headless browser instance.

### Nodejs

Check out [the nodejs demo](./docs/examples/node/) for an example of running a Bugout service under Node. Note that the `wrtc` library is not that stable at the time of writing and running Bugout in headless Chrome or Firefox seems to work better. Bugout servers running inside nodejs obviously won't have access to browser facilities like localStorage.

## The FAMGA virus

> Infected with the [FAMGA](https://duckduckgo.com/?q=FAMGA) virus everybody's eating brains. Time to grab yr bugout box & hit the forest.

