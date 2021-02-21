# Bugout API documentation

## `Bugout(identifier, [options])`

Create a `Bugout` instance which will connect to other instances on the network using the same identifier. To connect to a server, use its address as the identifier.

```javascript
var Bugout = require("bugout");

var b = new Bugout(identifier);
```

The `identifier` can be a Bugout server address, or any other string. If a non-address string is passed, all Bugout instances connecting to the same `identifier` will join a p2p room where no particular peer is considered to be the server.

### `options`

The following can be passed as the second `opts` argument to `Bugout(identifier, opts)` to customize various properties of the connection.

 * `wt` - a [WebTorrent instance](https://webtorrent.io/docs) to re-use. Pass this in if you're making connections to multiple Bugout channels.
 * `wtOpts` - options that will be passed when [creating the WebTorrent object](https://github.com/webtorrent/webtorrent/blob/master/docs/api.md#client--new-webtorrentopts).
 * `torrent` - a torrent to extend with Bugout RPC / gossip extension. If provided a new torrent will not be created.
 * `torrentOpts` - options that will be passed to the [WebTorrent seed method](https://github.com/webtorrent/webtorrent/blob/master/docs/api.md#clientseedinput-opts-function-onseed-torrent-).
 * `seed` - base58 encoded seed used to generate an [nacl signing key pair](https://github.com/dchest/tweetnacl-js#signatures).
 * `keyPair` - pass [nacl signing key pair](https://github.com/dchest/tweetnacl-js#signatures) directly rather than a seed.
 * `heartbeat` - start a network heartbeat to update peer list at an interval specified in milliseconds. See `b.heartbeat()` docs below.

Shortcut options:

 * `iceServers` - pass in custom STUN / TURN servers e.g.: `iceServers: [{urls: "stun:server.com:111"} ... ]`. Shortcut for passing `{rtcConfig: {iceServers: [...]}}` to `wtOpts`.
 * `announce` - use custom announce trackers to introduce peers e.g. `["wss://tracker...", ...]`. Only peers using the same trackers will find eachother. Shortcut for passing `{announce: [...]}` to `torrentOpts`.

### Using your own signaling servers

By default Bugout uses the following set of WebTorrent wss trackers for signaling to introduce nodes to eachother:

 * wss://hub.bugout.link
 * wss://tracker.openwebtorrent.com
 * wss://tracker.btorrent.xyz

If you run your own tracker, or you just want to use a different tracker for signaling, you can pass it in via the `announce` option:

```
new Bugout(identifier, {"announce": [...my tracker wss URLs..]});
```

You can also pass it to the [WebTorrent `seed()`](https://github.com/webtorrent/webtorrent/blob/master/docs/api.md#clientseedinput-opts-function-onseed-torrent-) call via `torrentOpts`.

### Customising the ICE STUN / TURN server set

You can likewise pass `iceServers` in `opts` to customise the set of STUN / TURN servers used during the WebRTC negotiation, or you can pass the same values through `wtOpts`.

### Private torrents

One of the options you can pass to `torrentOpts` is `private: true` which will prevent the client from sharing the hash with the DHT and PEX.

## Methods

```javascript
b.address();
```

Get this Bugout instance's address. Other Bugout instances can connect to this instance by using it's address as the identifier during instantiation.

```javascript
b.register(callname, func, docstring);
```

Register an RPC call which remote Bugout instances can call on this instance using the `.rpc()` method below.

```javascript
b.rpc(address, callname, args, callback);
```

Make an RPC call on a remote Bugout instance. If `address` is omitted then the identifier address (server) is assumed. `arguments` can be any JSON representable data structure.

```javascript
b.send(address, message);
```

Send a generic JSON `message` to a particular bugout `address`. If only one argument is passed it is assumed to be the `message` and the `address` is assumed to be the channel identifier (server address).

```javascript
b.heartbeat(interval);
```

For applications which require an up-to-date list of connected peers, calling this function causes a periodic heartbeat to be sent out meaning the list is kept up to date. The default value for `interval` is 30 seconds.

```javascript
b.destroy(callback);
```

Cleans up dangling references and timers and calls `callback` when done. `.close()` is an alias for this method.

```javascript
b.on(eventname, callback);
```

Listen out for an event called `eventname`. Arguments to the `callback` will depend on the type of event. See below for a list of events.

```javascript
b.once(eventname, callback);
```

As per `.on()` but stops listening after the event has fired once.

## Events

### seen (address)

Fires whenever we make a connection with another Bugout instance. `address` is the remote instance's address.

### server (address)

Fires when a connection is made to a Bugout instance who's address specifically matches the `identifier` passed into the `Bugout(identifier)` instantiation. In other words, when a connection is made to some Bugout server.

### connections (count)

Fires when the number of connections (wires) into the network changes. Note that the number of connections may be different from the number of peers we see as some peers will be connected to indirectly through other peers.

### message (address, message, packet)

Fires when a generic message is recieved by a remote Bugout instance from a peer node.

### ping (address)

Fires when a remote Bugout instance send a ping message.

### left (address)

Fires when a remote Bugout instance leaves the server identifier/room.

### timeout (address)

Fires when a remote Bugout instance times out (requires `.heartbeat()` to be running).

### rpc (address, call, args, nonce)

Fires every time a remote RPC call is made against this Bugout instance.

### rpc-response (address, nonce, response)

Fires when an RPC response is sent out to a caller.

## Low level WebTorrent events

### wireleft (wirecount, wire)

Fired when a WebTorrent wire disconnects.

### wireseen (wirecount, wire)

Fired when a WebTorrent wire connects.

### torrent (identifier, torrent)

Fires when the torrent is first created.

### tracker (identifier, update)

Fires when a torrent tracker update occurs (e.g. new peers etc.).

### announce (identifier)

Fires when the Bugout instance successfully announces itself on a tracker.

