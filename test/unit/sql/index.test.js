'use strict';

var Support   = require(__dirname + '/../support')
  , expectsql = Support.expectsql
  , current   = Support.sequelize
  , sql       = current.dialect.QueryGenerator
  , current = Support.sequelize;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

suite(Support.getTestDialectTeaser('SQL'), function() {
  suite('addIndex', function () {
    test('naming', function () {
      expectsql(sql.addIndexQuery('table', ['column1', 'column2'], {}, 'table'), {
        default: 'CREATE INDEX [table_column1_column2] ON [table] ([column1], [column2])',
        mysql: 'ALTER TABLE `table` ADD INDEX `table_column1_column2` (`column1`, `column2`)'
      });

      if (current.dialect.supports.schemas) {
        expectsql(sql.addIndexQuery('schema.table', ['column1', 'column2'], {}), {
          default: 'CREATE INDEX [schema_table_column1_column2] ON [schema].[table] ([column1], [column2])',
        });

        expectsql(sql.addIndexQuery({
          schema: 'schema',
          tableName: 'table'
        }, ['column1', 'column2'], {}, 'schema_table'), {
          default: 'CREATE INDEX [schema_table_column1_column2] ON [schema].[table] ([column1], [column2])'
        });

        expectsql(sql.addIndexQuery(sql.quoteTable(sql.addSchema({
          $schema: 'schema',
          tableName: 'table'
        })), ['column1', 'column2'], {}), {
          default: 'CREATE INDEX [schema_table_column1_column2] ON [schema].[table] ([column1], [column2])'
        });
      }
    });

    test('type and method', function () {
      expectsql(sql.addIndexQuery('User', ['fieldC'], {
          type: 'FULLTEXT',
          concurrently: true
        }), {
        sqlite: 'CREATE INDEX `user_field_c` ON `User` (`fieldC`)',
        mssql: 'CREATE FULLTEXT INDEX [user_field_c] ON [User] ([fieldC])',
        postgres: 'CREATE INDEX CONCURRENTLY "user_field_c" ON "User" ("fieldC")',
        mysql: 'ALTER TABLE `User` ADD FULLTEXT INDEX `user_field_c` (`fieldC`)'
      });

      expectsql(sql.addIndexQuery('User', ['fieldB', {attribute: 'fieldA', collate: 'en_US', order: 'DESC', length: 5}], {
          name: 'a_b_uniq',
          unique: true,
          method: 'BTREE',
          parser: 'foo'
        }), {
        sqlite: 'CREATE UNIQUE INDEX `a_b_uniq` ON `User` (`fieldB`, `fieldA` COLLATE `en_US` DESC)',
        mssql: 'CREATE UNIQUE INDEX [a_b_uniq] ON [User] ([fieldB], [fieldA] DESC)',
        postgres: 'CREATE UNIQUE INDEX "a_b_uniq" ON "User" USING BTREE ("fieldB", "fieldA" COLLATE "en_US" DESC)',
        mysql: 'ALTER TABLE `User` ADD UNIQUE INDEX `a_b_uniq` USING BTREE (`fieldB`, `fieldA`(5) DESC) WITH PARSER foo',
      });
    });

    test('POJO field', function () {
      expectsql(sql.addIndexQuery('table', [{ attribute: 'column', collate: 'BINARY', length: 5, order: 'DESC'}], {}, 'table'), {
        default: 'CREATE INDEX [table_column] ON [table] ([column] COLLATE [BINARY] DESC)',
        mssql: 'CREATE INDEX [table_column] ON [table] ([column] DESC)',
        mysql: 'ALTER TABLE `table` ADD INDEX `table_column` (`column`(5) DESC)'
      });
    });

    test('function', function () {
      expectsql(sql.addIndexQuery('table', [current.fn('UPPER', current.col('test'))], { name: 'myindex'}), {
        default: 'CREATE INDEX [myindex] ON [table] (UPPER([test]))',
        mysql: 'ALTER TABLE `table` ADD INDEX `myindex` (UPPER(`test`))'
      });
    });

    if (current.dialect.supports.index.using === 2) {
      test('USING', function () {
        expectsql(sql.addIndexQuery('table', {
          fields: ['event'],
          using: 'gin'
        }), {
          postgres: 'CREATE INDEX "table_event" ON "table" USING gin ("event")'
        });
      });
    }

    if (current.dialect.supports.index.using === 2) {
      test('WHERE', function () {
        expectsql(sql.addIndexQuery('table', {
          fields: ['type'],
          where: {
            type: 'public'
          }
        }), {
          postgres: 'CREATE INDEX "table_type" ON "table" ("type") WHERE "type" = \'public\''
        });

        expectsql(sql.addIndexQuery('table', {
          fields: ['type'],
          where: {
            type: {
              $or: [
                'group',
                'private'
              ]
            }
          }
        }), {
          postgres: 'CREATE INDEX "table_type" ON "table" ("type") WHERE ("type" = \'group\' OR "type" = \'private\')'
        });
      });
    }

    if (current.dialect.supports.JSON) {
      test('operator', function () {
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
      test('show indexes', function () {
        expectsql(sql.showIndexesQuery('table'), {
          postgres: 'SELECT i.relname AS name, ix.indisprimary AS primary, ix.indisunique AS unique, ix.indkey AS indkey, ' +
          'array_agg(a.attnum) as column_indexes, array_agg(a.attname) AS column_names, pg_get_indexdef(ix.indexrelid) ' +
          'AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a ' +
          'WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND ' +
          't.relkind = \'r\' and t.relname = \'table\' GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey ORDER BY i.relname;'
        });

        expectsql(sql.showIndexesQuery({tableName: 'table', schema: 'schema'}), {
          postgres: 'SELECT i.relname AS name, ix.indisprimary AS primary, ix.indisunique AS unique, ix.indkey AS indkey, ' +
          'array_agg(a.attnum) as column_indexes, array_agg(a.attname) AS column_names, pg_get_indexdef(ix.indexrelid) ' +
          'AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a, pg_namespace s ' +
          'WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND ' +
          't.relkind = \'r\' and t.relname = \'table\' AND s.oid = t.relnamespace AND s.nspname = \'schema\' ' +
          'GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey ORDER BY i.relname;'
        });
      });
    }
  });
});
