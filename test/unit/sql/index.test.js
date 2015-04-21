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
        default: 'CREATE INDEX [table_column1_column2] ON [table] ([column1], [column2])'
      });

      if (current.dialect.supports.schemas) {
        expectsql(sql.addIndexQuery('schema.table', ['column1', 'column2'], {}), {
          default: 'CREATE INDEX [schema_table_column1_column2] ON [schema].[table] ([column1], [column2])'
        });

        expectsql(sql.addIndexQuery('"schema"."table"', ['column1', 'column2'], {}), {
          default: 'CREATE INDEX [schema_table_column1_column2] ON [schema].[table] ([column1], [column2])'
        });
      }
    });

    test('POJO field', function () {
      expectsql(sql.addIndexQuery('table', [{ attribute: 'column', collate: 'BINARY', length: 5, order: 'DESC'}], {}, 'table'), {
        default: 'CREATE INDEX [table_column] ON [table] ([column] COLLATE [BINARY] DESC)',
        mysql: 'CREATE INDEX `table_column` ON `table` (`column`(5) DESC)',
        mssql: 'CREATE INDEX [table_column] ON [table] ([column] DESC)'
      });
    });


    test('function', function () {
      expectsql(sql.addIndexQuery('table', [current.fn('UPPER', current.col('test'))], { name: 'myindex'}), {
        default: 'CREATE INDEX [myindex] ON [table] (UPPER([test]))'
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
  });
});
