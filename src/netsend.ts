import * as net from "net"
import _ from "lodash"
import * as _debug from "debug"
import chalk from "chalk"

export interface SmtpClientOptions {
	port: number
	host: string
}

export class SmtpClient {

	private client?: net.Socket

	private responseQueue = new Queue()

	private debug = _debug.debug("smtp")

	constructor(private options: SmtpClientOptions) {
	}

	connect() {
		this.client = net.createConnection(this.options)
		this.client.on("data", ((data: Buffer) => {
			this.responseQueue.add(data.toString())
		}))
		this.client.on("end", () => {
			this.debug("END client")
		})
		this.client.on("error", (err) => {
			this.debug("ERROR")
			if (this.debug.enabled) console.error(err)
		})

		return this.response()
	}

	close() {
		this.debug("END netsend")
		if (this.client) {
			const client = this.client
			this.client.end(() => client.destroy())
			this.client = undefined
		}
	}

	async helo(value: string) {
		return this.write(`HELO ${value}`)
	}

	async from(value: string) {
		return this.write(`MAIL FROM: <${value}>`)
	}

	async to(value: string) {
		return this.write(`RCPT TO: <${value}>`)
	}

	private async write(msg: string) {
		if (!this.client) throw new Error(`client is null`)

		this.debug(`WRITE ${chalk.red(msg)}`)
		this.client.write(`${msg}\r\n`)

		return this.response()
	}

	private async response() {
		const line = await this.responseQueue.flush()
		if (this.debug.enabled) {
			const indented = line.split("\r\n").filter((value) => !_.isEmpty(value)).join("\r\n  ")
			this.debug(`RESPONSE\n  ${chalk.red(indented)}`)
		}
		const code = line.substr(0, 3)
		const message = line.substr(4)
		return { code, message }
	}

}

class Queue {

	private msgQueue: string[] = []
	private evtResolve: ((value?: string | PromiseLike<string> | undefined) => void) | undefined = undefined
	private debug = _debug.debug("queue")

	add(msg: string) {
		this.debug(`ADD\n  ${msg.toString().split("\r\n").filter((value) => !_.isEmpty(value)).join("\r\n  ")}`)

		if (this.evtResolve) {
			this.evtResolve(msg)
			this.evtResolve = undefined
		} else {
			this.msgQueue.push(msg)
		}
	}

	flush(): Promise<string> {
		this.debug("FLUSH")

		return new Promise((resolve) => {
			if (this.msgQueue.length) {
				const results = _.clone(this.msgQueue)
				this.msgQueue = []
				return resolve(`${results[0]}`)
			}
			this.evtResolve = resolve
		})
	}

}
