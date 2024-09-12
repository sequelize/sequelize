'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('./support');
const DataTypes = require('sequelize/lib/data-types');
const dialect = Support.getTestDialect();
const Sequelize = Support.Sequelize;
const current = Support.sequelize;
const _ = require('lodash');

describe(Support.getTestDialectTeaser('QueryInterface'), () => {
  beforeEach(function() {
    this.sequelize.options.quoteIdenifiers = true;
    this.queryInterface = this.sequelize.getQueryInterface();
  });

  afterEach(async function() {
    await Support.dropTestSchemas(this.sequelize);
  });

  describe('dropAllSchema', () => {
    it('should drop all schema', async function() {
      await this.queryInterface.dropAllSchemas({
        skip: [this.sequelize.config.database]
      });
      const schemaNames = await this.queryInterface.showAllSchemas();
      await this.queryInterface.createSchema('newSchema');
      const newSchemaNames = await this.queryInterface.showAllSchemas();
      if (!current.dialect.supports.schemas) return;
      expect(newSchemaNames).to.have.length(schemaNames.length + 1);
      await this.queryInterface.dropSchema('newSchema');
    });
  });

  describe('showAllTables', () => {
    it('should not contain views', async function() {
      async function cleanup(sequelize) {
        if (dialect === 'db2') {
          await sequelize.query('DROP VIEW V_Fail');
        } else if (dialect === 'oracle') {
          const plsql = [
            'BEGIN',
            'EXECUTE IMMEDIATE',
            '\'DROP VIEW V_Fail\';',
            'EXCEPTION WHEN OTHERS THEN',
            '  IF SQLCODE != -942 THEN',
            '    RAISE;',
            '  END IF;',
            'END;'
          ].join(' ');
          await sequelize.query(plsql);
        } else {
          await sequelize.query('DROP VIEW IF EXISTS V_Fail');
        }
      }
      await this.queryInterface.createTable('my_test_table', { name: DataTypes.STRING });
      await cleanup(this.sequelize);
      const sql = dialect === 'db2' ? 'CREATE VIEW V_Fail AS SELECT 1 Id FROM SYSIBM.SYSDUMMY1' : `CREATE VIEW V_Fail AS SELECT 1 Id${  Support.addDualInSelect()}`;
      await this.sequelize.query(sql);
      let tableNames = await this.queryInterface.showAllTables();
      await cleanup(this.sequelize);
      if (tableNames[0] && tableNames[0].tableName) {
        tableNames = tableNames.map(v => v.tableName);
      }
      expect(tableNames).to.deep.equal(['my_test_table']);
    });

    if (!['sqlite', 'postgres', 'db2', 'oracle'].includes(dialect)) {
      // NOTE: sqlite doesn't allow querying between databases and
      // postgres requires creating a new connection to create a new table.
      it('should not show tables in other databases', async function() {
        await this.queryInterface.createTable('my_test_table1', { name: DataTypes.STRING });
        await this.sequelize.query('CREATE DATABASE my_test_db');
        await this.sequelize.query(`CREATE TABLE my_test_db${dialect === 'mssql' ? '.dbo' : ''}.my_test_table2 (id INT)`);
        let tableNames = await this.queryInterface.showAllTables();
        await this.sequelize.query('DROP DATABASE my_test_db');
        if (tableNames[0] && tableNames[0].tableName) {
          tableNames = tableNames.map(v => v.tableName);
        }
        expect(tableNames).to.deep.equal(['my_test_table1']);
      });
    }

    if (['mysql', 'mariadb'].includes(dialect)) {
      it('should show all tables in all databases', async function() {
        await this.queryInterface.createTable('my_test_table1', { name: DataTypes.STRING });
        await this.sequelize.query('CREATE DATABASE my_test_db');
        await this.sequelize.query('CREATE TABLE my_test_db.my_test_table2 (id INT)');
        let tableNames = await this.sequelize.query(
          this.queryInterface.queryGenerator.showTablesQuery(),
          {
            raw: true,
            type: this.sequelize.QueryTypes.SHOWTABLES
          }
        );
        await this.sequelize.query('DROP DATABASE my_test_db');
        if (tableNames[0] && tableNames[0].tableName) {
          tableNames = tableNames.map(v => v.tableName);
        }
        tableNames.sort();

        expect(tableNames).to.include('my_test_table1');
        expect(tableNames).to.include('my_test_table2');
      });
    }
  });

  describe('renameTable', () => {
    it('should rename table', async function() {
      await this.queryInterface.createTable('my_test_table', {
        name: DataTypes.STRING
      });
      await this.queryInterface.renameTable('my_test_table', 'my_test_table_new');
      let tableNames = await this.queryInterface.showAllTables();
      if (['mssql', 'mariadb', 'db2', 'oracle'].includes(dialect)) {
        tableNames = tableNames.map(v => v.tableName);
      }
      expect(tableNames).to.contain('my_test_table_new');
      expect(tableNames).to.not.contain('my_test_table');
    });
  });

  describe('dropAllTables', () => {
    it('should drop all tables', async function() {

      // MSSQL includes `spt_values` table which is system defined, hence can't be dropped
      const showAllTablesIgnoringSpecialMSSQLTable = async () => {
        const tableNames = await this.queryInterface.showAllTables();
        return tableNames.filter(t => t.tableName !== 'spt_values');
      };

      await this.queryInterface.dropAllTables();

      expect(
        await showAllTablesIgnoringSpecialMSSQLTable()
      ).to.be.empty;

      await this.queryInterface.createTable('table', { name: DataTypes.STRING });

      expect(
        await showAllTablesIgnoringSpecialMSSQLTable()
      ).to.have.length(1);

      await this.queryInterface.dropAllTables();

      expect(
        await showAllTablesIgnoringSpecialMSSQLTable()
      ).to.be.empty;
    });

    it('should be able to skip given tables', async function() {
      await this.queryInterface.createTable('skipme', {
        name: DataTypes.STRING
      });
      await this.queryInterface.dropAllTables({ skip: ['skipme'] });
      let tableNames = await this.queryInterface.showAllTables();
      if (['mssql', 'mariadb', 'db2', 'oracle'].includes(dialect)) {
        tableNames = tableNames.map(v => v.tableName);
      }
      expect(tableNames).to.contain('skipme');
    });
  });

  describe('indexes', () => {
    beforeEach(async function() {
      await this.queryInterface.dropTable('Group');
      await this.queryInterface.createTable('Group', {
        username: DataTypes.STRING,
        isAdmin: DataTypes.BOOLEAN,
        from: DataTypes.STRING
      });
    });

    it('adds, reads and removes an index to the table', async function() {
      await this.queryInterface.addIndex('Group', ['username', 'isAdmin']);
      let indexes = await this.queryInterface.showIndex('Group');
      let indexColumns = _.uniq(indexes.map(index => index.name));
      expect(indexColumns).to.include('group_username_is_admin');
      await this.queryInterface.removeIndex('Group', ['username', 'isAdmin']);
      indexes = await this.queryInterface.showIndex('Group');
      indexColumns = _.uniq(indexes.map(index => index.name));
      expect(indexColumns).to.be.empty;
    });

    it('works with schemas', async function() {
      await this.sequelize.createSchema('schema');
      await this.queryInterface.createTable('table', {
        name: {
          type: DataTypes.STRING
        },
        isAdmin: {
          type: DataTypes.STRING
        }
      }, {
        schema: 'schema'
      });
      await this.queryInterface.addIndex(
        { schema: 'schema', tableName: 'table' },
        ['name', 'isAdmin'],
        null,
        'schema_table'
      );
      const indexes = await this.queryInterface.showIndex({
        schema: 'schema',
        tableName: 'table'
      });
      expect(indexes.length).to.eq(1);
      expect(indexes[0].name).to.eq('table_name_is_admin');
    });

    it('does not fail on reserved keywords', async function() {
      await this.queryInterface.addIndex('Group', ['from']);
    });
  });

  describe('renameColumn', () => {
    it('rename a simple column', async function() {
      const Users = this.sequelize.define('_Users', {
        username: DataTypes.STRING
      }, { freezeTableName: true });

      await Users.sync({ force: true });
      await this.queryInterface.renameColumn('_Users', 'username', 'pseudo');
      const table = await this.queryInterface.describeTable('_Users');
      expect(table).to.have.property('pseudo');
      expect(table).to.not.have.property('username');
    });

    it('works with schemas', async function() {
      await this.sequelize.createSchema('archive');
      const Users = this.sequelize.define('User', {
        username: DataTypes.STRING
      }, {
        tableName: 'Users',
        schema: 'archive'
      });
      await Users.sync({ force: true });
      await this.queryInterface.renameColumn({
        schema: 'archive',
        tableName: 'Users'
      }, 'username', 'pseudo');
      const table = await this.queryInterface.describeTable({
        schema: 'archive',
        tableName: 'Users'
      });
      expect(table).to.have.property('pseudo');
      expect(table).to.not.have.property('username');
    });

    it('rename a column non-null without default value', async function() {
      const Users = this.sequelize.define('_Users', {
        username: {
          type: DataTypes.STRING,
          allowNull: false
        }
      }, { freezeTableName: true });

      await Users.sync({ force: true });
      await this.queryInterface.renameColumn('_Users', 'username', 'pseudo');
      const table = await this.queryInterface.describeTable('_Users');
      expect(table).to.have.property('pseudo');
      expect(table).to.not.have.property('username');
    });

    it('rename a boolean column non-null without default value', async function() {
      const Users = this.sequelize.define('_Users', {
        active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        }
      }, { freezeTableName: true });

      await Users.sync({ force: true });
      await this.queryInterface.renameColumn('_Users', 'active', 'enabled');
      const table = await this.queryInterface.describeTable('_Users');
      expect(table).to.have.property('enabled');
      expect(table).to.not.have.property('active');
    });

    if (dialect !== 'db2') { // Db2 does not allow rename of a primary key column
      it('renames a column primary key autoIncrement column', async function() {
        const Fruits = this.sequelize.define('Fruit', {
          fruitId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
          }
        }, { freezeTableName: true });

        await Fruits.sync({ force: true });
        await this.queryInterface.renameColumn('Fruit', 'fruitId', 'fruit_id');
        const table = await this.queryInterface.describeTable('Fruit');
        expect(table).to.have.property('fruit_id');
        expect(table).to.not.have.property('fruitId');
      });
    }

    it('shows a reasonable error message when column is missing', async function() {
      const Users = this.sequelize.define('_Users', {
        username: DataTypes.STRING
      }, { freezeTableName: true });

      await Users.sync({ force: true });
      await expect(
        this.queryInterface.renameColumn('_Users', 'email', 'pseudo')
      ).to.be.rejectedWith('Table _Users doesn\'t have the column email');
    });
  });

  describe('addColumn', () => {
    beforeEach(async function() {
      await this.sequelize.createSchema('archive');
      await this.queryInterface.createTable('users', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        }
      });
    });

    it('should be able to add a foreign key reference', async function() {
      await this.queryInterface.createTable('level', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        }
      });
      await this.queryInterface.addColumn('users', 'level_id', {
        type: DataTypes.INTEGER,
        references: {
          model: 'level',
          key: 'id'
        },
        onUpdate: 'cascade',
        onDelete: 'set null'
      });
      const table = await this.queryInterface.describeTable('users');
      expect(table).to.have.property('level_id');
    });

    it('addColumn expected error', async function() {
      await this.queryInterface.createTable('level2', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        }
      });

      const testArgs = (...args) => expect(this.queryInterface.addColumn(...args))
        .to.be.rejectedWith(Error, 'addColumn takes at least 3 arguments (table, attribute name, attribute definition)');

      await testArgs('users', 'level_id');
      await testArgs(null, 'level_id');
      await testArgs('users', null, {});
    });

    it('should work with schemas', async function() {
      await this.queryInterface.createTable(
        { tableName: 'users', schema: 'archive' },
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
          }
        }
      );
      await this.queryInterface.addColumn(
        { tableName: 'users', schema: 'archive' },
        'level_id',
        { type: DataTypes.INTEGER }
      );
      const table = await this.queryInterface.describeTable({
        tableName: 'users',
        schema: 'archive'
      });
      expect(table).to.have.property('level_id');
    });
    // Db2 does not support enums in alter column
    if (dialect !== 'db2') {
      it('should work with enums (1)', async function() {
        await this.queryInterface.addColumn('users', 'someEnum', DataTypes.ENUM('value1', 'value2', 'value3'));
      });

      it('should work with enums (2)', async function() {
        await this.queryInterface.addColumn('users', 'someOtherEnum', {
          type: DataTypes.ENUM,
          values: ['value1', 'value2', 'value3']
        });
      });
    }
    if (dialect === 'postgres') {
      it('should be able to add a column of type of array of enums', async function() {
        await this.queryInterface.addColumn('users', 'tags', {
          allowNull: false,
          type: Sequelize.ARRAY(Sequelize.ENUM(
            'Value1',
            'Value2',
            'Value3'
          ))
        });
        const result = await this.queryInterface.describeTable('users');
        expect(result).to.have.property('tags');
        expect(result.tags.type).to.equal('ARRAY');
        expect(result.tags.allowNull).to.be.false;
      });
    }
  });

  describe('describeForeignKeys', () => {
    beforeEach(async function() {
      await this.queryInterface.createTable('users', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        }
      });
      await this.queryInterface.createTable('hosts', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        admin: {
          type: DataTypes.INTEGER,
          references: {
            model: 'users',
            key: 'id'
          }
        },
        operator: {
          type: DataTypes.INTEGER,
          references: {
            model: 'users',
            key: 'id'
          },
          onUpdate: 'cascade'
        },
        owner: {
          type: DataTypes.INTEGER,
          references: {
            model: 'users',
            key: 'id'
          },
          onUpdate: 'cascade',
          onDelete: 'set null'
        }
      });
    });

    it('should get a list of foreign keys for the table', async function() {

      const foreignKeys = await this.sequelize.query(
        this.queryInterface.queryGenerator.getForeignKeysQuery(
          'hosts',
          dialect === 'db2' ? this.sequelize.config.username.toUpperCase() : this.sequelize.config.database
        ),
        { type: this.sequelize.QueryTypes.FOREIGNKEYS }
      );

      expect(foreignKeys).to.have.length(3);

      if (dialect === 'postgres') {
        expect(Object.keys(foreignKeys[0])).to.have.length(6);
        expect(Object.keys(foreignKeys[1])).to.have.length(7);
        expect(Object.keys(foreignKeys[2])).to.have.length(7);
      } else if (dialect === 'sqlite' || dialect === 'db2') {
        expect(Object.keys(foreignKeys[0])).to.have.length(8);
      } else if (['mysql', 'mariadb', 'mssql'].includes(dialect)) {
        expect(Object.keys(foreignKeys[0])).to.have.length(12);
      } else if (dialect === 'oracle') {
        expect(Object.keys(foreignKeys[0])).to.have.length(6);
      } else {
        throw new Error(`This test doesn't support ${dialect}`);
      }

      if (dialect === 'mysql') {
        const [foreignKeysViaDirectMySQLQuery] = await this.sequelize.query(
          this.queryInterface.queryGenerator.getForeignKeyQuery('hosts', 'admin')
        );
        expect(foreignKeysViaDirectMySQLQuery[0]).to.deep.equal(foreignKeys[0]);
      }
    });

    it('should get a list of foreign key references details for the table', async function() {
      const references = await this.queryInterface.getForeignKeyReferencesForTable('hosts', this.sequelize.options);
      expect(references).to.have.length(3);
      for (const ref of references) {
        expect(ref.tableName).to.equal('hosts');
        expect(ref.referencedColumnName).to.equal('id');
        expect(ref.referencedTableName).to.equal('users');
      }
      const columnNames = references.map(reference => reference.columnName);
      expect(columnNames).to.have.same.members(['owner', 'operator', 'admin']);
    });
  });

  describe('constraints', () => {
    beforeEach(async function() {
      this.User = this.sequelize.define('users', {
        // Db2 does not allow unique constraint for a nullable column, Db2
        // throws SQL0542N error if we create constraint on nullable column.
        username: dialect === 'db2' ? { type: DataTypes.STRING, allowNull: false } : DataTypes.STRING,
        email: dialect === 'db2' ? { type: DataTypes.STRING, allowNull: false } : DataTypes.STRING,
        roles: DataTypes.STRING
      });

      this.Post = this.sequelize.define('posts', {
        username: DataTypes.STRING
      });
      await this.sequelize.sync({ force: true });
    });


    describe('unique', () => {
      it('should add, read & remove unique constraint', async function() {
        await this.queryInterface.addConstraint('users', { type: 'unique', fields: ['email'] });
        let constraints = await this.queryInterface.showConstraint('users');
        constraints = constraints.map(constraint => constraint.constraintName);
        expect(constraints).to.include('users_email_uk');
        await this.queryInterface.removeConstraint('users', 'users_email_uk');
        constraints = await this.queryInterface.showConstraint('users');
        constraints = constraints.map(constraint => constraint.constraintName);
        expect(constraints).to.not.include('users_email_uk');
      });

      it('should add a constraint after another', async function() {
        await this.queryInterface.addConstraint('users', { type: 'unique', fields: ['username'] });
        await this.queryInterface.addConstraint('users', { type: 'unique', fields: ['email'] });
        let constraints = await this.queryInterface.showConstraint('users');
        constraints = constraints.map(constraint => constraint.constraintName);
        expect(constraints).to.include('users_email_uk');
        expect(constraints).to.include('users_username_uk');
        await this.queryInterface.removeConstraint('users', 'users_email_uk');
        constraints = await this.queryInterface.showConstraint('users');
        constraints = constraints.map(constraint => constraint.constraintName);
        expect(constraints).to.not.include('users_email_uk');
        expect(constraints).to.include('users_username_uk');
        await this.queryInterface.removeConstraint('users', 'users_username_uk');
        constraints = await this.queryInterface.showConstraint('users');
        constraints = constraints.map(constraint => constraint.constraintName);
        expect(constraints).to.not.include('users_email_uk');
        expect(constraints).to.not.include('users_username_uk');
      });
    });

    if (current.dialect.supports.constraints.check) {
      describe('check', () => {
        it('should add, read & remove check constraint', async function() {
          await this.queryInterface.addConstraint('users', {
            type: 'check',
            fields: ['roles'],
            where: {
              roles: ['user', 'admin', 'guest', 'moderator']
            },
            name: 'check_user_roles'
          });
          let constraints = await this.queryInterface.showConstraint('users');
          constraints = constraints.map(constraint => constraint.constraintName);
          expect(constraints).to.include('check_user_roles');
          await this.queryInterface.removeConstraint('users', 'check_user_roles');
          constraints = await this.queryInterface.showConstraint('users');
          constraints = constraints.map(constraint => constraint.constraintName);
          expect(constraints).to.not.include('check_user_roles');
        });

        it('addconstraint missing type', async function() {
          await expect(
            this.queryInterface.addConstraint('users', {
              fields: ['roles'],
              where: { roles: ['user', 'admin', 'guest', 'moderator'] },
              name: 'check_user_roles'
            })
          ).to.be.rejectedWith(Error, 'Constraint type must be specified through options.type');
        });
      });
    }

    if (current.dialect.supports.constraints.default) {
      describe('default', () => {
        it('should add, read & remove default constraint', async function() {
          await this.queryInterface.addConstraint('users', {
            fields: ['roles'],
            type: 'default',
            defaultValue: 'guest'
          });
          let constraints = await this.queryInterface.showConstraint('users');
          constraints = constraints.map(constraint => constraint.constraintName);
          expect(constraints).to.include('users_roles_df');
          await this.queryInterface.removeConstraint('users', 'users_roles_df');
          constraints = await this.queryInterface.showConstraint('users');
          constraints = constraints.map(constraint => constraint.constraintName);
          expect(constraints).to.not.include('users_roles_df');
        });
      });
    }

    describe('primary key', () => {
      it('should add, read & remove primary key constraint', async function() {
        await this.queryInterface.removeColumn('users', 'id');
        await this.queryInterface.changeColumn('users', 'username', {
          type: DataTypes.STRING,
          allowNull: false
        });
        await this.queryInterface.addConstraint('users', {
          fields: ['username'],
          type: 'PRIMARY KEY'
        });
        let constraints = await this.queryInterface.showConstraint('users');
        constraints = constraints.map(constraint => constraint.constraintName);

        // The name of primaryKey constraint is always `PRIMARY` in case of MySQL and MariaDB
        const expectedConstraintName = ['mysql', 'mariadb'].includes(dialect) ? 'PRIMARY' : 'users_username_pk';

        expect(constraints).to.include(expectedConstraintName);
        await this.queryInterface.removeConstraint('users', expectedConstraintName);
        constraints = await this.queryInterface.showConstraint('users');
        constraints = constraints.map(constraint => constraint.constraintName);
        expect(constraints).to.not.include(expectedConstraintName);
      });
    });

    describe('foreign key', () => {
      it('should add, read & remove foreign key constraint', async function() {
        await this.queryInterface.removeColumn('users', 'id');
        await this.queryInterface.changeColumn('users', 'username', {
          type: DataTypes.STRING,
          allowNull: false
        });
        await this.queryInterface.addConstraint('users', {
          type: 'PRIMARY KEY',
          fields: ['username']
        });
        await this.queryInterface.addConstraint('posts', {
          fields: ['username'],
          references: {
            table: 'users',
            field: 'username'
          },
          onDelete: 'cascade',
          onUpdate: dialect !== 'oracle' ? 'cascade' : null,
          type: 'foreign key'
        });
        let constraints = await this.queryInterface.showConstraint('posts');
        constraints = constraints.map(constraint => constraint.constraintName);
        expect(constraints).to.include('posts_username_users_fk');
        await this.queryInterface.removeConstraint('posts', 'posts_username_users_fk');
        constraints = await this.queryInterface.showConstraint('posts');
        constraints = constraints.map(constraint => constraint.constraintName);
        expect(constraints).to.not.include('posts_username_users_fk');
      });
    });

    describe('unknown constraint', () => {
      it('should throw non existent constraints as UnknownConstraintError', async function() {
        try {
          await this.queryInterface.removeConstraint('users', 'unknown__constraint__name', {
            type: 'unique'
          });
          throw new Error('Error not thrown...');
        } catch (error) {
          expect(error).to.be.instanceOf(Sequelize.UnknownConstraintError);
          // The Oracle dialect, error messages doesn't have table and constraint information
          if (dialect != 'oracle') {
            expect(error.table).to.equal('users');
            expect(error.constraint).to.equal('unknown__constraint__name');
          }
        }
      });
    });
  });
});
