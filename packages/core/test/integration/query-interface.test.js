'use strict';

const uniq = require('lodash/uniq');

const chai = require('chai');

const expect = chai.expect;
const Support = require('./support');
const { DataTypes } = require('@sequelize/core');

const dialectName = Support.getTestDialect();
const dialect = Support.sequelize.dialect;

describe('QueryInterface', () => {
  beforeEach(function () {
    this.queryInterface = this.sequelize.queryInterface;
  });

  describe('dropAllSchema', () => {
    if (!dialect.supports.schemas) {
      return;
    }

    it('should drop all schema', async function () {
      await this.queryInterface.dropAllSchemas({
        skip: [this.sequelize.options.replication.write.database],
      });
      const schemaNames = await this.queryInterface.listSchemas();
      await this.queryInterface.createSchema('newSchema');
      const newSchemaNames = await this.queryInterface.listSchemas();

      expect(newSchemaNames).to.have.length(schemaNames.length + 1);
    });
  });

  describe('dropAllTables', () => {
    it('should drop all tables', async function () {
      await this.queryInterface.dropAllTables();
      const tableNames = await this.queryInterface.listTables();
      expect(tableNames).to.be.empty;

      await this.queryInterface.createTable('table', { name: DataTypes.STRING });
      const tableNames1 = await this.queryInterface.listTables();
      expect(tableNames1).to.have.length(1);

      await this.queryInterface.dropAllTables();
      const tableNames2 = await this.queryInterface.listTables();
      expect(tableNames2).to.be.empty;
    });

    it('should be able to skip given tables', async function () {
      await this.queryInterface.createTable('skipme', {
        name: DataTypes.STRING,
      });
      await this.queryInterface.dropAllTables({ skip: ['skipme'] });
      const result = await this.queryInterface.listTables();
      const tableNames = result.map(v => v.tableName);

      expect(tableNames).to.contain('skipme');
    });

    it('should be able to drop a foreign key', async function () {
      await this.queryInterface.dropAllTables();

      const tableNames = await this.queryInterface.listTables();
      expect(tableNames).to.be.empty;

      await this.queryInterface.createTable('users', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
      });
      await this.queryInterface.createTable('level', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
      });
      await this.queryInterface.addColumn('users', 'level_id', {
        type: DataTypes.INTEGER,
        references: {
          table: 'level',
          key: 'id',
        },
        onUpdate: 'cascade',
        onDelete: 'set null',
      });

      const tableNames1 = await this.queryInterface.listTables();
      expect(tableNames1).to.have.length(2);

      await this.queryInterface.dropAllTables();

      const tableNames2 = await this.queryInterface.listTables();
      expect(tableNames2).to.be.empty;
    });
  });

  describe('indexes', () => {
    beforeEach(async function () {
      await this.queryInterface.dropTable('Group');
      await this.queryInterface.createTable('Group', {
        username: DataTypes.STRING,
        isAdmin: DataTypes.BOOLEAN,
        from: DataTypes.STRING,
      });
    });

    it('adds, reads and removes an index to the table', async function () {
      await this.queryInterface.addIndex('Group', ['username', 'isAdmin']);
      let indexes = await this.queryInterface.showIndex('Group');
      let indexColumns = uniq(indexes.map(index => index.name));
      expect(indexColumns).to.include('group_username_is_admin');
      await this.queryInterface.removeIndex('Group', ['username', 'isAdmin']);
      indexes = await this.queryInterface.showIndex('Group');
      indexColumns = uniq(indexes.map(index => index.name));
      expect(indexColumns).to.be.empty;
    });

    if (dialect.supports.schemas) {
      it('works with schemas', async function () {
        await this.sequelize.createSchema('schema');
        await this.queryInterface.createTable(
          'table',
          {
            name: {
              type: DataTypes.STRING,
            },
            isAdmin: {
              type: DataTypes.STRING,
            },
          },
          {
            schema: 'schema',
          },
        );
        await this.queryInterface.addIndex(
          { schema: 'schema', tableName: 'table' },
          ['name', 'isAdmin'],
          null,
          'schema_table',
        );
        const indexes = await this.queryInterface.showIndex({
          schema: 'schema',
          tableName: 'table',
        });
        expect(indexes.length).to.eq(1);
        expect(indexes[0].name).to.eq('table_name_is_admin');
      });
    }

    it('does not fail on reserved keywords', async function () {
      await this.queryInterface.addIndex('Group', ['from']);
    });
  });

  if (dialectName !== 'ibmi') {
    describe('renameColumn', () => {
      it('rename a simple column', async function () {
        const Users = this.sequelize.define(
          '_Users',
          {
            username: DataTypes.STRING,
          },
          { freezeTableName: true },
        );

        await Users.sync({ force: true });
        await this.queryInterface.renameColumn('_Users', 'username', 'pseudo');
        const table = await this.queryInterface.describeTable('_Users');
        expect(table).to.have.property('pseudo');
        expect(table).to.not.have.property('username');
      });

      if (dialect.supports.schemas) {
        it('works with schemas', async function () {
          await this.sequelize.createSchema('archive');
          const Users = this.sequelize.define(
            'User',
            {
              username: DataTypes.STRING,
            },
            {
              tableName: 'Users',
              schema: 'archive',
            },
          );
          await Users.sync({ force: true });
          await this.queryInterface.renameColumn(
            {
              schema: 'archive',
              tableName: 'Users',
            },
            'username',
            'pseudo',
          );
          const table = await this.queryInterface.describeTable({
            schema: 'archive',
            tableName: 'Users',
          });
          expect(table).to.have.property('pseudo');
          expect(table).to.not.have.property('username');
        });
      }

      it('rename a column non-null without default value', async function () {
        const Users = this.sequelize.define(
          '_Users',
          {
            username: {
              type: DataTypes.STRING,
              allowNull: false,
            },
          },
          { freezeTableName: true },
        );

        await Users.sync({ force: true });
        await this.queryInterface.renameColumn('_Users', 'username', 'pseudo');
        const table = await this.queryInterface.describeTable('_Users');
        expect(table).to.have.property('pseudo');
        expect(table).to.not.have.property('username');
      });

      it('rename a boolean column non-null without default value', async function () {
        const Users = this.sequelize.define(
          '_Users',
          {
            active: {
              type: DataTypes.BOOLEAN,
              allowNull: false,
              defaultValue: false,
            },
          },
          { freezeTableName: true },
        );

        await Users.sync({ force: true });
        await this.queryInterface.renameColumn('_Users', 'active', 'enabled');
        const table = await this.queryInterface.describeTable('_Users');
        expect(table).to.have.property('enabled');
        expect(table).to.not.have.property('active');
      });

      if (dialectName !== 'db2') {
        // Db2 does not allow rename of a primary key column
        it('renames a column primary key autoIncrement column', async function () {
          const Fruits = this.sequelize.define(
            'Fruit',
            {
              fruitId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
              },
            },
            { freezeTableName: true },
          );

          await Fruits.sync({ force: true });
          await this.queryInterface.renameColumn('Fruit', 'fruitId', 'fruit_id');
          const table = await this.queryInterface.describeTable('Fruit');
          expect(table).to.have.property('fruit_id');
          expect(table).to.not.have.property('fruitId');
        });
      }

      it('shows a reasonable error message when column is missing', async function () {
        const Users = this.sequelize.define(
          '_Users',
          {
            username: DataTypes.STRING,
          },
          { freezeTableName: true },
        );

        await Users.sync({ force: true });
        await expect(
          this.queryInterface.renameColumn('_Users', 'email', 'pseudo'),
        ).to.be.rejectedWith("Table _Users doesn't have the column email");
      });
    });
  }

  describe('addColumn', () => {
    beforeEach(async function () {
      await this.queryInterface.createTable('users', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
      });
    });

    it('should be able to add a foreign key reference', async function () {
      await this.queryInterface.createTable('level', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
      });
      await this.queryInterface.addColumn('users', 'level_id', {
        type: DataTypes.INTEGER,
        references: {
          table: 'level',
          key: 'id',
        },
        onUpdate: 'cascade',
        onDelete: 'set null',
      });
      const table = await this.queryInterface.describeTable('users');
      expect(table).to.have.property('level_id');
    });

    it('addColumn expected error', async function () {
      await this.queryInterface.createTable('level2', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
      });

      const testArgs = (...args) =>
        expect(this.queryInterface.addColumn(...args)).to.be.rejectedWith(
          Error,
          'addColumn takes at least 3 arguments (table, attribute name, attribute definition)',
        );

      await testArgs('users', 'level_id');
      await testArgs(null, 'level_id');
      await testArgs('users', null, {});
    });

    if (dialect.supports.schemas) {
      it('should work with schemas', async function () {
        await this.sequelize.createSchema('archive');
        await this.queryInterface.createTable(
          { tableName: 'users', schema: 'archive' },
          {
            id: {
              type: DataTypes.INTEGER,
              primaryKey: true,
              autoIncrement: true,
            },
          },
        );
        await this.queryInterface.addColumn({ tableName: 'users', schema: 'archive' }, 'level_id', {
          type: DataTypes.INTEGER,
        });
        const table = await this.queryInterface.describeTable({
          tableName: 'users',
          schema: 'archive',
        });
        expect(table).to.have.property('level_id');
      });
    }

    // Db2 does not support enums in alter column
    if (dialectName !== 'db2') {
      it('should work with enums (1)', async function () {
        await this.queryInterface.addColumn(
          'users',
          'someEnum',
          DataTypes.ENUM('value1', 'value2', 'value3'),
        );
      });

      it('should work with enums (2)', async function () {
        await this.queryInterface.addColumn('users', 'someOtherEnum', {
          type: DataTypes.ENUM(['value1', 'value2', 'value3']),
        });
      });
    }

    if (dialectName === 'postgres') {
      it('should be able to add a column of type of array of enums', async function () {
        await this.queryInterface.addColumn('users', 'tags', {
          allowNull: false,
          type: DataTypes.ARRAY(DataTypes.ENUM('Value1', 'Value2', 'Value3')),
        });
        const result = await this.queryInterface.describeTable('users');
        expect(result).to.have.property('tags');
        expect(result.tags.type).to.equal('ARRAY');
        expect(result.tags.allowNull).to.be.false;
      });
    }
  });
});
