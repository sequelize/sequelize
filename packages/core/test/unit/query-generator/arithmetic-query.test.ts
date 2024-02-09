import { DataTypes, literal } from '@sequelize/core';
import { expectsql, sequelize } from '../../support';

describe('QueryGenerator#arithmeticQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
  }, { timestamps: false });

  it('uses the specified operator', async () => {
    const sqlPlus = queryGenerator.arithmeticQuery(
      '+', 'myTable', {}, { foo: 3 }, {}, {},
    );

    const sqlMinus = queryGenerator.arithmeticQuery(
      '-', 'myTable', {}, { foo: 3 }, {}, {},
    );

    expectsql(sqlPlus, {
      default: `UPDATE [myTable] SET [foo]=[foo]+ 3`,
      mssql: `UPDATE [myTable] SET [foo]=[foo]+ 3 OUTPUT INSERTED.*`,
      'postgres sqlite': `UPDATE [myTable] SET [foo]=[foo]+ 3 RETURNING *`,
    });

    expectsql(sqlMinus, {
      default: `UPDATE [myTable] SET [foo]=[foo]- 3`,
      mssql: `UPDATE [myTable] SET [foo]=[foo]- 3 OUTPUT INSERTED.*`,
      'postgres sqlite': `UPDATE [myTable] SET [foo]=[foo]- 3 RETURNING *`,
    });
  });

  it('uses the specified operator with literal', async () => {
    const sql = queryGenerator.arithmeticQuery(
      '+', 'myTable', {}, { foo: literal('bar') }, {}, {},
    );

    expectsql(sql, {
      default: `UPDATE [myTable] SET [foo]=[foo]+ bar`,
      mssql: `UPDATE [myTable] SET [foo]=[foo]+ bar OUTPUT INSERTED.*`,
      'postgres sqlite': `UPDATE [myTable] SET [foo]=[foo]+ bar RETURNING *`,
    });
  });

  it('supports specifying a WHERE clause', async () => {
    const sql = queryGenerator.arithmeticQuery(
      '+', 'myTable', { bar: 'biz' }, { foo: 3 }, {}, {},
    );

    expectsql(sql, {
      default: `UPDATE [myTable] SET [foo]=[foo]+ 3 WHERE [bar] = 'biz'`,
      mssql: `UPDATE [myTable] SET [foo]=[foo]+ 3 OUTPUT INSERTED.* WHERE [bar] = N'biz'`,
      'postgres sqlite': `UPDATE [myTable] SET [foo]=[foo]+ 3 WHERE [bar] = 'biz' RETURNING *`,
    });
  });

  it('supports omitting the RETURNING clause', async () => {
    const sql = queryGenerator.arithmeticQuery(
      '+', 'myTable', {}, { foo: 3 }, {}, { returning: false },
    );

    expectsql(sql, {
      default: `UPDATE [myTable] SET [foo]=[foo]+ 3`,
    });
  });

  it('does not cause a syntax error when the minus operator is used with a negative value', async () => {
    const sql = queryGenerator.arithmeticQuery(
      '-', 'myTable', {}, { foo: -1 }, {}, {},
    );

    expectsql(sql, {
      default: `UPDATE [myTable] SET [foo]=[foo]- -1`,
      mssql: `UPDATE [myTable] SET [foo]=[foo]- -1 OUTPUT INSERTED.*`,
      'postgres sqlite': `UPDATE [myTable] SET [foo]=[foo]- -1 RETURNING *`,
    });
  });

  // you'll find more replacement tests in query-generator tests
  it('parses named replacements in literals', async () => {
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
      mssql: `UPDATE [Users] SET [age]=[age]+ 2,[name]=N'John' OUTPUT INSERTED.* WHERE id = 47`,
      'postgres sqlite': `UPDATE [Users] SET [age]=[age]+ 2,[name]='John' WHERE id = 47 RETURNING *`,
    });
  });
});
