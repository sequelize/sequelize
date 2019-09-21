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
        return this.queryInterface.removeColumn('users', 'firstName').then(() => {
          return this.queryInterface.describeTable('users');
        }).then(table => {
          expect(table).to.not.have.property('firstName');
        });
      });

      it('should be able to remove a column without default value', function() {
        return this.queryInterface.removeColumn('users', 'lastName').then(() => {
          return this.queryInterface.describeTable('users');
        }).then(table => {
          expect(table).to.not.have.property('lastName');
        });
      });

      it('should be able to remove a column with a foreign key constraint', function() {
        return this.queryInterface.removeColumn('users', 'manager').then(() => {
          return this.queryInterface.describeTable('users');
        }).then(table => {
          expect(table).to.not.have.property('manager');
        });
      });

      it('should be able to remove a column with primaryKey', function() {
        return this.queryInterface.removeColumn('users', 'manager').then(() => {
          return this.queryInterface.describeTable('users');
        }).then(table => {
          expect(table).to.not.have.property('manager');
          return this.queryInterface.removeColumn('users', 'id');
        }).then(() => {
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
          return this.queryInterface.removeColumn('users', 'email').then(() => {
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
        ).then(() => {
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
        ).then(() => {
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
        }, 'id').then(() => {
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
          }, 'email').then(() => {
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
