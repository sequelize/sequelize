import { DataTypes, literal } from '@sequelize/core';
import { expectsql, sequelize } from '../../support';

describe('QueryGenerator#updateQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
  }, { timestamps: false });

  // you'll find more replacement tests in query-generator tests
  it('parses named replacements in literals', async () => {
    const query = queryGenerator.deleteQuery(
      User.tableName,
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
      postgres: `DELETE FROM "Users" WHERE "id" IN (SELECT "id" FROM "Users" WHERE name = 'Zoe' LIMIT 1);`,
      mariadb: 'DELETE FROM `Users` WHERE name = \'Zoe\' LIMIT 1;',
      mysql: 'DELETE FROM `Users` WHERE name = \'Zoe\' LIMIT 1;',
    });
  });
});
