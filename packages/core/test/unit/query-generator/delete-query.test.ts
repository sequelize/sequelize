import { DataTypes, literal } from '@sequelize/core';
import { expectsql, sequelize } from '../../support';

describe('QueryGenerator#deleteQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
  }, { timestamps: false });

  // you'll find more replacement tests in query-generator tests
  it('parses named replacements in literals', async () => {
    const query = queryGenerator.deleteQuery(
      User.table,
      literal('name = :name'),
      {
        limit: literal(':limit'),
        replacements: {
          limit: 1,
          name: 'Zoe',
        },
      },
      User,
    );

    expectsql(query, {
      default: `DELETE FROM [Users] WHERE name = 'Zoe' LIMIT 1`,
      postgres: `DELETE FROM "Users" WHERE "id" IN (SELECT "id" FROM "Users" WHERE name = 'Zoe' LIMIT 1)`,
      sqlite: `DELETE FROM \`Users\` WHERE rowid IN (SELECT rowid FROM \`Users\` WHERE name = 'Zoe' LIMIT 1)`,
      mssql: `DELETE TOP(1) FROM [Users] WHERE name = N'Zoe'; SELECT @@ROWCOUNT AS AFFECTEDROWS;`,
      snowflake: `DELETE FROM "Users" WHERE "id" IN (SELECT "id" FROM "Users" WHERE name = 'Zoe' LIMIT 1)`,
      db2: `DELETE FROM "Users" WHERE name = 'Zoe' FETCH NEXT 1 ROWS ONLY`,
      ibmi: `DELETE FROM "Users" WHERE name = 'Zoe' FETCH NEXT 1 ROWS ONLY`,
    });
  });
});
