import * as dns from "dns"
import _debug from "debug"
import _ from "lodash"
import randomstring from "randomstring"
import P from "bluebird"
P.config({ cancellation: true })

import netsend, { Netsend } from "./netsend"

const debug = _debug.debug("email-verifier")

export interface Options {
	helo: string
	from: string
	to: string
	debug?: boolean
	catchalltest?: boolean
	timeout?: number
}

export async function verify(opts: Options) {
	const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/; // eslint-disable-line
	if (!emailRegex.test(opts.to)) {
		return "INVALID"
	}

	const emailSplited = opts.to.split('@')
	const emailHost = emailSplited[1]
	const timeout = opts.timeout ? opts.timeout : 5000

	let jobDnsResolveMx: P<string>
	let jobNetConnect: P<Netsend>
	let jobVerify: P<string>

	const mainJob2 = (async () => {
		jobDnsResolveMx = P.resolve(resolveMx(emailHost))
		const exchange = await jobDnsResolveMx
	
		let netConn: Netsend
		try {
			jobNetConnect = P.resolve(netsend({ port: 25, host: exchange }))
			netConn = await jobNetConnect
		} catch (e) {
			return "CONN_FAIL"
		}
		
		jobVerify = P.resolve(verifySMTP(netConn, opts, emailHost))
		return jobVerify
	})()

	return new Promise((resolve) => {
		const mainJob = P.resolve(mainJob2).then(results => {
			resolve(results)
		}).catch((err) => {
			resolve(err.extra)
		})

		setTimeout(() => {
			const resolved = mainJob.isResolved()
			debug(`TIMED OUT resolved=${resolved}`)
			if (resolved) return

			if (jobDnsResolveMx && jobDnsResolveMx.isPending()) {
				return resolve('MXRECORD_TIMEOUT')
			}

			if (jobNetConnect && jobNetConnect.isPending()) {
				jobNetConnect.cancel()
				return resolve('CONN_TIMEOUT')
			}

			if (jobVerify && jobVerify.isPending()) {
				return resolve('VERIFY_TIMEOUT')
			}

			return resolve('UNKNOWN')
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
			throw new VerifyError('', 'MXRECORD_FAIL')
		}
	} catch (e) {
		throw new VerifyError('', 'MXRECORD_FAIL')
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
			throw new VerifyError("", "VERIFY_FAIL")
		}

		// HELO
		let writeMsg = `HELO ${opts.helo}`
		debug(writeMsg);
		netConn.write(writeMsg)

		resmsg = await netConn.response()
		debug(resmsg[0])
		if (resmsg[0].substr(0, 3) !== '250') {
			throw new VerifyError("", "VERIFY_FAIL")
		}

		// MAIL FROM
		writeMsg = `MAIL FROM: <${opts.from}>`
		debug(writeMsg);
		netConn.write(writeMsg)

		resmsg = await netConn.response()
		debug(resmsg[0])
		if (resmsg[0].substr(0, 3) !== '250') {
			throw new VerifyError("", "VERIFY_FAIL")
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
	} finally {
		netConn.end()
	}
}

class VerifyError extends Error {

	extra?: string

	constructor(message: string, extra?: string) {
		super();
		
		Error.captureStackTrace(this, this.constructor)
		this.name = 'CustomError'
		this.message = message
		this.extra = extra
	}
	
}

function generateRandomEmail(emailHost: string) {
	return `${randomstring.generate(32)}@${emailHost}`
}

function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}
