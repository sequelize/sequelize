'use strict';

/* jshint -W030 */
const chai = require('chai');
const expect = chai.expect;
const Support = require(__dirname + '/../../support');
const dialect = Support.getTestDialect();
const DataTypes = require(__dirname + '/../../../../lib/data-types');
const _ = require('lodash');

if (dialect === 'mysql') {
  describe('[MYSQL Specific] QueryInterface', () => {
    beforeEach(function() {
      this.sequelize.options.quoteIdenifiers = true;
      this.queryInterface = this.sequelize.getQueryInterface();
    });

    describe('indexes', () => {
      const tableName = 'utf8mb4';
      const indexName = 'utf8mb4_first_name_last_name';

      describe('rowFormat is not set', () => {
        beforeEach(function() {
          return this.queryInterface.dropTable(tableName)
            .then(() => this.queryInterface.createTable(tableName, {
              firstName: DataTypes.STRING,
              lastName: DataTypes.STRING
            }, {
              charset: 'utf8mb4'
            }));
        });

        it('should throw error', function() {
          return this.queryInterface.addIndex(tableName, ['firstName', 'lastName'], {
            name: indexName
          })
            .then(() => this.queryInterface.showIndex(tableName))
            .then(indexes => {
              const indexColumns = _.uniq(indexes.map(index => index.name));

              expect(indexColumns).to.include(indexName);
            })
            .catch((err) => {
              expect(err.message).to.be.equal('Index column size too large. The maximum column size is 767 bytes.');
            });
        });
      });

      describe('rowFormat=DYNAMIC', () => {
        beforeEach(function() {
          return this.queryInterface.dropTable(tableName)
            .then(() => this.queryInterface.createTable(tableName, {
              firstName: DataTypes.STRING,
              lastName: DataTypes.STRING
            }, {
              charset: 'utf8mb4',
              rowFormat: 'DYNAMIC'
            }));
        });

        it('should add a index to the table', function() {
          return this.queryInterface.addIndex(tableName, ['firstName', 'lastName'], {
            name: indexName
          })
            .then(() => this.queryInterface.showIndex(tableName))
            .then(indexes => {
              const indexColumns = _.uniq(indexes.map(index => index.name));

              expect(indexColumns).to.include(indexName);
            });
        });
      });
    });
  });
}
