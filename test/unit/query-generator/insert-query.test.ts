import { expect } from 'chai';
import { DataTypes, literal } from '@sequelize/core';
import { expectsql, sequelize } from '../../support';

describe('QueryGenerator#insertQuery', () => {
  const queryGenerator = sequelize.getQueryInterface().queryGenerator;

  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
  }, { timestamps: false });

  // you'll find more replacement tests in query-generator tests
  it('parses named replacements in literals', () => {
    const { query, bind } = queryGenerator.insertQuery(User.tableName, {
      firstName: literal(':name'),
    }, {}, {
      replacements: {
        name: 'Zoe',
      },
    });

    expectsql(query, {
      default: `INSERT INTO [Users] ([firstName]) VALUES ('Zoe');`,
      mssql: `INSERT INTO [Users] ([firstName]) VALUES (N'Zoe');`,
      db2: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ('Zoe'));`,
      ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ('Zoe'))`,
    });
    expect(bind).to.deep.eq({});
  });

  it('supports named bind parameters in literals', () => {
    const { query, bind } = queryGenerator.insertQuery(User.tableName, {
      firstName: 'John',
      lastName: literal('$lastName'),
      username: 'jd',
    });

    expectsql(query, {
      default: `INSERT INTO [Users] ([firstName],[lastName],[username]) VALUES ($sequelize_1,$lastName,$sequelize_2);`,
      db2: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName","lastName","username") VALUES ($sequelize_1,$lastName,$sequelize_2));`,
      ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName","lastName","username") VALUES ($sequelize_1,$lastName,$sequelize_2))`,
    });

    expect(bind).to.deep.eq({
      sequelize_1: 'John',
      sequelize_2: 'jd',
    });
  });

  it('parses positional bind parameters in literals', () => {
    const { query, bind } = queryGenerator.insertQuery(User.tableName, {
      firstName: 'John',
      lastName: literal('$1'),
      username: 'jd',
    });

    // lastName's bind position being changed from $1 to $2 is intentional: bind array order must match their order in the query in some dialects.
    expectsql(query, {
      default: `INSERT INTO [Users] ([firstName],[lastName],[username]) VALUES ($sequelize_1,$1,$sequelize_2);`,
      db2: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName","lastName","username") VALUES ($sequelize_1,$1,$sequelize_2));`,
      ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName","lastName","username") VALUES ($sequelize_1,$1,$sequelize_2))`,
    });
    expect(bind).to.deep.eq({
      sequelize_1: 'John',
      sequelize_2: 'jd',
    });
  });

  it('parses bind parameters in literals even with bindParams: false', () => {
    const { query, bind } = queryGenerator.insertQuery(User.tableName, {
      firstName: 'John',
      lastName: literal('$1'),
      username: 'jd',
    }, {}, {
      bindParam: false,
    });

    expectsql(query, {
      default: `INSERT INTO [Users] ([firstName],[lastName],[username]) VALUES ('John',$1,'jd');`,
      mssql: `INSERT INTO [Users] ([firstName],[lastName],[username]) VALUES (N'John',$1,N'jd');`,
      db2: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName","lastName","username") VALUES ('John',$1,'jd'));`,
      ibmi: `SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName","lastName","username") VALUES ('John',$1,'jd'))`,
    });
    expect(bind).to.be.undefined;
  });

  describe('returning', () => {
    it('supports returning: true', () => {
      const { query } = queryGenerator.insertQuery(User.tableName, {
        firstName: 'John',
      }, User.getAttributes(), {
        returning: true,
      });

      expectsql(query, {
        default: `INSERT INTO [Users] ([firstName]) VALUES ($sequelize_1) RETURNING [id], [firstName];`,
        // TODO: insertQuery should throw if returning is not supported
        'mysql mariadb sqlite': `INSERT INTO \`Users\` (\`firstName\`) VALUES ($sequelize_1);`,
        // TODO: insertQuery should throw if returning is not supported
        snowflake: `INSERT INTO "Users" ("firstName") VALUES ($sequelize_1);`,
        mssql: 'INSERT INTO [Users] ([firstName]) OUTPUT INSERTED.[id], INSERTED.[firstName] VALUES ($sequelize_1);',
        db2: 'SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ($sequelize_1));',
        ibmi: 'SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ($sequelize_1))',
      });
    });

    it('supports array of strings (column names)', () => {
      const { query } = queryGenerator.insertQuery(User.tableName, {
        firstName: 'John',
      }, User.getAttributes(), {
        returning: ['*', 'myColumn'],
      });

      expectsql(query, {
        default: `INSERT INTO [Users] ([firstName]) VALUES ($sequelize_1) RETURNING [*], [myColumn];`,
        // TODO: insertQuery should throw if returning is not supported
        'mysql mariadb sqlite': `INSERT INTO \`Users\` (\`firstName\`) VALUES ($sequelize_1);`,
        // TODO: insertQuery should throw if returning is not supported
        snowflake: `INSERT INTO "Users" ("firstName") VALUES ($sequelize_1);`,
        mssql: 'INSERT INTO [Users] ([firstName]) OUTPUT INSERTED.[*], INSERTED.[myColumn] VALUES ($sequelize_1);',
        // TODO: should only select specified columns
        db2: 'SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ($sequelize_1));',
        ibmi: 'SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ($sequelize_1))',
      });
    });

    it('supports array of literals', () => {

      expectsql(() => {
        return queryGenerator.insertQuery(User.tableName, {
          firstName: 'John',
        }, User.getAttributes(), {
          returning: [literal('*')],
        }).query;
      }, {
        default: `INSERT INTO [Users] ([firstName]) VALUES ($sequelize_1) RETURNING *;`,
        // TODO: insertQuery should throw if returning is not supported
        'mysql mariadb sqlite': `INSERT INTO \`Users\` (\`firstName\`) VALUES ($sequelize_1);`,
        // TODO: insertQuery should throw if returning is not supported
        snowflake: `INSERT INTO "Users" ("firstName") VALUES ($sequelize_1);`,
        mssql: new Error('literal() cannot be used in the "returning" option array in mssql. Use col(), or a string instead.'),
        // TODO: should only select specified columns
        db2: 'SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ($sequelize_1));',
        ibmi: 'SELECT * FROM FINAL TABLE (INSERT INTO "Users" ("firstName") VALUES ($sequelize_1))',
      });
    });
  });
});
