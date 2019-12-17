module.exports = {
	rootDir: '.',
	preset: 'ts-jest',
	testMatch: ['<rootDir>/test/**/*.ts'],
	coverageThreshold: {
		global: {
			branches: 0,
			functions: 0,
			lines: 0,
			statements: 0
		}
	},
	collectCoverage: true,
	coverageReporters: ["html"]
}
