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

    const AutoIncrementModel = sequelize.define(
      'AutoIncrementModel',
      {
        day: DataTypes.DATEONLY,
      },
      { timestamps: false },
    );

    return { User, AutoIncrementModel };
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

  it('inserts the default value of auto-increment attributes set to null', () => {
    const { AutoIncrementModel } = vars;

    const sql = queryGenerator.bulkInsertQuery(
      AutoIncrementModel.table,
      [{ id: null }, { id: null }],
      {},
      AutoIncrementModel.fieldRawAttributesMap,
    );

    expectsql(sql, {
      default: 'INSERT INTO [AutoIncrementModels] ([id]) VALUES (NULL),(NULL);',
      'postgres db2': 'INSERT INTO "AutoIncrementModels" ("id") VALUES (DEFAULT),(DEFAULT);',
      mssql:
        'INSERT INTO [AutoIncrementModels] DEFAULT VALUES;INSERT INTO [AutoIncrementModels] DEFAULT VALUES;',
      oracle: 'INSERT INTO "AutoIncrementModels" ("id") VALUES (DEFAULT) RETURNING "id" INTO :1',
      ibmi: 'SELECT * FROM FINAL TABLE (INSERT INTO "AutoIncrementModels" ("id") VALUES (DEFAULT),(DEFAULT))',
    });
  });

  it('inserts the default value of auto-increment attributes set to null with returning', () => {
    const { AutoIncrementModel } = vars;

    const sql = queryGenerator.bulkInsertQuery(
      AutoIncrementModel.table,
      [{ id: null }, { id: null }],
      { returning: true },
      AutoIncrementModel.fieldRawAttributesMap,
    );

    expectsql(sql, {
      default: 'INSERT INTO [AutoIncrementModels] ([id]) VALUES (NULL),(NULL);',
      postgres:
        'INSERT INTO "AutoIncrementModels" ("id") VALUES (DEFAULT),(DEFAULT) RETURNING "id", "day";',
      sqlite3:
        'INSERT INTO `AutoIncrementModels` (`id`) VALUES (NULL),(NULL) RETURNING `id`, `day`;',
      mssql:
        'INSERT INTO [AutoIncrementModels] OUTPUT INSERTED.[id], INSERTED.[day] DEFAULT VALUES;INSERT INTO [AutoIncrementModels] OUTPUT INSERTED.[id], INSERTED.[day] DEFAULT VALUES;',
      oracle: 'INSERT INTO "AutoIncrementModels" ("id") VALUES (DEFAULT) RETURNING "id" INTO :1',
      db2: 'SELECT * FROM FINAL TABLE (INSERT INTO "AutoIncrementModels" ("id") VALUES (DEFAULT),(DEFAULT));',
      ibmi: 'SELECT * FROM FINAL TABLE (INSERT INTO "AutoIncrementModels" ("id") VALUES (DEFAULT),(DEFAULT))',
    });
  });
});
