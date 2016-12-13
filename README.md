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
  debug: false
}).then(result => {
  console.log(result);
  // EXIST
  // NOT_EXIST
  // INVALID
  // BLOCK
});
```