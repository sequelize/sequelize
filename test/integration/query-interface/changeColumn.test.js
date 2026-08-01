'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require(__dirname + '/../support');
const DataTypes = require(__dirname + '/../../../lib/data-types');

let count = 0;
function log() {
  // sqlite fires a lot more querys than the other dbs. this is just a simple hack, since i'm lazy

  count++;
}

describe(Support.getTestDialectTeaser('QueryInterface'), () => {
  beforeEach(function () {
    this.sequelize.options.quoteIdenifiers = true;
    this.queryInterface = this.sequelize.getQueryInterface();
  });

  afterEach(function () {
    return this.sequelize.dropAllSchemas();
  });

  describe('changeColumn', () => {
    it('should support schemas', function () {
      return this.sequelize.createSchema('archive').then(() => {
        return this.queryInterface
          .createTable(
            {
              tableName: 'users',
              schema: 'archive'
            },
            {
              id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
              },
              currency: DataTypes.INTEGER
            }
          )
          .then(() => {
            return this.queryInterface.changeColumn(
              {
                tableName: 'users',
                schema: 'archive'
              },
              'currency',
              {
                type: DataTypes.FLOAT
              }
            );
          })
          .then(() => {
            return this.queryInterface.describeTable({
              tableName: 'users',
              schema: 'archive'
            });
          })
          .then((table) => {
            expect(table.currency.type).to.equal('DOUBLE PRECISION');
          });
      });
    });

    it('should change columns', function () {
      return this.queryInterface
        .createTable(
          {
            tableName: 'users'
          },
          {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true
            },
            currency: DataTypes.INTEGER
          }
        )
        .then(() => {
          return this.queryInterface.changeColumn('users', 'currency', {
            type: DataTypes.FLOAT,
            allowNull: true
          });
        })
        .then(() => {
          return this.queryInterface.describeTable({
            tableName: 'users'
          });
        })
        .then((table) => {
          expect(table.currency.type).to.equal('DOUBLE PRECISION');
        });
    });

    // MSSQL doesn't support using a modified column in a check constraint.
    // https://docs.microsoft.com/en-us/sql/t-sql/statements/alter-table-transact-sql

    it('should work with enums', function () {
      return this.queryInterface
        .createTable(
          {
            tableName: 'users'
          },
          {
            firstName: DataTypes.STRING
          }
        )
        .then(() => {
          return this.queryInterface.changeColumn('users', 'firstName', {
            type: DataTypes.ENUM(['value1', 'value2', 'value3'])
          });
        });
    });

    it('should work with enums with schemas', function () {
      return this.sequelize
        .createSchema('archive')
        .then(() => {
          return this.queryInterface.createTable(
            {
              tableName: 'users',
              schema: 'archive'
            },
            {
              firstName: DataTypes.STRING
            }
          );
        })
        .then(() => {
          return this.queryInterface.changeColumn(
            {
              tableName: 'users',
              schema: 'archive'
            },
            'firstName',
            {
              type: DataTypes.ENUM(['value1', 'value2', 'value3'])
            }
          );
        });
    });

    //SQlite navitely doesnt support ALTER Foreign key

    describe('should support foreign keys', () => {
      beforeEach(function () {
        return this.queryInterface
          .createTable('users', {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true
            },
            level_id: {
              type: DataTypes.INTEGER,
              allowNull: false
            }
          })
          .then(() => {
            return this.queryInterface.createTable('level', {
              id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
              }
            });
          });
      });

      it('able to change column to foreign key', function () {
        return this.queryInterface
          .changeColumn(
            'users',
            'level_id',
            {
              type: DataTypes.INTEGER,
              references: {
                model: 'level',
                key: 'id'
              },
              onUpdate: 'cascade',
              onDelete: 'cascade'
            },
            { logging: log }
          )
          .then(() => {
            expect(count).to.be.equal(1);
            count = 0;
          });
      });
    });
  });
});
