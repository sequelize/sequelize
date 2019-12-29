'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require(__dirname + '/../support');
const DataTypes = require(__dirname + '/../../../lib/data-types');
const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('QueryInterface'), () => {
  beforeEach(function() {
    this.sequelize.options.quoteIdenifiers = true;
    this.queryInterface = this.sequelize.getQueryInterface();
  });

  afterEach(function() {
    return this.sequelize.dropAllSchemas();
  });

  describe('removeColumn', () => {
    describe('(without a schema)', () => {
      beforeEach(function() {
        return this.queryInterface.createTable('users', {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
          },
          firstName: {
            type: DataTypes.STRING,
            defaultValue: 'Someone'
          },
          lastName: {
            type: DataTypes.STRING
          },
          manager: {
            type: DataTypes.INTEGER,
            references: {
              model: 'users',
              key: 'id'
            }
          },
          email: {
            type: DataTypes.STRING,
            unique: true
          }
        });
      });

      it('should be able to remove a column with a default value', function() {
        return this.queryInterface.removeColumn('users', 'firstName').bind(this).then(function() {
          return this.queryInterface.describeTable('users');
        }).then(table => {
          expect(table).to.not.have.property('firstName');
        });
      });

      it('should be able to remove a column without default value', function() {
        return this.queryInterface.removeColumn('users', 'lastName').bind(this).then(function() {
          return this.queryInterface.describeTable('users');
        }).then(table => {
          expect(table).to.not.have.property('lastName');
        });
      });

      it('should be able to remove a column with a foreign key constraint', function() {
        return this.queryInterface.removeColumn('users', 'manager').bind(this).then(function() {
          return this.queryInterface.describeTable('users');
        }).then(table => {
          expect(table).to.not.have.property('manager');
        });
      });

      it('should be able to remove a column with primaryKey', function() {
        return this.queryInterface.removeColumn('users', 'manager').bind(this).then(function() {
          return this.queryInterface.describeTable('users');
        }).then(function(table) {
          expect(table).to.not.have.property('manager');
          return this.queryInterface.removeColumn('users', 'id');
        }).then(function() {
          return this.queryInterface.describeTable('users');
        }).then(table => {
          expect(table).to.not.have.property('id');
        });
      });

      // From MSSQL documentation on ALTER COLUMN:
      //    The modified column cannot be any one of the following:
      //      - Used in a CHECK or UNIQUE constraint.
      // https://docs.microsoft.com/en-us/sql/t-sql/statements/alter-table-transact-sql#arguments
      if (dialect !== 'mssql') {
        it('should be able to remove a column with unique contraint', function() {
          return this.queryInterface.removeColumn('users', 'email').bind(this).then(function() {
            return this.queryInterface.describeTable('users');
          }).then(table => {
            expect(table).to.not.have.property('email');
          });
        });
      }
    });

    describe('(with a schema)', () => {
      beforeEach(function() {
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
            firstName: {
              type: DataTypes.STRING,
              defaultValue: 'Someone'
            },
            lastName: {
              type: DataTypes.STRING
            },
            email: {
              type: DataTypes.STRING,
              unique: true
            }
          });
        });
      });

      it('should be able to remove a column with a default value', function() {
        return this.queryInterface.removeColumn({
          tableName: 'users',
          schema: 'archive'
        }, 'firstName'
        ).bind(this).then(function() {
          return this.queryInterface.describeTable({
            tableName: 'users',
            schema: 'archive'
          });
        }).then(table => {
          expect(table).to.not.have.property('firstName');
        });
      });

      it('should be able to remove a column without default value', function() {
        return this.queryInterface.removeColumn({
          tableName: 'users',
          schema: 'archive'
        }, 'lastName'
        ).bind(this).then(function() {
          return this.queryInterface.describeTable({
            tableName: 'users',
            schema: 'archive'
          });
        }).then(table => {
          expect(table).to.not.have.property('lastName');
        });
      });

      it('should be able to remove a column with primaryKey', function() {
        return this.queryInterface.removeColumn({
          tableName: 'users',
          schema: 'archive'
        }, 'id').bind(this).then(function() {
          return this.queryInterface.describeTable({
            tableName: 'users',
            schema: 'archive'
          });
        }).then(table => {
          expect(table).to.not.have.property('id');
        });
      });

      // From MSSQL documentation on ALTER COLUMN:
      //    The modified column cannot be any one of the following:
      //      - Used in a CHECK or UNIQUE constraint.
      // https://docs.microsoft.com/en-us/sql/t-sql/statements/alter-table-transact-sql#arguments
      if (dialect !== 'mssql') {
        it('should be able to remove a column with unique contraint', function() {
          return this.queryInterface.removeColumn({
            tableName: 'users',
            schema: 'archive'
          }, 'email').bind(this).then(function() {
            return this.queryInterface.describeTable({
              tableName: 'users',
              schema: 'archive'
            });
          }).then(table => {
            expect(table).to.not.have.property('email');
          });
        });
      }
    });
  });
});