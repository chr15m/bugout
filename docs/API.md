# Bugout API documentation

### Instantiation

Create a `Bugout` instance which will connect to other instances on the network using the same identifier. To connect to a server, use its address as the identifier.

```javascript
var Bugout = require("bugout");

var b = new Bugout(identifier);
```

### b.address();

Get this Bugout instance's address. Other Bugout instances can connect to this instance by using it's address as the identifier during instantiation.

### b.register(callname, function, docstring);

Register an RPC call which remote Bugout instances can call on this instance using the `.rpc()` method below.

### b.rpc(address, callname, arguments, callback);

Make an RPC call on a remote Bugout instance. If address is omitted then the identifier address (server) is assumed. `arguments` can be any JSON representable data structure.

### b.send(address, message);

Send a generic JSON message to 

### b.heartbeat(interval);

For applications which require an up-to-date list of connected peers, calling this functino causes a periodic heartbeat to be sent out meaning the list is kept up to date. The default value for `interval` is 30 seconds.

### b.destroy(callback);

Cleans up dangling references and timers and calls `callback` when done. `.close()` is an alias for this method.

### b.on(eventname, callback);

Listen out for an event called `eventname`. Arguments to the `callback` will depend on the type of event. See below for a list of events.

### b.once(eventname, callback);

As per `.on()` but stops listening after the event has fired once.

## Events

### seen (address)

Fires whenever we make a connection with another Bugout instance. `address` is the remote instance's address.

### server (address)

Fires when a connection is made to a Bugout instance who's address specifically matches the `identifier` passed into the `Bugout(identifier)` instantiation. In other words when a connection is made to some Bugout server.

### connections (count)

Fires when the number of connections (wires) into the network changes.

### message (address, message, packet)

Fires when a generic message is recieved by a remote Bugout instance.

### ping (address)

Fires when a remote Bugout instance send a ping message.

### left (address)

Fires when a remote Bugout instance leaves the identifier room.

### timeout (address)

Fires when a remote Bugout instance times out (requires `.heartbeat()` to be running).

### rpc (address, call, args, nonce)

Fires when a remote RPC call is made against this Bugout instance.

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

