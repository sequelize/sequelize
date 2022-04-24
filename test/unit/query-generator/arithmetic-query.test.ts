import { DataTypes, literal } from '@sequelize/core';
import { expectsql, sequelize } from '../../support';

describe('QueryGenerator#updateQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
  }, { timestamps: false });

  // you'll find more replacement tests in query-generator tests
  it('parses named replacements in literals', async () => {
    const sql = queryGenerator.arithmeticQuery(
      '+',
      User.tableName,
      // where
      literal('id = :id'),
      // increment by field
      {
        age: literal(':age'),
      },
      // extraAttributesToBeUpdated
      {
        name: literal(':name'),
      },
      {
        replacements: {
          id: 47,
          age: 2,
          name: 'John',
        },
      },
    );

    expectsql(sql, {
      postgres: `UPDATE "Users" SET "age"="age"+ 2,"name"='John' WHERE id = 47 RETURNING *;`,
      mariadb: `UPDATE \`Users\` SET \`age\`=\`age\`+ 2,\`name\`='John' WHERE id = 47;`,
      mysql: `UPDATE \`Users\` SET \`age\`=\`age\`+ 2,\`name\`='John' WHERE id = 47;`,
    });
  });
});
