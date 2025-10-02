'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('../support');
const { DataTypes } = require('@sequelize/core');

const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('QueryInterface'), () => {
  beforeEach(function () {
    this.queryInterface = this.sequelize.queryInterface;
  });

  describe('bulkInsert (returning IDs)', () => {
    beforeEach(async function () {
      await this.queryInterface.createTable('UsersBulkInsert', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        name: DataTypes.STRING,
      });
    });

    afterEach(async function () {
      await this.queryInterface.dropTable('UsersBulkInsert');
    });

    it('should return inserted IDs for MySQL/MariaDB', async function () {
      if (!['mysql', 'mariadb'].includes(dialect)) {
        this.skip();
      }

      const rows = [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }];

      const result = await this.queryInterface.bulkInsert('UsersBulkInsert', rows, {});
      expect(result).to.deep.equal([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });
  });
});
