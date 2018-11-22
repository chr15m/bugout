# Bugout API documentation

### Instantiation

Create a `Bugout` instance which will connect to other instances on the network using the same identifier. To connect to a server, use its address as the identifier.

```javascript
var Bugout = require("bugout");

var b = new Bugout(identifier);
```

Instead of a Bugout server address, `identifier` can be any string. All Bugout instances connecting to the same string `identifier` will join a p2p room where no particular peer is considered to be the server.

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

