import * as dns from "dns"
import _debug from "debug"
import _ from "lodash"
import randomstring from "randomstring"
import P from "bluebird"

import { SmtpClient, SmtpClientResponse } from "./smtp"

const debug = _debug.debug("email-verifier")

export interface Options {
	helo: string
	from: string
	to: string
	catchalltest?: boolean
	timeout?: number
}

export async function verify(opts: Options) {
	const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
	if (!emailRegex.test(opts.to)) {
		return "INVALID"
	}

	let currentJob: string
	let netConn: SmtpClient
	let timedout = false

	const mainJob = P.resolve((async () => {
		const [, emailHost] = opts.to.split('@')
		if (timedout) return
		currentJob = "MXRECORD"
		const mx = await resolveMx(emailHost)

		if (timedout) return
		currentJob = "CONN"
		netConn = new SmtpClient({ port: 25, host: mx })

		if (timedout) return
		currentJob = "VERIFY"
		return await verifySMTP(netConn, opts, emailHost)
	})())

	return new Promise<string>((resolve) => {
		const timeout = opts.timeout ? opts.timeout : 5000
		setTimeout(() => {
			debug("TIMEOUT")
			timedout = true
			if (mainJob.isResolved()) return
			if (netConn) netConn.close()
			
			if (currentJob) return resolve(`${currentJob}_TIMEOUT`)
			return resolve('UNKNOWN_TIMEOUT')
		}, timeout);

		(async () => {
			try {
				resolve(await mainJob)
			} catch (e) {
				resolve(e.message)
			} finally {
				if (netConn) netConn.close()
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
			throw new Error("MXRECORD_FAIL")
		}
	} catch (e) {
		if (_debug.enabled(debug.namespace)) console.error(e)
		throw new Error("MXRECORD_FAIL")
	}

	const exchange = _(results).sortBy(v => v.priority).take(1).value()[0].exchange;
	debug(exchange)
	return exchange
}

async function verifySMTP(netConn: SmtpClient, opts: Options, emailHost: string) {
	debug('VERIFY USING SMTP')
	try {
		const ensure = async (promise: Promise<SmtpClientResponse>, value: number) => {
			const response = await promise
			if (response.code !== value) throw new Error("VERIFY_FAIL")
			return response
		}

		await ensure(netConn.connect(), 220)
		await ensure(netConn.helo(opts.helo), 250)
		await ensure(netConn.from(opts.from), 250)
		
		const response = await netConn.to(opts.to)
		if (response.code !== 250) return "NOT_EXIST"

		if (opts.catchalltest === true) {
			debug('MAILBOX EXIST..CHECKING FOR CATCHALL')
			const randomEmail = `${randomstring.generate(32)}@${emailHost}`
			const response = await netConn.to(randomEmail)
			if (response.code === 250) return "CATCH_ALL"
		}
		return "EXIST"
	} catch (e) {
		if (_debug.enabled(debug.namespace)) console.error(e)
		throw new Error("VERIFY_FAIL")
	} finally {
		netConn.close()
	}
}

export function delay(ms: number) {
	return new Promise<void>(resolve => setTimeout(resolve, ms));
}
