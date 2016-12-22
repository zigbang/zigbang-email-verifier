# zb-email-verifier

## Install

```bash
npm install zb-email-verifier --save
```

## Usage
```javascript
const zbEmailVerifier = require('zb-email-verifier');

const helo = 'yourdomain.com';
const from = 'youremail@example.org';
const checkEmail = 'check@example.org';

zbEmailVerifier.verify({
  helo: helo,
  from: from,
  to: checkEmail,
  debug: false,
  timeout: 1500
}).then(result => {
  console.log(result);

  // INVALID - email regexp validation failed
  // EXIST - email is existence
  // NOT_EXIST - email is not existence

  // MXRECORD_TIMEOUT - resolve mx record timeout
  // MXRECORD_FAIL - resolve mx record fail
  // CONN_FAIL - connect fail smtp
  // CONN_TIMEOUT - connect timeout smtp
  // VERIFY_TIMEOUT
  // VERIFY_FAIL
  // UNKNOWN
});
```