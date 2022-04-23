import { DataTypes, literal } from '@sequelize/core';
import { expect } from 'chai';
import type { BindContext } from '../../../types/dialects/abstract/query.js';
import { expectsql, sequelize } from '../../support';

describe('QueryGenerator#updateQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
  }, { timestamps: false });

  // you'll find more replacement tests in query-generator tests
  it('parses named replacements in literals', async () => {
    const bindContext: BindContext = {};
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
      bindContext,
    );

    expectsql(sql, {
      postgres: `UPDATE "Users" SET "age"="age"+ 2,"name"='John' WHERE id = 47 RETURNING *;`,
      mariadb: `UPDATE \`Users\` SET \`age\`=\`age\`+ 2,\`name\`='John' WHERE id = 47;`,
      mysql: `UPDATE \`Users\` SET \`age\`=\`age\`+ 2,\`name\`='John' WHERE id = 47;`,
    });
    expect(bindContext.normalizedBind).to.be.undefined;
  });

  it('parses named bind parameters in literals', async () => {
    const bindContext: BindContext = {};
    const sql = queryGenerator.arithmeticQuery(
      '+',
      User.tableName,
      // where
      literal('id = $id'),
      // increment by field
      {
        age: literal('$age'),
      },
      // extraAttributesToBeUpdated
      {
        name: literal('$name'),
      },
      {
        bind: {
          id: 47,
          age: 2,
          name: 'John',
        },
      },
      bindContext,
    );

    expectsql(sql, {
      postgres: `UPDATE "Users" SET "age"="age"+ $1,"name"=$2 WHERE id = $3 RETURNING *;`,
      mariadb: 'UPDATE `Users` SET `age`=`age`+ ?,`name`=? WHERE id = ?;',
      mysql: 'UPDATE `Users` SET `age`=`age`+ ?,`name`=? WHERE id = ?;',
    });
    expect(bindContext.normalizedBind).to.deep.eq([2, 'John', 47]);
  });

  it('parses positional bind parameters in literals', async () => {
    const bindContext: BindContext = {};
    const sql = queryGenerator.arithmeticQuery(
      '+',
      User.tableName,
      // where
      literal('id = $1'),
      // increment by field
      {
        age: literal('$2'),
      },
      // extraAttributesToBeUpdated
      {
        name: literal('$3'),
      },
      {
        bind: [47, 2, 'John'],
      },
      bindContext,
    );

    expectsql(sql, {
      postgres: `UPDATE "Users" SET "age"="age"+ $1,"name"=$2 WHERE id = $3 RETURNING *;`,
      mariadb: 'UPDATE `Users` SET `age`=`age`+ ?,`name`=? WHERE id = ?;',
      mysql: 'UPDATE `Users` SET `age`=`age`+ ?,`name`=? WHERE id = ?;',
    });
    expect(bindContext.normalizedBind).to.deep.eq([2, 'John', 47]);
  });
});
