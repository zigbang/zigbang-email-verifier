'use strict';

const net = require('net');
const P = require('bluebird');
const _ = require('lodash');

P.config({cancellation: true});

module.exports = (options => {
  return new P((resolve, reject, onCancel) => {
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

    const connOption = {
      port: options.port,
      host: options.host
    };

    const client = net.createConnection(connOption, () => {
      return resolve({
        write: (msg) => {
          client.write(msg + '\r\n');
        },
        end: () => {
          return new P((resolve, reject) => {
            client.end();
          });
        },
        response: responseQueue.flush
      });
    }).on('error', (err) => {
      reject(err);
    });

    onCancel(() => {
      client.end();
      client.destroy();
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

    });
  });
});