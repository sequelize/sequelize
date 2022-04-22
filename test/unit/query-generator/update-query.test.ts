import { DataTypes, literal } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../../support';

describe('QueryGenerator#updateQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
  }, { timestamps: false });

  // you'll find more replacement tests in query-generator tests
  it('parses named replacements in literals', async () => {
    const { query, bind } = queryGenerator.updateQuery(User.tableName, {
      firstName: literal(':name'),
    }, {
      where: literal('name = :name'),
    }, {
      replacements: {
        name: 'Zoe',
      },
    }, {});

    expect(query).to.eq(`UPDATE "Users" SET "firstName"='Zoe' WHERE name = 'Zoe';`);
    expect(bind).to.be.undefined;
  });

  it('parses named bind parameters in literals', async () => {
    const { query, bind } = queryGenerator.updateQuery(User.tableName, {
      firstName: 'John',
      lastName: literal('$lastName'),
      username: 'jd',
    }, {
      where: literal('name = $lastName'),
    }, {
      bind: {
        lastName: 'Doe',
      },
    }, {});

    expect(query).to.eq('UPDATE "Users" SET "firstName"=$1,"lastName"=$2,"username"=$3 WHERE name = $2;');
    expect(bind).to.deep.eq(['John', 'Doe', 'jd']);
  });

  it('parses positional bind parameters in literals', async () => {
    const { query, bind } = queryGenerator.updateQuery(User.tableName, {
      firstName: 'John',
      lastName: literal('$1'),
      username: 'jd',
    }, {}, {
      bind: ['Doe'],
    }, {});

    // lastName's bind position being changed from $1 to $2 is intentional
    expect(query).to.eq('UPDATE "Users" SET "firstName"=$1,"lastName"=$2,"username"=$3;');
    expect(bind).to.deep.eq(['John', 'Doe', 'jd']);
  });

  it('parses positional bind parameters in literals even with bindParams: false', async () => {
    const { query, bind } = queryGenerator.updateQuery(User.tableName, {
      firstName: 'John',
      lastName: literal('$1'),
      username: 'jd',
    }, {
      where: literal('first_name = $2'),
    }, {
      bindParam: false,
      bind: ['Doe', 'John'],
    }, {});

    // lastName's bind position being changed from $1 to $2 is intentional
    expect(query).to.eq(`UPDATE "Users" SET "firstName"='John',"lastName"=$1,"username"='jd' WHERE first_name = $2;`);
    expect(bind).to.deep.eq(['Doe', 'John']);
  });
});
