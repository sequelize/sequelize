'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const dialect = Support.getTestDialect();
const { DataTypes } = require('@sequelize/core');

if (dialect.startsWith('sqlite3')) {
  describe('[SQLITE Specific] QueryInterface', () => {
    beforeEach(function () {
      this.queryInterface = this.sequelize.queryInterface;
    });

    describe('describeTable', () => {
      beforeEach(async function () {
        this.sequelize.define(
          'SomeTable',
          {
            someColumn: DataTypes.INTEGER,
            otherColumn: DataTypes.INTEGER,
          },
          {
            indexes: [{
              name: 'instances_coalesce_vector_batch_id_word_batch_id',
              // this double wrapping in `sql.fn` is a hack because mysql
              // requires function expressions inside index declarations to
              // be wrapped in parentheses as well
              fields: [
                this.sequelize.fn(
                  'COALESCE',
                  this.sequelize.col('someColumn'),
                  this.sequelize.col('otherColumn')
                )
              ]
            }],
            freezeTableName: true,
            timestamps: false,
          },
        );

        await this.sequelize.sync({ force: true });
      });

    it('should be able to handle functional indexes', async function () {
      await expect(this.sequelize.queryInterface.describeTable('SomeTable')).not.to.be.rejected;
    });

    });
  });
}
