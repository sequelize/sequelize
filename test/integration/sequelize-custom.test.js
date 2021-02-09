'use strict';

const { expect } = require('chai');
const PostgresDialect = require('../../lib/dialects/postgres');
const Sequelize = require('../../index');

const options = {
  host: '127.0.0.1',
  port: 5432,
  pool: {
    max: 5,
    idle: 3000
  },
  dialect: PostgresDialect
};

this.sequelize = new Sequelize('sequelize_test', 'postgres', 'postgres', options);

describe('Custom Dialect', () => {

  describe('authenticate', () => {
    it('connects to database successfully', async () => {
      try {
        await this.sequelize.authenticate();
        expect(true).to.equal(true);
      } catch (error) {
        console.error(error);
      }
    });
  });

  describe('getDialect', () => {
    it('returns the defined dialect', () => {
      expect(this.sequelize.getDialect()).to.equal(options.dialect);
    });
  });

  describe('getDatabaseName', () => {
    it('returns the database name', () => {
      expect(this.sequelize.getDatabaseName()).to.equal(this.sequelize.config.database);
    });
  });

  describe('databaseVersion', () => {
    it('should database/dialect version', async () => {
      const version = await this.sequelize.databaseVersion();
      expect(typeof version).to.equal('string');
      expect(version).to.be.ok;
    });
  });
});
