import { DataTypes, Op, literal, sql } from '@sequelize/core';
import { expect } from 'chai';
import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;
const limitNotSupportedError = new Error(
  'Using LIMIT in bulkDeleteQuery requires specifying a model or model definition.',
);

describe('QueryGenerator#bulkDeleteQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces a delete query', () => {
    expectsql(queryGenerator.bulkDeleteQuery('myTable', { where: { name: 'barry' } }), {
      default: `DELETE FROM [myTable] WHERE [name] = 'barry'`,
      mssql: `DELETE FROM [myTable] WHERE [name] = N'barry'; SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
    });
  });

  it('produces a delete query with a limit', () => {
    expectsql(
      () => queryGenerator.bulkDeleteQuery('myTable', { where: { name: 'barry' }, limit: 10 }),
      {
        default: `DELETE FROM [myTable] WHERE [name] = 'barry' LIMIT 10`,
        sqlite3:
          "DELETE FROM `myTable` WHERE rowid IN (SELECT rowid FROM `myTable` WHERE `name` = 'barry' LIMIT 10)",
        'db2 ibmi': `DELETE FROM "myTable" WHERE "name" = 'barry' FETCH NEXT 10 ROWS ONLY`,
        'mssql postgres snowflake oracle': limitNotSupportedError,
      },
    );
  });

  it('produces a delete query with a limit using a model', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(queryGenerator.bulkDeleteQuery(MyModel, { where: { name: 'barry' }, limit: 10 }), {
      default: `DELETE FROM [MyModels] WHERE [name] = 'barry' LIMIT 10`,
      mssql: `DELETE FROM [MyModels] WHERE [id] IN (SELECT [id] FROM [MyModels] WHERE [name] = N'barry' ORDER BY [id] OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY); SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
      sqlite3:
        "DELETE FROM `MyModels` WHERE rowid IN (SELECT rowid FROM `MyModels` WHERE `name` = 'barry' LIMIT 10)",
      'db2 ibmi': `DELETE FROM "MyModels" WHERE "name" = 'barry' FETCH NEXT 10 ROWS ONLY`,
      'postgres snowflake': `DELETE FROM "MyModels" WHERE "id" IN (SELECT "id" FROM "MyModels" WHERE "name" = 'barry' ORDER BY "id" LIMIT 10)`,
      oracle: `DELETE FROM "MyModels" WHERE rowid IN (SELECT rowid FROM "MyModels" WHERE rownum <= 10 AND ("name" = 'barry'))`,
    });
  });

  it('produces a delete query with a limit using a model definition', () => {
    const MyModel = sequelize.define('MyModel', {});
    const myDefinition = MyModel.modelDefinition;

    expectsql(
      queryGenerator.bulkDeleteQuery(myDefinition, { where: { name: 'barry' }, limit: 10 }),
      {
        default: `DELETE FROM [MyModels] WHERE [name] = 'barry' LIMIT 10`,
        mssql: `DELETE FROM [MyModels] WHERE [id] IN (SELECT [id] FROM [MyModels] WHERE [name] = N'barry' ORDER BY [id] OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY); SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
        sqlite3:
          "DELETE FROM `MyModels` WHERE rowid IN (SELECT rowid FROM `MyModels` WHERE `name` = 'barry' LIMIT 10)",
        'db2 ibmi': `DELETE FROM "MyModels" WHERE "name" = 'barry' FETCH NEXT 10 ROWS ONLY`,
        'postgres snowflake': `DELETE FROM "MyModels" WHERE "id" IN (SELECT "id" FROM "MyModels" WHERE "name" = 'barry' ORDER BY "id" LIMIT 10)`,
        oracle: `DELETE FROM "MyModels" WHERE rowid IN (SELECT rowid FROM "MyModels" WHERE rownum <= 10 AND ("name" = 'barry'))`,
      },
    );
  });

  // you'll find more replacement tests in query-generator tests
  it('produces a delete query with named replacements in literals', () => {
    const MyModel = sequelize.define('MyModel', {});

    const query = queryGenerator.bulkDeleteQuery(MyModel, {
      limit: literal(':limit'),
      where: literal('name = :name'),
      replacements: {
        limit: 1,
        name: 'Zoe',
      },
    });

    expectsql(query, {
      default: `DELETE FROM [MyModels] WHERE name = 'Zoe' LIMIT 1`,
      mssql: `DELETE FROM [MyModels] WHERE [id] IN (SELECT [id] FROM [MyModels] WHERE name = N'Zoe' ORDER BY [id] OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY); SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
      sqlite3: `DELETE FROM \`MyModels\` WHERE rowid IN (SELECT rowid FROM \`MyModels\` WHERE name = 'Zoe' LIMIT 1)`,
      'db2 ibmi': `DELETE FROM "MyModels" WHERE name = 'Zoe' FETCH NEXT 1 ROWS ONLY`,
      'postgres snowflake': `DELETE FROM "MyModels" WHERE "id" IN (SELECT "id" FROM "MyModels" WHERE name = 'Zoe' ORDER BY "id" LIMIT 1)`,
      oracle: `DELETE FROM "MyModels" WHERE rowid IN (SELECT rowid FROM "MyModels" WHERE rownum <= :limit AND (name = 'Zoe'))`,
    });
  });

  it('fails to produce a delete query with undefined parameter in where', () => {
    expectsql(() => queryGenerator.bulkDeleteQuery('myTable', { where: { name: undefined } }), {
      default:
        new Error(`Invalid value received for the "where" option. Refer to the sequelize documentation to learn which values the "where" option accepts.
Value: { name: undefined }
Caused by: "undefined" cannot be escaped`),
    });
  });

  it('produces a delete query with a model where primary key has a field name different from attribute name', () => {
    const MyModel = sequelize.define('MyModel', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'my_model_id',
      },
    });

    expectsql(queryGenerator.bulkDeleteQuery(MyModel, { where: { id: 2 } }), {
      default: 'DELETE FROM [MyModels] WHERE [my_model_id] = 2',
      mssql: 'DELETE FROM [MyModels] WHERE [my_model_id] = 2; SELECT @@ROWCOUNT AS AFFECTEDROWS;',
    });
  });

  it('produces a delete query with a schema', () => {
    expectsql(
      queryGenerator.bulkDeleteQuery(
        { tableName: 'myTable', schema: 'mySchema' },
        { where: { name: 'barry' } },
      ),
      {
        default: `DELETE FROM [mySchema].[myTable] WHERE [name] = 'barry'`,
        mssql: `DELETE FROM [mySchema].[myTable] WHERE [name] = N'barry'; SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
        sqlite3: "DELETE FROM `mySchema.myTable` WHERE `name` = 'barry'",
      },
    );
  });

  it('produces a delete query with a default schema', () => {
    expectsql(
      queryGenerator.bulkDeleteQuery(
        { tableName: 'myTable', schema: dialect.getDefaultSchema() },
        { where: { name: 'barry' } },
      ),
      {
        default: `DELETE FROM [myTable] WHERE [name] = 'barry'`,
        mssql: `DELETE FROM [myTable] WHERE [name] = N'barry'; SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
        sqlite3: "DELETE FROM `myTable` WHERE `name` = 'barry'",
      },
    );
  });

  it('produces a delete query with a globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.queryGenerator;

    expectsql(queryGeneratorSchema.bulkDeleteQuery('myTable', { where: { name: 'barry' } }), {
      default: `DELETE FROM [mySchema].[myTable] WHERE [name] = 'barry'`,
      mssql: `DELETE FROM [mySchema].[myTable] WHERE [name] = N'barry'; SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
      sqlite3: "DELETE FROM `mySchema.myTable` WHERE `name` = 'barry'",
    });
  });

  it('refuses a where derived to be true for every row when rejectAlwaysTrueWhere is set', () => {
    expect(() =>
      queryGenerator.bulkDeleteQuery('myTable', {
        where: { id: { [Op.notIn]: [] } },
        rejectAlwaysTrueWhere: 'DELETE',
      }),
    ).to.throw(/is true for every row/);

    expect(() =>
      queryGenerator.bulkDeleteQuery('myTable', {
        where: { [Op.not]: { id: { [Op.in]: [] } } },
        rejectAlwaysTrueWhere: 'DELETE',
      }),
    ).to.throw(/is true for every row/);

    expectsql(queryGenerator.bulkDeleteQuery('myTable', { where: { id: { [Op.notIn]: [] } } }), {
      default: `DELETE FROM [myTable] WHERE 1 = 1`,
      mssql: `DELETE FROM [myTable] WHERE 1 = 1; SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
    });
  });

  it('accepts a where the caller wrote to be true for every row', () => {
    expectsql(
      queryGenerator.bulkDeleteQuery('myTable', {
        where: sql`1 = 1`,
        rejectAlwaysTrueWhere: 'DELETE',
      }),
      {
        default: `DELETE FROM [myTable] WHERE 1 = 1`,
        mssql: `DELETE FROM [myTable] WHERE 1 = 1; SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
      },
    );
  });

  it('accepts an empty where', () => {
    expectsql(
      queryGenerator.bulkDeleteQuery('myTable', { where: {}, rejectAlwaysTrueWhere: 'DELETE' }),
      {
        default: `DELETE FROM [myTable]`,
        mssql: `DELETE FROM [myTable]; SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
      },
    );
  });

  it('still emits an unsatisfiable where instead of rejecting it', () => {
    expectsql(
      queryGenerator.bulkDeleteQuery('myTable', {
        where: { id: { [Op.in]: [] } },
        rejectAlwaysTrueWhere: 'DELETE',
      }),
      {
        default: `DELETE FROM [myTable] WHERE 0 = 1`,
        mssql: `DELETE FROM [myTable] WHERE 0 = 1; SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
      },
    );
  });

  it('produces a delete query with schema and custom delimiter argument', () => {
    // This test is only relevant for dialects that do not support schemas
    if (dialect.supports.schemas) {
      return;
    }

    expectsql(
      queryGenerator.bulkDeleteQuery(
        { tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' },
        { where: { name: 'barry' } },
      ),
      {
        sqlite3: "DELETE FROM `mySchemacustommyTable` WHERE `name` = 'barry'",
      },
    );
  });
});
