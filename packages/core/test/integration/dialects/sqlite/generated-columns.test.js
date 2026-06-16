'use strict';

const { DataTypes, QueryTypes, sql } = require('@sequelize/core');
const { expect } = require('chai');
const Support = require('../../support');

if (Support.getTestDialect() === 'sqlite3') {
  describe('[SQLITE Specific] generated columns', () => {
    const tableName = 'generated_columns_test';

    afterEach(async function () {
      await this.sequelize.query('DROP VIEW IF EXISTS `generated_columns_view`');
      await this.sequelize.query('DROP TABLE IF EXISTS `generated_columns_child`');
      await this.sequelize.query('DROP TABLE IF EXISTS `generated_columns_temp`');
      await this.sequelize.query('DROP TABLE IF EXISTS `generated_columns_fts`');
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
  });
}
