import * as net from "net"
import _ from "lodash"
import * as _debug from "debug"

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
	return new Promise(async (resolve, reject) => {
		const responseQueue = new Queue()
		const client = net.createConnection(options)
		client.on("end", () => {
			debug("END")
		})
		client.on("data", ((data: Buffer) => {
			debug(`ADD\n  ${data.toString().split("\r\n").filter((value) => !_.isEmpty(value)).join("\r\n  ")}`)
			responseQueue.add(data.toString())
		}))
		client.on("error", (err) => {
			debug("ERROR")
			reject(err)
		})

		return resolve({
			write: (msg: string) => {
				debug(`WRITE\n  ${msg}`)
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
		this.debug(`ADD\n  ${msg.toString().split("\r\n").filter((value) => !_.isEmpty(value)).join("\r\n  ")}`)

		if (this.evtResolve) {
			this.evtResolve([msg])
			this.evtResolve = undefined
		} else {
			this.msgQueue.push(msg)
		}
	}

	flush(): Promise<string[]> {
		this.debug("FLUSH")

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
