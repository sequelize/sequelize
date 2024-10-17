import { DataTypes, ParameterStyle, literal } from '@sequelize/core';
import { expect } from 'chai';
import { beforeAll2, expectsql, sequelize } from '../../support';

describe('QueryGenerator#updateQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  const vars = beforeAll2(() => {
    const User = sequelize.define(
      'User',
      {
        firstName: DataTypes.STRING,
      },
      { timestamps: false },
    );

    return { User };
  });

  // you'll find more replacement tests in query-generator tests
  it('parses named replacements in literals', async () => {
    const { User } = vars;

    const { query, bind } = queryGenerator.updateQuery(
      User.table,
      {
        firstName: literal(':name'),
      },
      literal('name = :name'),
      {
        replacements: {
          name: 'Zoe',
        },
      },
    );

    expectsql(query, {
      default: `UPDATE [Users] SET [firstName]='Zoe' WHERE name = 'Zoe'`,
      mssql: `UPDATE [Users] SET [firstName]=N'Zoe' WHERE name = N'Zoe'`,
      db2: `SELECT * FROM FINAL TABLE (UPDATE "Users" SET "firstName"='Zoe' WHERE name = 'Zoe');`,
    });
    expect(bind).to.deep.eq({});
  });

  it('generates extra bind params', async () => {
    const { User } = vars;

    const { query, bind } = queryGenerator.updateQuery(
      User.table,
      {
        firstName: 'John',
        lastName: literal('$1'),
        username: 'jd',
      },
      {},
    );

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

  it('throws an error if the bindParam option is used', () => {
    const { User } = vars;

    expect(() => {
      queryGenerator.updateQuery(
        User.table,
        {
          firstName: 'John',
          lastName: literal('$1'),
          username: 'jd',
        },
        literal('first_name = $2'),
        // @ts-expect-error -- intentionally testing deprecated option
        { bindParam: false },
      );
    }).to.throw('The bindParam option has been removed. Use parameterStyle instead.');
  });

  it('does not generate extra bind params with parameterStyle: REPLACEMENT', async () => {
    const { User } = vars;

    const { query, bind } = queryGenerator.updateQuery(
      User.table,
      {
        firstName: 'John',
        lastName: literal('$1'),
        username: 'jd',
      },
      literal('first_name = $2'),
      {
        parameterStyle: ParameterStyle.REPLACEMENT,
      },
    );

    // lastName's bind position being changed from $1 to $2 is intentional
    expectsql(query, {
      default: `UPDATE [Users] SET [firstName]='John',[lastName]=$1,[username]='jd' WHERE first_name = $2`,
      mssql: `UPDATE [Users] SET [firstName]=N'John',[lastName]=$1,[username]=N'jd' WHERE first_name = $2`,
      db2: `SELECT * FROM FINAL TABLE (UPDATE "Users" SET "firstName"='John',"lastName"=$1,"username"='jd' WHERE first_name = $2);`,
    });

    expect(bind).to.be.undefined;
  });

  it('binds date values', () => {
    const result = queryGenerator.updateQuery(
      'myTable',
      {
        date: new Date('2011-03-27T10:01:55Z'),
      },
      { id: 2 },
    );

    expectsql(result, {
      query: {
        default: 'UPDATE [myTable] SET [date]=$sequelize_1 WHERE [id] = $sequelize_2',
        db2: 'SELECT * FROM FINAL TABLE (UPDATE "myTable" SET "date"=$sequelize_1 WHERE "id" = $sequelize_2);',
      },
      bind: {
        mysql: {
          sequelize_1: '2011-03-27 10:01:55.000',
          sequelize_2: 2,
        },
        mariadb: {
          sequelize_1: '2011-03-27 10:01:55.000',
          sequelize_2: 2,
        },
        db2: {
          sequelize_1: '2011-03-27 10:01:55.000',
          sequelize_2: 2,
        },
        ibmi: {
          sequelize_1: '2011-03-27 10:01:55.000',
          sequelize_2: 2,
        },
        snowflake: {
          sequelize_1: '2011-03-27 10:01:55.000',
          sequelize_2: 2,
        },
        sqlite3: {
          sequelize_1: '2011-03-27 10:01:55.000 +00:00',
          sequelize_2: 2,
        },
        postgres: {
          sequelize_1: '2011-03-27 10:01:55.000 +00:00',
          sequelize_2: 2,
        },
        mssql: {
          sequelize_1: '2011-03-27 10:01:55.000 +00:00',
          sequelize_2: 2,
        },
      },
    });
  });

  it('binds boolean values', () => {
    const result = queryGenerator.updateQuery(
      'myTable',
      {
        positive: true,
        negative: false,
      },
      { id: 2 },
    );

    expectsql(result, {
      query: {
        default:
          'UPDATE [myTable] SET [positive]=$sequelize_1,[negative]=$sequelize_2 WHERE [id] = $sequelize_3',
        db2: 'SELECT * FROM FINAL TABLE (UPDATE "myTable" SET "positive"=$sequelize_1,"negative"=$sequelize_2 WHERE "id" = $sequelize_3);',
      },
      bind: {
        sqlite3: {
          sequelize_1: 1,
          sequelize_2: 0,
          sequelize_3: 2,
        },
        mysql: {
          sequelize_1: 1,
          sequelize_2: 0,
          sequelize_3: 2,
        },
        mariadb: {
          sequelize_1: 1,
          sequelize_2: 0,
          sequelize_3: 2,
        },
        mssql: {
          sequelize_1: 1,
          sequelize_2: 0,
          sequelize_3: 2,
        },
        postgres: {
          sequelize_1: true,
          sequelize_2: false,
          sequelize_3: 2,
        },
        db2: {
          sequelize_1: true,
          sequelize_2: false,
          sequelize_3: 2,
        },
        ibmi: {
          sequelize_1: 1,
          sequelize_2: 0,
          sequelize_3: 2,
        },
        snowflake: {
          sequelize_1: true,
          sequelize_2: false,
          sequelize_3: 2,
        },
      },
    });
  });

  // TODO: Should we ignore undefined values instead? undefined is closer to "missing property" than null
  it('treats undefined as null', () => {
    const { query, bind } = queryGenerator.updateQuery(
      'myTable',
      {
        value: undefined,
        name: 'bar',
      },
      { id: 2 },
    );

    expectsql(query, {
      default:
        'UPDATE [myTable] SET [value]=$sequelize_1,[name]=$sequelize_2 WHERE [id] = $sequelize_3',
      db2: 'SELECT * FROM FINAL TABLE (UPDATE "myTable" SET "value"=$sequelize_1,"name"=$sequelize_2 WHERE "id" = $sequelize_3);',
    });

    expect(bind).to.deep.eq({
      sequelize_1: null,
      sequelize_2: 'bar',
      sequelize_3: 2,
    });
  });
});
