import { DataTypes, literal } from '@sequelize/core';
import { beforeAll2, expectsql, getTestDialect, sequelize } from '../../support';

const dialect = getTestDialect();

describe('QueryGenerator#bulkInsertQuery', () => {
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

  it('parses named replacements in literals', async () => {
    // The Oracle dialect doesn't support replacements for bulkInsert
    if (dialect === 'oracle') {
      return;
    }

    const { User } = vars;

    const sql = queryGenerator.bulkInsertQuery(
      User.table,
      [
        {
          firstName: literal(':injection'),
        },
      ],
      {
        replacements: {
          injection: 'a string',
        },
      },
    );

    expectsql(sql, {
      default: `INSERT INTO [Users] ([firstName]) VALUES ('a string');`,
      mssql: `INSERT INTO [Users] ([firstName]) VALUES (N'a string');`,
      // TODO: ibmi should be the same as `default`, since the 'returning' option is not specified
      ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ('a string'))`,
    });
  });

  it('escapes the values of auto-increment attributes', () => {
    const { User } = vars;

    expectsql(
      () =>
        queryGenerator.bulkInsertQuery(
          User.table,
          [
            { id: 5, firstName: 'a' },
            { id: null, firstName: 'b' },
          ],
          {},
          User.getAttributes(),
        ),
      {
        default: `INSERT INTO [Users] ([id],[firstName]) VALUES (5,'a'),(NULL,'b');`,
        postgres: `INSERT INTO "Users" ("id","firstName") VALUES (5,'a'),(DEFAULT,'b');`,
        ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("id","firstName") VALUES (5,'a'),(DEFAULT,'b'))`,
        mssql: `SET IDENTITY_INSERT [Users] ON; INSERT INTO [Users] ([id],[firstName]) VALUES (5,N'a'),(NULL,N'b'); SET IDENTITY_INSERT [Users] OFF;`,
        oracle: new Error(
          'For an auto-increment column either all row must be null or non-null, a mix of null and non-null is not allowed!',
        ),
      },
    );
  });

  it('does not inline invalid values of auto-increment attributes', () => {
    const { User } = vars;

    expectsql(
      () =>
        queryGenerator.bulkInsertQuery(
          User.table,
          [{ id: '1),(DEFAULT', firstName: 'a' }],
          {},
          User.getAttributes(),
        ),
      {
        default: new Error(`'1),(DEFAULT' is not a valid integer`),
        // Db2 does not pass the attribute types to escape(), but still escapes the value
        db2: `INSERT INTO "Users" ("id","firstName") VALUES ('1),(DEFAULT','a');`,
      },
    );
  });
});
