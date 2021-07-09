import {
  defineTaskApi,
  defineAsyncApi,
  defineOnApi,
  API_CONNECT_SOCKET,
  API_TYPE_CONNECT_SOCKET,
  ConnectSocketProtocol,
  ConnectSocketOptions,
  API_SEND_SOCKET_MESSAGE,
  API_TYPE_SEND_SOCKET_MESSAGE,
  SendSocketMessageProtocol,
  API_CLOSE_SOCKET,
  API_TYPE_CLOSE_SOCKET,
  CloseSocketProtocol,
} from '@dcloudio/uni-api'
import { requireNativePlugin } from '../base'
import { base64ToArrayBuffer, arrayBufferToBase64 } from '@dcloudio/uni-api'
import { extend, capitalize } from '@vue/shared'
import { callOptions } from '@dcloudio/uni-shared'

type Socket = {
  send: ({
    data,
  }: {
    id: String
    data:
      | string
      | {
          '@type': String
          base64: String
        }
  }) => void
  close: ({ code, reason }: { code?: number; reason?: string }) => void
  onopen: Function
  onmessage: Function
  onerror: Function
  onclose: Function
  WebSocket: Function
}
type eventName = keyof WebSocketEventMap
const socketTasks: SocketTask[] = []
const globalEvent: Record<eventName, string> = {
  open: '',
  close: '',
  error: '',
  message: '',
}

let socket: Socket
export function createSocketTask(args: UniApp.ConnectSocketOption) {
  const socketId = String(Date.now())
  let errMsg
  try {
    if (!socket) {
      socket = requireNativePlugin('uni-webSocket')
    }
    socket.WebSocket({
      id: socketId,
      url: args.url,
      protocol: Array.isArray(args.protocols)
        ? args.protocols.join(',')
        : args.protocols,
      header: args.header,
    })
  } catch (error) {
    errMsg = error
  }
  return { socket, socketId, errMsg }
}

class SocketTask implements UniApp.SocketTask {
  private _callbacks: {
    open: Function[]
    close: Function[]
    error: Function[]
    message: Function[]
  }
  _socket: Socket
  id: string
  CLOSED: number
  CLOSING: number
  CONNECTING: number
  OPEN: number
  readyState: number
  constructor(socket: Socket, socketId: string) {
    this.id = socketId
    this._socket = socket
    this._callbacks = {
      open: [],
      close: [],
      error: [],
      message: [],
    }
    this.CLOSED = 3
    this.CLOSING = 2
    this.CONNECTING = 0
    this.OPEN = 1
    this.readyState = this.CLOSED

    if (!this._socket) return

    this._socket.onopen(() => {
      this.readyState = this.OPEN
      this.socketStateChange('open')
    })
    this._socket.onmessage((e: any) => {
      this.socketStateChange('message', {
        data:
          typeof e.data === 'object'
            ? base64ToArrayBuffer(e.data.base64)
            : e.data,
      })
    })
    this._socket.onerror(() => {
      this.socketStateChange('error')
      this.onErrorOrClose()
    })
    this._socket.onclose(() => {
      this.socketStateChange('close')
      this.onErrorOrClose()
    })
  }

  onErrorOrClose() {
    this.readyState = this.CLOSED
    const index = socketTasks.indexOf(this)
    if (index >= 0) {
      socketTasks.splice(index, 1)
    }
  }

  socketStateChange(name: eventName, res: Data = {}) {
    if (this === socketTasks[0] && globalEvent[name]) {
      UniServiceJSBridge.invokeOnCallback(globalEvent[name], res)
    }

    // WYQ fix: App平台修复websocket onOpen时发送数据报错的Bug
    this._callbacks[name].forEach((callback) => {
      if (typeof callback === 'function') {
        callback(name === 'message' ? res : {})
      }
    })
  }

  send(args: UniApp.SendSocketMessageOptions) {
    if (this.readyState !== this.OPEN) {
      callOptions(args, 'sendSocketMessage:fail WebSocket is not connected')
    }
    try {
      this._socket.send({
        id: this.id,
        data:
          typeof args.data === 'object'
            ? {
                '@type': 'binary',
                base64: arrayBufferToBase64(args.data),
              }
            : args.data,
      })
      callOptions(args, 'sendSocketMessage:ok')
    } catch (error) {
      callOptions(args, `sendSocketMessage:fail ${error}`)
    }
  }

  close(args: UniApp.CloseSocketOptions) {
    this.readyState = this.CLOSING
    try {
      this._socket.close(
        extend({
          id: this.id,
          args,
        })
      )
      callOptions(args, 'closeSocket:ok')
    } catch (error) {
      callOptions(args, `closeSocket:fail ${error}`)
    }
  }

  onOpen(callback: Function) {
    this._callbacks.open.push(callback)
  }

  onClose(callback: Function) {
    this._callbacks.close.push(callback)
  }

  onError(callback: Function) {
    this._callbacks.error.push(callback)
  }

  onMessage(callback: Function) {
    this._callbacks.message.push(callback)
  }
}

export const connectSocket = defineTaskApi<API_TYPE_CONNECT_SOCKET>(
  API_CONNECT_SOCKET,
  ({ url, protocols, header, method }, { resolve, reject }) => {
    const { socket, socketId, errMsg } = createSocketTask({
      url,
      protocols,
      header,
      method,
    })
    const socketTask = new SocketTask(socket, socketId)
    if (errMsg) {
      setTimeout(() => {
        reject(errMsg)
      }, 0)
    } else {
      socketTasks.push(socketTask)
    }
    setTimeout(() => {
      resolve()
    }, 0)
    return socketTask
  },
  ConnectSocketProtocol,
  ConnectSocketOptions
)

export const sendSocketMessage = defineAsyncApi<API_TYPE_SEND_SOCKET_MESSAGE>(
  API_SEND_SOCKET_MESSAGE,
  (args, { resolve, reject }) => {
    const socketTask = socketTasks[0]
    if (!socketTask || socketTask.readyState !== socketTask.OPEN) {
      reject('sendSocketMessage:fail WebSocket is not connected')
      return
    }
    socketTask.send({ data: args.data })
    resolve()
  },
  SendSocketMessageProtocol
)

export const closeSocket = defineAsyncApi<API_TYPE_CLOSE_SOCKET>(
  API_CLOSE_SOCKET,
  (args, { resolve, reject }) => {
    const socketTask = socketTasks[0]
    if (!socketTask) {
      reject('closeSocket:fail WebSocket is not connected')
      return
    }
    socketTask.readyState = socketTask.CLOSING
    const { code, reason } = args
    socketTask.close({ code, reason })
    resolve()
  },
  CloseSocketProtocol
)

function on(event: eventName) {
  const api = `onSocket${capitalize(event)}`
  return defineOnApi(api, () => {
    globalEvent[event] = api
  })
}

export const onSocketOpen = /*#__PURE__*/ on('open')

export const onSocketError = /*#__PURE__*/ on('error')

export const onSocketMessage = /*#__PURE__*/ on('message')

export const onSocketClose = /*#__PURE__*/ on('close')