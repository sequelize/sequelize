import { Op, sql } from '@sequelize/core';
import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;
const notSupportedError = new Error(`Indexes are not supported by the ${dialect.name} dialect.`);
const lengthNotSupportedError = new Error(
  `The ${dialect.name} dialect does not support length on index fields.`,
);
const collateNotSupportedError = new Error(
  `The ${dialect.name} dialect does not support collate on index fields.`,
);
const functionNotSupportedError = new Error(
  `The ${dialect.name} dialect does not support expression/function-based indexes.`,
);
const operatorNotSupportedError = new Error(
  `The ${dialect.name} dialect does not support operator on index fields.`,
);

describe('QueryGenerator#addIndexQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('generates a query that adds an index', () => {
    expectsql(() => queryGenerator.addIndexQuery('table', { fields: ['column1', 'column2'] }), {
      default: 'CREATE INDEX [table_column1_column2] ON [table] ([column1], [column2])',
      snowflake: notSupportedError,
    });
  });

  it('generates a query that adds an index with column using functions', () => {
    expectsql(
      () =>
        queryGenerator.addIndexQuery('table', {
          name: 'myindex',
          fields: [sql.fn('UPPER', sql.attribute('test'))],
        }),
      {
        default: functionNotSupportedError,
        snowflake: notSupportedError,
        'db2 ibmi postgres sqlite3': 'CREATE INDEX [myindex] ON [table] (UPPER([test]))',
      },
    );
  });

  it('generates a query that adds an index with column collate', () => {
    expectsql(
      () =>
        queryGenerator.addIndexQuery('table', { fields: [{ name: 'column1', collate: 'en_US' }] }),
      {
        default: collateNotSupportedError,
        sqlite3: 'CREATE INDEX `table_column1` ON `table` (`column1` COLLATE `en_US`)',
        postgres: 'CREATE INDEX "table_column1" ON "table" ("column1" COLLATE "en_US")',
        snowflake: notSupportedError,
      },
    );
  });

  it('generates a query that adds an index with column length', () => {
    expectsql(
      () => queryGenerator.addIndexQuery('table', { fields: [{ name: 'column1', length: 7 }] }),
      {
        default: lengthNotSupportedError,
        snowflake: notSupportedError,
        'mariadb mysql': 'CREATE INDEX `table_column1` ON `table` (`column1`(7))',
      },
    );
  });

  it('generates a query that adds an index with column order', () => {
    expectsql(
      () => queryGenerator.addIndexQuery('table', { fields: [{ name: 'column1', order: 'DESC' }] }),
      {
        default: 'CREATE INDEX [table_column1] ON [table] ([column1] DESC)',
        snowflake: notSupportedError,
      },
    );
  });

  it('generates a query that adds an index with column operator', () => {
    expectsql(
      () =>
        queryGenerator.addIndexQuery('table', {
          fields: [{ name: 'column', operator: 'inet_ops' }],
        }),
      {
        default: operatorNotSupportedError,
        postgres: 'CREATE INDEX "table_column" ON "table" ("column" inet_ops)',
        snowflake: notSupportedError,
      },
    );
  });

  it('generates a query that adds an index with column collate, length, operator and order', () => {
    expectsql(
      () =>
        queryGenerator.addIndexQuery('table', {
          fields: [
            { name: 'column', collate: 'en_US', length: 7, order: 'DESC', operator: 'inet_ops' },
          ],
        }),
      {
        default: collateNotSupportedError,
        sqlite3: operatorNotSupportedError,
        postgres: lengthNotSupportedError,
        snowflake: notSupportedError,
      },
    );
  });

  it('generates a query that adds an index with column operator for multiple fields', () => {
    expectsql(
      () =>
        queryGenerator.addIndexQuery('table', {
          fields: [
            { name: 'path', order: 'DESC' },
            'level',
            { name: 'name', operator: 'varchar_pattern_ops' },
          ],
        }),
      {
        default: operatorNotSupportedError,
        postgres:
          'CREATE INDEX "table_path_level_name" ON "table" ("path" DESC, "level", "name" varchar_pattern_ops)',
        snowflake: notSupportedError,
      },
    );
  });

  it('generates a query that adds an index with a name', () => {
    expectsql(
      () =>
        queryGenerator.addIndexQuery('table', { fields: ['column1', 'column2'], name: 'index_1' }),
      {
        default: 'CREATE INDEX [index_1] ON [table] ([column1], [column2])',
        snowflake: notSupportedError,
      },
    );
  });

  it('generates a query that adds a unique index with a name', () => {
    expectsql(
      () =>
        queryGenerator.addIndexQuery('table', {
          fields: ['column1', 'column2'],
          name: 'index_1',
          unique: true,
        }),
      {
        default: 'CREATE UNIQUE INDEX [index_1] ON [table] ([column1], [column2])',
        ibmi: `BEGIN DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42891' BEGIN END; ALTER TABLE "table" ADD CONSTRAINT "index_1" UNIQUE ("column1", "column2"); END`,
        snowflake: notSupportedError,
      },
    );
  });

  it('generates a query that adds an index concurrently', () => {
    expectsql(
      () =>
        queryGenerator.addIndexQuery('table', {
          fields: ['column1', 'column2'],
          name: 'index_1',
          concurrently: true,
        }),
      {
        default: buildInvalidOptionReceivedError('addIndexQuery', dialect.name, ['concurrently']),
        postgres: 'CREATE INDEX CONCURRENTLY "index_1" ON "table" ("column1", "column2")',
        snowflake: notSupportedError,
      },
    );
  });

  it(`generates a query that adds an index if it doesn't already exist`, () => {
    expectsql(
      () =>
        queryGenerator.addIndexQuery('table', {
          fields: ['column1', 'column2'],
          name: 'index_1',
          ifNotExists: true,
        }),
      {
        default: buildInvalidOptionReceivedError('addIndexQuery', dialect.name, ['ifNotExists']),
        mariadb: 'CREATE INDEX IF NOT EXISTS `index_1` ON `table` (`column1`, `column2`)',
        snowflake: notSupportedError,
        'postgres sqlite3': 'CREATE INDEX IF NOT EXISTS [index_1] ON [table] ([column1], [column2])',
      },
    );
  });

  it('generates a query that adds an index with included columns', () => {
    expectsql(
      () =>
        queryGenerator.addIndexQuery('table', {
          fields: ['column1', 'column2'],
          name: 'index_1',
          include: ['column3'],
        }),
      {
        default: buildInvalidOptionReceivedError('addIndexQuery', dialect.name, ['include']),
        db2: new Error('DB2 does not support non-unique indexes with INCLUDE syntax.'),
        snowflake: notSupportedError,
        'mssql postgres':
          'CREATE INDEX [index_1] ON [table] ([column1], [column2]) INCLUDE ([column3])',
      },
    );
  });

  it('generates a query that adds a unique index with included columns', () => {
    expectsql(
      () =>
        queryGenerator.addIndexQuery('table', {
          fields: ['column1', 'column2'],
          name: 'index_1',
          include: ['column3'],
          unique: true,
        }),
      {
        default: buildInvalidOptionReceivedError('addIndexQuery', dialect.name, ['include']),
        snowflake: notSupportedError,
        'db2 mssql postgres':
          'CREATE UNIQUE INDEX [index_1] ON [table] ([column1], [column2]) INCLUDE ([column3])',
      },
    );
  });

  it('generates a query that adds an index with included columns using a sql expression', () => {
    expectsql(
      () =>
        queryGenerator.addIndexQuery('table', {
          fields: ['column1'],
          name: 'index_1',
          include: sql.list([sql.attribute('column2'), sql.literal('column3')]),
        }),
      {
        default: buildInvalidOptionReceivedError('addIndexQuery', dialect.name, ['include']),
        db2: new Error('DB2 does not support non-unique indexes with INCLUDE syntax.'),
        snowflake: notSupportedError,
        'mssql postgres':
          'CREATE INDEX [index_1] ON [table] ([column1]) INCLUDE ([column2], column3)',
      },
    );
  });

  it('generates a query that adds a unique index with included columns using an array of sql expressions', () => {
    expectsql(
      () =>
        queryGenerator.addIndexQuery('User', {
          fields: ['email'],
          name: 'index_1',
          include: [sql.attribute('first_name'), sql.literal('last_name')],
          unique: true,
        }),
      {
        default: buildInvalidOptionReceivedError('addIndexQuery', dialect.name, ['include']),
        snowflake: notSupportedError,
        'db2 mssql postgres':
          'CREATE UNIQUE INDEX [index_1] ON [User] ([email]) INCLUDE ([first_name], last_name)',
      },
    );
  });

  it('generates a query that adds a SPATIAL index from type', () => {
    expectsql(
      () =>
        queryGenerator.addIndexQuery('table', {
          fields: ['column1', 'column2'],
          name: 'index_1',
          type: 'SPATIAL',
        }),
      {
        default: buildInvalidOptionReceivedError('addIndexQuery', dialect.name, ['type']),
        snowflake: notSupportedError,
        'mariadb mssql mysql': 'CREATE SPATIAL INDEX [index_1] ON [table] ([column1], [column2])',
      },
    );
  });

  it('generates a query that adds a index with operator', () => {
    expectsql(
      () =>
        queryGenerator.addIndexQuery('table', {
          fields: ['column1', 'column2'],
          operator: 'inet_ops',
        }),
      {
        default: buildInvalidOptionReceivedError('addIndexQuery', dialect.name, ['operator']),
        postgres:
          'CREATE INDEX "table_column1_column2" ON "table" ("column1" inet_ops, "column2" inet_ops)',
        snowflake: notSupportedError,
      },
    );
  });

  it('generates a query that adds a index with a global and column operator', () => {
    expectsql(
      () =>
        queryGenerator.addIndexQuery('table', {
          fields: ['column1', { name: 'column2', operator: 'varchar_pattern_ops' }],
          operator: 'inet_ops',
        }),
      {
        default: buildInvalidOptionReceivedError('addIndexQuery', dialect.name, ['operator']),
        postgres:
          'CREATE INDEX "table_column1_column2" ON "table" ("column1" inet_ops, "column2" varchar_pattern_ops)',
        snowflake: notSupportedError,
      },
    );
  });

  it('generates a query that adds a index with parser', () => {
    expectsql(
      () =>
        queryGenerator.addIndexQuery('table', { fields: ['column1', 'column2'], parser: 'foo' }),
      {
        default: buildInvalidOptionReceivedError('addIndexQuery', dialect.name, ['parser']),
        snowflake: notSupportedError,
        'mariadb mysql':
          'CREATE INDEX `table_column1_column2` ON `table` (`column1`, `column2`) WITH PARSER foo',
      },
    );
  });

  it('generates a query that adds a index with using', () => {
    expectsql(
      () =>
        queryGenerator.addIndexQuery('table', { fields: ['column1', 'column2'], using: 'BTREE' }),
      {
        default: buildInvalidOptionReceivedError('addIndexQuery', dialect.name, ['using']),
        postgres:
          'CREATE INDEX "table_column1_column2" ON "table" USING BTREE ("column1", "column2")',
        snowflake: notSupportedError,
        'mariadb mysql':
          'CREATE INDEX `table_column1_column2` USING BTREE ON `table` (`column1`, `column2`)',
      },
    );
  });

  it('generates a query that adds a index with operator and using', () => {
    expectsql(
      () =>
        queryGenerator.addIndexQuery('table', {
          fields: ['column1', 'column2'],
          operator: 'inet_ops',
          using: 'gist',
        }),
      {
        default: buildInvalidOptionReceivedError('addIndexQuery', dialect.name, [
          'operator',
          'using',
        ]),
        postgres:
          'CREATE INDEX "table_column1_column2" ON "table" USING gist ("column1" inet_ops, "column2" inet_ops)',
        snowflake: notSupportedError,
        'mariadb mysql': buildInvalidOptionReceivedError('addIndexQuery', dialect.name, [
          'operator',
        ]),
      },
    );
  });

  it('generates a query that adds a index with where', () => {
    expectsql(
      () => queryGenerator.addIndexQuery('table', { fields: ['type'], where: { type: 'public' } }),
      {
        default: `CREATE INDEX [table_type] ON [table] ([type]) WHERE [type] = 'public'`,
        mssql: "CREATE INDEX [table_type] ON [table] ([type]) WHERE [type] = N'public'",
        snowflake: notSupportedError,
        'mariadb mysql': buildInvalidOptionReceivedError('addIndexQuery', dialect.name, ['where']),
      },
    );

    expectsql(
      () =>
        queryGenerator.addIndexQuery('table', {
          fields: ['type'],
          where: {
            type: {
              [Op.or]: ['group', 'private'],
            },
          },
        }),
      {
        default: `CREATE INDEX [table_type] ON [table] ([type]) WHERE [type] = 'group' OR [type] = 'private'`,
        mssql:
          "CREATE INDEX [table_type] ON [table] ([type]) WHERE [type] = N'group' OR [type] = N'private'",
        snowflake: notSupportedError,
        'mariadb mysql': buildInvalidOptionReceivedError('addIndexQuery', dialect.name, ['where']),
      },
    );

    expectsql(
      () =>
        queryGenerator.addIndexQuery('table', {
          fields: ['type'],
          where: {
            type: {
              [Op.isNot]: null,
            },
          },
        }),
      {
        default: 'CREATE INDEX [table_type] ON [table] ([type]) WHERE [type] IS NOT NULL',
        snowflake: notSupportedError,
        'mariadb mysql': buildInvalidOptionReceivedError('addIndexQuery', dialect.name, ['where']),
      },
    );
  });

  it('generates a query that adds an index for a model', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(() => queryGenerator.addIndexQuery(MyModel, { fields: ['username'] }), {
      default: 'CREATE INDEX [my_models_username] ON [MyModels] ([username])',
      snowflake: notSupportedError,
    });
  });

  it('generates a query that adds an index for a model definition', () => {
    const MyModel = sequelize.define('MyModel', {});
    const modelDefinition = MyModel.modelDefinition;

    expectsql(() => queryGenerator.addIndexQuery(modelDefinition, { fields: ['username'] }), {
      default: 'CREATE INDEX [my_models_username] ON [MyModels] ([username])',
      snowflake: notSupportedError,
    });
  });

  it('generates a query that adds an index with schema', () => {
    expectsql(
      () =>
        queryGenerator.addIndexQuery(
          { tableName: 'myTable', schema: 'mySchema' },
          { fields: ['username'] },
        ),
      {
        default: `CREATE INDEX [my_table_username] ON [mySchema].[myTable] ([username])`,
        sqlite3: 'CREATE INDEX `my_table_username` ON `mySchema.myTable` (`username`)',
        snowflake: notSupportedError,
        'db2 ibmi':
          'CREATE INDEX "mySchema"."my_table_username" ON "mySchema"."myTable" ("username")',
      },
    );
  });

  it('generates a query that adds an index with default schema', () => {
    expectsql(
      () =>
        queryGenerator.addIndexQuery(
          { tableName: 'myTable', schema: dialect.getDefaultSchema() },
          { fields: ['username'] },
        ),
      {
        default: `CREATE INDEX [my_table_username] ON [myTable] ([username])`,
        snowflake: notSupportedError,
      },
    );
  });

  it('generates a query that adds an index with globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.queryGenerator;

    expectsql(() => queryGeneratorSchema.addIndexQuery('myTable', { fields: ['username'] }), {
      default: `CREATE INDEX [my_table_username] ON [mySchema].[myTable] ([username])`,
      sqlite3: 'CREATE INDEX `my_table_username` ON `mySchema.myTable` (`username`)',
      snowflake: notSupportedError,
      'db2 ibmi':
        'CREATE INDEX "mySchema"."my_table_username" ON "mySchema"."myTable" ("username")',
    });
  });

  it('generates a query that adds an index with schema and custom delimiter argument', () => {
    // This test is only relevant for dialects that do not support schemas
    if (dialect.supports.schemas) {
      return;
    }

    expectsql(
      () =>
        queryGenerator.addIndexQuery(
          { tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' },
          { fields: ['username'] },
        ),
      {
        sqlite3: 'CREATE INDEX `my_table_username` ON `mySchemacustommyTable` (`username`)',
      },
    );
  });
});
