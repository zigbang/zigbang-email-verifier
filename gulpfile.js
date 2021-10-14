const gulp = require("gulp");
const execute = require("child_process").exec;
const package = require("./package.json");
const writeJsonFile = require("write-json-file");

const exec = function (command) {
  return new Promise(function (resolve, reject) {
    execute(command, function (err, stdout, stderr) {
      if (err) {
        console.log(err);
        reject(err);
      } else {
        console.log("[end] command -> ", command);
        resolve(stdout);
      }
    });
  });
}

gulp.task("set-new-npm-version-prod", function (done) {
	exec("npm show zb-email-verifier | grep latest").then(function(result) {
		const latestVersion = result.match(/\d+\.\d+\.\d+/g)[0]
		const latestVersions = latestVersion.split(".")
		const packageVersions = package.version.split(".")

		let newMinorVersion = parseInt(latestVersions[1]) + 1
		const newFetchVersion = 0
		if (packageVersions[0] !== latestVersions[0]) {
			newMinorVersion = 0
		}

		const newVersion = `${packageVersions[0]}.${newMinorVersion}.${newFetchVersion}`
		package.version = newVersion

		writeJsonFile("package.json", package).then(done)
	})
});
  
gulp.task("set-new-npm-version-dev", function (done) {
	exec("npm show zb-email-verifier | grep latest").then(function(result) {
		const latestVersion = result.match(/\d+\.\d+\.\d+/g)[0]
		const latestVersions = latestVersion.split(".")
		const packageVersions = package.version.split(".")

		let newPatchVersion = parseInt(latestVersions[2]) + 1
		let newMinorVersion = latestVersions[1]
		if (packageVersions[0] !== latestVersions[0]) {
			newPatchVersion = 0
			newMinorVersion = 0
		}

		const newVersion = `${packageVersions[0]}.${newMinorVersion}.${newPatchVersion}`
		package.version = newVersion

		writeJsonFile("package.json", package).then(done)
	})
});
