import { suite, test } from '@testdeck/jest'

import { verify } from "../src/index"

@suite
class TestSuite {

	@test("EXIST")
	async valid() {
		const host = "zigbang.com"
		const result = await verify({
			helo: host,
			from: `cs@${host}`,
			to: `cs@${host}`
		})
		expect(result).toBe('EXIST')
	}

	@test("EXIST with catchall")
	async validWithCatchall() {
		const host = "zigbang.com"
		const result = await verify({
			helo: host,
			from: `cs@${host}`,
			to: `cs@${host}`,
			catchalltest: true
		})
		expect(result).toBe('EXIST')
	}

	@test(`INVALID to`)
	async invalid() {
		const host = "zigbang.com"
		const result = await verify({
			helo: host,
			from: `invalid@${host}`,
			to: `invalid`
		})
		expect(result).toBe('INVALID')
	}

	@test("MXRECORD_FAIL invalid host")
	async invalid2() {
		const host = "invalidhost.dotcom"
		const result = await verify({
			helo: host,
			from: `invalid@${host}`,
			to: `invalid@${host}`
		})
		expect(result).toBe("MXRECORD_FAIL")
	}

	@test("MXRECORD_TIMEOUT")
	async timeout() {
		const host = "zigbang.com"
		const result = await verify({
			helo: host,
			from: `invalid@${host}`,
			to: `invalid@${host}`,
			timeout: 1
		})
		expect(result).toBe("MXRECORD_TIMEOUT")
	}

	@test("VERIFY_TIMEOUT")
	async timeout2() {
		const host = "zigbang.com"
		const result = await verify({
			helo: host,
			from: `invalid@${host}`,
			to: `invalid@${host}`,
			timeout: 100	// not a good method thou
		})
		expect(result).toBe("VERIFY_TIMEOUT")
	}
}
