import { DataTypes, literal } from '@sequelize/core';
import { expect } from 'chai';
import { expectsql, sequelize } from '../../support';

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
    });

    expectsql(query, {
      default: `UPDATE [Users] SET [firstName]='Zoe' WHERE name = 'Zoe'`,
      mssql: `UPDATE [Users] SET [firstName]=N'Zoe' WHERE name = N'Zoe';`,
      db2: `SELECT * FROM FINAL TABLE (UPDATE "Users" SET "firstName"='Zoe' WHERE name = 'Zoe');`,
    });
    expect(bind).to.deep.eq({});
  });

  it('generates extra bind params', async () => {
    const { query, bind } = queryGenerator.updateQuery(User.tableName, {
      firstName: 'John',
      lastName: literal('$1'),
      username: 'jd',
    }, {});

    // lastName's bind position being changed from $1 to $2 is intentional
    expectsql(query, {
      default: 'UPDATE [Users] SET [firstName]=$sequelize_1,[lastName]=$1,[username]=$sequelize_2',
      db2: `SELECT * FROM FINAL TABLE (UPDATE "Users" SET "firstName"=$sequelize_1,"lastName"=$1,"username"=$sequelize_2);`,
    });
    expect(bind).to.deep.eq({
      sequelize_1: 'John',
      sequelize_2: 'jd',
    });
  });

  it('does not generate extra bind params with bindParams: false', async () => {
    const { query, bind } = queryGenerator.updateQuery(User.tableName, {
      firstName: 'John',
      lastName: literal('$1'),
      username: 'jd',
    }, {
      where: literal('first_name = $2'),
    }, {
      bindParam: false,
    });

    // lastName's bind position being changed from $1 to $2 is intentional
    expectsql(query, {
      default: `UPDATE [Users] SET [firstName]='John',[lastName]=$1,[username]='jd' WHERE first_name = $2`,
      mssql: `UPDATE [Users] SET [firstName]=N'John',[lastName]=$1,[username]=N'jd' WHERE first_name = $2;`,
      db2: `SELECT * FROM FINAL TABLE (UPDATE "Users" SET "firstName"='John',"lastName"=$1,"username"='jd' WHERE first_name = $2);`,
    });

    expect(bind).to.be.undefined;
  });
});
