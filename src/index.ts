import * as dns from "dns"
import _debug from "debug"
import _ from "lodash"
import randomstring from "randomstring"
import P from "bluebird"

import netsend, { Netsend } from "./netsend"

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
	let netConn: Netsend

	const mainJob = P.resolve((async () => {
		currentJob = "MXRECORD"
		const [, emailHost] = opts.to.split('@')
		const mx = await resolveMx(emailHost)

		currentJob = "CONN"
		netConn = await netsend({ port: 25, host: mx })

		currentJob = "VERIFY"
		return await verifySMTP(netConn, opts, emailHost)
	})())

	return new Promise<string>((resolve) => {
		(async () => {
			try {
				resolve(await mainJob)
			} catch (e) {
				resolve(e.message)
			} finally {
				if (netConn) netConn.end()
			}
		})()
		
		const timeout = opts.timeout ? opts.timeout : 5000
		setTimeout(() => {
			if (mainJob.isResolved()) return
			if (netConn) netConn.end()
			
			if (currentJob) return resolve(`${currentJob}_TIMEOUT`)
			return resolve('UNKNOWN_TIMEOUT')
		}, timeout)
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

async function verifySMTP(netConn: Netsend, opts: Options, emailHost: string) {
	try {
		debug('CONNECTED SMTP SERVER')

		let resmsg = await netConn.response()
		debug(resmsg[0])
		if (resmsg[0].substr(0, 3) !== '220') {
			throw new Error("VERIFY_FAIL")
		}

		// HELO
		let writeMsg = `HELO ${opts.helo}`
		debug(writeMsg);
		netConn.write(writeMsg)

		resmsg = await netConn.response()
		debug(resmsg[0])
		if (resmsg[0].substr(0, 3) !== '250') {
			throw new Error("VERIFY_FAIL")
		}

		// MAIL FROM
		writeMsg = `MAIL FROM: <${opts.from}>`
		debug(writeMsg);
		netConn.write(writeMsg)

		resmsg = await netConn.response()
		debug(resmsg[0])
		if (resmsg[0].substr(0, 3) !== '250') {
			throw new Error("VERIFY_FAIL")
		}

		// RCPT TO
		writeMsg = `RCPT TO: <${opts.to}>`
		debug(writeMsg)
		netConn.write(writeMsg)

		resmsg = await netConn.response()
		debug(resmsg[0])
		if (resmsg[0].substr(0, 3) === '250') {
			if (opts.catchalltest === true) {
				// RCPT TO
				debug('MAILBOX EXIST..CHECKING FOR CATCHALL')
				const writeMsg = `RCPT TO: <${generateRandomEmail(emailHost)}>`
				debug(writeMsg)
				netConn.write(writeMsg)

				resmsg = await netConn.response()
				if (resmsg[0].substr(0, 3) === '250') {
					return 'CATCH_ALL'
				} else {
					return 'EXIST'
				}
			} else {
				return 'EXIST'
			}
		} else {
			return 'NOT_EXIST'
		}
	} catch (e) {
		if (_debug.enabled(debug.namespace)) console.error(e)
		throw new Error("VERIFY_FAIL")
	} finally {
		netConn.end()
	}
}

function generateRandomEmail(emailHost: string) {
	return `${randomstring.generate(32)}@${emailHost}`
}

export function delay(ms: number) {
	return new Promise<void>(resolve => setTimeout(resolve, ms));
}
