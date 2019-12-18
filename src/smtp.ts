import net from "net"
import _ from "lodash"
import debug from "debug"
import chalk from "chalk"
import WaitQueue from "wait-queue"

export interface SmtpClientOptions {
	host: string
	port?: number
}

export interface SmtpClientResponse {
	code: number
	message: string
}

export class SmtpClient {

	private client?: net.Socket

	private queue = new WaitQueue()

	private debug = debug.debug("smtp")

	constructor(private options: SmtpClientOptions) {
	}

	connect() {
		this.debug(`${chalk.bold.cyanBright("||")} connect`)

		const _options = {
			...this.options,
			port: this.options.port ?? 25
		}

		this.client = net.createConnection(_options)
		this.client.on("data", ((data: Buffer) => {
			this.queue.push(data.toString())
		}))
		this.client.on("end", () => {
			this.debug("END")
		})
		this.client.on("error", (err) => {
			this.debug("ERROR")
			if (this.debug.enabled) console.error(err)
		})

		return this.read()
	}

	close() {
		if (!this.client) return
		
		const _client = this.client
		this.client.end(() => { _client.destroy(); this.debug(`${chalk.bold.cyanBright("||")} closed`) })
		this.client = undefined
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

		this.debug(`${chalk.bold.blueBright(">>")} ${chalk.white(msg)}`)
		this.client.write(`${msg}\r\n`)

		return this.read()
	}

	private async read() {
		const line = await this.queue.shift() as string
		if (this.debug.enabled) {
			const indented = line.split("\r\n").filter((value) => !_.isEmpty(value)).join("\r\n   ")
			this.debug(`${chalk.bold.redBright("<<")} ${chalk.white(indented)}`)
		}
		const code = parseInt(line.substr(0, 3))
		const message = line.substr(4) // good enough for now
		return { code, message } as SmtpClientResponse
	}

}
