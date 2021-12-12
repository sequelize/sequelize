'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('../support');
const DataTypes = require('sequelize/lib/data-types');
const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('QueryInterface'), () => {
  beforeEach(function() {
    this.sequelize.options.quoteIdenifiers = true;
    this.queryInterface = this.sequelize.getQueryInterface();
  });

  afterEach(async function() {
    await Support.dropTestSchemas(this.sequelize);
  });

  describe('removeColumn', () => {
    describe('(without a schema)', () => {
      beforeEach(async function() {
        await this.queryInterface.createTable('users', {
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

      it('should be able to remove a column with a default value', async function() {
        await this.queryInterface.removeColumn('users', 'firstName');
        const table = await this.queryInterface.describeTable('users');
        expect(table).to.not.have.property('firstName');
      });

      it('should be able to remove a column without default value', async function() {
        await this.queryInterface.removeColumn('users', 'lastName');
        const table = await this.queryInterface.describeTable('users');
        expect(table).to.not.have.property('lastName');
      });

      it('should be able to remove a column with a foreign key constraint', async function() {
        await this.queryInterface.removeColumn('users', 'manager');
        const table = await this.queryInterface.describeTable('users');
        expect(table).to.not.have.property('manager');
      });

      it('should be able to remove a column with primaryKey', async function() {
        await this.queryInterface.removeColumn('users', 'manager');
        const table0 = await this.queryInterface.describeTable('users');
        expect(table0).to.not.have.property('manager');
        await this.queryInterface.removeColumn('users', 'id');
        const table = await this.queryInterface.describeTable('users');
        expect(table).to.not.have.property('id');
      });

      // From MSSQL documentation on ALTER COLUMN:
      //    The modified column cannot be any one of the following:
      //      - Used in a CHECK or UNIQUE constraint.
      // https://docs.microsoft.com/en-us/sql/t-sql/statements/alter-table-transact-sql#arguments
      if (dialect !== 'mssql') {
        it('should be able to remove a column with unique contraint', async function() {
          await this.queryInterface.removeColumn('users', 'email');
          const table = await this.queryInterface.describeTable('users');
          expect(table).to.not.have.property('email');
        });
      }
    });

    describe('(with a schema)', () => {
      beforeEach(async function() {
        await this.sequelize.createSchema('archive');

        await this.queryInterface.createTable({
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

      it('[Flaky] should be able to remove a column with a default value', async function() {
        await this.queryInterface.removeColumn({
          tableName: 'users',
          schema: 'archive'
        }, 'firstName'
        );

        const table = await this.queryInterface.describeTable({
          tableName: 'users',
          schema: 'archive'
        });

        expect(table).to.not.have.property('firstName');
      });

      it('should be able to remove a column without default value', async function() {
        await this.queryInterface.removeColumn({
          tableName: 'users',
          schema: 'archive'
        }, 'lastName'
        );

        const table = await this.queryInterface.describeTable({
          tableName: 'users',
          schema: 'archive'
        });

        expect(table).to.not.have.property('lastName');
      });

      it('should be able to remove a column with primaryKey', async function() {
        await this.queryInterface.removeColumn({
          tableName: 'users',
          schema: 'archive'
        }, 'id');

        const table = await this.queryInterface.describeTable({
          tableName: 'users',
          schema: 'archive'
        });

        expect(table).to.not.have.property('id');
      });

      // From MSSQL documentation on ALTER COLUMN:
      //    The modified column cannot be any one of the following:
      //      - Used in a CHECK or UNIQUE constraint.
      // https://docs.microsoft.com/en-us/sql/t-sql/statements/alter-table-transact-sql#arguments
      if (dialect !== 'mssql') {
        it('should be able to remove a column with unique contraint', async function() {
          await this.queryInterface.removeColumn({
            tableName: 'users',
            schema: 'archive'
          }, 'email');

          const table = await this.queryInterface.describeTable({
            tableName: 'users',
            schema: 'archive'
          });

          expect(table).to.not.have.property('email');
        });
      }
    });
  });
});
