'use strict';

const dns = require('dns');
const net = require('net');
const P = require('bluebird');
const _ = require('lodash');

const dnsResolveMx = P.promisify(dns.resolveMx, {context: dns});

const netConnect = (options => {
  return new P((resolve, reject) => {
    let fnNetEnd;

    const responseQueue = (() => {
      let msgQueue = [];
      let evtResolve = null;
      return {
        add(msg) {
          if(evtResolve) {
            evtResolve([msg]);
            evtResolve = null;
          } else {
            msgQueue.push(msg);
          }
        },
        flush() {
          return new P((resolve, reject) => {
            if(msgQueue.length) {
              const results = _.clone(msgQueue);
              msgQueue = [];
              return resolve(results);
            }
            evtResolve = resolve;
          });
        }
      };
    })();

    const client = net.createConnection(options, () => {
      return resolve({
        write: (msg) => {
          client.write(msg + '\r\n');
        },
        end: () => {
          return new P((resolve, reject) => {
            client.end();
            fnNetEnd = resolve;
          });
        },
        response: responseQueue.flush
      });
    });

    client.on('data', (() => {
      let response = '';
      return (data) => {
        response += data.toString();
        if(response.slice(-1) === '\n') {
          responseQueue.add(response.substr(0, response.length - 2));
          response = '';
        }
      };
    })());

    client.on('end', () => {
      fnNetEnd();
    });
  });
});


module.exports = {
  verify(opts) {

    const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/; // eslint-disable-line

    if(!emailRegex.test(opts.to)) {
      return P.resolve('INVALID');
    }

    const emailSplited = opts.to.split('@');
    const emailHost = emailSplited[1];

    const debug = opts.debug ? (_.isFunction(opts.debug) ? opts.debug : console.info) : () => {};

    return dnsResolveMx(emailHost).then(results => {
      debug('RESOLVE MX RECORD');

      const exchange = _(results).sortBy(v => v.priority).take(1).value()[0].exchange;
      debug('\t' + exchange);

      return netConnect({port: 25, host: exchange});
    }).then(netConn => {
      debug('CONNECTED SMTP SERVER');

      return netConn.response().then(resmsg => {
        debug('\t' + resmsg[0]);

        if(resmsg[0].substr(0, 3) !== '220') {
          return P.resolve('BLOCK');
        }

        const writeMsg = 'HELO ' + opts.helo;
        debug(writeMsg);
        netConn.write(writeMsg);

        return netConn.response();
      }).then(resmsg => {
        debug('\t' + resmsg[0]);

        if(resmsg[0].substr(0, 3) !== '250') {
          return P.resolve('BLOCK');
        }

        const writeMsg = `MAIL FROM: <${opts.from}>`;
        debug(writeMsg);
        netConn.write(writeMsg);

        return netConn.response();
      }).then(resmsg => {
        debug('\t' + resmsg[0]);

        if(resmsg[0].substr(0, 3) !== '250') {
          return P.resolve('BLOCK');
        }
        const writeMsg = `RCPT TO: <${opts.to}>`;
        debug(writeMsg);
        netConn.write(writeMsg);

        return netConn.response();
      }).then(resmsg => {
        debug('\t' + resmsg[0]);
        if(resmsg[0].substr(0, 3) === '250') {
          return 'EXIST';
        } else {
          return 'NOT_EXIST';
        }
      }).finally(() => {
        netConn.end();
      });
    });
  }
};
