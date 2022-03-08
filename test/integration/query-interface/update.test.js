'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const DataTypes = require('@sequelize/core/lib/data-types');

describe(Support.getTestDialectTeaser('QueryInterface'), () => {
  beforeEach(function () {
    this.sequelize.options.quoteIdenifiers = true;
    this.queryInterface = this.sequelize.getQueryInterface();
  });

  afterEach(async function () {
    await Support.dropTestSchemas(this.sequelize);
  });

  describe('update', () => {
    it('should not require a model instance', async function () {
      await this.sequelize.createSchema('archive');

      const table = {
        schema: 'archive',
        tableName: 'test',
      };

      await this.queryInterface.createTable(table, {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        value: DataTypes.INTEGER,
      });

      await this.queryInterface.insert(null, table, {
        id: 1,
        value: 1,
      });

      await this.queryInterface.update(null, table, {
        value: 2,
      }, {
        id: 1,
      });

      const [helper] = await this.queryInterface.select(null, table);
      expect(helper.value).to.equal(2);
    });
  });
});
