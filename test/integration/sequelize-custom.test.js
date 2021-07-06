'use strict';

const { expect } = require('chai');
const Sequelize = require('../../index');
const config = require('../config/config');

const dialectName = process.env.DIALECT === 'postgres-native' ? 'postgres' : process.env.DIALECT;
const CustomDialect = require(`../../lib/dialects/${dialectName}`);

before(() => {
  const options = {
    ...config[dialectName],
    dialect: CustomDialect
  };
  
  this.sequelize = new Sequelize(options);
});

after(() => {
  this.sequelize.close();
});

describe('Custom Dialect', () => {
  describe('authenticate', () => {
    it('connects to database successfully', () => {
      return expect(this.sequelize.authenticate()).to.eventually.be.fulfilled;
    });
  });

  describe('getDialect', () => {
    it('returns the defined dialect', () => {
      expect(this.sequelize.getDialect()).to.equal(CustomDialect);
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
