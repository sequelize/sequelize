'use strict';

const Support = require('../support'),
  expectsql = Support.expectsql,
  current = Support.sequelize,
  sql = current.dialect.queryGenerator,
  Op = Support.Sequelize.Op;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe(Support.getTestDialectTeaser('SQL'), () => {
  if (current.dialect.name === 'snowflake') {
    return;
  }
  describe('addIndex', () => {
    it('naming', () => {
      expectsql(sql.addIndexQuery('table', ['column1', 'column2'], {}, 'table'), {
        default: 'CREATE INDEX [table_column1_column2] ON [table] ([column1], [column2])',
        mariadb: 'ALTER TABLE `table` ADD INDEX `table_column1_column2` (`column1`, `column2`)',
        mysql: 'ALTER TABLE `table` ADD INDEX `table_column1_column2` (`column1`, `column2`)'
      });

      if (current.dialect.supports.schemas) {
        expectsql(sql.addIndexQuery('schema.table', ['column1', 'column2'], {}), {
          default: 'CREATE INDEX [schema_table_column1_column2] ON [schema].[table] ([column1], [column2])',
          mariadb: 'ALTER TABLE `schema`.`table` ADD INDEX `schema_table_column1_column2` (`column1`, `column2`)'
        });

        expectsql(sql.addIndexQuery({
          schema: 'schema',
          tableName: 'table'
        }, ['column1', 'column2'], {}, 'schema_table'), {
          default: 'CREATE INDEX [schema_table_column1_column2] ON [schema].[table] ([column1], [column2])',
          mariadb: 'ALTER TABLE `schema`.`table` ADD INDEX `schema_table_column1_column2` (`column1`, `column2`)'
        });

        expectsql(sql.addIndexQuery(sql.quoteTable(sql.addSchema({
          _schema: 'schema',
          tableName: 'table'
        })), ['column1', 'column2'], {}), {
          default: 'CREATE INDEX [schema_table_column1_column2] ON [schema].[table] ([column1], [column2])',
          mariadb: 'ALTER TABLE `schema`.`table` ADD INDEX `schema_table_column1_column2` (`column1`, `column2`)'
        });
      }
    });

    it('type and using', () => {
      expectsql(sql.addIndexQuery('User', ['fieldC'], {
        type: 'FULLTEXT',
        concurrently: true
      }), {
        sqlite: 'CREATE INDEX `user_field_c` ON `User` (`fieldC`)',
        db2: 'CREATE INDEX "user_field_c" ON "User" ("fieldC")',
        mssql: 'CREATE FULLTEXT INDEX [user_field_c] ON [User] ([fieldC])',
        postgres: 'CREATE INDEX CONCURRENTLY "user_field_c" ON "User" ("fieldC")',
        mariadb: 'ALTER TABLE `User` ADD FULLTEXT INDEX `user_field_c` (`fieldC`)',
        oracle: 'CREATE INDEX "user_field_c" ON "User" ("fieldC")',
        mysql: 'ALTER TABLE `User` ADD FULLTEXT INDEX `user_field_c` (`fieldC`)'
      });

      expectsql(sql.addIndexQuery('User', ['fieldB', { attribute: 'fieldA', collate: 'en_US', order: 'DESC', length: 5 }], {
        name: 'a_b_uniq',
        unique: true,
        using: 'BTREE',
        parser: 'foo'
      }), {
        sqlite: 'CREATE UNIQUE INDEX `a_b_uniq` ON `User` (`fieldB`, `fieldA` COLLATE `en_US` DESC)',
        mssql: 'CREATE UNIQUE INDEX [a_b_uniq] ON [User] ([fieldB], [fieldA] DESC)',
        db2: 'CREATE UNIQUE INDEX "a_b_uniq" ON "User" ("fieldB", "fieldA" DESC)',
        postgres: 'CREATE UNIQUE INDEX "a_b_uniq" ON "User" USING BTREE ("fieldB", "fieldA" COLLATE "en_US" DESC)',
        mariadb: 'ALTER TABLE `User` ADD UNIQUE INDEX `a_b_uniq` USING BTREE (`fieldB`, `fieldA`(5) DESC) WITH PARSER foo',
        oracle: 'CREATE UNIQUE INDEX "a_b_uniq" ON "User" ("fieldB", "fieldA" DESC)',
        mysql: 'ALTER TABLE `User` ADD UNIQUE INDEX `a_b_uniq` USING BTREE (`fieldB`, `fieldA`(5) DESC) WITH PARSER foo'
      });
    });

    it('POJO field', () => {
      expectsql(sql.addIndexQuery('table', [{ attribute: 'column', collate: 'BINARY', length: 5, order: 'DESC' }], {}, 'table'), {
        default: 'CREATE INDEX [table_column] ON [table] ([column] COLLATE [BINARY] DESC)',
        mssql: 'CREATE INDEX [table_column] ON [table] ([column] DESC)',
        db2: 'CREATE INDEX "table_column" ON "table" ("column" DESC)',
        mariadb: 'ALTER TABLE `table` ADD INDEX `table_column` (`column`(5) DESC)',
        oracle: 'CREATE INDEX "table_column" ON "table" ("column" DESC)',
        mysql: 'ALTER TABLE `table` ADD INDEX `table_column` (`column`(5) DESC)'
      });
    });

    it('function', () => {
      expectsql(sql.addIndexQuery('table', [current.fn('UPPER', current.col('test'))], { name: 'myindex' }), {
        default: 'CREATE INDEX [myindex] ON [table] (UPPER([test]))',
        mariadb: 'ALTER TABLE `table` ADD INDEX `myindex` (UPPER(`test`))',
        mysql: 'ALTER TABLE `table` ADD INDEX `myindex` (UPPER(`test`))'
      });
    });

    if (current.dialect.supports.index.using === 2) {
      it('USING', () => {
        expectsql(sql.addIndexQuery('table', {
          fields: ['event'],
          using: 'gin'
        }), {
          postgres: 'CREATE INDEX "table_event" ON "table" USING gin ("event")'
        });
      });
    }

    if (current.dialect.supports.index.where) {
      it('WHERE', () => {
        expectsql(sql.addIndexQuery('table', {
          fields: ['type'],
          where: {
            type: 'public'
          }
        }), {
          sqlite: 'CREATE INDEX `table_type` ON `table` (`type`) WHERE `type` = \'public\'',
          db2: 'CREATE INDEX "table_type" ON "table" ("type") WHERE "type" = \'public\'',
          postgres: 'CREATE INDEX "table_type" ON "table" ("type") WHERE "type" = \'public\'',
          mssql: 'CREATE INDEX [table_type] ON [table] ([type]) WHERE [type] = N\'public\''
        });

        expectsql(sql.addIndexQuery('table', {
          fields: ['type'],
          where: {
            type: {
              [Op.or]: [
                'group',
                'private'
              ]
            }
          }
        }), {
          sqlite: 'CREATE INDEX `table_type` ON `table` (`type`) WHERE (`type` = \'group\' OR `type` = \'private\')',
          db2: 'CREATE INDEX "table_type" ON "table" ("type") WHERE ("type" = \'group\' OR "type" = \'private\')',
          postgres: 'CREATE INDEX "table_type" ON "table" ("type") WHERE ("type" = \'group\' OR "type" = \'private\')',
          mssql: 'CREATE INDEX [table_type] ON [table] ([type]) WHERE ([type] = N\'group\' OR [type] = N\'private\')'
        });

        expectsql(sql.addIndexQuery('table', {
          fields: ['type'],
          where: {
            type: {
              [Op.ne]: null
            }
          }
        }), {
          sqlite: 'CREATE INDEX `table_type` ON `table` (`type`) WHERE `type` IS NOT NULL',
          db2: 'CREATE INDEX "table_type" ON "table" ("type") WHERE "type" IS NOT NULL',
          postgres: 'CREATE INDEX "table_type" ON "table" ("type") WHERE "type" IS NOT NULL',
          mssql: 'CREATE INDEX [table_type] ON [table] ([type]) WHERE [type] IS NOT NULL'
        });
      });
    }

    if (current.dialect.supports.JSONB) {
      it('operator', () => {
        expectsql(sql.addIndexQuery('table', {
          fields: ['event'],
          using: 'gin',
          operator: 'jsonb_path_ops'
        }), {
          postgres: 'CREATE INDEX "table_event" ON "table" USING gin ("event" jsonb_path_ops)'
        });
      });
    }

    if (current.dialect.name === 'postgres') {
      it('show indexes', () => {
        expectsql(sql.showIndexesQuery('table'), {
          postgres: 'SELECT i.relname AS name, ix.indisprimary AS primary, ix.indisunique AS unique, ix.indkey AS indkey, ' +
            'array_agg(a.attnum) as column_indexes, array_agg(a.attname) AS column_names, pg_get_indexdef(ix.indexrelid) ' +
            'AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a ' +
            'WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND ' +
            't.relkind = \'r\' and t.relname = \'table\' GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey ORDER BY i.relname;'
        });

        expectsql(sql.showIndexesQuery({ tableName: 'table', schema: 'schema' }), {
          postgres: 'SELECT i.relname AS name, ix.indisprimary AS primary, ix.indisunique AS unique, ix.indkey AS indkey, ' +
            'array_agg(a.attnum) as column_indexes, array_agg(a.attname) AS column_names, pg_get_indexdef(ix.indexrelid) ' +
            'AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a, pg_namespace s ' +
            'WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND ' +
            't.relkind = \'r\' and t.relname = \'table\' AND s.oid = t.relnamespace AND s.nspname = \'schema\' ' +
            'GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey ORDER BY i.relname;'
        });
      });
    }

    if (current.dialect.supports.index.operator) {
      it('operator with multiple fields', () => {
        expectsql(sql.addIndexQuery('table', {
          fields: ['column1', 'column2'],
          using: 'gist',
          operator: 'inet_ops'
        }), {
          postgres: 'CREATE INDEX "table_column1_column2" ON "table" USING gist ("column1" inet_ops, "column2" inet_ops)'
        });
      });
      it('operator in fields', () => {
        expectsql(sql.addIndexQuery('table', {
          fields: [{
            name: 'column',
            operator: 'inet_ops'
          }],
          using: 'gist'
        }), {
          postgres: 'CREATE INDEX "table_column" ON "table" USING gist ("column" inet_ops)'
        });
      });
      it('operator in fields with order', () => {
        expectsql(sql.addIndexQuery('table', {
          fields: [{
            name: 'column',
            order: 'DESC',
            operator: 'inet_ops'
          }],
          using: 'gist'
        }), {
          postgres: 'CREATE INDEX "table_column" ON "table" USING gist ("column" inet_ops DESC)'
        });
      });
      it('operator in multiple fields #1', () => {
        expectsql(sql.addIndexQuery('table', {
          fields: [{
            name: 'column1',
            order: 'DESC',
            operator: 'inet_ops'
          }, 'column2'],
          using: 'gist'
        }), {
          postgres: 'CREATE INDEX "table_column1_column2" ON "table" USING gist ("column1" inet_ops DESC, "column2")'
        });
      });
      it('operator in multiple fields #2', () => {
        expectsql(sql.addIndexQuery('table', {
          fields: [{
            name: 'path',
            operator: 'text_pattern_ops'
          }, 'level', {
            name: 'name',
            operator: 'varchar_pattern_ops'
          }],
          using: 'btree'
        }), {
          postgres: 'CREATE INDEX "table_path_level_name" ON "table" USING btree ("path" text_pattern_ops, "level", "name" varchar_pattern_ops)'
        });
      });
    }
  });

  describe('removeIndex', () => {
    it('naming', () => {
      expectsql(sql.removeIndexQuery('table', ['column1', 'column2'], {}, 'table'), {
        mariadb: 'DROP INDEX `table_column1_column2` ON `table`',
        mysql: 'DROP INDEX `table_column1_column2` ON `table`',
        mssql: 'DROP INDEX [table_column1_column2] ON [table]',
        db2: 'DROP INDEX "table_column1_column2"',
        oracle: 'DROP INDEX "table_column1_column2"',
        default: 'DROP INDEX IF EXISTS [table_column1_column2]'
      });
    });
  });
});
