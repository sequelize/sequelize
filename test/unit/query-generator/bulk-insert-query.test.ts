import { DataTypes, literal } from '@sequelize/core';
import type { BindContext } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/query.js';
import { expect } from 'chai';
import { expectsql, sequelize } from '../../support';

describe('QueryGenerator#bulkInsertQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
  }, { timestamps: false });

  it('parses named replacements in literals', async () => {
    const bindContext: BindContext = {};
    const sql = queryGenerator.bulkInsertQuery(User.tableName, [{
      firstName: literal(':injection'),
    }], {
      replacements: {
        injection: 'a string',
      },
    }, {}, bindContext);

    expectsql(sql, {
      default: 'INSERT INTO "Users" ("firstName") VALUES (\'a string\');',
    });

    expect(bindContext.normalizedBind).to.be.undefined;
  });
});
