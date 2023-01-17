'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes } = require('@sequelize/core');

const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('QueryInterface'), () => {
  beforeEach(function () {
    this.sequelize.options.quoteIdenifiers = true;
    this.queryInterface = this.sequelize.getQueryInterface();
  });

  afterEach(async function () {
    await Support.dropTestSchemas(this.sequelize);
  });

  describe('removeColumn', () => {
    describe('(without a schema)', () => {
      beforeEach(async function () {
        await this.queryInterface.createTable('users', {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          firstName: {
            type: DataTypes.STRING,
            defaultValue: 'Someone',
          },
          lastName: {
            type: DataTypes.STRING,
          },
          manager: {
            type: DataTypes.INTEGER,
            references: {
              table: 'users',
              key: 'id',
            },
          },
          email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
          },
        });
      });

      it('should be able to remove a column with a default value', async function () {
        await this.queryInterface.removeColumn('users', 'firstName');
        const table = await this.queryInterface.describeTable('users');
        expect(table).to.not.have.property('firstName');
      });

      it('should be able to remove a column without default value', async function () {
        await this.queryInterface.removeColumn('users', 'lastName');
        const table = await this.queryInterface.describeTable('users');
        expect(table).to.not.have.property('lastName');
      });

      it('should be able to remove a column with a foreign key constraint', async function () {
        await this.queryInterface.removeColumn('users', 'manager');
        const table = await this.queryInterface.describeTable('users');
        expect(table).to.not.have.property('manager');
      });

      it('should be able to remove a column with primaryKey', async function () {
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
        it('should be able to remove a column with unique contraint', async function () {
          await this.queryInterface.removeColumn('users', 'email');
          const table = await this.queryInterface.describeTable('users');
          expect(table).to.not.have.property('email');
        });
      }

      // sqlite has limited ALTER TABLE capapibilites which requires a workaround involving recreating tables.
      // This leads to issues with losing data or losing foreign key references.
      // The tests below address these problems
      // TODO: run in all dialects
      if (dialect === 'sqlite') {
        it('should remove a column with from table with foreign key constraints without losing data', async function () {
          await this.queryInterface.createTable('level', {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
            },
            name: {
              type: DataTypes.STRING,
              allowNull: false,
            },
          });

          await this.queryInterface.createTable('actors', {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
            },
            name: {
              type: DataTypes.STRING,
              allowNull: true,
            },
            level_id: {
              type: DataTypes.INTEGER,
              allowNull: false,
              references: {
                key: 'id',
                table: 'level',
              },
              onDelete: 'CASCADE',
              onUpdate: 'CASCADE',
            },
          });

          const levels = [{
            id: 1,
            name: 'L1',
          }, {
            id: 2,
            name: 'L2',
          },
          {
            id: 3,
            name: 'L3',
          }];

          const actors = [
            {
              name: 'Keanu Reeves',
              level_id: 2,
            },
            {
              name: 'Laurence Fishburne',
              level_id: 1,
            },
          ];

          await Promise.all([
            this.queryInterface.bulkInsert('level', levels),
            this.queryInterface.bulkInsert('actors', actors),
          ]);

          await this.queryInterface.removeColumn('level', 'name');

          const actorRows = await this.queryInterface.sequelize.query('SELECT * from actors;', {
            type: 'SELECT',
          });

          expect(actorRows).to.have.length(actors.length, 'actors records should be unaffected');
        });

        it('should retain ON UPDATE and ON DELETE constraints after a column is removed', async function () {
          await this.queryInterface.createTable('level', {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
            },
            name: {
              type: DataTypes.STRING,
              allowNull: false,
            },
          });

          await this.queryInterface.createTable('actors', {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
            },
            name: {
              type: DataTypes.STRING,
              allowNull: true,
            },
            level_id: {
              type: DataTypes.INTEGER,
              allowNull: false,
              references: {
                key: 'id',
                table: 'level',
              },
              onDelete: 'CASCADE',
              onUpdate: 'CASCADE',
            },
          });

          await this.queryInterface.removeColumn('actors', 'name');

          const constraintsQuery = this.queryInterface.queryGenerator.showConstraintsQuery('actors');
          const [{ sql: actorsSql }] = await this.queryInterface.sequelize.query(constraintsQuery, {
            type: 'SELECT',
          });

          expect(actorsSql).to.include('ON DELETE CASCADE', 'should include ON DELETE constraint');
          expect(actorsSql).to.include('ON UPDATE CASCADE', 'should include ON UPDATE constraint');
        });
      }
    });

    if (Support.sequelize.dialect.supports.schemas) {
      describe('(with a schema)', () => {
        beforeEach(async function () {
          await this.sequelize.createSchema('archive');

          await this.queryInterface.createTable({
            tableName: 'users',
            schema: 'archive',
          }, {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
            },
            firstName: {
              type: DataTypes.STRING,
              defaultValue: 'Someone',
            },
            lastName: {
              type: DataTypes.STRING,
            },
            email: {
              type: DataTypes.STRING,
              unique: true,
              allowNull: false,
            },
          });
        });

        it('[Flaky] should be able to remove a column with a default value', async function () {
          await this.queryInterface.removeColumn({
            tableName: 'users',
            schema: 'archive',
          }, 'firstName');

          const table = await this.queryInterface.describeTable({
            tableName: 'users',
            schema: 'archive',
          });

          expect(table).to.not.have.property('firstName');
        });

        it('should be able to remove a column without default value', async function () {
          await this.queryInterface.removeColumn({
            tableName: 'users',
            schema: 'archive',
          }, 'lastName');

          const table = await this.queryInterface.describeTable({
            tableName: 'users',
            schema: 'archive',
          });

          expect(table).to.not.have.property('lastName');
        });

        it('should be able to remove a column with primaryKey', async function () {
          await this.queryInterface.removeColumn({
            tableName: 'users',
            schema: 'archive',
          }, 'id');

          const table = await this.queryInterface.describeTable({
            tableName: 'users',
            schema: 'archive',
          });

          expect(table).to.not.have.property('id');
        });

        // From MSSQL documentation on ALTER COLUMN:
        //    The modified column cannot be any one of the following:
        //      - Used in a CHECK or UNIQUE constraint.
        // https://docs.microsoft.com/en-us/sql/t-sql/statements/alter-table-transact-sql#arguments
        if (dialect !== 'mssql') {
          it('should be able to remove a column with unique contraint', async function () {
            await this.queryInterface.removeColumn({
              tableName: 'users',
              schema: 'archive',
            }, 'email');

            const table = await this.queryInterface.describeTable({
              tableName: 'users',
              schema: 'archive',
            });

            expect(table).to.not.have.property('email');
          });
        }
      });
    }
  });
});
