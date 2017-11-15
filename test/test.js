'use strict';

const zbEmailVerifier = require('./../index');

describe('#verify()', function() {
  it('should return "EXIST" data', function(done) {
    zbEmailVerifier.verify({
      helo: 'zigbang.com',
      from: 'cs@zigbang.com',
      to: 'cs@zigbang.com',
      debug: true,
      catchalltest: true,
      timeout: 1500
    }).then(result => {
      if(result === 'EXIST') {
        done();
      } else {
        done(result);
      }
    });
  });

  // INVALID
  // MXRECORD_TIMEOUT
  // MXRECORD_FAIL
  // CONN_FAIL
  // CONN_TIMEOUT
  // VERIFY_TIMEOUT
  // VERIFY_FAIL
  // EXIST
  // NOT_EXIST
  // CATCH_ALL
  // UNKNOWN
});
