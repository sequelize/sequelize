import { DataTypes, Op } from '@sequelize/core';
import { expectsql, sequelize } from '../../../support';

const dialect = sequelize.dialect;
const queryGenerator = sequelize.queryGenerator;

/**
 * Isolated coverage for ASCII vs Unicode user-value escaping / SQL generation.
 * Kept out of pre-existing suites so training agents can add tests without
 * conflicting with verifier patches.
 */
describe('[MSSQL Specific] VARCHAR-safe user string escaping', () => {
  if (dialect.name !== 'mssql') {
    return;
  }

  before(() => {
    sequelize.define(
      'VarcharEscapeUser',
      {
        stringAttr: DataTypes.STRING,
        firstName: DataTypes.STRING,
      },
      { timestamps: false },
    );
  });

  describe('DataTypes.STRING / TEXT escape', () => {
    it('uses non-national literals only for ASCII STRING values', () => {
      expectsql(() => queryGenerator.escape('plain', { type: DataTypes.STRING }), {
        mssql: "'plain'",
      });
      expectsql(() => queryGenerator.escape("it's", { type: DataTypes.STRING }), {
        mssql: "'it''s'",
      });
      expectsql(() => queryGenerator.escape('café', { type: DataTypes.STRING }), {
        mssql: "N'café'",
      });
    });

    it('uses the same behavior for untyped user escaping', () => {
      expectsql(() => sequelize.escape('plain'), { mssql: "'plain'" });
      expectsql(() => sequelize.escape('café'), { mssql: "N'café'" });
    });

    it('uses non-national literals only for ASCII TEXT values', () => {
      expectsql(() => queryGenerator.escape('plain', { type: DataTypes.TEXT }), {
        mssql: "'plain'",
      });
      expectsql(() => queryGenerator.escape('中文', { type: DataTypes.TEXT }), {
        mssql: "N'中文'",
      });
    });
  });

  describe('WHERE / LIKE / IN generation', () => {
    it('uses non-national literals for ASCII equality and IN lists', () => {
      expectsql(queryGenerator.whereQuery({ firstName: 'abc' }), {
        mssql: `WHERE [firstName] = 'abc'`,
      });
      expectsql(queryGenerator.whereQuery({ stringAttr: '1' }), {
        mssql: `WHERE [stringAttr] = '1'`,
      });
      expectsql(queryGenerator.whereQuery({ stringAttr: ['1', '2'] }), {
        mssql: `WHERE [stringAttr] IN ('1', '2')`,
      });
      expectsql(queryGenerator.whereQuery({ stringAttr: { [Op.in]: ['ascii', 'café'] } }), {
        mssql: `WHERE [stringAttr] IN ('ascii', N'café')`,
      });
    });

    it('uses non-national literals for ASCII LIKE patterns', () => {
      expectsql(queryGenerator.whereQuery({ stringAttr: { [Op.like]: 'swagger%' } }), {
        mssql: `WHERE [stringAttr] LIKE 'swagger%'`,
      });
      expectsql(queryGenerator.whereQuery({ stringAttr: { [Op.like]: "sql'injection%" } }), {
        mssql: `WHERE [stringAttr] LIKE 'sql''injection%'`,
      });
    });

    it('keeps non-ASCII WHERE values on the national literal path', () => {
      expectsql(queryGenerator.whereQuery({ firstName: 'café' }), {
        mssql: `WHERE [firstName] = N'café'`,
      });
    });
  });

  describe('INSERT generation', () => {
    it('uses non-national literals for ASCII insert values', () => {
      const User = sequelize.define(
        'VarcharEscapeInsertUser',
        {
          user_name: DataTypes.STRING,
          pass_word: DataTypes.STRING,
        },
        { freezeTableName: true, timestamps: false, tableName: 'users' },
      );

      expectsql(
        queryGenerator.bulkInsertQuery(
          User.table,
          [{ user_name: 'testuser', pass_word: '12345' }],
          {},
          User.fieldRawAttributesMap,
        ),
        {
          mssql: "INSERT INTO [users] ([user_name],[pass_word]) VALUES ('testuser','12345');",
        },
      );
    });

    it('keeps non-ASCII insert values on the national literal path', () => {
      const User = sequelize.define(
        'VarcharEscapeInsertUnicodeUser',
        {
          user_name: DataTypes.STRING,
        },
        { freezeTableName: true, timestamps: false, tableName: 'users_unicode' },
      );

      expectsql(
        queryGenerator.bulkInsertQuery(
          User.table,
          [{ user_name: 'café' }],
          {},
          User.fieldRawAttributesMap,
        ),
        {
          mssql: "INSERT INTO [users_unicode] ([user_name]) VALUES (N'café');",
        },
      );
    });
  });
});
