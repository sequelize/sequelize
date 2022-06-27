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

  describe('changeColumn', () => {
    it('should support schemas', async function() {
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
        currency: DataTypes.INTEGER
      });

      await this.queryInterface.changeColumn({
        tableName: 'users',
        schema: 'archive'
      }, 'currency', {
        type: DataTypes.FLOAT
      });

      const table = await this.queryInterface.describeTable({
        tableName: 'users',
        schema: 'archive'
      });

      if (['postgres', 'postgres-native'].includes(dialect)) {
        expect(table.currency.type).to.equal('DOUBLE PRECISION');
      } else if (dialect === 'db2') {
        expect(table.currency.type).to.equal('DOUBLE');
      } else if (dialect === 'oracle') {
        expect(table.currency.type).to.equal('BINARY_FLOAT');
      } else {
        expect(table.currency.type).to.equal('FLOAT');
      }
    });

    it('should change columns', async function() {
      await this.queryInterface.createTable({
        tableName: 'users'
      }, {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        currency: DataTypes.INTEGER
      });
      if (dialect === 'db2') { // DB2 can change only one attr of a column
        await this.queryInterface.changeColumn('users', 'currency', {
          type: DataTypes.FLOAT
        });
      } else {
        await this.queryInterface.changeColumn('users', 'currency', {
          type: DataTypes.FLOAT,
          allowNull: true
        });
      }
      const table = await this.queryInterface.describeTable({
        tableName: 'users'
      });

      if (['postgres', 'postgres-native'].includes(dialect)) {
        expect(table.currency.type).to.equal('DOUBLE PRECISION');
      } else if (dialect === 'db2') {
        expect(table.currency.type).to.equal('DOUBLE');
      } else if (dialect === 'oracle') {
        expect(table.currency.type).to.equal('BINARY_FLOAT');
      } else {
        expect(table.currency.type).to.equal('FLOAT');
      }
    });

    // MSSQL doesn't support using a modified column in a check constraint.
    // https://docs.microsoft.com/en-us/sql/t-sql/statements/alter-table-transact-sql
    if (dialect !== 'mssql' && dialect !== 'db2') {
      it('should work with enums (case 1)', async function() {
        await this.queryInterface.createTable({
          tableName: 'users'
        }, {
          firstName: DataTypes.STRING
        });

        await this.queryInterface.changeColumn('users', 'firstName', {
          type: DataTypes.ENUM(['value1', 'value2', 'value3'])
        });
      });

      it('should work with enums (case 2)', async function() {
        await this.queryInterface.createTable({
          tableName: 'users'
        }, {
          firstName: DataTypes.STRING
        });

        await this.queryInterface.changeColumn('users', 'firstName', {
          type: DataTypes.ENUM,
          values: ['value1', 'value2', 'value3']
        });
      });

      it('should work with enums with schemas', async function() {
        await this.sequelize.createSchema('archive');

        await this.queryInterface.createTable({
          tableName: 'users',
          schema: 'archive'
        }, {
          firstName: DataTypes.STRING
        });

        await this.queryInterface.changeColumn({
          tableName: 'users',
          schema: 'archive'
        }, 'firstName', {
          type: DataTypes.ENUM(['value1', 'value2', 'value3'])
        });
      });
    }

    //SQlite natively doesn't support ALTER Foreign key
    if (dialect !== 'sqlite') {
      describe('should support foreign keys', () => {
        beforeEach(async function() {
          await this.queryInterface.createTable('users', {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true
            },
            level_id: {
              type: DataTypes.INTEGER,
              allowNull: false
            }
          });

          await this.queryInterface.createTable('level', {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true
            }
          });
        });

        it('able to change column to foreign key', async function() {
          const foreignKeys = await this.queryInterface.getForeignKeyReferencesForTable('users');
          expect(foreignKeys).to.be.an('array');
          expect(foreignKeys).to.be.empty;

          await this.queryInterface.changeColumn('users', 'level_id', {
            type: DataTypes.INTEGER,
            references: {
              model: 'level',
              key: 'id'
            },
            onUpdate: 'cascade',
            onDelete: 'cascade'
          });

          const newForeignKeys = await this.queryInterface.getForeignKeyReferencesForTable('users');
          expect(newForeignKeys).to.be.an('array');
          expect(newForeignKeys).to.have.lengthOf(1);
          expect(newForeignKeys[0].columnName).to.be.equal('level_id');
        });

        it('able to change column property without affecting other properties', async function() {
          // 1. look for users table information
          // 2. change column level_id on users to have a Foreign Key
          // 3. look for users table Foreign Keys information
          // 4. change column level_id AGAIN to allow null values
          // 5. look for new foreign keys information
          // 6. look for new table structure information
          // 7. compare foreign keys and tables(before and after the changes)
          const firstTable = await this.queryInterface.describeTable({
            tableName: 'users'
          });

          await this.queryInterface.changeColumn('users', 'level_id', {
            type: DataTypes.INTEGER,
            references: {
              model: 'level',
              key: 'id'
            },
            onUpdate: 'cascade',
            onDelete: 'cascade'
          });

          const keys = await this.queryInterface.getForeignKeyReferencesForTable('users');
          const firstForeignKeys = keys;

          await this.queryInterface.changeColumn('users', 'level_id', {
            type: DataTypes.INTEGER,
            allowNull: true
          });

          const newForeignKeys = await this.queryInterface.getForeignKeyReferencesForTable('users');
          expect(firstForeignKeys.length).to.be.equal(newForeignKeys.length);
          expect(firstForeignKeys[0].columnName).to.be.equal('level_id');
          expect(firstForeignKeys[0].columnName).to.be.equal(newForeignKeys[0].columnName);

          const describedTable = await this.queryInterface.describeTable({
            tableName: 'users'
          });

          expect(describedTable.level_id).to.have.property('allowNull');
          expect(describedTable.level_id.allowNull).to.not.equal(firstTable.level_id.allowNull);
          expect(describedTable.level_id.allowNull).to.be.equal(true);
        });
        // For Oracle, comments are not part of table description and are stored differently.   
        if (!['db2', 'oracle'].includes(dialect)) {
          it('should change the comment of column', async function() {
            const describedTable = await this.queryInterface.describeTable({
              tableName: 'users'
            });

            expect(describedTable.level_id.comment).to.be.equal(null);

            await this.queryInterface.changeColumn('users', 'level_id', {
              type: DataTypes.INTEGER,
              comment: 'FooBar'
            });

            const describedTable2 = await this.queryInterface.describeTable({ tableName: 'users' });
            expect(describedTable2.level_id.comment).to.be.equal('FooBar');
          });
        }
      });	  
    }

    if (dialect === 'sqlite') {
      it('should not remove unique constraints when adding or modifying columns', async function() {
        await this.queryInterface.createTable({
          tableName: 'Foos'
        }, {
          id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
          },
          name: {
            allowNull: false,
            unique: true,
            type: DataTypes.STRING
          },
          email: {
            allowNull: false,
            unique: true,
            type: DataTypes.STRING
          }
        });

        await this.queryInterface.addColumn('Foos', 'phone', {
          type: DataTypes.STRING,
          defaultValue: null,
          allowNull: true
        });

        let table = await this.queryInterface.describeTable({
          tableName: 'Foos'
        });
        expect(table.phone.allowNull).to.equal(true, '(1) phone column should allow null values');
        expect(table.phone.defaultValue).to.equal(null, '(1) phone column should have a default value of null');
        expect(table.email.unique).to.equal(true, '(1) email column should remain unique');
        expect(table.name.unique).to.equal(true, '(1) name column should remain unique');

        await this.queryInterface.changeColumn('Foos', 'email', {
          type: DataTypes.STRING,
          allowNull: true
        });

        table = await this.queryInterface.describeTable({
          tableName: 'Foos'
        });
        expect(table.email.allowNull).to.equal(true, '(2) email column should allow null values');
        expect(table.email.unique).to.equal(true, '(2) email column should remain unique');
        expect(table.name.unique).to.equal(true, '(2) name column should remain unique');
      });

      it('should add unique constraints to 2 columns and keep allowNull', async function() {
        await this.queryInterface.createTable({
          tableName: 'Foos'
        }, {
          id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
          },
          name: {
            allowNull: false,
            type: DataTypes.STRING
          },
          email: {
            allowNull: true,
            type: DataTypes.STRING
          }
        });

        await this.queryInterface.changeColumn('Foos', 'name', {
          type: DataTypes.STRING,
          unique: true
        });
        await this.queryInterface.changeColumn('Foos', 'email', {
          type: DataTypes.STRING,
          unique: true
        });

        const table = await this.queryInterface.describeTable({
          tableName: 'Foos'
        });
        expect(table.name.allowNull).to.equal(false);
        expect(table.name.unique).to.equal(true);
        expect(table.email.allowNull).to.equal(true);
        expect(table.email.unique).to.equal(true);
      });

      it('should not remove foreign keys when adding or modifying columns', async function() {
        const Task = this.sequelize.define('Task', { title: DataTypes.STRING }),
          User = this.sequelize.define('User', { username: DataTypes.STRING });

        User.hasOne(Task);

        await User.sync({ force: true });
        await Task.sync({ force: true });

        await this.queryInterface.addColumn('Tasks', 'bar', DataTypes.INTEGER);
        let refs = await this.queryInterface.getForeignKeyReferencesForTable('Tasks');
        expect(refs.length).to.equal(1, 'should keep foreign key after adding column');
        expect(refs[0].columnName).to.equal('UserId');
        expect(refs[0].referencedTableName).to.equal('Users');
        expect(refs[0].referencedColumnName).to.equal('id');

        await this.queryInterface.changeColumn('Tasks', 'bar', DataTypes.STRING);
        refs = await this.queryInterface.getForeignKeyReferencesForTable('Tasks');
        expect(refs.length).to.equal(1, 'should keep foreign key after changing column');
        expect(refs[0].columnName).to.equal('UserId');
        expect(refs[0].referencedTableName).to.equal('Users');
        expect(refs[0].referencedColumnName).to.equal('id');

        await this.queryInterface.renameColumn('Tasks', 'bar', 'foo');
        refs = await this.queryInterface.getForeignKeyReferencesForTable('Tasks');
        expect(refs.length).to.equal(1, 'should keep foreign key after renaming column');
        expect(refs[0].columnName).to.equal('UserId');
        expect(refs[0].referencedTableName).to.equal('Users');
        expect(refs[0].referencedColumnName).to.equal('id');
      });
    }
  });
});
