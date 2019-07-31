'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('../support');
const DataTypes = require('../../../lib/data-types');
const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('QueryInterface'), () => {
  beforeEach(function() {
    this.sequelize.options.quoteIdenifiers = true;
    this.queryInterface = this.sequelize.getQueryInterface();
  });

  afterEach(function() {
    return Support.dropTestSchemas(this.sequelize);
  });

  // FIXME: These tests should make assertions against the created table using describeTable
  describe('createTable', () => {
    it('should create a auto increment primary key', function() {
      return this.queryInterface.createTable('TableWithPK', {
        table_id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        }
      }).then(() => {
        return this.queryInterface.insert(null, 'TableWithPK', {}, { raw: true, returning: true, plain: true })
          .then(([response]) => {
            expect(response.table_id || typeof response !== 'object' && response).to.be.ok;
          });
      });
    });

    it('should create unique constraint with uniqueKeys', function() {
      return this.queryInterface.createTable('MyTable', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        name: {
          type: DataTypes.STRING
        },
        email: {
          type: DataTypes.STRING
        }
      }, {
        uniqueKeys: {
          myCustomIndex: {
            fields: ['name', 'email']
          },
          myOtherIndex: {
            fields: ['name']
          }
        }
      }).then(() => {
        return this.queryInterface.showIndex('MyTable');
      }).then(indexes => {
        switch (dialect) {
          case 'postgres':
          case 'postgres-native':
          case 'sqlite':
          case 'mssql':

            // name + email
            expect(indexes[0].unique).to.be.true;
            expect(indexes[0].fields[0].attribute).to.equal('name');
            expect(indexes[0].fields[1].attribute).to.equal('email');

            // name
            expect(indexes[1].unique).to.be.true;
            expect(indexes[1].fields[0].attribute).to.equal('name');
            break;

          case 'mariadb':
          case 'mysql':
            // name + email
            expect(indexes[1].unique).to.be.true;
            expect(indexes[1].fields[0].attribute).to.equal('name');
            expect(indexes[1].fields[1].attribute).to.equal('email');

            // name
            expect(indexes[2].unique).to.be.true;
            expect(indexes[2].fields[0].attribute).to.equal('name');
            break;

          default:
            throw new Error(`Not implemented fpr ${dialect}`);
        }
      });
    });

    it('should work with enums (1)', function() {
      return this.queryInterface.createTable('SomeTable', {
        someEnum: DataTypes.ENUM('value1', 'value2', 'value3')
      });
    });

    it('should work with enums (2)', function() {
      return this.queryInterface.createTable('SomeTable', {
        someEnum: {
          type: DataTypes.ENUM,
          values: ['value1', 'value2', 'value3']
        }
      });
    });

    it('should work with enums (3)', function() {
      return this.queryInterface.createTable('SomeTable', {
        someEnum: {
          type: DataTypes.ENUM,
          values: ['value1', 'value2', 'value3'],
          field: 'otherName'
        }
      });
    });

    it('should work with enums (4)', function() {
      return this.queryInterface.createSchema('archive').then(() => {
        return this.queryInterface.createTable('SomeTable', {
          someEnum: {
            type: DataTypes.ENUM,
            values: ['value1', 'value2', 'value3'],
            field: 'otherName'
          }
        }, { schema: 'archive' });
      });
    });

    it('should work with enums (5)', function() {
      return this.queryInterface.createTable('SomeTable', {
        someEnum: {
          type: DataTypes.ENUM(['COMMENT']),
          comment: 'special enum col'
        }
      });
    });

    it('should work with schemas', function() {
      return this.sequelize.createSchema('hero').then(() => {
        return this.queryInterface.createTable('User', {
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
