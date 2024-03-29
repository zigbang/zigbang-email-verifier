import dns from "dns"
import _debug from "debug"
import _ from "lodash"
import randomstring from "randomstring"
import P from "bluebird"

import { SmtpClient, SmtpClientResponse } from "./smtp"

const debug = _debug.debug("email-verifier")

type ResponseType = "simple" | "reason"

export interface Options {
	helo: string
	from: string
	to: string
	catchalltest?: boolean
	timeout?: number
	responseType?: ResponseType
}

export interface VerifyResult {

	/**
	 * result code, ie. INVALID, EXIST, etc
	 */
	resultCode: string

	/**
	 * reason for failure
	 */
	reason?: string
}

/**
 * Error for verify failure 
 *
 * ```ts
 * catch (e) {
 *     throw new VerifyError("RESULT_CODE", e.message)
 * }
 * ```
 */
class VerifyError extends Error {
	public resultCode: string
	public reason: string

	constructor(message: string, reason: string) {
		super(message)
		this.resultCode = message
		this.reason = reason

		// prototype needs to be explicitly set when targeting es3/es5
		Object.setPrototypeOf(this, VerifyError.prototype)
	}
}

export async function verify(opts: Options): Promise<string | VerifyResult> {
	const responseType = opts.responseType ?? "simple"

	const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
	if (!emailRegex.test(opts.to)) {
		return makeResponse(responseType, { resultCode: "INVALID" })
	}

	let currentJob: string
	let client: SmtpClient
	let timedout = false

	const mainJob = P.resolve((async () => {
		const timedoutResult = makeResponse(responseType, { resultCode: "UNKNOWN_TIMEOUT" })

		const [, emailHost] = opts.to.split('@')
		if (timedout) return timedoutResult
		currentJob = "MXRECORD"
		const host = await resolveMx(emailHost)

		if (timedout) return timedoutResult
		currentJob = "CONN"
		client = new SmtpClient({ host })

		if (timedout) return timedoutResult
		currentJob = "VERIFY"

		const result = await verifySMTP(client, opts, emailHost)
		return makeResponse(responseType, result)
	})())

	return new Promise<string | VerifyResult>((resolve) => {
		const timeout = opts.timeout ? opts.timeout : 5000
		setTimeout(() => {
			debug("TIMEOUT")
			timedout = true
			if (mainJob.isResolved()) return
			if (client) client.close()
			
			if (currentJob) {
				return resolve(makeResponse(responseType, { resultCode: `${currentJob}_TIMEOUT` }))
			}
			return resolve(makeResponse(responseType, { resultCode: "UNKNOWN_TIMEOUT" }))
		}, timeout);

		(async () => {
			try {
				resolve(await mainJob)
			} catch (e) {
				if (e instanceof VerifyError) {
					resolve(makeResponse(responseType, {
						resultCode: e.resultCode,
						reason: e.reason
					}))
				} else {
					resolve(makeResponse(responseType, {
						resultCode: e.message
					}))
				}
			} finally {
				if (client) client.close()
			}
		})()
	})
}

async function resolveMx(emailHost: string) {
	debug('RESOLVE MX RECORD')
	let results: dns.MxRecord[]
	try {
		const dnsResolveMx = P.promisify(dns.resolveMx, { context: dns });
		results = await dnsResolveMx(emailHost)
		if (_.isEmpty(results)) {
			throw new VerifyError("MXRECORD_FAIL", `failed to dns resolve mx record for ${emailHost}`)
		}
	} catch (e) {
		if (_debug.enabled(debug.namespace)) console.error(e)
		throw new VerifyError("MXRECORD_FAIL", e.message)
	}

	const exchange = _(results).sortBy(v => v.priority).take(1).value()[0].exchange;
	debug(exchange)
	return exchange
}

async function verifySMTP(netConn: SmtpClient, opts: Options, emailHost: string): Promise<VerifyResult> {
	debug('VERIFY USING SMTP')
	try {
		const ensure = async (promise: Promise<SmtpClientResponse>, value: number) => {
			const response = await promise
			if (response.code !== value) throw new Error(JSON.stringify(response))
			return response
		}

		await ensure(netConn.connect(), 220)
		await ensure(netConn.helo(opts.helo), 250)
		await ensure(netConn.from(opts.from), 250)
		
		const response = await netConn.to(opts.to)
		if (response.code !== 250) {
			return {
				resultCode: "NOT_EXIST",
			}
		}

		if (opts.catchalltest === true) {
			debug('MAILBOX EXIST..CHECKING FOR CATCHALL')
			const randomEmail = `${randomstring.generate(32)}@${emailHost}`
			const response = await netConn.to(randomEmail)
			if (response.code === 250) {
				return {
					resultCode: "CATCH_ALL"
				}
			}
		}

		return {
			resultCode: "EXIST",
		}
	} catch (e) {
		if (_debug.enabled(debug.namespace)) console.error(e)
		throw new VerifyError("VERIFY_FAIL", e.message)
	} finally {
		netConn.close()
	}
}

export function delay(ms: number) {
	return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function makeResponse(responseType: ResponseType, result: VerifyResult) {
	switch (responseType) {
		case "simple":
			return result.resultCode
		case "reason":
			return result
		default:
			throw new Error("no such reasponse type")
	}
}
