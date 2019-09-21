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

  describe('changeColumn', () => {
    it('should support schemas', function() {
      return this.sequelize.createSchema('archive').then(() => {
        return this.queryInterface.createTable({
          tableName: 'users',
          schema: 'archive'
        }, {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
          },
          currency: DataTypes.INTEGER
        }).then(() => {
          return this.queryInterface.changeColumn({
            tableName: 'users',
            schema: 'archive'
          }, 'currency', {
            type: DataTypes.FLOAT
          });
        }).then(() => {
          return this.queryInterface.describeTable({
            tableName: 'users',
            schema: 'archive'
          });
        }).then(table => {
          if (dialect === 'postgres' || dialect === 'postgres-native') {
            expect(table.currency.type).to.equal('DOUBLE PRECISION');
          } else {
            expect(table.currency.type).to.equal('FLOAT');
          }
        });
      });
    });

    it('should change columns', function() {
      return this.queryInterface.createTable({
        tableName: 'users'
      }, {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        currency: DataTypes.INTEGER
      }).then(() => {
        return this.queryInterface.changeColumn('users', 'currency', {
          type: DataTypes.FLOAT,
          allowNull: true
        });
      }).then(() => {
        return this.queryInterface.describeTable({
          tableName: 'users'
        });
      }).then(table => {
        if (dialect === 'postgres' || dialect === 'postgres-native') {
          expect(table.currency.type).to.equal('DOUBLE PRECISION');
        } else {
          expect(table.currency.type).to.equal('FLOAT');
        }
      });
    });

    // MSSQL doesn't support using a modified column in a check constraint.
    // https://docs.microsoft.com/en-us/sql/t-sql/statements/alter-table-transact-sql
    if (dialect !== 'mssql') {
      it('should work with enums (case 1)', function() {
        return this.queryInterface.createTable({
          tableName: 'users'
        }, {
          firstName: DataTypes.STRING
        }).then(() => {
          return this.queryInterface.changeColumn('users', 'firstName', {
            type: DataTypes.ENUM(['value1', 'value2', 'value3'])
          });
        });
      });

      it('should work with enums (case 2)', function() {
        return this.queryInterface.createTable({
          tableName: 'users'
        }, {
          firstName: DataTypes.STRING
        }).then(() => {
          return this.queryInterface.changeColumn('users', 'firstName', {
            type: DataTypes.ENUM,
            values: ['value1', 'value2', 'value3']
          });
        });
      });

      it('should work with enums with schemas', function() {
        return this.sequelize.createSchema('archive').then(() => {
          return this.queryInterface.createTable({
            tableName: 'users',
            schema: 'archive'
          }, {
            firstName: DataTypes.STRING
          });
        }).then(() => {
          return this.queryInterface.changeColumn({
            tableName: 'users',
            schema: 'archive'
          }, 'firstName', {
            type: DataTypes.ENUM(['value1', 'value2', 'value3'])
          });
        });
      });
    }

    //SQlite natively doesn't support ALTER Foreign key
    if (dialect !== 'sqlite') {
      describe('should support foreign keys', () => {
        beforeEach(function() {
          return this.queryInterface.createTable('users', {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true
            },
            level_id: {
              type: DataTypes.INTEGER,
              allowNull: false
            }
          }).then(() => {
            return this.queryInterface.createTable('level', {
              id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
              }
            });
          });
        });

        it('able to change column to foreign key', function() {
          return this.queryInterface.getForeignKeyReferencesForTable('users').then( foreignKeys => {
            expect(foreignKeys).to.be.an('array');
            expect(foreignKeys).to.be.empty;
            return this.queryInterface.changeColumn('users', 'level_id', {
              type: DataTypes.INTEGER,
              references: {
                model: 'level',
                key: 'id'
              },
              onUpdate: 'cascade',
              onDelete: 'cascade'
            });
          }).then(() => {
            return this.queryInterface.getForeignKeyReferencesForTable('users');
          }).then(newForeignKeys => {
            expect(newForeignKeys).to.be.an('array');
            expect(newForeignKeys).to.have.lengthOf(1);
            expect(newForeignKeys[0].columnName).to.be.equal('level_id');
          });
        });

        it('able to change column property without affecting other properties', function() {
          let firstTable, firstForeignKeys;
          // 1. look for users table information
          // 2. change column level_id on users to have a Foreign Key
          // 3. look for users table Foreign Keys information
          // 4. change column level_id AGAIN to allow null values
          // 5. look for new foreign keys information
          // 6. look for new table structure information
          // 7. compare foreign keys and tables(before and after the changes)
          return this.queryInterface.describeTable({
            tableName: 'users'
          }).then( describedTable => {
            firstTable = describedTable;
            return this.queryInterface.changeColumn('users', 'level_id', {
              type: DataTypes.INTEGER,
              references: {
                model: 'level',
                key: 'id'
              },
              onUpdate: 'cascade',
              onDelete: 'cascade'
            });
          }).then( () => {
            return this.queryInterface.getForeignKeyReferencesForTable('users');
          }).then( keys => {
            firstForeignKeys = keys;
            return this.queryInterface.changeColumn('users', 'level_id', {
              type: DataTypes.INTEGER,
              allowNull: true
            });
          }).then( () => {
            return this.queryInterface.getForeignKeyReferencesForTable('users');
          }).then( newForeignKeys => {
            expect(firstForeignKeys.length).to.be.equal(newForeignKeys.length);
            expect(firstForeignKeys[0].columnName).to.be.equal('level_id');
            expect(firstForeignKeys[0].columnName).to.be.equal(newForeignKeys[0].columnName);
            
            return this.queryInterface.describeTable({
              tableName: 'users'
            });
          }).then( describedTable => {
            expect(describedTable.level_id).to.have.property('allowNull');
            expect(describedTable.level_id.allowNull).to.not.equal(firstTable.level_id.allowNull);
            expect(describedTable.level_id.allowNull).to.be.equal(true);
          });
        });

        it('should change the comment of column', function() {
          return this.queryInterface.describeTable({
            tableName: 'users'
          }).then(describedTable => {
            expect(describedTable.level_id.comment).to.be.equal(null);
            return this.queryInterface.changeColumn('users', 'level_id', {
              type: DataTypes.INTEGER,
              comment: 'FooBar'
            });
          }).then(() => {
            return this.queryInterface.describeTable({ tableName: 'users' });
          }).then(describedTable2 => {
            expect(describedTable2.level_id.comment).to.be.equal('FooBar');
          });
        });
      });
    }
  });
});
