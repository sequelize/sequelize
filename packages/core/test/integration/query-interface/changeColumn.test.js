'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes } = require('@sequelize/core');

const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('QueryInterface'), () => {
  beforeEach(async function () {
    this.queryInterface = this.sequelize.queryInterface;
  });

  describe('changeColumn', () => {
    if (Support.sequelize.dialect.supports.schemas) {
      it('should support schemas', async function () {
        await this.sequelize.createSchema('archive');

        await this.queryInterface.createTable(
          {
            tableName: 'users',
            schema: 'archive',
          },
          {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
            },
            currency: DataTypes.INTEGER,
          },
        );

        await this.queryInterface.changeColumn(
          {
            tableName: 'users',
            schema: 'archive',
          },
          'currency',
          {
            type: DataTypes.FLOAT,
          },
        );

        const table = await this.queryInterface.describeTable({
          tableName: 'users',
          schema: 'archive',
        });

        if (['postgres', 'postgres-native', 'mssql', 'db2'].includes(dialect)) {
          expect(table.currency.type).to.equal('REAL');
        } else {
          expect(table.currency.type).to.equal('FLOAT');
        }
      });
    }

    it('should change columns', async function () {
      await this.queryInterface.createTable(
        {
          tableName: 'users',
        },
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          currency: DataTypes.INTEGER,
        },
      );
      if (dialect === 'db2') {
        // DB2 can change only one attr of a column
        await this.queryInterface.changeColumn('users', 'currency', {
          type: DataTypes.FLOAT,
        });
      } else {
        await this.queryInterface.changeColumn('users', 'currency', {
          type: DataTypes.FLOAT,
          allowNull: true,
        });
      }

      const table = await this.queryInterface.describeTable({
        tableName: 'users',
      });

      if (['postgres', 'postgres-native', 'mssql', 'sqlite3', 'db2'].includes(dialect)) {
        expect(table.currency.type).to.equal('REAL');
      } else {
        expect(table.currency.type).to.equal('FLOAT');
      }
    });

    // MSSQL doesn't support using a modified column in a check constraint.
    // https://docs.microsoft.com/en-us/sql/t-sql/statements/alter-table-transact-sql
    if (dialect !== 'mssql' && dialect !== 'db2') {
      it('should work with enums (case 1)', async function () {
        await this.queryInterface.createTable(
          {
            tableName: 'users',
          },
          {
            firstName: DataTypes.STRING,
          },
        );

        await this.queryInterface.changeColumn('users', 'firstName', {
          type: DataTypes.ENUM(['value1', 'value2', 'value3']),
        });
      });

      it('should work with enums (case 2)', async function () {
        await this.queryInterface.createTable(
          {
            tableName: 'users',
          },
          {
            firstName: DataTypes.STRING,
          },
        );

        await this.queryInterface.changeColumn('users', 'firstName', {
          type: DataTypes.ENUM(['value1', 'value2', 'value3']),
        });
      });

      if (Support.sequelize.dialect.supports.schemas) {
        it('should work with enums with schemas', async function () {
          await this.sequelize.createSchema('archive');

          await this.queryInterface.createTable(
            {
              tableName: 'users',
              schema: 'archive',
            },
            {
              firstName: DataTypes.STRING,
            },
          );

          await this.queryInterface.changeColumn(
            {
              tableName: 'users',
              schema: 'archive',
            },
            'firstName',
            {
              type: DataTypes.ENUM(['value1', 'value2', 'value3']),
            },
          );
        });
      }
    }

    describe('should support foreign keys', () => {
      beforeEach(async function () {
        await this.queryInterface.createTable('users', {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          level_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
          },
        });

        await this.queryInterface.createTable('level', {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
        });
      });

      it('able to change column to foreign key', async function () {
        const foreignKeys = await this.queryInterface.showConstraints('users', {
          constraintType: 'FOREIGN KEY',
        });
        expect(foreignKeys).to.be.an('array');
        expect(foreignKeys).to.be.empty;

        await this.queryInterface.changeColumn('users', 'level_id', {
          type: DataTypes.INTEGER,
          references: {
            table: 'level',
            key: 'id',
          },
          onUpdate: 'cascade',
          onDelete: 'cascade',
        });

        const newForeignKeys = await this.queryInterface.showConstraints('users', {
          constraintType: 'FOREIGN KEY',
        });
        expect(newForeignKeys).to.be.an('array');
        expect(newForeignKeys).to.have.lengthOf(1);
        expect(newForeignKeys[0].columnNames).to.deep.equal(['level_id']);
      });

      it('able to change column property without affecting other properties', async function () {
        // 1. look for users table information
        // 2. change column level_id on users to have a Foreign Key
        // 3. look for users table Foreign Keys information
        // 4. change column level_id AGAIN to allow null values
        // 5. look for new foreign keys information
        // 6. look for new table structure information
        // 7. compare foreign keys and tables(before and after the changes)
        const firstTable = await this.queryInterface.describeTable({
          tableName: 'users',
        });

        await this.queryInterface.changeColumn('users', 'level_id', {
          type: DataTypes.INTEGER,
          references: {
            table: 'level',
            key: 'id',
          },
          onUpdate: 'cascade',
          onDelete: 'cascade',
        });

        const keys = await this.queryInterface.showConstraints('users', {
          constraintType: 'FOREIGN KEY',
        });
        const firstForeignKeys = keys;

        await this.queryInterface.changeColumn('users', 'level_id', {
          type: DataTypes.INTEGER,
          allowNull: true,
        });

        const newForeignKeys = await this.queryInterface.showConstraints('users', {
          constraintType: 'FOREIGN KEY',
        });
        expect(firstForeignKeys.length).to.equal(newForeignKeys.length);
        expect(firstForeignKeys[0].columnNames).to.deep.equal(['level_id']);
        expect(firstForeignKeys[0].columnNames).to.deep.equal(newForeignKeys[0].columnNames);

        const describedTable = await this.queryInterface.describeTable({
          tableName: 'users',
        });

        expect(describedTable.level_id).to.have.property('allowNull');
        expect(describedTable.level_id.allowNull).to.not.equal(firstTable.level_id.allowNull);
        expect(describedTable.level_id.allowNull).to.equal(true);
      });

      if (!['db2', 'ibmi', 'sqlite3'].includes(dialect)) {
        it('should change the comment of column', async function () {
          const describedTable = await this.queryInterface.describeTable({
            tableName: 'users',
          });

          expect(describedTable.level_id.comment).to.equal(null);

          await this.queryInterface.changeColumn('users', 'level_id', {
            type: DataTypes.INTEGER,
            comment: 'FooBar',
          });

          const describedTable2 = await this.queryInterface.describeTable({ tableName: 'users' });
          expect(describedTable2.level_id.comment).to.equal('FooBar');
        });
      }
    });

    // sqlite has limited ALTER TABLE capapibilites which requires a workaround involving recreating tables.
    // This leads to issues with losing data or losing foreign key references.
    // The tests below address these problems
    // TODO: run in all dialects
    if (dialect === 'sqlite3') {
      it('should not loose indexes & unique constraints when adding or modifying columns', async function () {
        await this.queryInterface.createTable('foos', {
          id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER,
          },
          name: {
            allowNull: false,
            unique: true,
            type: DataTypes.STRING,
          },
          email: {
            allowNull: false,
            unique: true,
            type: DataTypes.STRING,
          },
          birthday: {
            allowNull: false,
            type: DataTypes.DATEONLY,
          },
        });

        await this.queryInterface.addIndex('foos', ['birthday']);
        const initialIndexes = await this.queryInterface.showIndex('foos');
        let table = await this.queryInterface.describeTable('foos');
        expect(table.email.unique).to.equal(true, '(0) email column should be unique');
        expect(table.name.unique).to.equal(true, '(0) name column should be unique');

        await this.queryInterface.addColumn('foos', 'phone', {
          type: DataTypes.STRING,
          defaultValue: null,
          allowNull: true,
        });

        expect(await this.queryInterface.showIndex('foos')).to.deep.equal(
          initialIndexes,
          'addColumn should not modify indexes',
        );

        table = await this.queryInterface.describeTable('foos');
        expect(table.phone.allowNull).to.equal(true, '(1) phone column should allow null values');
        expect(table.phone.defaultValue).to.equal(
          null,
          '(1) phone column should have a default value of null',
        );
        expect(table.email.unique).to.equal(true, '(1) email column should remain unique');
        expect(table.name.unique).to.equal(true, '(1) name column should remain unique');

        await this.queryInterface.changeColumn('foos', 'email', {
          type: DataTypes.STRING,
          allowNull: true,
        });

        expect(await this.queryInterface.showIndex('foos')).to.deep.equal(
          initialIndexes,
          'changeColumn should not modify indexes',
        );

        table = await this.queryInterface.describeTable('foos');
        expect(table.email.allowNull).to.equal(true, '(2) email column should allow null values');
        expect(table.email.unique).to.equal(true, '(2) email column should remain unique');
        expect(table.name.unique).to.equal(true, '(2) name column should remain unique');
      });

      it('should add unique constraints to 2 columns and keep allowNull', async function () {
        await this.queryInterface.createTable(
          {
            tableName: 'Foos',
          },
          {
            id: {
              allowNull: false,
              autoIncrement: true,
              primaryKey: true,
              type: DataTypes.INTEGER,
            },
            name: {
              allowNull: false,
              type: DataTypes.STRING,
            },
            email: {
              allowNull: true,
              type: DataTypes.STRING,
            },
          },
        );

        await this.queryInterface.changeColumn('Foos', 'name', {
          type: DataTypes.STRING,
          unique: true,
        });
        await this.queryInterface.changeColumn('Foos', 'email', {
          type: DataTypes.STRING,
          unique: true,
        });

        const table = await this.queryInterface.describeTable({
          tableName: 'Foos',
        });
        expect(table.name.allowNull).to.equal(false);
        expect(table.name.unique).to.equal(true);
        expect(table.email.allowNull).to.equal(true);
        expect(table.email.unique).to.equal(true);
      });

      it('should not remove foreign keys when adding or modifying columns', async function () {
        const Task = this.sequelize.define('Task', { title: DataTypes.STRING });
        const User = this.sequelize.define('User', { username: DataTypes.STRING });

        User.hasOne(Task);

        await User.sync({ force: true });
        await Task.sync({ force: true });

        await this.queryInterface.addColumn('Tasks', 'bar', DataTypes.INTEGER);
        let refs = await this.queryInterface.showConstraints(Task, {
          constraintType: 'FOREIGN KEY',
        });
        expect(refs.length).to.equal(1, 'should keep foreign key after adding column');
        expect(refs[0].columnNames).to.deep.equal(['userId']);
        expect(refs[0].referencedTableName).to.equal('Users');
        expect(refs[0].referencedColumnNames).to.deep.equal(['id']);

        await this.queryInterface.changeColumn('Tasks', 'bar', DataTypes.STRING);
        refs = await this.queryInterface.showConstraints(Task, { constraintType: 'FOREIGN KEY' });
        expect(refs.length).to.equal(1, 'should keep foreign key after changing column');
        expect(refs[0].columnNames).to.deep.equal(['userId']);
        expect(refs[0].referencedTableName).to.equal('Users');
        expect(refs[0].referencedColumnNames).to.deep.equal(['id']);

        await this.queryInterface.renameColumn('Tasks', 'bar', 'foo');
        refs = await this.queryInterface.showConstraints(Task, { constraintType: 'FOREIGN KEY' });
        expect(refs.length).to.equal(1, 'should keep foreign key after renaming column');
        expect(refs[0].columnNames).to.deep.equal(['userId']);
        expect(refs[0].referencedTableName).to.equal('Users');
        expect(refs[0].referencedColumnNames).to.deep.equal(['id']);
      });

      it('should retain ON UPDATE and ON DELETE constraints after a column is changed', async function () {
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

        await this.queryInterface.createTable('users', {
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

        await this.queryInterface.changeColumn('users', 'name', {
          type: DataTypes.STRING,
          allowNull: false,
        });

        await this.queryInterface.changeColumn('users', 'level_id', {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            key: 'id',
            table: 'level',
          },
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        });

        const constraints = await this.queryInterface.showConstraints('users');
        const foreignKey = constraints.find(
          constraint => constraint.constraintType === 'FOREIGN KEY',
        );
        expect(foreignKey).to.not.be.undefined;
        expect(foreignKey).to.have.property('deleteAction', 'CASCADE');
        expect(foreignKey).to.have.property('updateAction', 'CASCADE');
      });

      it('should change columns with foreign key constraints without data loss', async function () {
        await this.queryInterface.createTable('users', {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          name: {
            type: DataTypes.INTEGER,
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

        const levels = [
          {
            id: 1,
            name: 'L1',
          },
          {
            id: 2,
            name: 'L2',
          },
          {
            id: 3,
            name: 'L3',
          },
        ];

        const users = [
          {
            name: 'Morpheus',
            level_id: 2,
          },
          {
            name: 'Neo',
            level_id: 1,
          },
        ];

        await Promise.all([
          this.queryInterface.bulkInsert('level', levels),
          this.queryInterface.bulkInsert('users', users),
        ]);

        await this.queryInterface.changeColumn('level', 'name', {
          type: DataTypes.STRING,
          allowNull: true,
        });

        const userRows = await this.queryInterface.sequelize.query('SELECT * from users;', {
          type: 'SELECT',
        });

        expect(userRows).to.have.length(users.length, 'user records should be unaffected');
      });
    }
  });
});
