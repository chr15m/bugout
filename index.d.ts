declare module 'bugout' {
    type BugoutOpts = {
        announce?: string[]
    }

    type SeenCallBack = (address: string) => void
    type ServerCallback = (address: string) => void
    type ConnectionsCallback = (count: number) => void
    type MessageCallback = (address: string, message: Record<string, unknown>, packet: Record<string, unknown>) => void
    type PingCallback = (address: string) => void
    type LeftCallback = (address: string) => void
    type TimeoutCallback = (address: string) => void
    type RPCCallback = (address: string, callback: (...any) => void) => void
    type RPCResponseCallBack = (address: string, none: string, response: Record<string, unknown>) => void

    type EventCallbacks =
      | SeenCallBack
      | ServerCallback
      | ConnectionsCallback
      | MessageCallback
      | PingCallback
      | LeftCallback
      | TimeoutCallback
      | RPCCallback
      | RPCResponseCallBack

    class Bugout {
        constructor(identifier: string, opts: BugoutOpts)
        address(): string
        register(callName: string, func: Function, docString: string): void
        rpc(address: string, callName: string, args: Array<Record<string, unknown>>, callback: () => void)
        send(address: string, message: string): void
        send(message: string): void
        heartbeat(milliseconds: number): void
        destroy(callback?: () => void): void
        on<CallbackType extends EventCallbacks>(eventName: string, callback: CallbackType)
    }
    export default Bugout
    export {
        Bugout,
        BugoutOpts,
        SeenCallBack,
        ServerCallback,
        ConnectionsCallback,
        MessageCallback,
        PingCallback,
        LeftCallback,
        TimeoutCallback,
        RPCCallback,
        RPCResponseCallBack,
    }
}
