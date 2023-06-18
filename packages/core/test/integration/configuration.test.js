'use strict';

const chai = require('chai');

const expect = chai.expect;
const { Config: config } = require('../config/config');
const Support = require('./support');

const dialect = Support.getTestDialect();
const { Sequelize } = require('@sequelize/core');
const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');

let sqlite3;
if (dialect === 'sqlite') {
  sqlite3 = require('sqlite3');
}

describe(Support.getTestDialectTeaser('Configuration'), () => {
  Support.setResetMode('none');

  describe('Connections problems should fail with a nice message', () => {
    if (dialect !== 'db2') {
      it(`when we don't have the correct server details`, async () => {
        const options = {
          logging: false,
          host: 'localhost',
          port: 19_999, // Wrong port
          dialect,
        };

        const constructorArgs = [
          config[dialect].database,
          config[dialect].username,
          config[dialect].password,
          options,
        ];

        let willBeRejectedWithArgs = [[Sequelize.HostNotReachableError, Sequelize.InvalidConnectionError]];

        if (dialect === 'sqlite') {
          options.storage = '/path/to/no/where/land';
          options.dialectOptions = { mode: sqlite3.OPEN_READONLY };
          // SQLite doesn't have a breakdown of error codes, so we are unable to discern between the different types of errors.
          willBeRejectedWithArgs = [Sequelize.ConnectionError, 'SQLITE_CANTOPEN: unable to open database file'];
        }

        const seq = new Sequelize(...constructorArgs);
        Support.destroySequelizeAfterTest(seq);
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
      Support.destroySequelizeAfterTest(seq);
      switch (dialect) {
        case 'sqlite': {
          // SQLite doesn't require authentication and `select 1 as hello` is a valid query, so this should be fulfilled not rejected for it.
          await expect(seq.query('select 1 as hello')).to.eventually.be.fulfilled;

          break;
        }

        case 'db2': {
          await expect(seq.query('select 1 as hello')).to.eventually.be.rejectedWith(...willBeRejectedWithArgs);

          break;
        }

        case 'ibmi': {
          await expect(seq.query('select 1 as hello from SYSIBM.SYSDUMMY1')).to.eventually.be.rejectedWith(Sequelize.ConnectionRefusedError, 'Error connecting to the database');

          break;
        }

        default: {
          await expect(seq.query('select 1 as hello')).to.eventually.be.rejectedWith(Sequelize.ConnectionRefusedError, 'connect ECONNREFUSED');
        }
      }
    });

    it('when we don\'t have a valid dialect.', () => {
      expect(() => {
        new Sequelize(config[dialect].database, config[dialect].username, config[dialect].password, { host: '0.0.0.1', port: config[dialect].port, dialect: 'some-fancy-dialect' });
      }).to.throw(Error, 'The dialect some-fancy-dialect is not supported. Supported dialects: mariadb, mssql, mysql, postgres, sqlite, ibmi, db2 and snowflake.');
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
          } catch (error) {
            expect(error.code).to.equal('ENOENT');
          }

          const sequelizeReadOnly0 = new Sequelize('sqlite://foo', {
            storage: p,
            dialectOptions: {
              mode: sqlite3.OPEN_READONLY,
            },
          });
          Support.destroySequelizeAfterTest(sequelizeReadOnly0);

          const sequelizeReadWrite0 = new Sequelize('sqlite://foo', {
            storage: p,
            dialectOptions: {
              mode: sqlite3.OPEN_READWRITE,
            },
          });
          Support.destroySequelizeAfterTest(sequelizeReadWrite0);

          expect(sequelizeReadOnly0.config.dialectOptions.mode).to.equal(sqlite3.OPEN_READONLY);
          expect(sequelizeReadWrite0.config.dialectOptions.mode).to.equal(sqlite3.OPEN_READWRITE);

          await Promise.all([
            sequelizeReadOnly0.query(createTableFoo)
              .should.be.rejectedWith(Error, 'SQLITE_CANTOPEN: unable to open database file'),
            sequelizeReadWrite0.query(createTableFoo)
              .should.be.rejectedWith(Error, 'SQLITE_CANTOPEN: unable to open database file'),
          ]);

          // By default, sqlite creates a connection that's READWRITE | CREATE
          const sequelize = new Sequelize('sqlite://foo', {
            storage: p,
          });

          Support.destroySequelizeAfterTest(sequelize);
          await testAccess(await sequelize.query(createTableFoo));
          const sequelizeReadOnly = new Sequelize('sqlite://foo', {
            storage: p,
            dialectOptions: {
              mode: sqlite3.OPEN_READONLY,
            },
          });
          Support.destroySequelizeAfterTest(sequelizeReadOnly);

          const sequelizeReadWrite = new Sequelize('sqlite://foo', {
            storage: p,
            dialectOptions: {
              mode: sqlite3.OPEN_READWRITE,
            },
          });
          Support.destroySequelizeAfterTest(sequelizeReadWrite);

          await Promise.all([
            sequelizeReadOnly.query(createTableBar)
              .should.be.rejectedWith(Error, 'SQLITE_READONLY: attempt to write a readonly database'),
            sequelizeReadWrite.query(createTableBar),
          ]);
        } finally {
          await promisify(fs.unlink)(p);
        }
      });
    }
  });

});
