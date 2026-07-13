'use strict';

const { DataTypes, QueryTypes, Sequelize, sql } = require('@sequelize/core');
const { SqliteDialect } = require('@sequelize/sqlite3');
const { expect } = require('chai');
const { rm } = require('node:fs/promises');
const Support = require('../../support');

if (Support.getTestDialect() === 'sqlite3') {
  describe('[SQLITE Specific] generated columns', () => {
    const tableName = 'generated_columns_test';

    afterEach(async function () {
      await this.sequelize.query('DROP VIEW IF EXISTS `generated_columns_view`');
      await this.sequelize.query('DROP VIEW IF EXISTS `generated_columns_temp_view`');
      await this.sequelize.query('DROP TABLE IF EXISTS `generated_columns_child`');
      await this.sequelize.query('DROP TABLE IF EXISTS `generated_columns_temp_child`');
      await this.sequelize.query('DROP TABLE IF EXISTS `generated_columns_temp_audit`');
      await this.sequelize.query('DROP TABLE IF EXISTS `generated_columns_temp`');
      await this.sequelize.query('DROP TABLE IF EXISTS `generated_columns_fts`');
      await this.sequelize.query('DROP TABLE IF EXISTS `generated_columns_(test`');
      await this.sequelize.query('DROP TABLE IF EXISTS `generated columns test`');
      await this.sequelize.queryInterface.dropTable(tableName);
      await this.sequelize.query('DROP TABLE IF EXISTS `generated_columns_audit`');
    });

    it('adds a STORED generated column to a populated table', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await queryInterface.createTable(tableName, {
        price: DataTypes.INTEGER,
        quantity: DataTypes.INTEGER,
      });
      await queryInterface.bulkInsert(tableName, [{ price: 6, quantity: 7 }]);

      await queryInterface.addColumn(tableName, 'total', {
        type: DataTypes.INTEGER,
        generatedAs: sql.literal('`price` * `quantity`'),
        generatedColumn: 'STORED',
      });

      expect(await queryInterface.select(null, tableName, {})).to.deep.equal([
        { price: 6, quantity: 7, total: 42 },
      ]);
    });

    it('preserves the complete table schema when adding a STORED generated column', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await this.sequelize.query('CREATE TABLE `generated_columns_audit` (`name` TEXT)');
      await this.sequelize.query(`
        CREATE TABLE \`generated_columns_test\` (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "quantity" INTEGER CHECK ("quantity" > 0),
          "name" TEXT COLLATE NOCASE UNIQUE
        ) STRICT
      `);
      await this.sequelize.query(
        'CREATE INDEX generated_columns_expression ON generated_columns_test (lower(`name`))',
      );
      await this.sequelize.query(
        'CREATE INDEX generated_columns_partial ON generated_columns_test (`quantity`) WHERE `quantity` > 1',
      );
      await this.sequelize.query(
        'CREATE VIEW generated_columns_view AS SELECT `id`, `name` FROM generated_columns_test WHERE `quantity` > 1',
      );
      await this.sequelize.query(`
        CREATE TRIGGER generated_columns_insert
        AFTER INSERT ON generated_columns_test
        BEGIN
          INSERT INTO "generated_columns_audit" ("name") VALUES (NEW."name");
        END
      `);
      await this.sequelize.query(
        "INSERT INTO generated_columns_test (`quantity`, `name`) VALUES (1, 'one'), (2, 'two'), (3, 'three')",
      );
      await this.sequelize.query('DELETE FROM generated_columns_test WHERE `id` = 3');

      await queryInterface.addColumn(tableName, 'doubled', {
        type: DataTypes.INTEGER,
        generatedAs: sql.literal('`quantity` * 2'),
        generatedColumn: 'STORED',
      });

      const [schemaRows] = await this.sequelize.query(
        `SELECT type, name, sql FROM sqlite_master WHERE name = '${tableName}' OR tbl_name = '${tableName}' ORDER BY type, name`,
      );
      const tableSql = schemaRows.find(row => row.type === 'table').sql;
      expect(tableSql).to.include('AUTOINCREMENT');
      expect(tableSql).to.include('CHECK ("quantity" > 0)');
      expect(tableSql).to.include('COLLATE NOCASE');
      expect(tableSql).to.match(/\) STRICT$/);
      expect(tableSql).to.include('GENERATED ALWAYS AS (`quantity` * 2) STORED');
      expect(schemaRows.find(row => row.name === 'generated_columns_expression').sql).to.include(
        'lower(`name`)',
      );
      expect(schemaRows.find(row => row.name === 'generated_columns_partial').sql).to.include(
        'WHERE `quantity` > 1',
      );
      expect(schemaRows.find(row => row.name === 'generated_columns_insert')).not.to.be.undefined;
      const [[view]] = await this.sequelize.query(
        "SELECT sql FROM sqlite_master WHERE type = 'view' AND name = 'generated_columns_view'",
      );
      expect(view.sql).to.include('FROM generated_columns_test');
      const [viewRows] = await this.sequelize.query(
        'SELECT `id`, `name` FROM generated_columns_view ORDER BY `id`',
      );
      expect(viewRows).to.deep.equal([{ id: 2, name: 'two' }]);

      await expect(
        this.sequelize.query(
          "INSERT INTO generated_columns_test (`quantity`, `name`) VALUES (-1, 'invalid')",
        ),
      ).to.be.rejected;
      await expect(
        this.sequelize.query(
          "INSERT INTO generated_columns_test (`quantity`, `name`) VALUES (4, 'ONE')",
        ),
      ).to.be.rejected;

      await this.sequelize.query(
        "INSERT INTO generated_columns_test (`quantity`, `name`) VALUES (4, 'four')",
      );
      const [[inserted]] = await this.sequelize.query(
        "SELECT `id`, `doubled` FROM generated_columns_test WHERE `name` = 'four'",
      );
      expect(inserted).to.deep.equal({ id: 4, doubled: 8 });
      const [auditRows] = await this.sequelize.query(
        'SELECT `name` FROM `generated_columns_audit` ORDER BY rowid',
      );
      expect(auditRows.at(-1)).to.deep.equal({ name: 'four' });
    });

    it('preserves referenced rows and generated columns when adding and removing constraints', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await this.sequelize.query(`
        CREATE TABLE generated_columns_test (
          id INTEGER PRIMARY KEY,
          value INTEGER,
          note TEXT DEFAULT '"kept"',
          doubled INTEGER GENERATED ALWAYS AS (value * 2) STORED
        )
      `);
      await this.sequelize.query(`
        CREATE TABLE generated_columns_child (
          id INTEGER PRIMARY KEY,
          parent_id INTEGER REFERENCES generated_columns_test (id) ON DELETE CASCADE
        )
      `);
      await this.sequelize.query('INSERT INTO generated_columns_test (id, value) VALUES (1, 3)');
      await this.sequelize.query(
        'INSERT INTO generated_columns_child (id, parent_id) VALUES (1, 1)',
      );

      await queryInterface.addConstraint(tableName, {
        fields: ['value'],
        name: 'generated_columns_value_unique',
        type: 'UNIQUE',
      });
      expect(await queryInterface.select(null, 'generated_columns_child', {})).to.deep.equal([
        { id: 1, parent_id: 1 },
      ]);
      expect(await queryInterface.select(null, tableName, {})).to.deep.equal([
        { id: 1, value: 3, note: '"kept"', doubled: 6 },
      ]);

      await queryInterface.removeConstraint(tableName, 'generated_columns_value_unique');
      expect(await queryInterface.select(null, 'generated_columns_child', {})).to.deep.equal([
        { id: 1, parent_id: 1 },
      ]);
      expect(await queryInterface.select(null, tableName, {})).to.deep.equal([
        { id: 1, value: 3, note: '"kept"', doubled: 6 },
      ]);
      await this.sequelize.query('INSERT INTO generated_columns_test (id, value) VALUES (2, 3)');
      const [[inserted]] = await this.sequelize.query(
        'SELECT note FROM generated_columns_test WHERE id = 2',
      );
      expect(inserted.note).to.equal('"kept"');
    });

    it('preserves raw schema and referenced rows in the legacy rename fallback', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await this.sequelize.query(`
        CREATE TABLE generated_columns_test (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          value INTEGER CHECK (value > 0),
          note TEXT DEFAULT 'value',
          doubled INTEGER GENERATED ALWAYS AS (value * 2) STORED
        )
      `);
      await this.sequelize.query(
        'CREATE UNIQUE INDEX generated_columns_value_index ON generated_columns_test (value)',
      );
      await this.sequelize.query(`
        CREATE TABLE generated_columns_child (
          id INTEGER PRIMARY KEY,
          parent_id INTEGER REFERENCES generated_columns_test (id) ON DELETE CASCADE
        )
      `);
      await this.sequelize.query('INSERT INTO generated_columns_test (value) VALUES (3)');
      await this.sequelize.query(
        'INSERT INTO generated_columns_child (id, parent_id) VALUES (1, 1)',
      );

      const databaseVersion = this.sequelize.getDatabaseVersionIfExist();
      this.sequelize.setDatabaseVersion('3.24.0');
      try {
        await queryInterface.renameColumn(tableName, 'value', 'renamed');
      } finally {
        this.sequelize.setDatabaseVersion(databaseVersion);
      }

      expect(await queryInterface.select(null, 'generated_columns_child', {})).to.deep.equal([
        { id: 1, parent_id: 1 },
      ]);
      expect(await queryInterface.select(null, tableName, {})).to.deep.equal([
        { id: 1, renamed: 3, note: 'value', doubled: 6 },
      ]);
      const [schemaRows] = await this.sequelize.query(
        `SELECT type, name, sql FROM sqlite_master WHERE tbl_name = '${tableName}' ORDER BY type, name`,
      );
      const tableSql = schemaRows.find(row => row.type === 'table').sql;
      expect(tableSql).to.include('AUTOINCREMENT');
      expect(tableSql).to.include('CHECK (renamed > 0)');
      expect(tableSql).to.include("DEFAULT 'value'");
      expect(tableSql).to.include('GENERATED ALWAYS AS (renamed * 2) STORED');
      expect(schemaRows.find(row => row.name === 'generated_columns_value_index').sql).to.include(
        '(renamed)',
      );
    });

    it('does not rewrite unrelated types or double-quoted defaults in the legacy rename fallback', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await this.sequelize.query(`
        CREATE TABLE generated_columns_test (
          id INTEGER PRIMARY KEY,
          "integer" TEXT,
          other INTEGER,
          note TEXT DEFAULT "integer",
          doubled INTEGER GENERATED ALWAYS AS (other * 2) STORED
        )
      `);
      await this.sequelize.query(
        'INSERT INTO generated_columns_test ("integer", other) VALUES (\'first\', 3)',
      );

      const databaseVersion = this.sequelize.getDatabaseVersionIfExist();
      this.sequelize.setDatabaseVersion('3.24.0');
      try {
        await queryInterface.renameColumn(tableName, 'integer', 'label');
      } finally {
        this.sequelize.setDatabaseVersion(databaseVersion);
      }

      await this.sequelize.query(
        "INSERT INTO generated_columns_test (label, other) VALUES ('second', 4)",
      );

      expect(
        await queryInterface.select(null, tableName, { order: [['id', 'ASC']] }),
      ).to.deep.equal([
        { id: 1, label: 'first', other: 3, note: 'integer', doubled: 6 },
        { id: 2, label: 'second', other: 4, note: 'integer', doubled: 8 },
      ]);
      const tableInfo = await this.sequelize.queryRaw('PRAGMA table_info(generated_columns_test)', {
        type: QueryTypes.SELECT,
      });
      expect(tableInfo.find(column => column.name === 'id').type).to.equal('INTEGER');
      expect(tableInfo.find(column => column.name === 'other').type).to.equal('INTEGER');
    });

    it('does not rewrite unrelated views during the legacy rename fallback', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await queryInterface.createTable(tableName, { value: DataTypes.INTEGER });
      await queryInterface.createTable('generated_columns_audit', { value: DataTypes.INTEGER });
      await queryInterface.bulkInsert('generated_columns_audit', [{ value: 7 }]);
      await this.sequelize.query(
        'CREATE VIEW generated_columns_view AS SELECT value FROM generated_columns_audit',
      );

      const databaseVersion = this.sequelize.getDatabaseVersionIfExist();
      this.sequelize.setDatabaseVersion('3.24.0');
      try {
        await queryInterface.renameColumn(tableName, 'value', 'renamed');
      } finally {
        this.sequelize.setDatabaseVersion(databaseVersion);
      }

      expect(await queryInterface.select(null, 'generated_columns_view', {})).to.deep.equal([
        { value: 7 },
      ]);
      const [[view]] = await this.sequelize.query(
        "SELECT sql FROM sqlite_master WHERE name = 'generated_columns_view'",
      );
      expect(view.sql).to.include('SELECT value FROM generated_columns_audit');
    });

    it('rejects type-name ambiguity in legacy rename expressions', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await this.sequelize.query(`
        CREATE TABLE generated_columns_test (
          "integer" TEXT,
          value TEXT,
          normalized INTEGER GENERATED ALWAYS AS (CAST(value AS /* type */ "INTEGER")) STORED
        )
      `);

      const databaseVersion = this.sequelize.getDatabaseVersionIfExist();
      this.sequelize.setDatabaseVersion('3.24.0');
      try {
        await expect(queryInterface.renameColumn(tableName, 'integer', 'label')).to.be.rejectedWith(
          /ambiguous with a SQL type/i,
        );
      } finally {
        this.sequelize.setDatabaseVersion(databaseVersion);
      }

      expect(await queryInterface.describeTable(tableName)).to.have.property('integer');
      const [[table]] = await this.sequelize.query(
        "SELECT sql FROM sqlite_master WHERE name = 'generated_columns_test'",
      );
      expect(table.sql).to.include('CAST(value AS /* type */ "INTEGER")');
    });

    it('rejects SQL keyword ambiguity in legacy rename expressions', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await this.sequelize.query(`
        CREATE TABLE generated_columns_test (
          "null" INTEGER,
          value INTEGER,
          result GENERATED ALWAYS AS (COALESCE(value, NULL)) STORED
        )
      `);
      await this.sequelize.query(
        'INSERT INTO generated_columns_test ("null", value) VALUES (42, NULL)',
      );

      const databaseVersion = this.sequelize.getDatabaseVersionIfExist();
      this.sequelize.setDatabaseVersion('3.24.0');
      try {
        await expect(queryInterface.renameColumn(tableName, 'null', 'label')).to.be.rejectedWith(
          /ambiguous with a SQL type/i,
        );
      } finally {
        this.sequelize.setDatabaseVersion(databaseVersion);
      }

      expect(await queryInterface.select(null, tableName, {})).to.deep.equal([
        { null: 42, value: null, result: null },
      ]);
    });

    it('rejects ambiguous dependent views before a legacy rename rebuild', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await queryInterface.createTable(tableName, { value: DataTypes.INTEGER });
      await this.sequelize.query(
        "CREATE VIEW generated_columns_view AS SELECT value FROM 'generated_columns_test'",
      );

      const databaseVersion = this.sequelize.getDatabaseVersionIfExist();
      this.sequelize.setDatabaseVersion('3.24.0');
      try {
        await expect(queryInterface.renameColumn(tableName, 'value', 'renamed')).to.be.rejectedWith(
          /cannot safely rename.*view/i,
        );
      } finally {
        this.sequelize.setDatabaseVersion(databaseVersion);
      }

      expect(await queryInterface.describeTable(tableName)).to.have.property('value');
      expect(await queryInterface.select(null, 'generated_columns_view', {})).to.deep.equal([]);
    });

    it('rejects single-quoted trigger references before a legacy rename rebuild', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await queryInterface.createTable(tableName, { value: DataTypes.INTEGER });
      await queryInterface.createTable('generated_columns_audit', { value: DataTypes.INTEGER });
      await this.sequelize.query(`
        CREATE TRIGGER generated_columns_trigger
        AFTER UPDATE OF 'value' ON generated_columns_test
        BEGIN
          INSERT INTO generated_columns_audit (value) VALUES (NEW.'value');
        END
      `);

      const databaseVersion = this.sequelize.getDatabaseVersionIfExist();
      this.sequelize.setDatabaseVersion('3.24.0');
      try {
        await expect(queryInterface.renameColumn(tableName, 'value', 'renamed')).to.be.rejectedWith(
          /cannot safely rename.*trigger/i,
        );
      } finally {
        this.sequelize.setDatabaseVersion(databaseVersion);
      }

      expect(await queryInterface.describeTable(tableName)).to.have.property('value');
    });

    it('ignores AUTOINCREMENT tokens in string literals during rebuilds', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await this.sequelize.query(`
        CREATE TABLE generated_columns_test (
          id INTEGER PRIMARY KEY,
          value INTEGER,
          note TEXT DEFAULT 'AUTOINCREMENT'
        )
      `);
      await this.sequelize.query('INSERT INTO generated_columns_test (value) VALUES (3)');

      await queryInterface.addColumn(tableName, 'doubled', {
        type: DataTypes.INTEGER,
        generatedAs: sql.literal('value * 2'),
      });

      expect(await queryInterface.select(null, tableName, {})).to.deep.equal([
        { id: 1, value: 3, note: 'AUTOINCREMENT', doubled: 6 },
      ]);
    });

    it('preserves standard double-quoted foreign keys when changing their column', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await this.sequelize.query('PRAGMA foreign_keys = ON');
      await this.sequelize.query('CREATE TABLE generated_columns_test ("id" INTEGER PRIMARY KEY)');
      await this.sequelize.query(`
        CREATE TABLE generated_columns_child (
          "id" INTEGER PRIMARY KEY,
          "parent_id" INTEGER REFERENCES "generated_columns_test" ("id"),
          "doubled" INTEGER GENERATED ALWAYS AS ("parent_id" * 2) STORED
        )
      `);
      await this.sequelize.query('INSERT INTO generated_columns_test (id) VALUES (1)');
      await this.sequelize.query(
        'INSERT INTO generated_columns_child (id, parent_id) VALUES (1, 1)',
      );

      await queryInterface.changeColumn('generated_columns_child', 'parent_id', DataTypes.TEXT);

      await expect(
        this.sequelize.query(
          "INSERT INTO generated_columns_child (id, parent_id) VALUES (2, '999')",
        ),
      ).to.be.rejected;
      expect(await queryInterface.select(null, 'generated_columns_child', {})).to.deep.equal([
        { id: 1, parent_id: '1', doubled: 2 },
      ]);
    });

    it('preserves composite foreign keys without creating inline references', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await this.sequelize.query('PRAGMA foreign_keys = ON');
      await this.sequelize.query(
        'CREATE TABLE generated_columns_test (a INTEGER, b INTEGER, UNIQUE (a, b))',
      );
      await this.sequelize.query(`
        CREATE TABLE generated_columns_child (
          x INTEGER,
          y INTEGER,
          doubled INTEGER GENERATED ALWAYS AS (x * 2) STORED,
          FOREIGN KEY (x, y) REFERENCES generated_columns_test (a, b)
        )
      `);
      await this.sequelize.query('INSERT INTO generated_columns_test VALUES (1, 2)');
      await this.sequelize.query('INSERT INTO generated_columns_child (x, y) VALUES (1, 2)');

      await queryInterface.changeColumn('generated_columns_child', 'x', DataTypes.TEXT);

      await expect(
        this.sequelize.query("INSERT INTO generated_columns_child (x, y) VALUES ('1', 999)"),
      ).to.be.rejected;
      expect(await queryInterface.select(null, 'generated_columns_child', {})).to.deep.equal([
        { x: '1', y: 2, doubled: 2 },
      ]);
    });

    it('shows and removes commented constraint names containing spaces', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await this.sequelize.query(`
        CREATE TABLE generated_columns_test (
          id INTEGER,
          value INTEGER,
          doubled INTEGER GENERATED ALWAYS AS (value * 2) STORED,
          /* leading constraint comment */ CONSTRAINT "unique value" UNIQUE (value),
          CONSTRAINT "primary value" PRIMARY /* between keywords */ KEY (id),
          UNIQUE (id, value),
          CHECK (value > 0)
        )
      `);

      const constraints = await queryInterface.showConstraints(tableName);
      const constraint = constraints.find(item => item.constraintName === 'unique value');
      expect(constraint).to.include({
        constraintName: 'unique value',
        constraintType: 'UNIQUE',
      });
      expect(constraint.columnNames).to.deep.equal(['value']);
      expect(constraints).to.deep.include.members([
        {
          constraintSchema: '',
          constraintName: 'primary value',
          constraintType: 'PRIMARY KEY',
          tableSchema: '',
          tableName,
          columnNames: ['id'],
        },
        {
          constraintSchema: '',
          constraintName: 'UNIQUE',
          constraintType: 'UNIQUE',
          tableSchema: '',
          tableName,
          columnNames: ['id', 'value'],
        },
      ]);
      expect(constraints.some(item => item.constraintType === 'CHECK')).to.equal(true);
      await queryInterface.removeConstraint(tableName, 'unique value');
      await this.sequelize.query(
        'INSERT INTO generated_columns_test (id, value) VALUES (1, 1), (2, 1)',
      );
      await queryInterface.removeConstraint(tableName, 'primary value');
      await this.sequelize.query('INSERT INTO generated_columns_test (id, value) VALUES (1, 2)');
      expect(await queryInterface.select(null, tableName, {})).to.have.length(3);
    });

    it('preserves exact main and TEMP AUTOINCREMENT high-water values', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await this.sequelize.query(
        'CREATE TABLE generated_columns_test (id INTEGER PRIMARY KEY AUTOINCREMENT, value INTEGER)',
      );
      await this.sequelize.query('INSERT INTO generated_columns_test (value) VALUES (1)');
      await this.sequelize.query(
        "UPDATE sqlite_sequence SET seq = 9007199254740993 WHERE name = 'generated_columns_test'",
      );
      await this.sequelize.query(
        'CREATE TEMP TABLE generated_columns_temp (id INTEGER PRIMARY KEY AUTOINCREMENT, value INTEGER)',
      );
      await this.sequelize.query('INSERT INTO generated_columns_temp (value) VALUES (1)');
      await this.sequelize.query(
        "UPDATE temp.sqlite_sequence SET seq = 50 WHERE name = 'generated_columns_temp'",
      );

      for (const targetTable of [tableName, 'generated_columns_temp']) {
        await queryInterface.addColumn(targetTable, 'doubled', {
          type: DataTypes.INTEGER,
          generatedAs: sql.literal('value * 2'),
        });
      }

      const [[mainSequence]] = await this.sequelize.query(
        "SELECT CAST(seq AS TEXT) AS seq FROM main.sqlite_sequence WHERE name = 'generated_columns_test'",
      );
      expect(mainSequence.seq).to.equal('9007199254740993');
      await this.sequelize.query('INSERT INTO generated_columns_temp (value) VALUES (2)');
      expect(await queryInterface.select(null, 'generated_columns_temp', {})).to.deep.equal([
        { id: 1, value: 1, doubled: 2 },
        { id: 51, value: 2, doubled: 4 },
      ]);
    });

    it('does not treat table constraints as colliding column definitions', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await this.sequelize.query(`
        CREATE TABLE generated_columns_test (
          "unique" TEXT,
          a INTEGER,
          b INTEGER,
          doubled INTEGER GENERATED ALWAYS AS (a * 2) STORED,
          /* table constraint */ UNIQUE /* before columns */ (a, b)
        )
      `);
      await this.sequelize.query('INSERT INTO generated_columns_test (a, b) VALUES (1, 1)');

      await queryInterface.removeColumn(tableName, 'unique');

      await expect(this.sequelize.query('INSERT INTO generated_columns_test (a, b) VALUES (1, 1)'))
        .to.be.rejected;
      expect(await queryInterface.select(null, tableName, {})).to.deep.equal([
        { a: 1, b: 1, doubled: 2 },
      ]);
    });

    it('introspects generated columns on quoted table names containing spaces', async function () {
      const queryInterface = this.sequelize.queryInterface;
      const quotedTableName = 'generated columns test';
      await this.sequelize.query(`
        CREATE TABLE "${quotedTableName}" (
          value INTEGER,
          doubled INTEGER GENERATED ALWAYS AS (value * 2) STORED
        )
      `);

      const description = await queryInterface.describeTable(quotedTableName);

      expect(description.doubled.generatedColumn).to.equal('STORED');
      expect(description.doubled.generatedAs.val.join('')).to.equal('value * 2');
    });

    it('rejects an unsafe transactional rebuild of a referenced table before altering it', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await queryInterface.createTable(tableName, {
        id: { type: DataTypes.INTEGER, primaryKey: true },
        value: DataTypes.INTEGER,
      });
      await queryInterface.createTable('generated_columns_child', {
        id: { type: DataTypes.INTEGER, primaryKey: true },
        parentId: {
          type: DataTypes.INTEGER,
          references: { table: tableName, key: 'id' },
        },
      });
      await this.sequelize.query(
        'INSERT INTO generated_columns_test (`id`, `value`) VALUES (1, 10)',
      );
      await this.sequelize.query(
        'INSERT INTO `generated_columns_child` (`id`, `parentId`) VALUES (1, 1)',
      );

      await expect(
        this.sequelize.transaction(async transaction => {
          await queryInterface.addColumn(
            tableName,
            'doubled',
            {
              type: DataTypes.INTEGER,
              generatedAs: sql.literal('`value` * 2'),
            },
            { transaction },
          );
        }),
      ).to.be.rejectedWith(
        /cannot safely rebuild.*inside an existing transaction.*outside the transaction/i,
      );

      const [tableRows] = await this.sequelize.query('SELECT * FROM generated_columns_test');
      expect(tableRows).to.deep.equal([{ id: 1, value: 10 }]);
      const description = await queryInterface.describeTable(tableName);
      expect(description).not.to.have.property('doubled');
    });

    it('allows a transactional rebuild when no table references the target', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await queryInterface.createTable(tableName, { value: DataTypes.INTEGER });
      await queryInterface.bulkInsert(tableName, [{ value: 6 }]);

      await this.sequelize.transaction(async transaction => {
        await queryInterface.addColumn(
          tableName,
          'doubled',
          {
            type: DataTypes.INTEGER,
            generatedAs: sql.literal('`value` * 2'),
          },
          { transaction },
        );
      });

      expect(await queryInterface.select(null, tableName, {})).to.deep.equal([
        { value: 6, doubled: 12 },
      ]);
    });

    it('rejects an unsafe general rebuild of a referenced table inside a transaction', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await queryInterface.createTable(tableName, {
        id: { type: DataTypes.INTEGER, primaryKey: true },
        value: DataTypes.INTEGER,
        obsolete: DataTypes.STRING,
        doubled: {
          type: DataTypes.INTEGER,
          generatedAs: sql.literal('`value` * 2'),
        },
      });
      await queryInterface.createTable('generated_columns_child', {
        id: { type: DataTypes.INTEGER, primaryKey: true },
        parentId: {
          type: DataTypes.INTEGER,
          references: { table: tableName, key: 'id' },
          onDelete: 'CASCADE',
        },
      });
      await this.sequelize.query(
        "INSERT INTO generated_columns_test (`id`, `value`, `obsolete`) VALUES (1, 10, 'keep')",
      );
      await this.sequelize.query(
        'INSERT INTO `generated_columns_child` (`id`, `parentId`) VALUES (1, 1)',
      );

      await expect(
        this.sequelize.transaction(async transaction => {
          await queryInterface.removeColumn(tableName, 'obsolete', { transaction });
        }),
      ).to.be.rejectedWith(
        /cannot safely rebuild.*inside an existing transaction.*outside the transaction/i,
      );

      expect(await queryInterface.select(null, 'generated_columns_child', {})).to.deep.equal([
        { id: 1, parentId: 1 },
      ]);
      expect(await queryInterface.describeTable(tableName)).to.have.property('obsolete');
    });

    it('rejects an unsafe transactional rebuild of a referenced TEMP table', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await this.sequelize.query(
        'CREATE TEMP TABLE `generated_columns_temp` (`id` INTEGER PRIMARY KEY, `value` INTEGER)',
      );
      await this.sequelize.query(
        'CREATE TEMP TABLE `generated_columns_temp_child` (`id` INTEGER PRIMARY KEY, `parentId` INTEGER REFERENCES `generated_columns_temp` (`id`) ON DELETE CASCADE)',
      );
      await this.sequelize.query(
        'INSERT INTO `generated_columns_temp` (`id`, `value`) VALUES (1, 10)',
      );
      await this.sequelize.query(
        'INSERT INTO `generated_columns_temp_child` (`id`, `parentId`) VALUES (1, 1)',
      );

      await expect(
        this.sequelize.transaction(async transaction => {
          await queryInterface.addColumn(
            'generated_columns_temp',
            'doubled',
            {
              type: DataTypes.INTEGER,
              generatedAs: sql.literal('`value` * 2'),
            },
            { transaction },
          );
        }),
      ).to.be.rejectedWith(
        /cannot safely rebuild.*inside an existing transaction.*outside the transaction/i,
      );

      expect(await queryInterface.select(null, 'generated_columns_temp_child', {})).to.deep.equal([
        { id: 1, parentId: 1 },
      ]);
      expect(await queryInterface.describeTable('generated_columns_temp')).not.to.have.property(
        'doubled',
      );
    });

    it('renames a source column used by a generated expression without losing schema objects', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await this.sequelize.query('CREATE TABLE `generated_columns_audit` (`value` INTEGER)');
      await queryInterface.createTable(tableName, {
        source: DataTypes.INTEGER,
        doubled: {
          type: DataTypes.INTEGER,
          generatedAs: sql.literal('`source` * 2'),
        },
      });
      await this.sequelize.query(
        `CREATE INDEX generated_columns_source_index ON ${tableName} (source)`,
      );
      await this.sequelize.query(`
        CREATE TRIGGER generated_columns_source_update
        AFTER UPDATE OF source ON ${tableName}
        BEGIN
          INSERT INTO generated_columns_audit (value) VALUES (NEW.source);
        END
      `);
      await queryInterface.bulkInsert(tableName, [{ source: 4 }]);

      await queryInterface.renameColumn(tableName, 'source', 'value');

      const [schemaRows] = await this.sequelize.query(
        `SELECT type, name, sql FROM sqlite_master WHERE name = '${tableName}' OR tbl_name = '${tableName}' ORDER BY type, name`,
      );
      for (const schemaRow of schemaRows) {
        expect(schemaRow.sql).not.to.match(/\bsource\b/);
      }

      expect(schemaRows.find(row => row.type === 'table').sql).to.match(
        /GENERATED ALWAYS AS \([`"]value[`"] \* 2\) STORED/,
      );
      expect(schemaRows.find(row => row.name === 'generated_columns_source_index')).not.to.be
        .undefined;
      expect(schemaRows.find(row => row.name === 'generated_columns_source_update')).not.to.be
        .undefined;

      await this.sequelize.query(`UPDATE ${tableName} SET value = 7`);
      expect(await queryInterface.select(null, tableName, {})).to.deep.equal([
        { value: 7, doubled: 14 },
      ]);
      expect(await queryInterface.select(null, 'generated_columns_audit', {})).to.deep.equal([
        { value: 7 },
      ]);
    });

    it('uses columnName when adding a STORED generated column', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await queryInterface.createTable(tableName, { value: DataTypes.INTEGER });
      await queryInterface.bulkInsert(tableName, [{ value: 5 }]);

      await queryInterface.addColumn(tableName, 'logicalDoubled', {
        type: DataTypes.INTEGER,
        columnName: 'physical_doubled',
        generatedAs: sql.literal('`value` * 2'),
      });

      expect(await queryInterface.select(null, tableName, {})).to.deep.equal([
        { value: 5, physical_doubled: 10 },
      ]);
      expect(await queryInterface.describeTable(tableName)).to.have.property('physical_doubled');
    });

    it('parses escaped generated identifiers and comments while preserving expression indexes', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await this.sequelize.query(`
        CREATE TABLE generated_columns_test (
          \`a\`\`b\` INTEGER,
          /* leading definition comment, with parenthesis ) */
          \`g\`\`x\` INTEGER GENERATED ALWAYS AS (
            \`a\`\`b\` + 1 /* misleading comma, and parenthesis ) */
          ) STORED,
          \`obsolete\` TEXT
        )
      `);
      await this.sequelize.query(
        'CREATE INDEX generated_columns_complex_index ON generated_columns_test ((`a``b` + 1)) WHERE `a``b` > 0',
      );
      await this.sequelize.query(
        "INSERT INTO generated_columns_test (`a``b`, `obsolete`) VALUES (2, 'remove me')",
      );

      const description = await queryInterface.describeTable(tableName);
      expect(description['g`x'].generatedAs.val.join('')).to.include(
        '`a``b` + 1 /* misleading comma, and parenthesis ) */',
      );

      await queryInterface.removeColumn(tableName, 'obsolete');

      const [[index]] = await this.sequelize.query(
        "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'generated_columns_complex_index'",
      );
      expect(index.sql).to.include('((`a``b` + 1)) WHERE `a``b` > 0');
      expect(await queryInterface.select(null, tableName, {})).to.deep.equal([
        { 'a`b': 2, 'g`x': 3 },
      ]);
    });

    it('adds and introspects a STORED generated column on a TEMP table', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await this.sequelize.query(
        'CREATE TEMP TABLE `generated_columns_temp` (`value` INTEGER NOT NULL)',
      );
      await this.sequelize.query('INSERT INTO `generated_columns_temp` (`value`) VALUES (9)');

      await queryInterface.addColumn('generated_columns_temp', 'doubled', {
        type: DataTypes.INTEGER,
        generatedAs: sql.literal('`value` * 2'),
      });

      const description = await queryInterface.describeTable('generated_columns_temp');
      expect(description.doubled.generatedColumn).to.equal('STORED');
      expect(description.doubled.generatedAs.val.join('')).to.equal('`value` * 2');
      expect(await queryInterface.select(null, 'generated_columns_temp', {})).to.deep.equal([
        { value: 9, doubled: 18 },
      ]);
      const [[tempTable]] = await this.sequelize.query(
        "SELECT count(*) AS count FROM sqlite_temp_master WHERE type = 'table' AND name = 'generated_columns_temp'",
      );
      const [[mainTable]] = await this.sequelize.query(
        "SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'generated_columns_temp'",
      );
      expect(tempTable.count).to.equal(1);
      expect(mainTable.count).to.equal(0);
    });

    it('keeps a TEMP table in the temporary schema when rebuilding it', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await this.sequelize.query(
        'CREATE TEMP TABLE `generated_columns_temp` (`value` INTEGER, `obsolete` TEXT, `doubled` INTEGER GENERATED ALWAYS AS (`value` * 2) STORED)',
      );
      await this.sequelize.query(
        "INSERT INTO `generated_columns_temp` (`value`, `obsolete`) VALUES (4, 'remove')",
      );

      await queryInterface.removeColumn('generated_columns_temp', 'obsolete');

      const [[tempTable]] = await this.sequelize.query(
        "SELECT count(*) AS count FROM sqlite_temp_master WHERE type = 'table' AND name = 'generated_columns_temp'",
      );
      const [[mainTable]] = await this.sequelize.query(
        "SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'generated_columns_temp'",
      );
      expect(tempTable.count).to.equal(1);
      expect(mainTable.count).to.equal(0);
      expect(await queryInterface.select(null, 'generated_columns_temp', {})).to.deep.equal([
        { value: 4, doubled: 8 },
      ]);
    });

    it('does not expose TABLE_XINFO hidden virtual-table fields as columns', async function () {
      await this.sequelize.query(
        'CREATE VIRTUAL TABLE `generated_columns_fts` USING fts5(`content`)',
      );

      const description = await this.sequelize.queryRaw(
        'PRAGMA TABLE_XINFO(`generated_columns_fts`)',
        { type: QueryTypes.DESCRIBE },
      );

      expect(description).to.have.all.keys('content');
    });

    it('parses generated clauses outside comments and quoted table names', async function () {
      const queryInterface = this.sequelize.queryInterface;
      const unusualTableName = 'generated_columns_(test';
      await this.sequelize.query(`
        CREATE TABLE "${unusualTableName}" (
          "value" INTEGER,
          "doubled" INTEGER CHECK (CAST("value" AS INTEGER) > 0 /* AS (wrong) */)
            GENERATED ALWAYS AS ("value" * 2) STORED,
          /* leading column comment */ "obsolete" TEXT
        )
      `);
      await this.sequelize.query(
        `INSERT INTO "${unusualTableName}" ("value", "obsolete") VALUES (3, 'remove')`,
      );

      const description = await queryInterface.describeTable(unusualTableName);
      expect(description.doubled.generatedAs.val.join('')).to.equal('"value" * 2');

      await queryInterface.removeColumn(unusualTableName, 'obsolete');
      expect(await queryInterface.describeTable(unusualTableName)).not.to.have.property('obsolete');

      await queryInterface.addColumn(unusualTableName, 'tripled', {
        type: DataTypes.INTEGER,
        generatedAs: sql.literal('"value" * 3'),
      });

      expect(await queryInterface.select(null, unusualTableName, {})).to.deep.equal([
        { value: 3, doubled: 6, tripled: 9 },
      ]);
    });

    it('preserves a generated column when rebuilding for an unrelated column', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await queryInterface.createTable(tableName, {
        value: DataTypes.INTEGER,
        obsolete: DataTypes.STRING,
        doubled: {
          type: DataTypes.INTEGER,
          generatedAs: sql.literal('`value` * 2'),
          generatedColumn: 'STORED',
        },
      });
      await queryInterface.bulkInsert(tableName, [{ value: 8, obsolete: 'remove me' }]);

      await queryInterface.removeColumn(tableName, 'obsolete');

      const description = await queryInterface.describeTable(tableName);
      expect(description.doubled.generatedColumn).to.equal('STORED');
      expect(await queryInterface.select(null, tableName, {})).to.deep.equal([
        { value: 8, doubled: 16 },
      ]);
    });

    it('preserves raw table schema and composite unique constraints when rebuilding', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await this.sequelize.query(`
        CREATE TABLE generated_columns_test (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "a" INTEGER CHECK ("a" > 0),
          "b" TEXT COLLATE NOCASE,
          "change_me" INTEGER,
          "obsolete" TEXT,
          "doubled" INTEGER GENERATED ALWAYS AS ("a" * 2) STORED,
          UNIQUE ("a", "b")
        ) STRICT
      `);
      await this.sequelize.query(
        "INSERT INTO generated_columns_test (`a`, `b`, `change_me`, `obsolete`) VALUES (1, 'x', 1, 'remove'), (1, 'y', 2, 'remove'), (2, 'x', 3, 'remove')",
      );
      await this.sequelize.query(
        "UPDATE main.sqlite_sequence SET seq = 50 WHERE name = 'generated_columns_test'",
      );

      await queryInterface.changeColumn(tableName, 'change_me', DataTypes.TEXT);
      await queryInterface.removeColumn(tableName, 'obsolete');

      const [[table]] = await this.sequelize.query(
        `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = '${tableName}'`,
      );
      expect(table.sql).to.include('AUTOINCREMENT');
      expect(table.sql).to.include('CHECK ("a" > 0)');
      expect(table.sql).to.include('COLLATE NOCASE');
      expect(table.sql).to.include('UNIQUE ("a", "b")');
      expect(table.sql).to.match(/\) STRICT$/);
      expect(table.sql).to.include('`change_me` TEXT');

      await expect(
        this.sequelize.query(
          "INSERT INTO generated_columns_test (`a`, `b`, `change_me`) VALUES (-1, 'invalid', 4)",
        ),
      ).to.be.rejected;
      await expect(
        this.sequelize.query(
          "INSERT INTO generated_columns_test (`a`, `b`, `change_me`) VALUES (1, 'X', 4)",
        ),
      ).to.be.rejected;
      await this.sequelize.query(
        "INSERT INTO generated_columns_test (`a`, `b`, `change_me`) VALUES (3, 'z', 4)",
      );
      const [[inserted]] = await this.sequelize.query(
        'SELECT `id`, `doubled` FROM generated_columns_test WHERE `a` = 3',
      );
      expect(inserted).to.deep.equal({ id: 51, doubled: 6 });
    });

    it('preserves dependent views when rebuilding a table', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await queryInterface.createTable(tableName, {
        value: DataTypes.INTEGER,
        obsolete: DataTypes.STRING,
        doubled: {
          type: DataTypes.INTEGER,
          generatedAs: sql.literal('`value` * 2'),
        },
      });
      await queryInterface.bulkInsert(tableName, [{ value: 7, obsolete: 'remove' }]);
      await this.sequelize.query(
        'CREATE VIEW `generated_columns_view` AS SELECT `value`, `doubled` FROM `generated_columns_test`',
      );

      await queryInterface.removeColumn(tableName, 'obsolete');

      const [viewRows] = await this.sequelize.query(
        'SELECT `value`, `doubled` FROM `generated_columns_view`',
      );
      expect(viewRows).to.deep.equal([{ value: 7, doubled: 14 }]);
      const [[view]] = await this.sequelize.query(
        "SELECT sql FROM sqlite_master WHERE type = 'view' AND name = 'generated_columns_view'",
      );
      expect(view.sql).to.include('FROM `generated_columns_test`');
    });

    it('preserves TEMP views that depend on a main-schema table', async function () {
      const queryInterface = this.sequelize.queryInterface;
      await queryInterface.createTable(tableName, {
        value: DataTypes.INTEGER,
        obsolete: DataTypes.STRING,
      });
      await queryInterface.bulkInsert(tableName, [{ value: 7, obsolete: 'remove' }]);
      await this.sequelize.query(
        'CREATE TEMP VIEW `generated_columns_temp_view` AS SELECT `value` FROM `main`.`generated_columns_test`',
      );
      await this.sequelize.query(
        'CREATE TEMP TABLE `generated_columns_temp_audit` (`value` INTEGER)',
      );
      await this.sequelize.query(`
        CREATE TEMP TRIGGER generated_columns_temp_trigger
        AFTER INSERT ON generated_columns_test
        BEGIN
          INSERT INTO generated_columns_temp_audit (value) VALUES (NEW.value);
        END
      `);

      await queryInterface.addColumn(tableName, 'doubled', {
        type: DataTypes.INTEGER,
        generatedAs: sql.literal('`value` * 2'),
      });
      await queryInterface.removeColumn(tableName, 'obsolete');

      const [viewRows] = await this.sequelize.query(
        'SELECT `value` FROM `generated_columns_temp_view`',
      );
      expect(viewRows).to.deep.equal([{ value: 7 }]);
      const [[tempView]] = await this.sequelize.query(
        "SELECT count(*) AS count FROM sqlite_temp_master WHERE type = 'view' AND name = 'generated_columns_temp_view'",
      );
      const [[mainView]] = await this.sequelize.query(
        "SELECT count(*) AS count FROM sqlite_master WHERE type = 'view' AND name = 'generated_columns_temp_view'",
      );
      expect(tempView.count).to.equal(1);
      expect(mainView.count).to.equal(0);
      expect(await queryInterface.select(null, tableName, {})).to.deep.equal([
        { value: 7, doubled: 14 },
      ]);
      await this.sequelize.query('INSERT INTO `generated_columns_test` (`value`) VALUES (8)');
      expect(await queryInterface.select(null, 'generated_columns_temp_audit', {})).to.deep.equal([
        { value: 8 },
      ]);
    });

    it('supports sync alter with an existing generated column', async function () {
      const GeneratedModel = this.sequelize.define(
        'SqliteGeneratedColumn',
        {
          value: DataTypes.INTEGER,
          doubled: {
            type: DataTypes.INTEGER,
            generatedAs: sql.literal('`value` * 2'),
            generatedColumn: 'STORED',
          },
        },
        { freezeTableName: true, tableName, timestamps: false },
      );
      await GeneratedModel.sync({ force: true });
      await GeneratedModel.create({ value: 11 });

      await GeneratedModel.sync({ alter: true });

      expect((await GeneratedModel.findOne()).doubled).to.equal(22);
    });

    it('rolls back earlier individual inserts if a later mixed empty bulk row fails', async function () {
      const GeneratedModel = this.sequelize.define(
        'SqliteGeneratedColumn',
        {
          source: { type: DataTypes.STRING, unique: true },
          computed: {
            type: DataTypes.STRING,
            generatedAs: sql.literal("coalesce(`source`, 'default')"),
            generatedColumn: 'STORED',
          },
        },
        { freezeTableName: true, tableName, timestamps: false },
      );
      await GeneratedModel.sync({ force: true });
      await GeneratedModel.create({ source: 'duplicate' });
      let bulkInstances;
      let initialDataValues;
      GeneratedModel.beforeBulkCreate(instances => {
        bulkInstances = instances;
        initialDataValues = { ...instances[0].dataValues };
      });

      await expect(GeneratedModel.bulkCreate([{}, { source: 'duplicate' }], { fields: ['source'] }))
        .to.be.rejected;

      expect(await GeneratedModel.count()).to.equal(1);
      expect(await GeneratedModel.count({ where: { source: null } })).to.equal(0);
      expect(bulkInstances[0].isNewRecord).to.equal(true);
      expect(bulkInstances[0].dataValues).to.deep.equal(initialDataValues);
    });

    it('keeps transaction null independent from an ambient CLS transaction', async () => {
      const storage = `/tmp/sequelize-generated-columns-transaction-null-${process.pid}.sqlite`;
      const independentSequelize = new Sequelize({
        dialect: SqliteDialect,
        disableClsTransactions: false,
        logging: false,
        pool: { max: 2 },
        storage,
      });

      try {
        const GeneratedModel = independentSequelize.define(
          'SqliteIndependentGeneratedColumn',
          {
            source: DataTypes.STRING,
            computed: {
              type: DataTypes.STRING,
              generatedAs: sql.literal("coalesce(`source`, 'default')"),
              generatedColumn: 'STORED',
            },
          },
          { timestamps: false },
        );
        await GeneratedModel.sync({ force: true });

        await expect(
          independentSequelize.transaction(async () => {
            await GeneratedModel.bulkCreate([{}, { source: 'outside' }], {
              fields: ['source'],
              transaction: null,
            });

            throw new Error('roll back ambient transaction');
          }),
        ).to.be.rejectedWith('roll back ambient transaction');

        expect(await GeneratedModel.count()).to.equal(2);
      } finally {
        await independentSequelize.close();
        await rm(storage, { force: true });
      }
    });
  });
}
