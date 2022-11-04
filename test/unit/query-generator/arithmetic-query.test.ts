import { DataTypes, literal } from '@sequelize/core';
import { expectsql, sequelize } from '../../support';

describe('QueryGenerator#arithmeticQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
  }, { timestamps: false });

  it('should use the plus operator', async () => {
    const sql = queryGenerator.arithmeticQuery(
      '+', 'myTable', {}, { foo: literal('bar') }, {}, {},
    );

    expectsql(sql, {
      default: `UPDATE [myTable] SET [foo]=[foo]+ bar`,
      postgres: `UPDATE "myTable" SET "foo"="foo"+ bar RETURNING *`,
      mssql: `UPDATE [myTable] SET [foo]=[foo]+ bar OUTPUT INSERTED.*`,
    });
  });

  it('should use the plus operator with where clause', async () => {
    const sql = queryGenerator.arithmeticQuery(
      '+', 'myTable', { bar: 'biz' }, { foo: literal('bar') }, {}, {},
    );

    expectsql(sql, {
      default: `UPDATE [myTable] SET [foo]=[foo]+ bar WHERE [bar] = 'biz'`,
      postgres: `UPDATE "myTable" SET "foo"="foo"+ bar WHERE "bar" = 'biz' RETURNING *`,
      mssql: `UPDATE [myTable] SET [foo]=[foo]+ bar OUTPUT INSERTED.* WHERE [bar] = N'biz'`,
    });
  });

  it('should use the plus operator without returning clause', async () => {
    const sql = queryGenerator.arithmeticQuery(
      '+', 'myTable', {}, { foo: literal('bar') }, {}, { returning: false },
    );

    expectsql(sql, {
      default: `UPDATE [myTable] SET [foo]=[foo]+ bar`,
    });
  });

  it('should use the minus operator', async () => {
    const sql = queryGenerator.arithmeticQuery(
      '-', 'myTable', {}, { foo: literal('bar') }, {}, {},
    );

    expectsql(sql, {
      default: `UPDATE [myTable] SET [foo]=[foo]- bar`,
      postgres: `UPDATE "myTable" SET "foo"="foo"- bar RETURNING *`,
      mssql: `UPDATE [myTable] SET [foo]=[foo]- bar OUTPUT INSERTED.*`,
    });
  });

  it('should use the minus operator with negative value', async () => {
    const sql = queryGenerator.arithmeticQuery(
      '-', 'myTable', {}, { foo: -1 }, {}, {},
    );

    expectsql(sql, {
      default: `UPDATE [myTable] SET [foo]=[foo]- -1`,
      postgres: `UPDATE "myTable" SET "foo"="foo"- -1 RETURNING *`,
      mssql: `UPDATE [myTable] SET [foo]=[foo]- -1 OUTPUT INSERTED.*`,
    });
  });

  it('should use the minus operator with where clause', async () => {
    const sql = queryGenerator.arithmeticQuery(
      '-', 'myTable', { bar: 'biz' }, { foo: literal('bar') }, {}, {},
    );

    expectsql(sql, {
      default: `UPDATE [myTable] SET [foo]=[foo]- bar WHERE [bar] = 'biz'`,
      postgres: `UPDATE "myTable" SET "foo"="foo"- bar WHERE "bar" = 'biz' RETURNING *`,
      mssql: `UPDATE [myTable] SET [foo]=[foo]- bar OUTPUT INSERTED.* WHERE [bar] = N'biz'`,
    });
  });

  it('should use the minus operator without returning clause', async () => {
    const sql = queryGenerator.arithmeticQuery(
      '-', 'myTable', {}, { foo: literal('bar') }, {}, { returning: false },
    );

    expectsql(sql, {
      default: `UPDATE [myTable] SET [foo]=[foo]- bar`,
    });
  });

  // you'll find more replacement tests in query-generator tests
  it('parses named replacements in literals', async () => {
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
    );

    expectsql(sql, {
      default: `UPDATE [Users] SET [age]=[age]+ 2,[name]='John' WHERE id = 47`,
      postgres: `UPDATE "Users" SET "age"="age"+ 2,"name"='John' WHERE id = 47 RETURNING *`,
      mssql: `UPDATE [Users] SET [age]=[age]+ 2,[name]=N'John' OUTPUT INSERTED.* WHERE id = 47`,
    });
  });
});
