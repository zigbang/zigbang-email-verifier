import { suite, test } from '@testdeck/jest';

import { verify } from "../src/index"

@suite
class TestSuite {

	@test(`should return "EXIST" data`)
	async someTest() {
		const host = "zigbang.com"
		const result = await verify({
			helo: host,
			from: `cs@${host}`,
			to: `cs@${host}`,
			debug: true,
			catchalltest: true,
			timeout: 5000
		})
		expect(result).toBe('EXIST');
	}

	@test(`INVALID to`)
	async invalid() {
		const result = await verify({
			helo: "zigbang.com",
			from: 'cs@zigbang.com',
			to: 'cs'
		})
		expect(result).toBe("INVALID")
	}

	// @test
	// async invalid2() {
	// 	const result = await verify({
	// 		helo: "zigbang.co",
	// 		from: 'cs@zigbang.co',
	// 		to: 'cs@zigbang.co'
	// 	})
	// 	expect(result).toBe("INVALID")
	// }
}

// INVALID
// MXRECORD_TIMEOUT
// MXRECORD_FAIL
// CATCH_ALL

// CONN_FAIL
// CONN_TIMEOUT
// VERIFY_TIMEOUT
// VERIFY_FAIL
// EXIST
// NOT_EXIST
// UNKNOWN
