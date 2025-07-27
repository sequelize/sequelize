'use strict';

const Support = require('../../support');
const { literal, Op } = require('@sequelize/core');

const expectsql = Support.expectsql;
const current = Support.sequelize;
const sql = current.dialect.queryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

const TICK_LEFT = Support.sequelize.dialect.TICK_CHAR_LEFT;
const TICK_RIGHT = Support.sequelize.dialect.TICK_CHAR_RIGHT;

describe(Support.getTestDialectTeaser('SQL'), () => {
  if (current.dialect.name === 'snowflake') {
    return;
  }

  describe('addIndex', () => {
    it('naming', () => {
      expectsql(sql.addIndexQuery('table', ['column1', 'column2'], {}, 'table'), {
        default: 'CREATE INDEX [table_column1_column2] ON [table] ([column1], [column2])',
        'mariadb mysql':
          'ALTER TABLE `table` ADD INDEX `table_column1_column2` (`column1`, `column2`)',
      });

      if (current.dialect.supports.schemas) {
        expectsql(sql.addIndexQuery('schema.table', ['column1', 'column2'], {}), {
          default:
            'CREATE INDEX [schema_table_column1_column2] ON [schema.table] ([column1], [column2])',
          'mariadb mysql':
            'ALTER TABLE `schema.table` ADD INDEX `schema_table_column1_column2` (`column1`, `column2`)',
        });

        expectsql(
          sql.addIndexQuery(
            {
              schema: 'schema',
              tableName: 'table',
            },
            ['column1', 'column2'],
            {},
            'schema_table',
          ),
          {
            default:
              'CREATE INDEX [schema_table_column1_column2] ON [schema].[table] ([column1], [column2])',
            db2: 'CREATE INDEX "schema"."schema_table_column1_column2" ON "schema"."table" ("column1", "column2")',
            'mariadb mysql':
              'ALTER TABLE `schema`.`table` ADD INDEX `schema_table_column1_column2` (`column1`, `column2`)',
          },
        );

        expectsql(
          sql.addIndexQuery(
            // quoteTable will produce '"schema"."table"'
            // that is a perfectly valid table name, so passing it to quoteTable again (through addIndexQuery) must produce this:
            // '"""schema"".""table"""'
            // the double-quotes are duplicated because they are escaped
            sql.quoteTable({
              schema: 'schema',
              tableName: 'table',
            }),
            ['column1', 'column2'],
            {},
          ),
          {
            // using TICK variables directly because it's impossible for expectsql to know whether the TICK inside ticks is meant to be a tick or just part of the string
            default: `CREATE INDEX ${TICK_LEFT}${TICK_LEFT}${TICK_LEFT}schema${TICK_RIGHT}${TICK_RIGHT}_${TICK_LEFT}${TICK_LEFT}table${TICK_RIGHT}${TICK_RIGHT}_column1_column2${TICK_RIGHT} ON ${TICK_LEFT}${TICK_LEFT}${TICK_LEFT}schema${TICK_RIGHT}${TICK_RIGHT}.${TICK_LEFT}${TICK_LEFT}table${TICK_RIGHT}${TICK_RIGHT}${TICK_RIGHT} ([column1], [column2])`,
            'mariadb mysql':
              'ALTER TABLE ```schema``.``table``` ADD INDEX ```schema``_``table``_column1_column2` (`column1`, `column2`)',
          },
        );
      }
    });

    it('type and using', () => {
      expectsql(
        sql.addIndexQuery('User', ['fieldC'], {
          type: 'FULLTEXT',
          concurrently: true,
        }),
        {
          ibmi: 'CREATE INDEX "user_field_c" ON "User" ("fieldC")',
          sqlite3: 'CREATE INDEX `user_field_c` ON `User` (`fieldC`)',
          db2: 'CREATE INDEX "user_field_c" ON "User" ("fieldC")',
          mssql: 'CREATE FULLTEXT INDEX [user_field_c] ON [User] ([fieldC])',
          postgres: 'CREATE INDEX CONCURRENTLY "user_field_c" ON "User" ("fieldC")',
          mariadb: 'ALTER TABLE `User` ADD FULLTEXT INDEX `user_field_c` (`fieldC`)',
          mysql: 'ALTER TABLE `User` ADD FULLTEXT INDEX `user_field_c` (`fieldC`)',
        },
      );

      expectsql(
        sql.addIndexQuery(
          'User',
          ['fieldB', { attribute: 'fieldA', collate: 'en_US', order: 'DESC', length: 5 }],
          {
            name: 'a_b_uniq',
            unique: true,
            using: 'BTREE',
            parser: 'foo',
          },
        ),
        {
          sqlite3:
            'CREATE UNIQUE INDEX `a_b_uniq` ON `User` (`fieldB`, `fieldA` COLLATE `en_US` DESC)',
          mssql: 'CREATE UNIQUE INDEX [a_b_uniq] ON [User] ([fieldB], [fieldA] DESC)',
          db2: 'CREATE UNIQUE INDEX "a_b_uniq" ON "User" ("fieldB", "fieldA" DESC)',
          ibmi: `BEGIN
      DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42891'
        BEGIN END;
        ALTER TABLE "User" ADD CONSTRAINT "a_b_uniq" UNIQUE ("fieldB", "fieldA" DESC);
      END`,
          postgres:
            'CREATE UNIQUE INDEX "a_b_uniq" ON "User" USING BTREE ("fieldB", "fieldA" COLLATE "en_US" DESC)',
          mariadb:
            'ALTER TABLE `User` ADD UNIQUE INDEX `a_b_uniq` USING BTREE (`fieldB`, `fieldA`(5) DESC) WITH PARSER foo',
          mysql:
            'ALTER TABLE `User` ADD UNIQUE INDEX `a_b_uniq` USING BTREE (`fieldB`, `fieldA`(5) DESC) WITH PARSER foo',
        },
      );
    });

    it('POJO field', () => {
      expectsql(
        sql.addIndexQuery(
          'table',
          [{ name: 'column', collate: 'BINARY', length: 5, order: 'DESC' }],
          {},
          'table',
        ),
        {
          default: 'CREATE INDEX [table_column] ON [table] ([column] COLLATE [BINARY] DESC)',
          mssql: 'CREATE INDEX [table_column] ON [table] ([column] DESC)',
          db2: 'CREATE INDEX "table_column" ON "table" ("column" DESC)',
          ibmi: 'CREATE INDEX "table_column" ON "table" ("column" DESC)',
          mariadb: 'ALTER TABLE `table` ADD INDEX `table_column` (`column`(5) DESC)',
          mysql: 'ALTER TABLE `table` ADD INDEX `table_column` (`column`(5) DESC)',
        },
      );
    });

    it('function', () => {
      expectsql(
        sql.addIndexQuery('table', [current.fn('UPPER', current.col('test'))], { name: 'myindex' }),
        {
          default: 'CREATE INDEX [myindex] ON [table] (UPPER([test]))',
          mariadb: 'ALTER TABLE `table` ADD INDEX `myindex` (UPPER(`test`))',
          mysql: 'ALTER TABLE `table` ADD INDEX `myindex` (UPPER(`test`))',
        },
      );
    });

    if (current.dialect.supports.index.using === 2) {
      it('USING', () => {
        expectsql(
          sql.addIndexQuery('table', {
            fields: ['event'],
            using: 'gin',
          }),
          {
            postgres: 'CREATE INDEX "table_event" ON "table" USING gin ("event")',
          },
        );
      });
    }

    if (current.dialect.supports.index.where) {
      it('WHERE', () => {
        expectsql(
          sql.addIndexQuery('table', {
            fields: ['type'],
            where: {
              type: 'public',
            },
          }),
          {
            ibmi: 'CREATE INDEX "table_type" ON "table" ("type") WHERE "type" = \'public\'',
            sqlite3: "CREATE INDEX `table_type` ON `table` (`type`) WHERE `type` = 'public'",
            db2: 'CREATE INDEX "table_type" ON "table" ("type") WHERE "type" = \'public\'',
            postgres: 'CREATE INDEX "table_type" ON "table" ("type") WHERE "type" = \'public\'',
            mssql: "CREATE INDEX [table_type] ON [table] ([type]) WHERE [type] = N'public'",
          },
        );

        expectsql(
          sql.addIndexQuery('table', {
            fields: ['type'],
            where: {
              type: {
                [Op.or]: ['group', 'private'],
              },
            },
          }),
          {
            ibmi: 'CREATE INDEX "table_type" ON "table" ("type") WHERE "type" = \'group\' OR "type" = \'private\'',
            sqlite3:
              "CREATE INDEX `table_type` ON `table` (`type`) WHERE `type` = 'group' OR `type` = 'private'",
            db2: 'CREATE INDEX "table_type" ON "table" ("type") WHERE "type" = \'group\' OR "type" = \'private\'',
            postgres:
              'CREATE INDEX "table_type" ON "table" ("type") WHERE "type" = \'group\' OR "type" = \'private\'',
            mssql:
              "CREATE INDEX [table_type] ON [table] ([type]) WHERE [type] = N'group' OR [type] = N'private'",
          },
        );

        expectsql(
          sql.addIndexQuery('table', {
            fields: ['type'],
            where: {
              type: {
                [Op.ne]: null,
              },
            },
          }),
          {
            ibmi: 'CREATE INDEX "table_type" ON "table" ("type") WHERE "type" IS NOT NULL',
            sqlite3: 'CREATE INDEX `table_type` ON `table` (`type`) WHERE `type` IS NOT NULL',
            db2: 'CREATE INDEX "table_type" ON "table" ("type") WHERE "type" IS NOT NULL',
            postgres: 'CREATE INDEX "table_type" ON "table" ("type") WHERE "type" IS NOT NULL',
            mssql: 'CREATE INDEX [table_type] ON [table] ([type]) WHERE [type] IS NOT NULL',
          },
        );
      });
    }

    if (current.dialect.supports.dataTypes.JSONB) {
      it('operator', () => {
        expectsql(
          sql.addIndexQuery('table', {
            fields: ['event'],
            using: 'gin',
            operator: 'jsonb_path_ops',
          }),
          {
            postgres: 'CREATE INDEX "table_event" ON "table" USING gin ("event" jsonb_path_ops)',
          },
        );
      });
    }

    if (current.dialect.supports.index.operator) {
      it('operator with multiple fields', () => {
        expectsql(
          sql.addIndexQuery('table', {
            fields: ['column1', 'column2'],
            using: 'gist',
            operator: 'inet_ops',
          }),
          {
            postgres:
              'CREATE INDEX "table_column1_column2" ON "table" USING gist ("column1" inet_ops, "column2" inet_ops)',
          },
        );
      });
      it('operator in fields', () => {
        expectsql(
          sql.addIndexQuery('table', {
            fields: [
              {
                name: 'column',
                operator: 'inet_ops',
              },
            ],
            using: 'gist',
          }),
          {
            postgres: 'CREATE INDEX "table_column" ON "table" USING gist ("column" inet_ops)',
          },
        );
      });
      it('operator in fields with order', () => {
        expectsql(
          sql.addIndexQuery('table', {
            fields: [
              {
                name: 'column',
                order: 'DESC',
                operator: 'inet_ops',
              },
            ],
            using: 'gist',
          }),
          {
            postgres: 'CREATE INDEX "table_column" ON "table" USING gist ("column" inet_ops DESC)',
          },
        );
      });
      it('operator in multiple fields #1', () => {
        expectsql(
          sql.addIndexQuery('table', {
            fields: [
              {
                name: 'column1',
                order: 'DESC',
                operator: 'inet_ops',
              },
              'column2',
            ],
            using: 'gist',
          }),
          {
            postgres:
              'CREATE INDEX "table_column1_column2" ON "table" USING gist ("column1" inet_ops DESC, "column2")',
          },
        );
      });
      it('operator in multiple fields #2', () => {
        expectsql(
          sql.addIndexQuery('table', {
            fields: [
              {
                name: 'path',
                operator: 'text_pattern_ops',
              },
              'level',
              {
                name: 'name',
                operator: 'varchar_pattern_ops',
              },
            ],
            using: 'btree',
          }),
          {
            postgres:
              'CREATE INDEX "table_path_level_name" ON "table" USING btree ("path" text_pattern_ops, "level", "name" varchar_pattern_ops)',
          },
        );
      });
    }

    it('include columns with unique index', () => {
      expectsql(
        () =>
          sql.addIndexQuery('User', {
            name: 'email_include_name',
            fields: ['email'],
            include: ['first_name', 'last_name'],
            unique: true,
          }),
        {
          default: new Error(
            `The include attribute for indexes is not supported by ${current.dialect.name} dialect`,
          ),
          mssql:
            'CREATE UNIQUE INDEX [email_include_name] ON [User] ([email]) INCLUDE ([first_name], [last_name])',
          'db2 postgres':
            'CREATE UNIQUE INDEX "email_include_name" ON "User" ("email") INCLUDE ("first_name", "last_name")',
        },
      );
    });

    it('include columns with non-unique index', () => {
      expectsql(
        () =>
          sql.addIndexQuery('User', {
            name: 'email_include_name',
            fields: ['email'],
            include: ['first_name', 'last_name'],
          }),
        {
          db2: new Error('DB2 does not support non-unique indexes with INCLUDE syntax.'),
          default: new Error(
            `The include attribute for indexes is not supported by ${current.dialect.name} dialect`,
          ),
          mssql:
            'CREATE INDEX [email_include_name] ON [User] ([email]) INCLUDE ([first_name], [last_name])',
          postgres:
            'CREATE INDEX "email_include_name" ON "User" ("email") INCLUDE ("first_name", "last_name")',
        },
      );
    });

    it('include columns using a liternal with non-unique index', () => {
      expectsql(
        () =>
          sql.addIndexQuery('User', {
            name: 'email_include_name',
            fields: ['email'],
            include: literal('(first_name, last_name)'),
          }),
        {
          db2: new Error('DB2 does not support non-unique indexes with INCLUDE syntax.'),
          default: new Error(
            `The include attribute for indexes is not supported by ${current.dialect.name} dialect`,
          ),
          mssql:
            'CREATE INDEX [email_include_name] ON [User] ([email]) INCLUDE (first_name, last_name)',
          postgres:
            'CREATE INDEX "email_include_name" ON "User" ("email") INCLUDE (first_name, last_name)',
        },
      );
    });

    it('include columns using an array of liternals with non-unique index', () => {
      expectsql(
        () =>
          sql.addIndexQuery('User', {
            name: 'email_include_name',
            fields: ['email'],
            include: [literal('first_name'), literal('last_name')],
          }),
        {
          db2: new Error('DB2 does not support non-unique indexes with INCLUDE syntax.'),
          default: new Error(
            `The include attribute for indexes is not supported by ${current.dialect.name} dialect`,
          ),
          mssql:
            'CREATE INDEX [email_include_name] ON [User] ([email]) INCLUDE (first_name, last_name)',
          postgres:
            'CREATE INDEX "email_include_name" ON "User" ("email") INCLUDE (first_name, last_name)',
        },
      );
    });
  });
});
