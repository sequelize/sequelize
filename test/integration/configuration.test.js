'use strict';

const chai = require('chai'),
  expect = chai.expect,
  config = require('../config/config'),
  Support = require('./support'),
  dialect = Support.getTestDialect(),
  Sequelize = Support.Sequelize,
  fs = require('fs'),
  path = require('path');

let sqlite3;
if (dialect === 'sqlite') {
  sqlite3 = require('sqlite3'); // eslint-disable-line
}

describe(Support.getTestDialectTeaser('Configuration'), () => {
  describe('Connections problems should fail with a nice message', () => {
    it('when we don\'t have the correct server details', () => {
      const seq = new Sequelize(config[dialect].database, config[dialect].username, config[dialect].password, { storage: '/path/to/no/where/land', logging: false, host: '0.0.0.1', port: config[dialect].port, dialect });
      if (dialect === 'sqlite') {
        // SQLite doesn't have a breakdown of error codes, so we are unable to discern between the different types of errors.
        return expect(seq.query('select 1 as hello')).to.eventually.be.rejectedWith(Sequelize.ConnectionError, 'SQLITE_CANTOPEN: unable to open database file');
      }
      return expect(seq.query('select 1 as hello')).to.eventually.be.rejectedWith([Sequelize.HostNotReachableError, Sequelize.InvalidConnectionError]);
    });

    it('when we don\'t have the correct login information', () => {
      if (dialect === 'mssql') {
        // NOTE: Travis seems to be having trouble with this test against the
        //       AWS instance. Works perfectly fine on a local setup.
        expect(true).to.be.true;
        return;
      }

      const seq = new Sequelize(config[dialect].database, config[dialect].username, 'fakepass123', { logging: false, host: config[dialect].host, port: 1, dialect });
      if (dialect === 'sqlite') {
        // SQLite doesn't require authentication and `select 1 as hello` is a valid query, so this should be fulfilled not rejected for it.
        return expect(seq.query('select 1 as hello')).to.eventually.be.fulfilled;
      }
      return expect(seq.query('select 1 as hello')).to.eventually.be.rejectedWith(Sequelize.ConnectionRefusedError, 'connect ECONNREFUSED');
    });

    it('when we don\'t have a valid dialect.', () => {
      expect(() => {
        new Sequelize(config[dialect].database, config[dialect].username, config[dialect].password, { host: '0.0.0.1', port: config[dialect].port, dialect: 'some-fancy-dialect' });
      }).to.throw(Error, 'The dialect some-fancy-dialect is not supported. Supported dialects: mssql, mariadb, mysql, postgres, and sqlite.');
    });
  });

  describe('Instantiation with arguments', () => {
    if (dialect === 'sqlite') {
      it('should respect READONLY / READWRITE connection modes', () => {
        const p = path.join(__dirname, '../tmp', 'foo.sqlite');
        const createTableFoo = 'CREATE TABLE foo (faz TEXT);';
        const createTableBar = 'CREATE TABLE bar (baz TEXT);';

        const testAccess = Sequelize.Promise.method(() => {
          return Sequelize.Promise.promisify(fs.access)(p, fs.R_OK | fs.W_OK);
        });

        return Sequelize.Promise.promisify(fs.unlink)(p)
          .catch(err => {
            expect(err.code).to.equal('ENOENT');
          })
          .then(() => {
            const sequelizeReadOnly = new Sequelize('sqlite://foo', {
              storage: p,
              dialectOptions: {
                mode: sqlite3.OPEN_READONLY
              }
            });
            const sequelizeReadWrite = new Sequelize('sqlite://foo', {
              storage: p,
              dialectOptions: {
                mode: sqlite3.OPEN_READWRITE
              }
            });

            expect(sequelizeReadOnly.config.dialectOptions.mode).to.equal(sqlite3.OPEN_READONLY);
            expect(sequelizeReadWrite.config.dialectOptions.mode).to.equal(sqlite3.OPEN_READWRITE);

            return Sequelize.Promise.join(
              sequelizeReadOnly.query(createTableFoo)
                .should.be.rejectedWith(Error, 'SQLITE_CANTOPEN: unable to open database file'),
              sequelizeReadWrite.query(createTableFoo)
                .should.be.rejectedWith(Error, 'SQLITE_CANTOPEN: unable to open database file')
            );
          })
          .then(() => {
          // By default, sqlite creates a connection that's READWRITE | CREATE
            const sequelize = new Sequelize('sqlite://foo', {
              storage: p
            });
            return sequelize.query(createTableFoo);
          })
          .then(testAccess)
          .then(() => {
            const sequelizeReadOnly = new Sequelize('sqlite://foo', {
              storage: p,
              dialectOptions: {
                mode: sqlite3.OPEN_READONLY
              }
            });
            const sequelizeReadWrite = new Sequelize('sqlite://foo', {
              storage: p,
              dialectOptions: {
                mode: sqlite3.OPEN_READWRITE
              }
            });

            return Sequelize.Promise.join(
              sequelizeReadOnly.query(createTableBar)
                .should.be.rejectedWith(Error, 'SQLITE_READONLY: attempt to write a readonly database'),
              sequelizeReadWrite.query(createTableBar)
            );
          })
          .finally(() => {
            return Sequelize.Promise.promisify(fs.unlink)(p);
          });
      });
    }
  });

});
