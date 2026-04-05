'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../../support');

const { Sequelize } = require('@sequelize/core');
const { SqliteDialect } = require('@sequelize/sqlite3');

const dialect = Support.getTestDialect();

describe('[SQLITE Specific] ConnectionManager', () => {
  if (dialect !== 'sqlite3') {
    return;
  }

  describe('getConnection', () => {
    it('should forward empty string storage to SQLite connector to create temporary disk-based database', async () => {
      // storage='' means anonymous disk-based database
      const sequelize = new Sequelize({
        dialect: SqliteDialect,
        storage: '',
        pool: { max: 1, idle: Infinity },
      });

      const connection = await sequelize.pool.acquire();
      expect(connection.filename).to.equal('');
    });

    it('supports :memory: database', async () => {
      const sequelize = new Sequelize({
        dialect: SqliteDialect,
        storage: ':memory:',
        pool: { max: 1, idle: Infinity },
      });

      const connection = await sequelize.pool.acquire();
      expect(connection.filename).to.equal(':memory:');
    });
  });
});
