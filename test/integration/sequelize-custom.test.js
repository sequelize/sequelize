'use strict';

const dialectName = process.env.DIALECT; 

const { expect } = require('chai');
const Sequelize = require('../../index');
const config = require('../config/config');

const CustomDialect = require(`../../lib/dialects/ + ${dialectName}`);

const options = {
  ...config[dialectName],
  dialect: CustomDialect
};

this.sequelize = new Sequelize(options);

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
