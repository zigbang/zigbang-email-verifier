import * as net from "net"
import _ from "lodash"
import * as _debug from "debug"
import P from "bluebird"
P.config({ cancellation: true });

interface NetsendOptions {
	port: number
	host: string
}

export interface Netsend {
	
	write(msg: string): void
	end(): Promise<void>
	response(): Promise<string[]>
	
}

const debug = _debug.debug("netsend")

export default function netsend(options: NetsendOptions): Promise<Netsend> {
	return new P(async (resolve, reject, onCancel) => {
		const responseQueue = new Queue()
		const client = net.createConnection(options)
		client.on("end", () => {
			debug("onEnd()")
		})
		client.on("data", ((data: Buffer) => {
			debug(`onData()\n${data}`)
			responseQueue.add(data.toString())
		}))
		client.on("error", (err) => {
			debug("onError()")
			reject(err)
		})

		if (onCancel) onCancel(() => {
			debug("onCancel()")
			client.end();
			client.destroy()
		})

		return resolve({
			write: (msg: string) => {
				client.write(`${msg}\r\n`)
			},
			end: () => {
				return new Promise((resolve) => {
					client.end(() => resolve)
				})
			},
			response: () => {
				return responseQueue.flush()
			}
		})
	})
}

class Queue {

	private msgQueue: string[] = []
	private evtResolve: ((value?: string[] | PromiseLike<string[]> | undefined) => void) | undefined = undefined
	private debug = _debug.debug("queue")

	add(msg: string) {
		this.debug(`add() msg=${msg}`)

		if (this.evtResolve) {
			this.evtResolve([msg])
			this.evtResolve = undefined
		} else {
			this.msgQueue.push(msg)
		}
	}

	flush(): Promise<string[]> {
		this.debug("flush()")

		return new Promise((resolve) => {
			if (this.msgQueue.length) {
				const results = _.clone(this.msgQueue)
				this.msgQueue = []
				return resolve(results)
			}
			this.evtResolve = resolve
		})
	}

}
