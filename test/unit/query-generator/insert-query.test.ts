import { DataTypes, literal } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../../support';

describe('QueryGenerator#insertQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
  }, { timestamps: false });

  // you'll find more replacement tests in query-generator tests
  it('parses named replacements in literals', async () => {
    const { query, bind } = queryGenerator.insertQuery(User.tableName, {
      firstName: literal(':name'),
    }, {}, {
      replacements: {
        name: 'Zoe',
      },
    });

    expect(query).to.eq('INSERT INTO "Users" ("firstName") VALUES (\'Zoe\');');
    expect(bind).to.be.undefined;
  });

  it('parses named bind parameters in literals', async () => {
    const { query, bind } = queryGenerator.insertQuery(User.tableName, {
      firstName: 'John',
      lastName: literal('$lastName'),
      username: 'jd',
    }, {}, {
      bind: {
        lastName: 'Doe',
      },
    });

    expect(query).to.eq('INSERT INTO "Users" ("firstName","lastName","username") VALUES ($1,$2,$3);');
    expect(bind).to.deep.eq(['John', 'Doe', 'jd']);
  });

  it('parses positional bind parameters in literals', async () => {
    const { query, bind } = queryGenerator.insertQuery(User.tableName, {
      firstName: 'John',
      lastName: literal('$1'),
      username: 'jd',
    }, {}, {
      bind: ['Doe'],
    });

    // lastName's bind position being changed from $1 to $2 is intentional
    expect(query).to.eq('INSERT INTO "Users" ("firstName","lastName","username") VALUES ($1,$2,$3);');
    expect(bind).to.deep.eq(['John', 'Doe', 'jd']);
  });

  it('parses bind parameters in literals even with bindParams: false', async () => {
    const { query, bind } = queryGenerator.insertQuery(User.tableName, {
      firstName: 'John',
      lastName: literal('$1'),
      username: 'jd',
    }, {}, {
      bindParam: false,
      bind: ['Doe'],
    });

    // lastName's bind position being changed from $1 to $2 is intentional
    expect(query).to.eq(`INSERT INTO "Users" ("firstName","lastName","username") VALUES ('John',$1,'jd');`);
    expect(bind).to.deep.eq(['Doe']);
  });
});
