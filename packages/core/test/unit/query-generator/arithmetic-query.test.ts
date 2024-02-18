import { DataTypes, literal } from '@sequelize/core';
import { beforeAll2, expectsql, sequelize } from '../../support';

describe('QueryGenerator#arithmeticQuery', () => {
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

  it('uses the specified operator', async () => {
    const sqlPlus = queryGenerator.arithmeticQuery('+', 'myTable', {}, { foo: 3 }, {}, {});

    const sqlMinus = queryGenerator.arithmeticQuery('-', 'myTable', {}, { foo: 3 }, {}, {});

    expectsql(sqlPlus, {
      default: `UPDATE [myTable] SET [foo]=[foo]+ 3`,
      postgres: `UPDATE "myTable" SET "foo"="foo"+ 3 RETURNING *`,
      mssql: `UPDATE [myTable] SET [foo]=[foo]+ 3 OUTPUT INSERTED.*`,
    });

    expectsql(sqlMinus, {
      default: `UPDATE [myTable] SET [foo]=[foo]- 3`,
      postgres: `UPDATE "myTable" SET "foo"="foo"- 3 RETURNING *`,
      mssql: `UPDATE [myTable] SET [foo]=[foo]- 3 OUTPUT INSERTED.*`,
    });
  });

  it('uses the specified operator with literal', async () => {
    const sql = queryGenerator.arithmeticQuery('+', 'myTable', {}, { foo: literal('bar') }, {}, {});

    expectsql(sql, {
      default: `UPDATE [myTable] SET [foo]=[foo]+ bar`,
      postgres: `UPDATE "myTable" SET "foo"="foo"+ bar RETURNING *`,
      mssql: `UPDATE [myTable] SET [foo]=[foo]+ bar OUTPUT INSERTED.*`,
    });
  });

  it('supports specifying a WHERE clause', async () => {
    const sql = queryGenerator.arithmeticQuery('+', 'myTable', { bar: 'biz' }, { foo: 3 }, {}, {});

    expectsql(sql, {
      default: `UPDATE [myTable] SET [foo]=[foo]+ 3 WHERE [bar] = 'biz'`,
      postgres: `UPDATE "myTable" SET "foo"="foo"+ 3 WHERE "bar" = 'biz' RETURNING *`,
      mssql: `UPDATE [myTable] SET [foo]=[foo]+ 3 OUTPUT INSERTED.* WHERE [bar] = N'biz'`,
    });
  });

  it('supports omitting the RETURNING clause', async () => {
    const sql = queryGenerator.arithmeticQuery(
      '+',
      'myTable',
      {},
      { foo: 3 },
      {},
      { returning: false },
    );

    expectsql(sql, {
      default: `UPDATE [myTable] SET [foo]=[foo]+ 3`,
    });
  });

  it('does not cause a syntax error when the minus operator is used with a negative value', async () => {
    const sql = queryGenerator.arithmeticQuery('-', 'myTable', {}, { foo: -1 }, {}, {});

    expectsql(sql, {
      default: `UPDATE [myTable] SET [foo]=[foo]- -1`,
      postgres: `UPDATE "myTable" SET "foo"="foo"- -1 RETURNING *`,
      mssql: `UPDATE [myTable] SET [foo]=[foo]- -1 OUTPUT INSERTED.*`,
    });
  });

  // you'll find more replacement tests in query-generator tests
  it('parses named replacements in literals', async () => {
    const { User } = vars;

    const sql = queryGenerator.arithmeticQuery(
      '+',
      User.table,
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
      default: `UPDATE [Users] SET [age]=[age]+ 2,[name]='John' WHERE id = 47`,
      postgres: `UPDATE "Users" SET "age"="age"+ 2,"name"='John' WHERE id = 47 RETURNING *`,
      mssql: `UPDATE [Users] SET [age]=[age]+ 2,[name]=N'John' OUTPUT INSERTED.* WHERE id = 47`,
    });
  });
});
