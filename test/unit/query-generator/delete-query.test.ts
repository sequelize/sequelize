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
      bindContext,
    );

    expectsql(query, {
      postgres: `DELETE FROM "Users" WHERE "id" IN (SELECT "id" FROM "Users" WHERE name = 'Zoe' LIMIT 1)`,
    });
    expect(bindContext.normalizedBind).to.be.undefined;
  });

  it('parses named bind parameters in literals', async () => {
    const bindContext: BindContext = {};
    const query = queryGenerator.deleteQuery(
      User.tableName,
      literal('name = $name'),
      {
        limit: literal('$limit'),
        bind: {
          limit: 1,
          name: 'Zoe',
        },
      },
      User,
      bindContext,
    );

    expectsql(query, {
      postgres: `DELETE FROM "Users" WHERE "id" IN (SELECT "id" FROM "Users" WHERE name = $1 LIMIT $2)`,
    });
    expect(bindContext.normalizedBind).to.deep.eq(['Zoe', 1]);
  });

  it('parses positional bind parameters in literals', async () => {
    const bindContext: BindContext = {};
    const query = queryGenerator.deleteQuery(
      User.tableName,
      literal('name = $2'),
      {
        limit: literal('$1'),
        bind: [1, 'Zoe'],
      },
      User,
      bindContext,
    );

    expectsql(query, {
      postgres: `DELETE FROM "Users" WHERE "id" IN (SELECT "id" FROM "Users" WHERE name = $1 LIMIT $2)`,
    });

    // it's normal that the order of the bind parameters has been flipped.
    expect(bindContext.normalizedBind).to.deep.eq(['Zoe', 1]);
  });
});
