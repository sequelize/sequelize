import { DataTypes, sql } from '@sequelize/core';
import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { expect } from 'chai';
import { inspect } from 'node:util';
import { beforeAll2, createSequelizeInstance, expectsql, sequelize } from '../../support';

const { attribute, col, fn, literal } = sql;
const limitWithoutModelError = new Error(
  'Using options.limit in updateQuery is not allowed if no model or model definition is specified.',
);
const triggerWithoutModelError = new Error(
  'Using options.returning with triggers in updateQuery is not allowed if no model or model definition is specified.',
);
const returningNotSupportedError = buildInvalidOptionReceivedError(
  'updateQuery',
  sequelize.dialect.name,
  ['returning'],
);
const ignoreDuplicatesNotSupportedError = buildInvalidOptionReceivedError(
  'updateQuery',
  sequelize.dialect.name,
  ['ignoreDuplicates'],
);

describe('QueryGenerator#updateQuery', () => {
  const queryGenerator = sequelize.queryGenerator;
  const vars = beforeAll2(() => {
    const User = sequelize.define(
      'User',
      {
        firstName: { type: DataTypes.STRING, columnName: 'first_name' },
        lastName: { type: DataTypes.STRING, columnName: 'last_name' },
        username: DataTypes.STRING,
      },
      { timestamps: false },
    );

    return { User };
  });

  it('generates an update query', () => {
    expectsql(queryGenerator.updateQuery('myTable', { status: 'bar' }), {
      query: {
        default: 'UPDATE [myTable] SET [status]=$sequelize_1',
        'db2 ibmi': 'SELECT COUNT(*) FROM FINAL TABLE (UPDATE "myTable" SET "status"=$sequelize_1)',
      },
      bind: { default: { sequelize_1: 'bar' } },
    });
  });

  it('generates an update query with a where clause', () => {
    expectsql(queryGenerator.updateQuery('myTable', { status: 'bar' }, { where: { id: 2 } }), {
      query: {
        default: 'UPDATE [myTable] SET [status]=$sequelize_1 WHERE [id] = $sequelize_2',
        'db2 ibmi':
          'SELECT COUNT(*) FROM FINAL TABLE (UPDATE "myTable" SET "status"=$sequelize_1 WHERE "id" = $sequelize_2)',
      },
      bind: { default: { sequelize_1: 'bar', sequelize_2: 2 } },
    });
  });

  it('generates an update query with a where clause and limit', () => {
    expectsql(
      () =>
        queryGenerator.updateQuery('myTable', { status: 'bar' }, { where: { id: 2 }, limit: 1 })
          .query,
      {
        default:
          'UPDATE [myTable] SET [status]=$sequelize_1 WHERE [id] = $sequelize_2 LIMIT $sequelize_3',
        mysql: 'UPDATE `myTable` SET `status`=$sequelize_1 WHERE `id` = $sequelize_2 LIMIT 1',
        sqlite3:
          'UPDATE `myTable` SET `status`=$sequelize_1 WHERE rowid IN (SELECT rowid FROM `myTable` WHERE `id` = $sequelize_2 LIMIT $sequelize_3)',
        'db2 ibmi':
          'SELECT COUNT(*) FROM FINAL TABLE (UPDATE "myTable" SET "status"=$sequelize_1 WHERE "id" = $sequelize_2 FETCH NEXT $sequelize_3 ROWS ONLY)',
        'mssql postgres snowflake': limitWithoutModelError,
      },
    );
  });

  it('generates an update query with a where clause, limit and offset', () => {
    expectsql(
      () =>
        queryGenerator.updateQuery(
          'myTable',
          { status: 'bar' },
          { where: { id: 2 }, limit: 1, offset: 2 },
        ).query,
      {
        default:
          'UPDATE [myTable] SET [status]=$sequelize_1 WHERE [id] = $sequelize_2 LIMIT $sequelize_3 OFFSET $sequelize_4',
        mysql:
          'UPDATE `myTable` SET `status`=$sequelize_1 WHERE `id` = $sequelize_2 LIMIT 1 OFFSET 2',
        sqlite3:
          'UPDATE `myTable` SET `status`=$sequelize_1 WHERE rowid IN (SELECT rowid FROM `myTable` WHERE `id` = $sequelize_2 LIMIT $sequelize_3 OFFSET $sequelize_4)',
        'db2 ibmi':
          'SELECT COUNT(*) FROM FINAL TABLE (UPDATE "myTable" SET "status"=$sequelize_1 WHERE "id" = $sequelize_2 OFFSET $sequelize_3 ROWS FETCH NEXT $sequelize_4 ROWS ONLY)',
        'mssql postgres snowflake': limitWithoutModelError,
      },
    );
  });

  it('generates an update query for a model with a where clause and limit', () => {
    expectsql(
      queryGenerator.updateQuery(vars.User, { firstName: 'bar' }, { where: { id: 2 }, limit: 1 }),
      {
        query: {
          default:
            'UPDATE [Users] SET [first_name]=$sequelize_1 WHERE [id] = $sequelize_2 LIMIT $sequelize_3',
          mssql:
            'UPDATE [Users] SET [first_name]=$sequelize_1 WHERE [id] IN (SELECT [id] FROM [Users] WHERE [id] = $sequelize_2 ORDER BY [id] OFFSET $sequelize_3 ROWS FETCH NEXT $sequelize_4 ROWS ONLY)',
          mysql: 'UPDATE `Users` SET `first_name`=$sequelize_1 WHERE `id` = $sequelize_2 LIMIT 1',
          sqlite3:
            'UPDATE `Users` SET `first_name`=$sequelize_1 WHERE rowid IN (SELECT rowid FROM `Users` WHERE `id` = $sequelize_2 LIMIT $sequelize_3)',
          'db2 ibmi':
            'SELECT COUNT(*) FROM FINAL TABLE (UPDATE "Users" SET "first_name"=$sequelize_1 WHERE "id" = $sequelize_2 FETCH NEXT $sequelize_3 ROWS ONLY)',
          'postgres snowflake':
            'UPDATE [Users] SET [first_name]=$sequelize_1 WHERE [id] IN (SELECT [id] FROM [Users] WHERE [id] = $sequelize_2 ORDER BY [id] LIMIT $sequelize_3)',
        },
        bind: {
          default: { sequelize_1: 'bar', sequelize_2: 2, sequelize_3: 1 },
          mssql: { sequelize_1: 'bar', sequelize_2: 2, sequelize_3: 0, sequelize_4: 1 },
          mysql: { sequelize_1: 'bar', sequelize_2: 2 },
        },
      },
    );
  });

  it('generates an update query for a model with a where clause, limit and offset', () => {
    expectsql(
      queryGenerator.updateQuery(
        vars.User,
        { firstName: 'bar' },
        { where: { id: 2 }, limit: 1, offset: 2 },
      ),
      {
        query: {
          default:
            'UPDATE [Users] SET [first_name]=$sequelize_1 WHERE [id] = $sequelize_2 LIMIT $sequelize_3 OFFSET $sequelize_4',
          mssql:
            'UPDATE [Users] SET [first_name]=$sequelize_1 WHERE [id] IN (SELECT [id] FROM [Users] WHERE [id] = $sequelize_2 ORDER BY [id] OFFSET $sequelize_3 ROWS FETCH NEXT $sequelize_4 ROWS ONLY)',
          mysql:
            'UPDATE `Users` SET `first_name`=$sequelize_1 WHERE `id` = $sequelize_2 LIMIT 1 OFFSET 2',
          sqlite3:
            'UPDATE `Users` SET `first_name`=$sequelize_1 WHERE rowid IN (SELECT rowid FROM `Users` WHERE `id` = $sequelize_2 LIMIT $sequelize_3 OFFSET $sequelize_4)',
          'db2 ibmi':
            'SELECT COUNT(*) FROM FINAL TABLE (UPDATE "Users" SET "first_name"=$sequelize_1 WHERE "id" = $sequelize_2 OFFSET $sequelize_3 ROWS FETCH NEXT $sequelize_4 ROWS ONLY)',
          'postgres snowflake':
            'UPDATE [Users] SET [first_name]=$sequelize_1 WHERE [id] IN (SELECT [id] FROM [Users] WHERE [id] = $sequelize_2 ORDER BY [id] LIMIT $sequelize_3 OFFSET $sequelize_4)',
        },
        bind: {
          default: { sequelize_1: 'bar', sequelize_2: 2, sequelize_3: 1, sequelize_4: 2 },
          db2: { sequelize_1: 'bar', sequelize_2: 2, sequelize_3: 2, sequelize_4: 1 },
          ibmi: { sequelize_1: 'bar', sequelize_2: 2, sequelize_3: 2, sequelize_4: 1 },
          mssql: { sequelize_1: 'bar', sequelize_2: 2, sequelize_3: 2, sequelize_4: 1 },
          mysql: { sequelize_1: 'bar', sequelize_2: 2 },
        },
      },
    );
  });

  it('generates an update query with a where clause and ignoreDuplicates', () => {
    expectsql(
      () =>
        queryGenerator.updateQuery(
          'myTable',
          { status: 'bar' },
          { where: { id: 2 }, ignoreDuplicates: true },
        ).query,
      {
        default: ignoreDuplicatesNotSupportedError,
        sqlite3: 'UPDATE OR IGNORE `myTable` SET `status`=$sequelize_1 WHERE `id` = $sequelize_2',
        'mariadb mysql':
          'UPDATE IGNORE `myTable` SET `status`=$sequelize_1 WHERE `id` = $sequelize_2',
      },
    );
  });

  it('generates an update query with all options', () => {
    expectsql(
      () =>
        queryGenerator.updateQuery(
          'myTable',
          { status: 'bar' },
          { where: { id: 2 }, ignoreDuplicates: true, offset: 2, limit: 5, returning: true },
        ).query,
      {
        default: ignoreDuplicatesNotSupportedError,
        sqlite3:
          'UPDATE OR IGNORE `myTable` SET `status`=$sequelize_1 WHERE rowid IN (SELECT rowid FROM `myTable` WHERE `id` = $sequelize_2 LIMIT $sequelize_3 OFFSET $sequelize_4) RETURNING *',
        snowflake: buildInvalidOptionReceivedError('updateQuery', sequelize.dialect.name, [
          'ignoreDuplicates',
          'returning',
        ]),
        'mariadb mysql': returningNotSupportedError,
      },
    );
  });

  it('escapes special characters in the query', () => {
    expectsql(
      queryGenerator.updateQuery(
        'myTable',
        { name: "foo';DROP TABLE myTable;" },
        { where: { name: 'foo' } },
      ),
      {
        query: {
          default: 'UPDATE [myTable] SET [name]=$sequelize_1 WHERE [name] = $sequelize_2',
          'db2 ibmi':
            'SELECT COUNT(*) FROM FINAL TABLE (UPDATE "myTable" SET "name"=$sequelize_1 WHERE "name" = $sequelize_2)',
        },
        bind: { default: { sequelize_1: "foo';DROP TABLE myTable;", sequelize_2: 'foo' } },
      },
    );
  });

  it('allows sql functions in the query', () => {
    expectsql(
      queryGenerator.updateQuery(
        'myTable',
        { name: fn('UPPER', col('name')) },
        { where: { name: 'foo' } },
      ),
      {
        query: {
          default: 'UPDATE [myTable] SET [name]=UPPER([name]) WHERE [name] = $sequelize_1',
          'db2 ibmi':
            'SELECT COUNT(*) FROM FINAL TABLE (UPDATE "myTable" SET "name"=UPPER("name") WHERE "name" = $sequelize_1)',
        },
        bind: { default: { sequelize_1: 'foo' } },
      },
    );
  });

  it('includes null values in the statement', () => {
    expectsql(
      queryGenerator.updateQuery('myTable', { status: 'bar', value: null }, { where: { id: 2 } }),
      {
        query: {
          default:
            'UPDATE [myTable] SET [status]=$sequelize_1,[value]=$sequelize_2 WHERE [id] = $sequelize_3',
          'db2 ibmi':
            'SELECT COUNT(*) FROM FINAL TABLE (UPDATE "myTable" SET "status"=$sequelize_1,"value"=$sequelize_2 WHERE "id" = $sequelize_3)',
        },
        bind: { default: { sequelize_1: 'bar', sequelize_2: null, sequelize_3: 2 } },
      },
    );
  });

  it('omits undefined values from the statement by default', () => {
    expectsql(
      queryGenerator.updateQuery(
        'myTable',
        { status: 'bar', value: undefined },
        { where: { id: 2 } },
      ),
      {
        query: {
          default: 'UPDATE [myTable] SET [status]=$sequelize_1 WHERE [id] = $sequelize_2',
          'db2 ibmi':
            'SELECT COUNT(*) FROM FINAL TABLE (UPDATE "myTable" SET "status"=$sequelize_1 WHERE "id" = $sequelize_2)',
        },
        bind: { default: { sequelize_1: 'bar', sequelize_2: 2 } },
      },
    );
  });

  // you'll find more replacement tests in query-generator tests
  it('parses named replacements in literals', async () => {
    const { query, bind } = queryGenerator.updateQuery(
      vars.User,
      { firstName: literal(':name') },
      {
        where: literal('name = :name'),
        replacements: {
          name: 'Zoe',
        },
      },
    );

    expectsql(query, {
      default: `UPDATE [Users] SET [first_name]='Zoe' WHERE name = 'Zoe'`,
      mssql: `UPDATE [Users] SET [first_name]=N'Zoe' WHERE name = N'Zoe'`,
      'db2 ibmi': `SELECT COUNT(*) FROM FINAL TABLE (UPDATE "Users" SET "first_name"='Zoe' WHERE name = 'Zoe')`,
    });
    expect(bind).to.deep.eq({});
  });

  it('generates an update query for a model', () => {
    expectsql(queryGenerator.updateQuery(vars.User, { firstName: 'bar' }), {
      query: {
        default: 'UPDATE [Users] SET [first_name]=$sequelize_1',
        'db2 ibmi':
          'SELECT COUNT(*) FROM FINAL TABLE (UPDATE "Users" SET "first_name"=$sequelize_1)',
      },
      bind: { default: { sequelize_1: 'bar' } },
    });
  });

  it('throw an error if an invalid colmn is passed with a model', () => {
    expect(() => {
      queryGenerator.updateQuery(vars.User, { first_name: 'bar' });
    }).to.throw('Attribute "first_name" does not exist on model "User".');
  });

  it('generates an update query for a model table', () => {
    expectsql(queryGenerator.updateQuery(vars.User.table, { first_name: 'bar' }), {
      query: {
        default: 'UPDATE [Users] SET [first_name]=$sequelize_1',
        'db2 ibmi':
          'SELECT COUNT(*) FROM FINAL TABLE (UPDATE "Users" SET "first_name"=$sequelize_1)',
      },
      bind: { default: { sequelize_1: 'bar' } },
    });
  });

  it('generates an update query for a model definition', () => {
    expectsql(queryGenerator.updateQuery(vars.User.modelDefinition, { firstName: 'bar' }), {
      query: {
        default: 'UPDATE [Users] SET [first_name]=$sequelize_1',
        'db2 ibmi':
          'SELECT COUNT(*) FROM FINAL TABLE (UPDATE "Users" SET "first_name"=$sequelize_1)',
      },
      bind: { default: { sequelize_1: 'bar' } },
    });
  });

  it('generates an update query for a table with schema', () => {
    expectsql(
      queryGenerator.updateQuery({ tableName: 'myTable', schema: 'mySchema' }, { status: 'bar' }),
      {
        query: {
          default: 'UPDATE [mySchema].[myTable] SET [status]=$sequelize_1',
          sqlite3: 'UPDATE `mySchema.myTable` SET `status`=$sequelize_1',
          'db2 ibmi':
            'SELECT COUNT(*) FROM FINAL TABLE (UPDATE "mySchema"."myTable" SET "status"=$sequelize_1)',
        },
        bind: { default: { sequelize_1: 'bar' } },
      },
    );
  });

  it('generates an update query for a table with default schema', () => {
    expectsql(
      queryGenerator.updateQuery(
        { tableName: 'myTable', schema: sequelize.dialect.getDefaultSchema() },
        { status: 'bar' },
      ),
      {
        query: {
          default: 'UPDATE [myTable] SET [status]=$sequelize_1',
          'db2 ibmi':
            'SELECT COUNT(*) FROM FINAL TABLE (UPDATE "myTable" SET "status"=$sequelize_1)',
        },
        bind: { default: { sequelize_1: 'bar' } },
      },
    );
  });

  it('generates an update query for a table with globally defined schema', () => {
    const customSequelize = createSequelizeInstance({ schema: 'mySchema' });
    const customQueryGenerator = customSequelize.queryGenerator;

    expectsql(customQueryGenerator.updateQuery('myTable', { status: 'bar' }), {
      query: {
        default: 'UPDATE [mySchema].[myTable] SET [status]=$sequelize_1',
        sqlite3: 'UPDATE `mySchema.myTable` SET `status`=$sequelize_1',
        'db2 ibmi':
          'SELECT COUNT(*) FROM FINAL TABLE (UPDATE "mySchema"."myTable" SET "status"=$sequelize_1)',
      },
      bind: { default: { sequelize_1: 'bar' } },
    });
  });

  it('generates an update query for a table and schema with custom delimiter', () => {
    // This test is only relevant for dialects that do not support schemas
    if (sequelize.dialect.supports.schemas) {
      return;
    }

    expectsql(
      queryGenerator.updateQuery(
        { tableName: 'myTable', schema: 'mySchema', delimiter: 'custom' },
        { status: 'bar' },
      ),
      {
        query: { sqlite3: 'UPDATE `mySchemacustommyTable` SET `status`=$sequelize_1' },
        bind: { default: { sequelize_1: 'bar' } },
      },
    );
  });

  describe('Returning', () => {
    it('generates an update query with a where clause and returning: false', () => {
      expectsql(
        () =>
          queryGenerator.updateQuery(
            'myTable',
            { status: 'bar' },
            { where: { id: 2 }, returning: false },
          ).query,
        {
          default: 'UPDATE [myTable] SET [status]=$sequelize_1 WHERE [id] = $sequelize_2',
          'db2 ibmi':
            'SELECT COUNT(*) FROM FINAL TABLE (UPDATE "myTable" SET "status"=$sequelize_1 WHERE "id" = $sequelize_2)',
        },
      );
    });

    it('generates an update query with a where clause and returning: true', () => {
      expectsql(
        () =>
          queryGenerator.updateQuery(
            'myTable',
            { status: 'bar' },
            { where: { id: 2 }, returning: true },
          ).query,
        {
          default:
            'UPDATE [myTable] SET [status]=$sequelize_1 WHERE [id] = $sequelize_2 RETURNING *',
          mssql:
            'UPDATE [myTable] SET [status]=$sequelize_1 OUTPUT INSERTED.* WHERE [id] = $sequelize_2',
          'db2 ibmi':
            'SELECT * FROM FINAL TABLE (UPDATE "myTable" SET "status"=$sequelize_1 WHERE "id" = $sequelize_2)',
          'mariadb mysql snowflake': returningNotSupportedError,
        },
      );
    });

    it('generates an update query with a where clause and returning with an array', () => {
      expectsql(
        () =>
          queryGenerator.updateQuery(
            'myTable',
            { status: 'bar' },
            { where: { id: 2 }, returning: ['id', col('status')] },
          ).query,
        {
          default:
            'UPDATE [myTable] SET [status]=$sequelize_1 WHERE [id] = $sequelize_2 RETURNING [id], [status]',
          mssql:
            'UPDATE [myTable] SET [status]=$sequelize_1 OUTPUT INSERTED.[id], INSERTED.[status] WHERE [id] = $sequelize_2',
          'db2 ibmi':
            'SELECT "id", "status" FROM FINAL TABLE (UPDATE "myTable" SET "status"=$sequelize_1 WHERE "id" = $sequelize_2)',
          'mariadb mysql snowflake': returningNotSupportedError,
        },
      );
    });

    it('generates an update query with a where clause and returning with an array with liternal', () => {
      expectsql(
        () =>
          queryGenerator.updateQuery(
            'myTable',
            { status: 'bar' },
            { where: { id: 2 }, returning: ['id', col('status'), literal('*')] },
          ).query,
        {
          default:
            'UPDATE [myTable] SET [status]=$sequelize_1 WHERE [id] = $sequelize_2 RETURNING [id], [status], *',
          mssql: new Error(
            `Unsupported value in "returning" option: ${inspect(literal('*'))}. This option only accepts true, false, an array of strings, attribute() or col() sql expressions.`,
          ),
          'db2 ibmi':
            'SELECT "id", "status", * FROM FINAL TABLE (UPDATE "myTable" SET "status"=$sequelize_1 WHERE "id" = $sequelize_2)',
          'mariadb mysql snowflake': returningNotSupportedError,
        },
      );
    });

    it('generates an update query with a where clause and returning: true and hasTrigger: true', () => {
      expectsql(
        () =>
          queryGenerator.updateQuery(
            'myTable',
            { status: 'bar' },
            { where: { id: 2 }, returning: true, hasTrigger: true },
          ).query,
        {
          default:
            'UPDATE [myTable] SET [status]=$sequelize_1 WHERE [id] = $sequelize_2 RETURNING *',
          mssql: triggerWithoutModelError,
          'db2 ibmi':
            'SELECT * FROM FINAL TABLE (UPDATE "myTable" SET "status"=$sequelize_1 WHERE "id" = $sequelize_2)',
          'mariadb mysql snowflake': returningNotSupportedError,
        },
      );
    });

    it('generates an update query with a where clause and returning: true and hasTrigger: true with column types', () => {
      expectsql(
        () =>
          queryGenerator.updateQuery(
            'myTable',
            { status: 'bar' },
            {
              where: { id: 2 },
              returning: true,
              hasTrigger: true,
              columnTypes: { status: DataTypes.STRING },
            },
          ).query,
        {
          default:
            'UPDATE [myTable] SET [status]=$sequelize_1 WHERE [id] = $sequelize_2 RETURNING *',
          mssql: triggerWithoutModelError,
          'db2 ibmi':
            'SELECT * FROM FINAL TABLE (UPDATE "myTable" SET "status"=$sequelize_1 WHERE "id" = $sequelize_2)',
          'mariadb mysql snowflake': returningNotSupportedError,
        },
      );
    });

    it('generates an update query for a model with a where clause and returning: false', () => {
      expectsql(
        () =>
          queryGenerator.updateQuery(
            vars.User,
            { firstName: 'bar' },
            { where: { id: 2 }, returning: false },
          ).query,
        {
          default: 'UPDATE [Users] SET [first_name]=$sequelize_1 WHERE [id] = $sequelize_2',
          'db2 ibmi':
            'SELECT COUNT(*) FROM FINAL TABLE (UPDATE "Users" SET "first_name"=$sequelize_1 WHERE "id" = $sequelize_2)',
        },
      );
    });

    it('generates an update query for a model with a where clause and returning: true', () => {
      expectsql(
        () =>
          queryGenerator.updateQuery(
            vars.User,
            { firstName: 'bar' },
            { where: { id: 2 }, returning: true },
          ).query,
        {
          default:
            'UPDATE [Users] SET [first_name]=$sequelize_1 WHERE [id] = $sequelize_2 RETURNING [id], [first_name], [last_name], [username]',
          mssql:
            'UPDATE [Users] SET [first_name]=$sequelize_1 OUTPUT INSERTED.[id], INSERTED.[first_name], INSERTED.[last_name], INSERTED.[username] WHERE [id] = $sequelize_2',
          'db2 ibmi':
            'SELECT "id", "first_name", "last_name", "username" FROM FINAL TABLE (UPDATE "Users" SET "first_name"=$sequelize_1 WHERE "id" = $sequelize_2)',
          'mariadb mysql snowflake': returningNotSupportedError,
        },
      );
    });

    it('generates an update query for a model with a where clause and returning with an array', () => {
      expectsql(
        () =>
          queryGenerator.updateQuery(
            vars.User,
            { firstName: 'bar' },
            { where: { id: 2 }, returning: ['id', col('firstName')] },
          ).query,
        {
          default:
            'UPDATE [Users] SET [first_name]=$sequelize_1 WHERE [id] = $sequelize_2 RETURNING [id], [firstName]',
          mssql:
            'UPDATE [Users] SET [first_name]=$sequelize_1 OUTPUT INSERTED.[id], INSERTED.[firstName] WHERE [id] = $sequelize_2',
          'db2 ibmi':
            'SELECT "id", "firstName" FROM FINAL TABLE (UPDATE "Users" SET "first_name"=$sequelize_1 WHERE "id" = $sequelize_2)',
          'mariadb mysql snowflake': returningNotSupportedError,
        },
      );
    });

    it('generates an update query for a model with a where clause and returning with an array with liternal', () => {
      expectsql(
        () =>
          queryGenerator.updateQuery(
            vars.User,
            { firstName: 'bar' },
            { where: { id: 2 }, returning: ['id', col('firstName'), literal('*')] },
          ).query,
        {
          default:
            'UPDATE [Users] SET [first_name]=$sequelize_1 WHERE [id] = $sequelize_2 RETURNING [id], [firstName], *',
          mssql: new Error(
            `Unsupported value in "returning" option: ${inspect(literal('*'))}. This option only accepts true, false, an array of strings, attribute() or col() sql expressions.`,
          ),
          'db2 ibmi':
            'SELECT "id", "firstName", * FROM FINAL TABLE (UPDATE "Users" SET "first_name"=$sequelize_1 WHERE "id" = $sequelize_2)',
          'mariadb mysql snowflake': returningNotSupportedError,
        },
      );
    });

    it('generates an update query for a model with a where clause and returning: true and hasTrigger: true', () => {
      expectsql(
        () =>
          queryGenerator.updateQuery(
            vars.User,
            { firstName: 'bar' },
            { where: { id: 2 }, returning: true, hasTrigger: true },
          ).query,
        {
          default:
            'UPDATE [Users] SET [first_name]=$sequelize_1 WHERE [id] = $sequelize_2 RETURNING [id], [first_name], [last_name], [username]',
          mssql: `DECLARE @output_table TABLE ([id] INTEGER, [first_name] NVARCHAR(255), [last_name] NVARCHAR(255), [username] NVARCHAR(255));
            UPDATE [Users] SET [first_name]=$sequelize_1 OUTPUT INSERTED.[id], INSERTED.[first_name], INSERTED.[last_name], INSERTED.[username] INTO @output_table WHERE [id] = $sequelize_2;
            SELECT * FROM @output_table`,
          'db2 ibmi':
            'SELECT "id", "first_name", "last_name", "username" FROM FINAL TABLE (UPDATE "Users" SET "first_name"=$sequelize_1 WHERE "id" = $sequelize_2)',
          'mariadb mysql snowflake': returningNotSupportedError,
        },
      );
    });

    it('generates an update query for a model with a where clause, hasTrigger: true and returning with an array', () => {
      expectsql(
        () =>
          queryGenerator.updateQuery(
            vars.User,
            { firstName: 'bar' },
            {
              where: { id: 2 },
              returning: ['id', attribute('firstName'), col('last_name')],
              hasTrigger: true,
            },
          ).query,
        {
          default:
            'UPDATE [Users] SET [first_name]=$sequelize_1 WHERE [id] = $sequelize_2 RETURNING [id], [first_name], [last_name]',
          mssql: `DECLARE @output_table TABLE ([id] INTEGER, [first_name] NVARCHAR(MAX), [last_name] NVARCHAR(MAX));
            UPDATE [Users] SET [first_name]=$sequelize_1 OUTPUT INSERTED.[id], INSERTED.[first_name], INSERTED.[last_name] INTO @output_table WHERE [id] = $sequelize_2;
            SELECT * FROM @output_table`,
          'db2 ibmi':
            'SELECT "id", "first_name", "last_name" FROM FINAL TABLE (UPDATE "Users" SET "first_name"=$sequelize_1 WHERE "id" = $sequelize_2)',
          'mariadb mysql snowflake': returningNotSupportedError,
        },
      );
    });
  });

  describe('Bind params', () => {
    it('generates extra bind params', async () => {
      // lastName's bind position being changed from $1 to $2 is intentional
      expectsql(
        queryGenerator.updateQuery(vars.User, {
          firstName: 'John',
          lastName: literal('$1'),
          username: 'jd',
        }),
        {
          query: {
            default:
              'UPDATE [Users] SET [first_name]=$sequelize_1,[last_name]=$1,[username]=$sequelize_2',
            'db2 ibmi':
              'SELECT COUNT(*) FROM FINAL TABLE (UPDATE "Users" SET "first_name"=$sequelize_1,"last_name"=$1,"username"=$sequelize_2)',
          },
          bind: { default: { sequelize_1: 'John', sequelize_2: 'jd' } },
        },
      );
    });

    it('does not generate extra bind params with bindParams: false', async () => {
      const { query, bind } = queryGenerator.updateQuery(
        vars.User,
        {
          firstName: 'John',
          lastName: literal('$1'),
          username: 'jd',
        },
        {
          // @ts-expect-error -- Testing invalid options
          bindParam: false,
          where: literal('first_name = $2'),
        },
      );

      // lastName's bind position being changed from $1 to $2 is intentional
      expectsql(query, {
        default: `UPDATE [Users] SET [first_name]='John',[last_name]=$1,[username]='jd' WHERE first_name = $2`,
        mssql: `UPDATE [Users] SET [first_name]=N'John',[last_name]=$1,[username]=N'jd' WHERE first_name = $2`,
        'db2 ibmi': `SELECT COUNT(*) FROM FINAL TABLE (UPDATE "Users" SET "first_name"='John',"last_name"=$1,"username"='jd' WHERE first_name = $2)`,
      });

      expect(bind).to.be.undefined;
    });

    it('binds date values', () => {
      const result = queryGenerator.updateQuery(
        'myTable',
        {
          date: new Date('2011-03-27T10:01:55Z'),
        },
        { where: { id: 2 } },
      );

      expectsql(result, {
        query: {
          default: 'UPDATE [myTable] SET [date]=$sequelize_1 WHERE [id] = $sequelize_2',
          'db2 ibmi':
            'SELECT COUNT(*) FROM FINAL TABLE (UPDATE "myTable" SET "date"=$sequelize_1 WHERE "id" = $sequelize_2)',
        },
        bind: {
          mysql: {
            sequelize_1: '2011-03-27 10:01:55.000',
            sequelize_2: 2,
          },
          mariadb: {
            sequelize_1: '2011-03-27 10:01:55.000',
            sequelize_2: 2,
          },
          db2: {
            sequelize_1: '2011-03-27 10:01:55.000',
            sequelize_2: 2,
          },
          ibmi: {
            sequelize_1: '2011-03-27 10:01:55.000',
            sequelize_2: 2,
          },
          snowflake: {
            sequelize_1: '2011-03-27 10:01:55.000',
            sequelize_2: 2,
          },
          sqlite3: {
            sequelize_1: '2011-03-27 10:01:55.000 +00:00',
            sequelize_2: 2,
          },
          postgres: {
            sequelize_1: '2011-03-27 10:01:55.000 +00:00',
            sequelize_2: 2,
          },
          mssql: {
            sequelize_1: '2011-03-27 10:01:55.000 +00:00',
            sequelize_2: 2,
          },
        },
      });
    });

    it('binds boolean values', () => {
      const result = queryGenerator.updateQuery(
        'myTable',
        {
          positive: true,
          negative: false,
        },
        { where: { id: 2 } },
      );

      expectsql(result, {
        query: {
          default:
            'UPDATE [myTable] SET [positive]=$sequelize_1,[negative]=$sequelize_2 WHERE [id] = $sequelize_3',
          'db2 ibmi':
            'SELECT COUNT(*) FROM FINAL TABLE (UPDATE "myTable" SET "positive"=$sequelize_1,"negative"=$sequelize_2 WHERE "id" = $sequelize_3)',
        },
        bind: {
          sqlite3: {
            sequelize_1: 1,
            sequelize_2: 0,
            sequelize_3: 2,
          },
          mysql: {
            sequelize_1: 1,
            sequelize_2: 0,
            sequelize_3: 2,
          },
          mariadb: {
            sequelize_1: 1,
            sequelize_2: 0,
            sequelize_3: 2,
          },
          mssql: {
            sequelize_1: 1,
            sequelize_2: 0,
            sequelize_3: 2,
          },
          postgres: {
            sequelize_1: true,
            sequelize_2: false,
            sequelize_3: 2,
          },
          db2: {
            sequelize_1: true,
            sequelize_2: false,
            sequelize_3: 2,
          },
          ibmi: {
            sequelize_1: 1,
            sequelize_2: 0,
            sequelize_3: 2,
          },
          snowflake: {
            sequelize_1: true,
            sequelize_2: false,
            sequelize_3: 2,
          },
        },
      });
    });
  });
});
