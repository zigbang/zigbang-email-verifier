# zb-email-verifier

## Install

```bash
npm install zb-email-verifier --save
```

## Usage

```javascript
import { verify } from "zb-email-verifier"

const result = await verify({
	helo: "yourdomain.com",
	from: "youremail@example.org",
	to: "check@example.org",
	catchalltest: true,	// default false
	timeout: 1500		// default 5000
})

// INVALID - email regexp validation failed
// EXIST - email is exist
// NOT_EXIST - email does not exist
// CATCH_ALL - catch all smtp server

// MXRECORD_FAIL - resolve mx record fail
// MXRECORD_TIMEOUT - resolve mx record timeout
// CONN_FAIL - connect fail smtp
// CONN_TIMEOUT - connect timeout smtp
// VERIFY_FAIL
// VERIFY_TIMEOUT
// UNKNOWN
// UNKNOWN_TIMEOUT
```