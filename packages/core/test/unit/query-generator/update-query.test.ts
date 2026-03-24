import { DataTypes, ParameterStyle, literal } from '@sequelize/core';
import { _validateIncludedElements } from '@sequelize/core/_non-semver-use-at-your-own-risk_/model-internals.js';
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
        oracle: {
          sequelize_1: new Date('2011-03-27T10:01:55Z'),
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
        oracle: {
          sequelize_1: '1',
          sequelize_2: '0',
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

  describe('with include', () => {
    const includeVars = beforeAll2(() => {
      const Post = sequelize.define(
        'Post',
        {
          title: DataTypes.STRING,
          authorId: DataTypes.INTEGER,
        },
        { timestamps: false },
      );

      const Author = sequelize.define(
        'Author',
        {
          name: DataTypes.STRING,
        },
        { timestamps: false },
      );

      Post.belongsTo(Author, { foreignKey: 'authorId' });
      Author.hasMany(Post, { foreignKey: 'authorId' });

      return { Post, Author };
    });

    it('generates UPDATE with subquery for single include', () => {
      const { Post } = includeVars;

      const options: any = {
        model: Post,
        include: _validateIncludedElements({
          model: Post,
          include: [{ association: Post.associations.author, where: { name: 'John' } }],
        }).include,
      };

      const result = queryGenerator.updateQuery(Post.table, { title: 'Updated' }, {}, options);

      expectsql(result.query, {
        default: `UPDATE [Posts] SET [title]=$sequelize_1 WHERE [Posts].[id] IN (SELECT [Post].[id] FROM [Posts] AS [Post] INNER JOIN [Authors] AS [author] ON [Post].[authorId] = [author].[id] AND [author].[name] = 'John')`,
        mssql: `UPDATE [Posts] SET [title]=$sequelize_1 WHERE [Posts].[id] IN (SELECT [Post].[id] FROM [Posts] AS [Post] INNER JOIN [Authors] AS [author] ON [Post].[authorId] = [author].[id] AND [author].[name] = N'John')`,
        oracle: `UPDATE "Posts" SET "title"=$sequelize_1 WHERE "Posts"."id" IN (SELECT "Post"."id" FROM "Posts" "Post" INNER JOIN "Authors" "author" ON "Post"."authorId" = "author"."id" AND "author"."name" = 'John')`,
        db2: `SELECT * FROM FINAL TABLE (UPDATE "Posts" SET "title"=$sequelize_1 WHERE "Posts"."id" IN (SELECT "Post"."id" FROM "Posts" AS "Post" INNER JOIN "Authors" AS "author" ON "Post"."authorId" = "author"."id" AND "author"."name" = 'John'));`,
      });
    });

    it('generates UPDATE with subquery including main table WHERE', () => {
      const { Post } = includeVars;

      const options: any = {
        model: Post,
        include: _validateIncludedElements({
          model: Post,
          include: [{ association: Post.associations.author, where: { name: 'John' } }],
        }).include,
      };

      const result = queryGenerator.updateQuery(
        Post.table,
        { title: 'Updated' },
        { authorId: 1 },
        options,
      );

      expectsql(result.query, {
        default: `UPDATE [Posts] SET [title]=$sequelize_1 WHERE [Posts].[id] IN (SELECT [Post].[id] FROM [Posts] AS [Post] INNER JOIN [Authors] AS [author] ON [Post].[authorId] = [author].[id] AND [author].[name] = 'John' WHERE [authorId] = $sequelize_2)`,
        mssql: `UPDATE [Posts] SET [title]=$sequelize_1 WHERE [Posts].[id] IN (SELECT [Post].[id] FROM [Posts] AS [Post] INNER JOIN [Authors] AS [author] ON [Post].[authorId] = [author].[id] AND [author].[name] = N'John' WHERE [authorId] = $sequelize_2)`,
        oracle: `UPDATE "Posts" SET "title"=$sequelize_1 WHERE "Posts"."id" IN (SELECT "Post"."id" FROM "Posts" "Post" INNER JOIN "Authors" "author" ON "Post"."authorId" = "author"."id" AND "author"."name" = 'John' WHERE "authorId" = $sequelize_2)`,
        db2: `SELECT * FROM FINAL TABLE (UPDATE "Posts" SET "title"=$sequelize_1 WHERE "Posts"."id" IN (SELECT "Post"."id" FROM "Posts" AS "Post" INNER JOIN "Authors" AS "author" ON "Post"."authorId" = "author"."id" AND "author"."name" = 'John' WHERE "authorId" = $sequelize_2));`,
      });
    });

    it('uses LEFT OUTER JOIN when required is false', () => {
      const { Post } = includeVars;

      const options: any = {
        model: Post,
        include: _validateIncludedElements({
          model: Post,
          include: [{ association: Post.associations.author, required: false, where: { name: 'John' } }],
        }).include,
      };

      const result = queryGenerator.updateQuery(Post.table, { title: 'Updated' }, {}, options);

      expectsql(result.query, {
        default: `UPDATE [Posts] SET [title]=$sequelize_1 WHERE [Posts].[id] IN (SELECT [Post].[id] FROM [Posts] AS [Post] LEFT OUTER JOIN [Authors] AS [author] ON [Post].[authorId] = [author].[id] AND [author].[name] = 'John')`,
        mssql: `UPDATE [Posts] SET [title]=$sequelize_1 WHERE [Posts].[id] IN (SELECT [Post].[id] FROM [Posts] AS [Post] LEFT OUTER JOIN [Authors] AS [author] ON [Post].[authorId] = [author].[id] AND [author].[name] = N'John')`,
        oracle: `UPDATE "Posts" SET "title"=$sequelize_1 WHERE "Posts"."id" IN (SELECT "Post"."id" FROM "Posts" "Post" LEFT OUTER JOIN "Authors" "author" ON "Post"."authorId" = "author"."id" AND "author"."name" = 'John')`,
        db2: `SELECT * FROM FINAL TABLE (UPDATE "Posts" SET "title"=$sequelize_1 WHERE "Posts"."id" IN (SELECT "Post"."id" FROM "Posts" AS "Post" LEFT OUTER JOIN "Authors" AS "author" ON "Post"."authorId" = "author"."id" AND "author"."name" = 'John'));`,
      });
    });

    it('still generates normal UPDATE without include', () => {
      const { Post } = includeVars;

      const result = queryGenerator.updateQuery(
        Post.table,
        { title: 'Updated' },
        { id: 1 },
        { model: Post },
      );

      expectsql(result.query, {
        default: `UPDATE [Posts] SET [title]=$sequelize_1 WHERE [id] = $sequelize_2`,
        db2: `SELECT * FROM FINAL TABLE (UPDATE "Posts" SET "title"=$sequelize_1 WHERE "id" = $sequelize_2);`,
      });
    });
  });
});
