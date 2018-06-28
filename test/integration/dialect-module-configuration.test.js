'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/support'),
  Sequelize = Support.Sequelize,
  dialect = Support.getTestDialect();

describe('Sequelize', () => {
  describe('Dialect module option', () => {
    it('should accept dialectModule option', () => {
      const sequelize = new Sequelize('dbname', 'root', 'pass', {
        port: 999,
        dialect,
        dialectModule: { a: 'b' }
      });
      expect(sequelize.connectionManager.lib).to.deep.equal({ a: 'b' });
    });

    it('should accept dialectModulePath option', () => {
      const sequelize = new Sequelize('dbname', 'root', 'pass', {
        port: 999,
        dialect,
        dialectModulePath: 'semver'
      });
      expect(sequelize.connectionManager.lib.coerce('v2')).to.equal('v2.0.0');
    });
  });
