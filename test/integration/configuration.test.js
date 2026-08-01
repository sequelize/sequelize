'use strict';

const chai = require('chai'),
  expect = chai.expect,
  config = require(__dirname + '/../config/config'),
  Support = require(__dirname + '/support'),
  dialect = Support.getTestDialect(),
  Sequelize = Support.Sequelize;

describe(Support.getTestDialectTeaser('Configuration'), () => {
  describe('Connections problems should fail with a nice message', () => {
    it("when we don't have the correct server details", () => {
      const seq = new Sequelize(config[dialect].database, config[dialect].username, config[dialect].password, {
        logging: false,
        host: '127.0.0.1',
        port: 1,
        dialect
      });
      return expect(seq.query('select 1 as hello')).to.eventually.be.rejectedWith([
        seq.HostNotReachableError,
        seq.InvalidConnectionError
      ]);
    });

    it("when we don't have the correct login information", () => {
      const seq = new Sequelize(config[dialect].database, config[dialect].username, 'fakepass123', {
        logging: false,
        host: config[dialect].host,
        port: 1,
        dialect
      });
      return expect(seq.query('select 1 as hello')).to.eventually.be.rejectedWith(
        seq.ConnectionRefusedError,
        'connect ECONNREFUSED'
      );
    });

    it("when we don't have a valid dialect.", () => {
      expect(() => {
        new Sequelize(config[dialect].database, config[dialect].username, config[dialect].password, {
          host: '0.0.0.1',
          port: config[dialect].port,
          dialect: 'some-fancy-dialect'
        });
      }).to.throw(Error, 'The dialect some-fancy-dialect is not supported. Supported dialects: postgres.');
    });
  });
});
