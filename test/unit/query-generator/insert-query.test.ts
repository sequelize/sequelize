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
    expect(bind).to.deep.eq({});
  });

  it('supports named bind parameters in literals', async () => {
    const { query, bind } = queryGenerator.insertQuery(User.tableName, {
      firstName: 'John',
      lastName: literal('$lastName'),
      username: 'jd',
    });

    expectsql(query, {
      default: `INSERT INTO [Users] ([firstName],[lastName],[username]) VALUES ($sequelize_1,$lastName,$sequelize_2);`,
    });

    expect(bind).to.deep.eq({
      sequelize_1: 'John',
      sequelize_2: 'jd',
    });
  });

  it('parses positional bind parameters in literals', async () => {
    const { query, bind } = queryGenerator.insertQuery(User.tableName, {
      firstName: 'John',
      lastName: literal('$1'),
      username: 'jd',
    });

    // lastName's bind position being changed from $1 to $2 is intentional: bind array order must match their order in the query in some dialects.
    expectsql(query, {
      default: `INSERT INTO [Users] ([firstName],[lastName],[username]) VALUES ($sequelize_1,$1,$sequelize_2);`,
    });
    expect(bind).to.deep.eq({
      sequelize_1: 'John',
      sequelize_2: 'jd',
    });
  });

  it('parses bind parameters in literals even with bindParams: false', async () => {
    const { query, bind } = queryGenerator.insertQuery(User.tableName, {
      firstName: 'John',
      lastName: literal('$1'),
      username: 'jd',
    }, {}, {
      bindParam: false,
    });

    expectsql(query, {
      default: `INSERT INTO [Users] ([firstName],[lastName],[username]) VALUES ('John',$1,'jd');`,
    });
    expect(bind).to.be.undefined;
  });
});
