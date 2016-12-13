'use strict';

const zbEmailVerifier = require('./../index');

describe('#verify()', function() {
  it('should return "EXIST" data', function(done) {
    zbEmailVerifier.verify({
      helo: 'zigbang.com',
      from: 'cs@zigbang.com',
      to: 'cs@zigbang.com',
      debug: true
    }).then(result => {
      if(result === 'EXIST') {
        done();
      } else {
        done(result);
      }
    });
  });

  // EXIST
  // NOT_EXIST
  // INVALID
  // BLOCK
});
