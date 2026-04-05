'use strict';

const { expect } = require('chai');
const Support = require('../../support');
const { DataTypes } = require('@sequelize/core');
const sinon = require('sinon');

const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('Warning'), () => {
  // We can only test MySQL warnings when using MySQL.
  if (dialect === 'mysql') {
    describe('logging', () => {
      it('logs warnings when there are warnings', async () => {
        const logger = sinon.fake();
        const sequelize = Support.createSingleTestSequelizeInstance({
          logging: logger,
          benchmark: false,
          showWarnings: true,
        });

        const Model = sequelize.define('model', {
          name: DataTypes.STRING(1),
        });

        await sequelize.sync({ force: true });
        await sequelize.authenticate();
        await sequelize.query("SET SESSION sql_mode='';");

        await Model.create({
          name: 'very-long-long-name',
        });

        // last log is warning message
        expect(logger.args.at(-1)[0]).to.be.match(/^mysql warnings \(default\):.*/m);
      });
    });
  }
});
