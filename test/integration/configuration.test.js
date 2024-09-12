'use strict';

const chai = require('chai'),
  expect = chai.expect,
  config = require('../config/config'),
  Support = require('./support'),
  dialect = Support.getTestDialect(),
  Sequelize = Support.Sequelize,
  fs = require('fs'),
  path = require('path'),
  { promisify } = require('util');

let sqlite3;
if (dialect === 'sqlite') {
  sqlite3 = require('sqlite3'); // eslint-disable-line
}

describe(Support.getTestDialectTeaser('Configuration'), () => {
  describe('Connections problems should fail with a nice message', () => {
    if (dialect != 'db2') {
      it('when we don\'t have the correct server details', async () => {
        const options = {
          logging: false,
          host: 'localhost',
          port: 19999, // Wrong port
          dialect
        };

        const constructorArgs = [
          config[dialect].database,
          config[dialect].username,
          config[dialect].password,
          options
        ];

        let willBeRejectedWithArgs = [[Sequelize.HostNotReachableError, Sequelize.InvalidConnectionError]];

        if (dialect === 'sqlite') {
          options.storage = '/path/to/no/where/land';
          options.dialectOptions = { mode: sqlite3.OPEN_READONLY };
          // SQLite doesn't have a breakdown of error codes, so we are unable to discern between the different types of errors.
          willBeRejectedWithArgs = [Sequelize.ConnectionError, 'SQLITE_CANTOPEN: unable to open database file'];
        }

        const seq = new Sequelize(...constructorArgs);
        await expect(seq.query('select 1 as hello')).to.eventually.be.rejectedWith(...willBeRejectedWithArgs);
      });
    }

    it('when we don\'t have the correct login information', async () => {
      const willBeRejectedWithArgs = [[Sequelize.HostNotReachableError, Sequelize.InvalidConnectionError]];
      
      if (dialect === 'mssql') {
        // TODO: GitHub Actions seems to be having trouble with this test. Works perfectly fine on a local setup.
        expect(true).to.be.true;
        return;
      }

      const seq = new Sequelize(config[dialect].database, config[dialect].username, 'fakepass123', { logging: false, host: config[dialect].host, port: 1, dialect });
      if (dialect === 'sqlite') {
        // SQLite doesn't require authentication and `select 1 as hello` is a valid query, so this should be fulfilled not rejected for it.
        await expect(seq.query('select 1 as hello')).to.eventually.be.fulfilled;
      } else if (dialect === 'db2') {
        await expect(seq.query('select 1 as hello')).to.eventually.be.rejectedWith(...willBeRejectedWithArgs);
      } else if (dialect === 'oracle') {
        await expect(seq.query('select 1 as hello FROM DUAL')).to.eventually.be.rejectedWith(Sequelize.HostNotReachableError);
      } else {
        await expect(seq.query('select 1 as hello')).to.eventually.be.rejectedWith(Sequelize.ConnectionRefusedError, 'connect ECONNREFUSED');
      }
    });

    it('when we don\'t have a valid dialect.', () => {
      expect(() => {
        new Sequelize(config[dialect].database, config[dialect].username, config[dialect].password, { host: '0.0.0.1', port: config[dialect].port, dialect: 'some-fancy-dialect' });
      }).to.throw(Error, 'The dialect some-fancy-dialect is not supported. Supported dialects: mssql, mariadb, mysql, oracle, postgres, db2 and sqlite.');
    });
  });

  describe('Instantiation with arguments', () => {
    if (dialect === 'sqlite') {
      it('should respect READONLY / READWRITE connection modes', async () => {
        const p = path.join(__dirname, '../tmp', 'foo.sqlite');
        const createTableFoo = 'CREATE TABLE foo (faz TEXT);';
        const createTableBar = 'CREATE TABLE bar (baz TEXT);';

        const testAccess = () => {
          return promisify(fs.access)(p, fs.R_OK | fs.W_OK);
        };

        try {
          try {
            await promisify(fs.unlink)(p);
          } catch (err) {
            expect(err.code).to.equal('ENOENT');
          }

          const sequelizeReadOnly0 = new Sequelize('sqlite://foo', {
            storage: p,
            dialectOptions: {
              mode: sqlite3.OPEN_READONLY
            }
          });
          const sequelizeReadWrite0 = new Sequelize('sqlite://foo', {
            storage: p,
            dialectOptions: {
              mode: sqlite3.OPEN_READWRITE
            }
          });

          expect(sequelizeReadOnly0.config.dialectOptions.mode).to.equal(sqlite3.OPEN_READONLY);
          expect(sequelizeReadWrite0.config.dialectOptions.mode).to.equal(sqlite3.OPEN_READWRITE);

          await Promise.all([
            sequelizeReadOnly0.query(createTableFoo)
              .should.be.rejectedWith(Error, 'SQLITE_CANTOPEN: unable to open database file'),
            sequelizeReadWrite0.query(createTableFoo)
              .should.be.rejectedWith(Error, 'SQLITE_CANTOPEN: unable to open database file')
          ]);

          // By default, sqlite creates a connection that's READWRITE | CREATE
          const sequelize = new Sequelize('sqlite://foo', {
            storage: p
          });
          await testAccess(await sequelize.query(createTableFoo));
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

          await Promise.all([
            sequelizeReadOnly.query(createTableBar)
              .should.be.rejectedWith(Error, 'SQLITE_READONLY: attempt to write a readonly database'),
            sequelizeReadWrite.query(createTableBar)
          ]);
        } finally {
          await promisify(fs.unlink)(p);
        }
      });
    }
  });

});
