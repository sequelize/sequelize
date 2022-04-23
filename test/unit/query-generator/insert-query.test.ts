import { DataTypes, literal } from '@sequelize/core';
import { expect } from 'chai';
import { expectsql, sequelize } from '../../support';

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

    expectsql(query, {
      default: `INSERT INTO [Users] ([firstName]) VALUES ('Zoe');`,
    });
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

    expectsql(query, {
      postgres: `INSERT INTO "Users" ("firstName","lastName","username") VALUES ($1,$2,$3);`,
      mariadb: 'INSERT INTO `Users` (`firstName`,`lastName`,`username`) VALUES (?,?,?);',
      mysql: 'INSERT INTO `Users` (`firstName`,`lastName`,`username`) VALUES (?,?,?);',
    });

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

    // lastName's bind position being changed from $1 to $2 is intentional: bind array order must match their order in the query in some dialects.
    expectsql(query, {
      postgres: `INSERT INTO "Users" ("firstName","lastName","username") VALUES ($1,$2,$3);`,
      mariadb: 'INSERT INTO `Users` (`firstName`,`lastName`,`username`) VALUES (?,?,?);',
      mysql: 'INSERT INTO `Users` (`firstName`,`lastName`,`username`) VALUES (?,?,?);',
    });
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

    expectsql(query, {
      postgres: `INSERT INTO "Users" ("firstName","lastName","username") VALUES ('John',$1,'jd');`,
      mariadb: 'INSERT INTO `Users` (`firstName`,`lastName`,`username`) VALUES (\'John\',?,\'jd\');',
      mysql: 'INSERT INTO `Users` (`firstName`,`lastName`,`username`) VALUES (\'John\',?,\'jd\');',
    });
    expect(bind).to.deep.eq(['Doe']);
  });
});
