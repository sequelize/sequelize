'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require(__dirname + '/../support');
const DataTypes = require(__dirname + '/../../../lib/data-types');
const _ = require('lodash');

describe(Support.getTestDialectTeaser('QueryInterface'), () => {
  beforeEach(function () {
    this.sequelize.options.quoteIdenifiers = true;
    this.queryInterface = this.sequelize.getQueryInterface();
  });

  afterEach(function () {
    return this.sequelize.dropAllSchemas();
  });

  // FIXME: These tests should make assertions against the created table using describeTable
  describe('createTable', () => {
    it('should create a auto increment primary key', function () {
      return this.queryInterface.createTable('TableWithPK', {
        table_id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        }
      }).then(() => {
        return this.queryInterface.insert(null, 'TableWithPK', {}, { raw: true, returning: true, plain: true })
          .then(results => {
            const response = _.head(results);
            expect(response.table_id || typeof response !== 'object' && response).to.be.ok;
          });
      });
    });

    it('should work with enums (1)', function () {
      return this.queryInterface.createTable('SomeTable', {
        someEnum: DataTypes.ENUM('value1', 'value2', 'value3')
      });
    });

    it('should work with enums (2)', function () {
      return this.queryInterface.createTable('SomeTable', {
        someEnum: {
          type: DataTypes.ENUM,
          values: ['value1', 'value2', 'value3']
        }
      });
    });

    it('should work with enums (3)', function () {
      return this.queryInterface.createTable('SomeTable', {
        someEnum: {
          type: DataTypes.ENUM,
          values: ['value1', 'value2', 'value3'],
          field: 'otherName'
        }
      });
    });

    it('should work with enums (4)', function () {
      return this.queryInterface.createSchema('archive').bind(this).then(function () {
        return this.queryInterface.createTable('SomeTable', {
          someEnum: {
            type: DataTypes.ENUM,
            values: ['value1', 'value2', 'value3'],
            field: 'otherName'
          }
        }, { schema: 'archive' });
      });
    });

    it('should work with schemas', function () {
      const self = this;
      return self.sequelize.createSchema('hero').then(() => {
        return self.queryInterface.createTable('User', {
          name: {
            type: DataTypes.STRING
          }
        }, {
          schema: 'hero'
        });
      });
    });
  });
});