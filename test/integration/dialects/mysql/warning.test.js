'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('../../../support');
const Sequelize = Support.Sequelize;
const dialect = Support.getTestDialect();
const sinon = require('sinon');

describe(Support.getTestDialectTeaser('Warning'), () => {
  // We can only test MySQL warnings when using MySQL.
  if (dialect === 'mysql') {
    describe('logging', () => {
      it('logs warnings when there are warnings', () => {
        const logger = sinon.spy(console, 'log');
        const sequelize = Support.createSequelizeInstance({
          logging: logger,
          benchmark: false,
          showWarnings: true
        });

        const Model = sequelize.define('model', {
          name: Sequelize.DataTypes.STRING(1, true)
        });

        return sequelize.sync({ force: true }).then(() => {
          return sequelize.authenticate();
        }).then(() => {
          return sequelize.query("SET SESSION sql_mode='';");
        }).then(() => {
          return Model.create({
            name: 'very-long-long-name'
          });
        }).then(() => {
          // last log is warning message
          expect(logger.args[logger.args.length - 1][0]).to.be.match(/^MySQL Warnings \(default\):.*/m);
        }, () => {
          expect.fail();
        });
      });
    });
  }
});
