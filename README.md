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
  // INVALID
// MXRECORD_TIMEOUT
// MXRECORD_FAIL
// CONN_FAIL
// CONN_TIMEOUT
// VERIFY_TIMEOUT
// VERIFY_FAIL
// EXIST
// NOT_EXIST
// UNKNOWN
});
```