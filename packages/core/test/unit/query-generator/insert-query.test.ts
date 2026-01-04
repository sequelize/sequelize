import { DataTypes, ParameterStyle, literal } from '@sequelize/core';
import { expect } from 'chai';
import { beforeAll2, expectsql, sequelize } from '../../support';

describe('QueryGenerator#insertQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  const vars = beforeAll2(() => {
    const User = sequelize.define(
      'User',
      {
        firstName: DataTypes.STRING,
      },
      { timestamps: false },
    );

    return { User };
  });

  // you'll find more replacement tests in query-generator tests
  it('parses named replacements in literals', () => {
    const { User } = vars;

    const { query, bind } = queryGenerator.insertQuery(
      User.table,
      {
        firstName: literal(':name'),
      },
      {},
      {
        replacements: {
          name: 'Zoe',
        },
      },
    );

    expectsql(query, {
      default: `INSERT INTO [Users] ([firstName]) VALUES ('Zoe');`,
      mssql: `INSERT INTO [Users] ([firstName]) VALUES (N'Zoe');`,
      db2: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ('Zoe'));`,
      ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ('Zoe'))`,
    });
    expect(bind).to.deep.eq({});
  });

  it('supports named bind parameters in literals', () => {
    const { User } = vars;

    const { query, bind } = queryGenerator.insertQuery(User.table, {
      firstName: 'John',
      lastName: literal('$lastName'),
      username: 'jd',
    });

    expectsql(query, {
      default: `INSERT INTO [Users] ([firstName],[lastName],[username]) VALUES ($sequelize_1,$lastName,$sequelize_2);`,
      db2: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName","lastName","username") VALUES ($sequelize_1,$lastName,$sequelize_2));`,
      ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName","lastName","username") VALUES ($sequelize_1,$lastName,$sequelize_2))`,
    });

    expect(bind).to.deep.eq({
      sequelize_1: 'John',
      sequelize_2: 'jd',
    });
  });

  it('parses positional bind parameters in literals', () => {
    const { User } = vars;

    const { query, bind } = queryGenerator.insertQuery(User.table, {
      firstName: 'John',
      lastName: literal('$1'),
      username: 'jd',
    });

    // lastName's bind position being changed from $1 to $2 is intentional: bind array order must match their order in the query in some dialects.
    expectsql(query, {
      default: `INSERT INTO [Users] ([firstName],[lastName],[username]) VALUES ($sequelize_1,$1,$sequelize_2);`,
      db2: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName","lastName","username") VALUES ($sequelize_1,$1,$sequelize_2));`,
      ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName","lastName","username") VALUES ($sequelize_1,$1,$sequelize_2))`,
    });
    expect(bind).to.deep.eq({
      sequelize_1: 'John',
      sequelize_2: 'jd',
    });
  });

  it('throws an error if the bindParam option is used', () => {
    const { User } = vars;

    expect(() => {
      queryGenerator.insertQuery(
        User.table,
        {
          firstName: 'John',
          lastName: literal('$1'),
          username: 'jd',
        },
        {},
        // @ts-expect-error -- intentionally testing deprecated option
        { bindParam: false },
      );
    }).to.throw('The bindParam option has been removed. Use parameterStyle instead.');
  });

  it('parses bind parameters in literals even with parameterStyle: REPLACEMENT', () => {
    const { User } = vars;

    const { query, bind } = queryGenerator.insertQuery(
      User.table,
      {
        firstName: 'John',
        lastName: literal('$1'),
        username: 'jd',
      },
      {},
      {
        parameterStyle: ParameterStyle.REPLACEMENT,
      },
    );

    expectsql(query, {
      default: `INSERT INTO [Users] ([firstName],[lastName],[username]) VALUES ('John',$1,'jd');`,
      mssql: `INSERT INTO [Users] ([firstName],[lastName],[username]) VALUES (N'John',$1,N'jd');`,
      db2: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName","lastName","username") VALUES ('John',$1,'jd'));`,
      ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName","lastName","username") VALUES ('John',$1,'jd'))`,
    });
    expect(bind).to.be.undefined;
  });

  // This test was added due to a regression where these values were being converted to strings
  it('binds number values', () => {
    if (!sequelize.dialect.supports.dataTypes.ARRAY) {
      return;
    }

    const { User } = vars;

    const { query, bind } = queryGenerator.insertQuery(User.tableName, {
      numbers: [1, 2, 3],
    });

    expectsql(query, {
      default: `INSERT INTO "Users" ([numbers]) VALUES ($sequelize_1);`,
      db2: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("numbers") VALUES ($sequelize_1));`,
      ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("numbers") VALUES ($sequelize_1))`,
    });
    expect(bind).to.deep.eq({
      sequelize_1: [1, 2, 3],
    });
  });

  describe('returning', () => {
    it('supports returning: true', () => {
      const { User } = vars;

      const { query } = queryGenerator.insertQuery(
        User.table,
        {
          firstName: 'John',
        },
        User.getAttributes(),
        {
          returning: true,
        },
      );

      expectsql(query, {
        default: `INSERT INTO [Users] ([firstName]) VALUES ($sequelize_1) RETURNING [id], [firstName];`,
        // TODO: insertQuery should throw if returning is not supported
        'mysql mariadb': `INSERT INTO \`Users\` (\`firstName\`) VALUES ($sequelize_1);`,
        // TODO: insertQuery should throw if returning is not supported
        snowflake: `INSERT INTO "Users" ("firstName") VALUES ($sequelize_1);`,
        mssql:
          'INSERT INTO [Users] ([firstName]) OUTPUT INSERTED.[id], INSERTED.[firstName] VALUES ($sequelize_1);',
        db2: 'SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ($sequelize_1));',
        ibmi: 'SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ($sequelize_1))',
      });
    });

    it('supports array of strings (column names)', () => {
      const { User } = vars;

      const { query } = queryGenerator.insertQuery(
        User.table,
        {
          firstName: 'John',
        },
        User.getAttributes(),
        {
          returning: ['*', 'myColumn'],
        },
      );

      expectsql(query, {
        default: `INSERT INTO [Users] ([firstName]) VALUES ($sequelize_1) RETURNING [*], [myColumn];`,
        // TODO: insertQuery should throw if returning is not supported
        'mysql mariadb': `INSERT INTO \`Users\` (\`firstName\`) VALUES ($sequelize_1);`,
        // TODO: insertQuery should throw if returning is not supported
        snowflake: `INSERT INTO "Users" ("firstName") VALUES ($sequelize_1);`,
        mssql:
          'INSERT INTO [Users] ([firstName]) OUTPUT INSERTED.[*], INSERTED.[myColumn] VALUES ($sequelize_1);',
        // TODO: should only select specified columns
        db2: 'SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ($sequelize_1));',
        ibmi: 'SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ($sequelize_1))',
      });
    });

    it('supports array of literals', () => {
      const { User } = vars;

      expectsql(
        () => {
          return queryGenerator.insertQuery(
            User.table,
            {
              firstName: 'John',
            },
            User.getAttributes(),
            {
              returning: [literal('*')],
            },
          ).query;
        },
        {
          default: `INSERT INTO [Users] ([firstName]) VALUES ($sequelize_1) RETURNING *;`,
          // TODO: insertQuery should throw if returning is not supported
          'mysql mariadb': `INSERT INTO \`Users\` (\`firstName\`) VALUES ($sequelize_1);`,
          // TODO: insertQuery should throw if returning is not supported
          snowflake: `INSERT INTO "Users" ("firstName") VALUES ($sequelize_1);`,
          mssql: new Error(
            'literal() cannot be used in the "returning" option array in mssql. Use col(), or a string instead.',
          ),
          // TODO: should only select specified columns
          db2: 'SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ($sequelize_1));',
          ibmi: 'SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ($sequelize_1))',
        },
      );
    });

    it('binds date values', () => {
      const result = queryGenerator.insertQuery('myTable', {
        birthday: new Date('2011-03-27T10:01:55Z'),
      });
      expectsql(result, {
        query: {
          default: 'INSERT INTO [myTable] ([birthday]) VALUES ($sequelize_1);',
          'db2 ibmi':
            'SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("birthday") VALUES ($sequelize_1));',
        },
        bind: {
          mysql: {
            sequelize_1: '2011-03-27 10:01:55.000',
          },
          mariadb: {
            sequelize_1: '2011-03-27 10:01:55.000',
          },
          db2: {
            sequelize_1: '2011-03-27 10:01:55.000',
          },
          ibmi: {
            sequelize_1: '2011-03-27 10:01:55.000',
          },
          snowflake: {
            sequelize_1: '2011-03-27 10:01:55.000',
          },
          sqlite3: {
            sequelize_1: '2011-03-27 10:01:55.000 +00:00',
          },
          postgres: {
            sequelize_1: '2011-03-27 10:01:55.000 +00:00',
          },
          mssql: {
            sequelize_1: '2011-03-27 10:01:55.000 +00:00',
          },
        },
      });
    });

    it('binds boolean values', () => {
      const result = queryGenerator.insertQuery('myTable', { positive: true, negative: false });
      expectsql(result, {
        query: {
          default:
            'INSERT INTO [myTable] ([positive],[negative]) VALUES ($sequelize_1,$sequelize_2);',
          'db2 ibmi':
            'SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("positive","negative") VALUES ($sequelize_1,$sequelize_2));',
        },
        bind: {
          sqlite3: {
            sequelize_1: 1,
            sequelize_2: 0,
          },
          mysql: {
            sequelize_1: 1,
            sequelize_2: 0,
          },
          mariadb: {
            sequelize_1: 1,
            sequelize_2: 0,
          },
          mssql: {
            sequelize_1: 1,
            sequelize_2: 0,
          },
          postgres: {
            sequelize_1: true,
            sequelize_2: false,
          },
          db2: {
            sequelize_1: true,
            sequelize_2: false,
          },
          ibmi: {
            sequelize_1: 1,
            sequelize_2: 0,
          },
          snowflake: {
            sequelize_1: true,
            sequelize_2: false,
          },
        },
      });
    });

    // TODO: Should we ignore undefined values instead? undefined is closer to "missing property" than null
    it('treats undefined as null', () => {
      const { query, bind } = queryGenerator.insertQuery('myTable', {
        value: undefined,
        name: 'bar',
      });
      expectsql(query, {
        default: 'INSERT INTO [myTable] ([value],[name]) VALUES ($sequelize_1,$sequelize_2);',
        'db2 ibmi':
          'SELECT * FROM FINAL TABLE (INSERT INTO "myTable" ("value","name") VALUES ($sequelize_1,$sequelize_2));',
      });

      expect(bind).to.deep.eq({
        sequelize_1: null,
        sequelize_2: 'bar',
      });
    });
  });
});
