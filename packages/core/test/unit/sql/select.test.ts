import type { TableName } from '@sequelize/core';
import { DataTypes, Op } from '@sequelize/core';
import { _validateIncludedElements } from '@sequelize/core/_non-semver-use-at-your-own-risk_/model-internals.js';
import util from 'node:util';
import type { SqlExpectations } from '../../support';
import {
  allowDeprecationsInSuite,
  beforeAll2,
  createSequelizeInstance,
  expectsql,
  sequelize,
} from '../../support';

const queryGenerator = sequelize.queryGenerator;

type SelectQueryOptions = NonNullable<Parameters<typeof queryGenerator.selectQuery>[1]> & {
  table?: TableName;
  // normally set by _validateIncludedElements
  hasMultiAssociation?: boolean;
};

const TICK_LEFT = sequelize.dialect.TICK_CHAR_LEFT;
const TICK_RIGHT = sequelize.dialect.TICK_CHAR_RIGHT;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe('QueryGenerator#selectQuery', () => {
  function expectSelect(options: SelectQueryOptions, expectation: SqlExpectations) {
    const model = options.model;

    return expectsql(
      () => queryGenerator.selectQuery((options.table || model?.table)!, options, options.model),
      expectation,
    );
  }

  const testsql = function (
    options: SelectQueryOptions,
    expectation: SqlExpectations,
    testFunction: Mocha.TestFunction | Mocha.ExclusiveTestFunction = it,
  ) {
    testFunction(util.inspect(options, { depth: 2 }), () => {
      expectSelect(options, expectation);
    });
  };

  testsql.only = (options: SelectQueryOptions, expectation: SqlExpectations) =>
    testsql(options, expectation, it.only);

  testsql(
    {
      table: 'User',
      attributes: ['email', ['first_name', 'firstName']],
      where: {
        email: 'jon.snow@gmail.com',
      },
      order: [['email', 'DESC']],
      limit: 10,
    },
    {
      default:
        "SELECT [email], [first_name] AS [firstName] FROM [User] WHERE [User].[email] = 'jon.snow@gmail.com' ORDER BY [email] DESC LIMIT 10;",
      db2: 'SELECT "email", "first_name" AS "firstName" FROM "User" WHERE "User"."email" = \'jon.snow@gmail.com\' ORDER BY "email" DESC FETCH NEXT 10 ROWS ONLY;',
      mssql:
        "SELECT [email], [first_name] AS [firstName] FROM [User] WHERE [User].[email] = N'jon.snow@gmail.com' ORDER BY [email] DESC OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY;",
      ibmi: 'SELECT "email", "first_name" AS "firstName" FROM "User" WHERE "User"."email" = \'jon.snow@gmail.com\' ORDER BY "email" DESC FETCH NEXT 10 ROWS ONLY',
      oracle: `SELECT "email", "first_name" AS "firstName" FROM "User" WHERE "User"."email" = 'jon.snow@gmail.com' ORDER BY "email" DESC OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY;`,
    },
  );

  testsql(
    {
      table: 'User',
      attributes: ['email', ['first_name', 'firstName'], ['last_name', 'lastName']],
      order: [['last_name', 'ASC']],
      groupedLimit: {
        limit: 3,
        on: 'companyId',
        values: [1, 5],
      },
    },
    {
      default: `SELECT [User].* FROM (${[
        `SELECT * FROM (SELECT [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [User] WHERE [User].[companyId] = 1 ORDER BY [last_name] ASC LIMIT 3) AS sub`,
        `SELECT * FROM (SELECT [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [User] WHERE [User].[companyId] = 5 ORDER BY [last_name] ASC LIMIT 3) AS sub`,
      ].join(sequelize.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ')}) AS [User];`,
      'db2 ibmi': `SELECT [User].* FROM (${[
        `SELECT * FROM (SELECT "email", "first_name" AS "firstName", "last_name" AS "lastName" FROM "User" WHERE "User"."companyId" = 1 ORDER BY "last_name" ASC FETCH NEXT 3 ROWS ONLY) AS sub`,
        `SELECT * FROM (SELECT "email", "first_name" AS "firstName", "last_name" AS "lastName" FROM "User" WHERE "User"."companyId" = 5 ORDER BY "last_name" ASC FETCH NEXT 3 ROWS ONLY) AS sub`,
      ].join(sequelize.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ')}) AS [User];`,
      mssql: `SELECT [User].* FROM (${[
        `SELECT * FROM (SELECT [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [User] WHERE [User].[companyId] = 1 ORDER BY [last_name] ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY) AS sub`,
        `SELECT * FROM (SELECT [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [User] WHERE [User].[companyId] = 5 ORDER BY [last_name] ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY) AS sub`,
      ].join(sequelize.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ')}) AS [User];`,
      oracle: `SELECT "User".* FROM (${[
        `SELECT * FROM (SELECT "email", "first_name" AS "firstName", "last_name" AS "lastName" FROM "User" WHERE "User"."companyId" = 1 ORDER BY "last_name" ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY) sub`,
        `SELECT * FROM (SELECT "email", "first_name" AS "firstName", "last_name" AS "lastName" FROM "User" WHERE "User"."companyId" = 5 ORDER BY "last_name" ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY) sub`,
      ].join(
        sequelize.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ',
      )}) "User" ORDER BY "last_name" ASC;`,
    },
  );

  describe('With BelongsToMany', () => {
    const vars = beforeAll2(() => {
      const User = sequelize.define('user', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          field: 'id_user',
        },
      });

      const Project = sequelize.define('project', {
        title: DataTypes.STRING,
      });

      const ProjectUser = sequelize.define(
        'project_user',
        {
          userId: {
            type: DataTypes.INTEGER,
            field: 'user_id',
          },
          projectId: {
            type: DataTypes.INTEGER,
            field: 'project_id',
          },
        },
        { timestamps: false },
      );

      const userProjects = User.belongsToMany(Project, { through: ProjectUser });
      Project.belongsToMany(User, { through: ProjectUser });

      return { User, Project, ProjectUser, userProjects };
    });

    it('supports groupedLimit', () => {
      const { User } = vars;

      expectSelect(
        {
          model: User,
          attributes: [['id_user', 'id']],
          order: [['last_name', 'ASC']],
          groupedLimit: {
            limit: 3,
            on: vars.userProjects,
            values: [1, 5],
          },
        },
        {
          default: `SELECT [user].* FROM (${[
            `SELECT * FROM (
            SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_user].[user_id] AS [project_user.userId], [project_user].[project_id] AS [project_user.projectId]
            FROM [users] AS [user]
            INNER JOIN [project_users] AS [project_user]
              ON [user].[id_user] = [project_user].[user_id]
              AND [project_user].[project_id] = 1
            ORDER BY [subquery_order_0] ASC LIMIT 3
          ) AS sub`,
            `SELECT * FROM (
            SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_user].[user_id] AS [project_user.userId], [project_user].[project_id] AS [project_user.projectId]
            FROM [users] AS [user]
            INNER JOIN [project_users] AS [project_user]
              ON [user].[id_user] = [project_user].[user_id]
              AND [project_user].[project_id] = 5
            ORDER BY [subquery_order_0] ASC LIMIT 3
          ) AS sub`,
          ].join(
            sequelize.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ',
          )}) AS [user] ORDER BY [subquery_order_0] ASC;`,
          'db2 ibmi': `SELECT [user].* FROM (${[
            `SELECT * FROM (
            SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_user].[user_id] AS [project_user.userId], [project_user].[project_id] AS [project_user.projectId]
            FROM [users] AS [user]
            INNER JOIN [project_users] AS [project_user]
              ON [user].[id_user] = [project_user].[user_id]
              AND [project_user].[project_id] = 1
            ORDER BY [subquery_order_0] ASC FETCH NEXT 3 ROWS ONLY
          ) AS sub`,
            `SELECT * FROM (
            SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_user].[user_id] AS [project_user.userId], [project_user].[project_id] AS [project_user.projectId]
            FROM [users] AS [user]
            INNER JOIN [project_users] AS [project_user]
              ON [user].[id_user] = [project_user].[user_id]
              AND [project_user].[project_id] = 5
            ORDER BY [subquery_order_0] ASC FETCH NEXT 3 ROWS ONLY
          ) AS sub`,
          ].join(
            sequelize.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ',
          )}) AS [user] ORDER BY [subquery_order_0] ASC;`,
          mssql: `SELECT [user].* FROM (${[
            `SELECT * FROM (
            SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_user].[user_id] AS [project_user.userId], [project_user].[project_id] AS [project_user.projectId]
            FROM [users] AS [user]
            INNER JOIN [project_users] AS [project_user]
              ON [user].[id_user] = [project_user].[user_id]
              AND [project_user].[project_id] = 1
            ORDER BY [subquery_order_0] ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY
          ) AS sub`,
            `SELECT * FROM (
            SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_user].[user_id] AS [project_user.userId], [project_user].[project_id] AS [project_user.projectId]
            FROM [users] AS [user]
            INNER JOIN [project_users] AS [project_user]
              ON [user].[id_user] = [project_user].[user_id]
              AND [project_user].[project_id] = 5
            ORDER BY [subquery_order_0] ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY
          ) AS sub`,
          ].join(
            sequelize.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ',
          )}) AS [user] ORDER BY [subquery_order_0] ASC;`,
          oracle: `SELECT "user".* FROM (${[
            `SELECT * FROM (
                SELECT "user"."id_user" AS "id", "user"."last_name" AS "subquery_order_0", "project_user"."user_id" AS "project_user.userId", "project_user"."project_id" AS "project_user.projectId"
                FROM "users" "user"
                INNER JOIN "project_users" "project_user"
                  ON "user"."id_user" = "project_user"."user_id"
                  AND "project_user"."project_id" = 1
                ORDER BY "subquery_order_0" ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY
              ) sub`,
            `SELECT * FROM (
                SELECT "user"."id_user" AS "id", "user"."last_name" AS "subquery_order_0", "project_user"."user_id" AS "project_user.userId", "project_user"."project_id" AS "project_user.projectId"
                FROM "users" "user"
                INNER JOIN "project_users" "project_user"
                  ON "user"."id_user" = "project_user"."user_id"
                  AND "project_user"."project_id" = 5
                ORDER BY "subquery_order_0" ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY
                ) sub`,
          ].join(
            sequelize.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ',
          )}) "user" ORDER BY "subquery_order_0" ASC;`,
        },
      );
    });

    it('supports groupedLimit with through', () => {
      const { User } = vars;

      expectSelect(
        {
          model: User,
          attributes: [['id_user', 'id']],
          order: [['last_name', 'ASC']],
          groupedLimit: {
            limit: 3,
            through: {
              where: {
                status: 1,
              },
            },
            on: vars.userProjects,
            values: [1, 5],
          },
        },
        {
          default: `SELECT [user].* FROM (${[
            `SELECT * FROM (
            SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_user].[user_id] AS [project_user.userId], [project_user].[project_id] AS [project_user.projectId]
            FROM [users] AS [user]
            INNER JOIN [project_users] AS [project_user]
              ON [user].[id_user] = [project_user].[user_id]
              AND ([project_user].[project_id] = 1
              AND [project_user].[status] = 1)
            ORDER BY [subquery_order_0] ASC LIMIT 3
          ) AS sub`,
            `SELECT * FROM (
            SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_user].[user_id] AS [project_user.userId], [project_user].[project_id] AS [project_user.projectId]
            FROM [users] AS [user]
            INNER JOIN [project_users] AS [project_user]
              ON [user].[id_user] = [project_user].[user_id]
              AND ([project_user].[project_id] = 5
              AND [project_user].[status] = 1)
            ORDER BY [subquery_order_0] ASC LIMIT 3
          ) AS sub`,
          ].join(
            sequelize.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ',
          )}) AS [user] ORDER BY [subquery_order_0] ASC;`,
          'db2 ibmi': `SELECT [user].* FROM (${[
            `SELECT * FROM (
            SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_user].[user_id] AS [project_user.userId], [project_user].[project_id] AS [project_user.projectId]
            FROM [users] AS [user]
            INNER JOIN [project_users] AS [project_user]
              ON [user].[id_user] = [project_user].[user_id]
              AND ([project_user].[project_id] = 1
              AND [project_user].[status] = 1)
            ORDER BY [subquery_order_0] ASC FETCH NEXT 3 ROWS ONLY
          ) AS sub`,
            `SELECT * FROM (
            SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_user].[user_id] AS [project_user.userId], [project_user].[project_id] AS [project_user.projectId]
            FROM [users] AS [user]
            INNER JOIN [project_users] AS [project_user]
              ON [user].[id_user] = [project_user].[user_id]
              AND ([project_user].[project_id] = 5
              AND [project_user].[status] = 1)
            ORDER BY [subquery_order_0] ASC FETCH NEXT 3 ROWS ONLY
          ) AS sub`,
          ].join(
            sequelize.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ',
          )}) AS [user] ORDER BY [subquery_order_0] ASC;`,
          mssql: `SELECT [user].* FROM (${[
            `SELECT * FROM (
            SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_user].[user_id] AS [project_user.userId], [project_user].[project_id] AS [project_user.projectId]
            FROM [users] AS [user]
            INNER JOIN [project_users] AS [project_user]
              ON [user].[id_user] = [project_user].[user_id]
              AND ([project_user].[project_id] = 1
              AND [project_user].[status] = 1)
            ORDER BY [subquery_order_0] ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY
          ) AS sub`,
            `SELECT * FROM (
            SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_user].[user_id] AS [project_user.userId], [project_user].[project_id] AS [project_user.projectId]
            FROM [users] AS [user]
            INNER JOIN [project_users] AS [project_user]
              ON [user].[id_user] = [project_user].[user_id]
              AND ([project_user].[project_id] = 5
              AND [project_user].[status] = 1)
            ORDER BY [subquery_order_0] ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY
          ) AS sub`,
          ].join(
            sequelize.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ',
          )}) AS [user] ORDER BY [subquery_order_0] ASC;`,
          oracle: `SELECT "user".* FROM (${[
            `SELECT * FROM (
              SELECT "user"."id_user" AS "id", "user"."last_name" AS "subquery_order_0", "project_user"."user_id" AS "project_user.userId", "project_user"."project_id" AS "project_user.projectId"
              FROM "users" "user"
              INNER JOIN "project_users" "project_user"
                ON "user"."id_user" = "project_user"."user_id"
                AND ("project_user"."project_id" = 1 AND "project_user"."status" = 1)
              ORDER BY "subquery_order_0" ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY
              ) sub`,
            `SELECT * FROM (
                SELECT "user"."id_user" AS "id", "user"."last_name" AS "subquery_order_0", "project_user"."user_id" AS "project_user.userId", "project_user"."project_id" AS "project_user.projectId"
                FROM "users" "user"
                INNER JOIN "project_users" "project_user"
                  ON "user"."id_user" = "project_user"."user_id"
                  AND ("project_user"."project_id" = 5 AND "project_user"."status" = 1)
                ORDER BY "subquery_order_0" ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY
              ) sub`,
          ].join(
            sequelize.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ',
          )}) "user" ORDER BY "subquery_order_0" ASC;`,
        },
      );
    });

    it('supports groupedLimit with through and where', () => {
      const { User } = vars;

      expectSelect(
        {
          model: User,
          attributes: [['id_user', 'id']],
          order: [['id_user', 'ASC']],
          where: {
            age: {
              [Op.gte]: 21,
            },
          },
          groupedLimit: {
            limit: 3,
            on: vars.userProjects,
            values: [1, 5],
          },
        },
        {
          default: `SELECT [user].* FROM (${[
            `SELECT * FROM (
             SELECT [user].[id_user] AS [id], [user].[id_user] AS [subquery_order_0], [project_user].[user_id] AS [project_user.userId], [project_user].[project_id] AS [project_user.projectId]
             FROM [users] AS [user]
             INNER JOIN [project_users] AS [project_user]
               ON [user].[id_user] = [project_user].[user_id]
               AND [project_user].[project_id] = 1
             WHERE [user].[age] >= 21
             ORDER BY [subquery_order_0] ASC LIMIT 3
          ) AS sub`,
            `SELECT * FROM (
            SELECT [user].[id_user] AS [id], [user].[id_user] AS [subquery_order_0], [project_user].[user_id] AS [project_user.userId], [project_user].[project_id] AS [project_user.projectId]
            FROM [users] AS [user]
            INNER JOIN [project_users] AS [project_user]
              ON [user].[id_user] = [project_user].[user_id]
              AND [project_user].[project_id] = 5
            WHERE [user].[age] >= 21
            ORDER BY [subquery_order_0] ASC LIMIT 3
          ) AS sub`,
          ].join(
            sequelize.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ',
          )}) AS [user] ORDER BY [subquery_order_0] ASC;`,
          'db2 ibmi': `SELECT [user].* FROM (${[
            `SELECT * FROM (
             SELECT [user].[id_user] AS [id], [user].[id_user] AS [subquery_order_0], [project_user].[user_id] AS [project_user.userId], [project_user].[project_id] AS [project_user.projectId]
             FROM [users] AS [user]
             INNER JOIN [project_users] AS [project_user]
               ON [user].[id_user] = [project_user].[user_id]
               AND [project_user].[project_id] = 1
             WHERE [user].[age] >= 21
             ORDER BY [subquery_order_0] ASC FETCH NEXT 3 ROWS ONLY
          ) AS sub`,
            `SELECT * FROM (
            SELECT [user].[id_user] AS [id], [user].[id_user] AS [subquery_order_0], [project_user].[user_id] AS [project_user.userId], [project_user].[project_id] AS [project_user.projectId]
            FROM [users] AS [user]
            INNER JOIN [project_users] AS [project_user]
              ON [user].[id_user] = [project_user].[user_id]
              AND [project_user].[project_id] = 5
            WHERE [user].[age] >= 21
            ORDER BY [subquery_order_0] ASC FETCH NEXT 3 ROWS ONLY
          ) AS sub`,
          ].join(
            sequelize.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ',
          )}) AS [user] ORDER BY [subquery_order_0] ASC;`,
          mssql: `SELECT [user].* FROM (${[
            `SELECT * FROM (
             SELECT [user].[id_user] AS [id], [user].[id_user] AS [subquery_order_0], [project_user].[user_id] AS [project_user.userId], [project_user].[project_id] AS [project_user.projectId]
             FROM [users] AS [user]
             INNER JOIN [project_users] AS [project_user]
               ON [user].[id_user] = [project_user].[user_id]
               AND [project_user].[project_id] = 1
             WHERE [user].[age] >= 21
             ORDER BY [subquery_order_0] ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY
          ) AS sub`,
            `SELECT * FROM (
            SELECT [user].[id_user] AS [id], [user].[id_user] AS [subquery_order_0], [project_user].[user_id] AS [project_user.userId], [project_user].[project_id] AS [project_user.projectId]
            FROM [users] AS [user]
            INNER JOIN [project_users] AS [project_user]
              ON [user].[id_user] = [project_user].[user_id]
              AND [project_user].[project_id] = 5
            WHERE [user].[age] >= 21
            ORDER BY [subquery_order_0] ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY
          ) AS sub`,
          ].join(
            sequelize.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ',
          )}) AS [user] ORDER BY [subquery_order_0] ASC;`,
          oracle: `SELECT "user".* FROM (${[
            `SELECT * FROM (
                SELECT "user"."id_user" AS "id", "user"."id_user" AS "subquery_order_0", "project_user"."user_id" AS "project_user.userId", "project_user"."project_id" AS "project_user.projectId"
                FROM "users" "user"
                INNER JOIN "project_users" "project_user"
                  ON "user"."id_user" = "project_user"."user_id"
                  AND "project_user"."project_id" = 1 WHERE "user"."age" >= 21
                ORDER BY "subquery_order_0" ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY
              ) sub`,
            `SELECT * FROM (
                SELECT "user"."id_user" AS "id", "user"."id_user" AS "subquery_order_0", "project_user"."user_id" AS "project_user.userId", "project_user"."project_id" AS "project_user.projectId"
                FROM "users" "user"
                INNER JOIN "project_users" "project_user"
                  ON "user"."id_user" = "project_user"."user_id"
                  AND "project_user"."project_id" = 5
                WHERE "user"."age" >= 21
                ORDER BY "subquery_order_0" ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY
              ) sub`,
          ].join(
            sequelize.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ',
          )}) "user" ORDER BY "subquery_order_0" ASC;`,
        },
      );
    });
  });

  describe('With HasMany', () => {
    const vars = beforeAll2(() => {
      const User = sequelize.define(
        'user',
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            field: 'id_user',
          },
          email: DataTypes.STRING,
          firstName: {
            type: DataTypes.STRING,
            field: 'first_name',
          },
          lastName: {
            type: DataTypes.STRING,
            field: 'last_name',
          },
        },
        {
          tableName: 'users',
        },
      );
      const Post = sequelize.define(
        'Post',
        {
          title: DataTypes.STRING,
          userId: {
            type: DataTypes.INTEGER,
            field: 'user_id',
          },
        },
        {
          tableName: 'post',
        },
      );

      const userPosts = User.hasMany(Post, { foreignKey: 'userId', as: 'POSTS' });

      const Comment = sequelize.define(
        'Comment',
        {
          title: DataTypes.STRING,
          postId: {
            type: DataTypes.INTEGER,
            field: 'post_id',
          },
        },
        {
          tableName: 'comment',
        },
      );

      const postComments = Post.hasMany(Comment, { foreignKey: 'postId', as: 'COMMENTS' });

      const include = _validateIncludedElements({
        include: [
          {
            attributes: ['title'],
            association: userPosts,
          },
        ],
        model: User,
      }).include;

      return { User, Post, include, userPosts, postComments };
    });

    it('supports groupedLimit', () => {
      const { include, User } = vars;

      expectSelect(
        {
          model: User,
          include,
          attributes: [
            ['id_user', 'id'],
            'email',
            ['first_name', 'firstName'],
            ['last_name', 'lastName'],
          ],
          order: [['last_name', 'ASC']],
          groupedLimit: {
            limit: 3,
            on: 'companyId',
            values: [1, 5],
          },
        },
        {
          default: `SELECT [user].*, [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title] FROM (${[
            `SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE [user].[companyId] = 1 ORDER BY [lastName] ASC LIMIT 3) AS sub`,
            `SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE [user].[companyId] = 5 ORDER BY [lastName] ASC LIMIT 3) AS sub`,
          ].join(
            sequelize.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ',
          )}) AS [user] LEFT OUTER JOIN [post] AS [POSTS] ON [user].[id] = [POSTS].[user_id];`,
          'db2 ibmi': `SELECT [user].*, [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title] FROM (${[
            `SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE [user].[companyId] = 1 ORDER BY [lastName] ASC FETCH NEXT 3 ROWS ONLY) AS sub`,
            `SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE [user].[companyId] = 5 ORDER BY [lastName] ASC FETCH NEXT 3 ROWS ONLY) AS sub`,
          ].join(
            sequelize.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ',
          )}) AS [user] LEFT OUTER JOIN [post] AS [POSTS] ON [user].[id] = [POSTS].[user_id];`,
          mssql: `SELECT [user].*, [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title] FROM (${[
            `SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE [user].[companyId] = 1 ORDER BY [lastName] ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY) AS sub`,
            `SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE [user].[companyId] = 5 ORDER BY [lastName] ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY) AS sub`,
          ].join(
            sequelize.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ',
          )}) AS [user] LEFT OUTER JOIN [post] AS [POSTS] ON [user].[id] = [POSTS].[user_id];`,
          oracle: `SELECT "user".*, "POSTS"."id" AS "POSTS.id", "POSTS"."title" AS "POSTS.title" FROM (${[
            `SELECT * FROM (SELECT "id_user" AS "id", "email", "first_name" AS "firstName", "last_name" AS "lastName" FROM "users" "user" WHERE "user"."companyId" = 1 ORDER BY "lastName" ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY) sub`,
            `SELECT * FROM (SELECT "id_user" AS "id", "email", "first_name" AS "firstName", "last_name" AS "lastName" FROM "users" "user" WHERE "user"."companyId" = 5 ORDER BY "lastName" ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY) sub`,
          ].join(
            sequelize.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ',
          )}) "user" LEFT OUTER JOIN "post" "POSTS" ON "user"."id" = "POSTS"."user_id" ORDER BY "lastName" ASC;`,
        },
      );
    });

    it('supports order, limit, offset', () => {
      const { include, User } = vars;

      expectSelect(
        {
          model: User,
          include,
          attributes: [
            ['id_user', 'id'],
            'email',
            ['first_name', 'firstName'],
            ['last_name', 'lastName'],
          ],
          // [last_name] is not wrapped in a literal, so it's a column name and must be escaped
          // as [[[last_name]]]
          order: [
            [
              '[last_name]'
                .replaceAll('[', sequelize.dialect.TICK_CHAR_LEFT)
                .replaceAll(']', sequelize.dialect.TICK_CHAR_RIGHT),
              'ASC',
            ],
          ],
          limit: 30,
          offset: 10,
          hasMultiAssociation: true, // must be set only for mssql dialect here
          subQuery: true,
        },
        {
          default: `SELECT [user].*, [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title] FROM (SELECT [user].[id_user] AS [id], [user].[email], [user].[first_name] AS [firstName], [user].[last_name] AS [lastName] FROM [users] AS [user] ORDER BY [user].${TICK_LEFT}${TICK_LEFT}${TICK_LEFT}last_name${TICK_RIGHT}${TICK_RIGHT}${TICK_RIGHT} ASC LIMIT 30 OFFSET 10) AS [user] LEFT OUTER JOIN [post] AS [POSTS] ON [user].[id_user] = [POSTS].[user_id] ORDER BY [user].${TICK_LEFT}${TICK_LEFT}${TICK_LEFT}last_name${TICK_RIGHT}${TICK_RIGHT}${TICK_RIGHT} ASC;`,
          'db2 ibmi mssql': `SELECT [user].*, [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title] FROM (SELECT [user].[id_user] AS [id], [user].[email], [user].[first_name] AS [firstName], [user].[last_name] AS [lastName] FROM [users] AS [user] ORDER BY [user].${TICK_LEFT}${TICK_LEFT}${TICK_LEFT}last_name${TICK_RIGHT}${TICK_RIGHT}${TICK_RIGHT} ASC OFFSET 10 ROWS FETCH NEXT 30 ROWS ONLY) AS [user] LEFT OUTER JOIN [post] AS [POSTS] ON [user].[id_user] = [POSTS].[user_id] ORDER BY [user].${TICK_LEFT}${TICK_LEFT}${TICK_LEFT}last_name${TICK_RIGHT}${TICK_RIGHT}${TICK_RIGHT} ASC;`,
          oracle: `SELECT "user".*, "POSTS"."id" AS "POSTS.id", "POSTS"."title" AS "POSTS.title" FROM (SELECT "user"."id_user" AS "id", "user"."email", "user"."first_name" AS "firstName", "user"."last_name" AS "lastName" FROM "users" "user" ORDER BY "user".${TICK_LEFT}${TICK_LEFT}${TICK_LEFT}last_name${TICK_RIGHT}${TICK_RIGHT}${TICK_RIGHT} ASC OFFSET 10 ROWS FETCH NEXT 30 ROWS ONLY) "user" LEFT OUTER JOIN "post" "POSTS" ON "user"."id_user" = "POSTS"."user_id" ORDER BY "user".${TICK_LEFT}${TICK_LEFT}${TICK_LEFT}last_name${TICK_RIGHT}${TICK_RIGHT}${TICK_RIGHT} ASC;`,
        },
      );
    });

    it('supports order, limit, offset without subQuery', () => {
      const { include, User } = vars;

      // By default, SELECT with include of a multi association & limit will be ran as a subQuery
      //  This checks the result when the query is forced to be ran without a subquery
      expectSelect(
        {
          model: User,
          include,
          attributes: [
            ['id_user', 'id'],
            'email',
            ['first_name', 'firstName'],
            ['last_name', 'lastName'],
          ],
          // [last_name] is not wrapped in a literal, so it's a column name and must be escaped
          // as [[[last_name]]]
          order: [
            [
              '[last_name]'
                .replaceAll('[', sequelize.dialect.TICK_CHAR_LEFT)
                .replaceAll(']', sequelize.dialect.TICK_CHAR_RIGHT),
              'ASC',
            ],
          ],
          limit: 30,
          offset: 10,
          hasMultiAssociation: true, // must be set only for mssql dialect here
          subQuery: false,
        },
        {
          default: `SELECT [user].[id_user] AS [id], [user].[email], [user].[first_name] AS [firstName], [user].[last_name] AS [lastName], [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title]
        FROM [users] AS [user] LEFT OUTER JOIN [post] AS [POSTS]
        ON [user].[id_user] = [POSTS].[user_id]
        ORDER BY [user].${TICK_LEFT}${TICK_LEFT}${TICK_LEFT}last_name${TICK_RIGHT}${TICK_RIGHT}${TICK_RIGHT} ASC LIMIT 30 OFFSET 10;`,
          'db2 ibmi mssql': `SELECT [user].[id_user] AS [id], [user].[email], [user].[first_name] AS [firstName], [user].[last_name] AS [lastName], [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title]
        FROM [users] AS [user] LEFT OUTER JOIN [post] AS [POSTS]
        ON [user].[id_user] = [POSTS].[user_id]
        ORDER BY [user].${TICK_LEFT}${TICK_LEFT}${TICK_LEFT}last_name${TICK_RIGHT}${TICK_RIGHT}${TICK_RIGHT} ASC OFFSET 10 ROWS FETCH NEXT 30 ROWS ONLY;`,
          oracle: `SELECT "user"."id_user" AS "id", "user"."email", "user"."first_name" AS "firstName", "user"."last_name" AS "lastName", "POSTS"."id" AS "POSTS.id", "POSTS"."title" AS "POSTS.title"
        FROM "users" "user" LEFT OUTER JOIN "post" "POSTS"
        ON "user"."id_user" = "POSTS"."user_id"
        ORDER BY "user".${TICK_LEFT}${TICK_LEFT}${TICK_LEFT}last_name${TICK_RIGHT}${TICK_RIGHT}${TICK_RIGHT} ASC OFFSET 10 ROWS FETCH NEXT 30 ROWS ONLY;`,
        },
      );
    });

    it('supports nested includes', () => {
      const { User } = vars;
      const nestedInclude = _validateIncludedElements({
        include: [
          {
            attributes: ['title'],
            association: vars.userPosts,
            include: [
              {
                attributes: ['title'],
                association: vars.postComments,
              },
            ],
          },
        ],
        model: User,
      }).include;

      expectSelect(
        {
          model: User,
          include: nestedInclude,
          attributes: [
            ['id_user', 'id'],
            'email',
            ['first_name', 'firstName'],
            ['last_name', 'lastName'],
          ],
          order: [['last_name', 'ASC']],
          groupedLimit: {
            limit: 3,
            on: 'companyId',
            values: [1, 5],
          },
        },
        {
          default: `SELECT [user].*, [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title], [POSTS->COMMENTS].[id] AS [POSTS.COMMENTS.id], [POSTS->COMMENTS].[title] AS [POSTS.COMMENTS.title] FROM (${[
            `SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE [user].[companyId] = 1 ORDER BY [lastName] ASC LIMIT 3) AS sub`,
            `SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE [user].[companyId] = 5 ORDER BY [lastName] ASC LIMIT 3) AS sub`,
          ].join(
            sequelize.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ',
          )}) AS [user] LEFT OUTER JOIN [post] AS [POSTS] ON [user].[id] = [POSTS].[user_id] LEFT OUTER JOIN [comment] AS [POSTS->COMMENTS] ON [POSTS].[id] = [POSTS->COMMENTS].[post_id];`,
          'db2 ibmi': `SELECT [user].*, [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title], [POSTS->COMMENTS].[id] AS [POSTS.COMMENTS.id], [POSTS->COMMENTS].[title] AS [POSTS.COMMENTS.title] FROM (${[
            `SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE [user].[companyId] = 1 ORDER BY [lastName] ASC FETCH NEXT 3 ROWS ONLY) AS sub`,
            `SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE [user].[companyId] = 5 ORDER BY [lastName] ASC FETCH NEXT 3 ROWS ONLY) AS sub`,
          ].join(
            sequelize.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ',
          )}) AS [user] LEFT OUTER JOIN [post] AS [POSTS] ON [user].[id] = [POSTS].[user_id] LEFT OUTER JOIN [comment] AS [POSTS->COMMENTS] ON [POSTS].[id] = [POSTS->COMMENTS].[post_id];`,
          mssql: `SELECT [user].*, [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title], [POSTS->COMMENTS].[id] AS [POSTS.COMMENTS.id], [POSTS->COMMENTS].[title] AS [POSTS.COMMENTS.title] FROM (${[
            `SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE [user].[companyId] = 1 ORDER BY [lastName] ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY) AS sub`,
            `SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE [user].[companyId] = 5 ORDER BY [lastName] ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY) AS sub`,
          ].join(
            sequelize.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ',
          )}) AS [user] LEFT OUTER JOIN [post] AS [POSTS] ON [user].[id] = [POSTS].[user_id] LEFT OUTER JOIN [comment] AS [POSTS->COMMENTS] ON [POSTS].[id] = [POSTS->COMMENTS].[post_id];`,
          oracle: `SELECT "user".*, "POSTS"."id" AS "POSTS.id", "POSTS"."title" AS "POSTS.title", "POSTS->COMMENTS"."id" AS "POSTS.COMMENTS.id", "POSTS->COMMENTS"."title" AS "POSTS.COMMENTS.title" FROM (${[
            `SELECT * FROM (SELECT "id_user" AS "id", "email", "first_name" AS "firstName", "last_name" AS "lastName" FROM "users" "user" WHERE "user"."companyId" = 1 ORDER BY "lastName" ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY) sub`,
            `SELECT * FROM (SELECT "id_user" AS "id", "email", "first_name" AS "firstName", "last_name" AS "lastName" FROM "users" "user" WHERE "user"."companyId" = 5 ORDER BY "lastName" ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY) sub`,
          ].join(
            sequelize.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ',
          )}) "user" LEFT OUTER JOIN "post" "POSTS" ON "user"."id" = "POSTS"."user_id" LEFT OUTER JOIN "comment" "POSTS->COMMENTS" ON "POSTS"."id" = "POSTS->COMMENTS"."post_id" ORDER BY "lastName" ASC;`,
        },
      );
    });
  });

  it('include (left outer join)', () => {
    const User = sequelize.define(
      'User',
      {
        name: DataTypes.STRING,
        age: DataTypes.INTEGER,
      },
      {
        freezeTableName: true,
      },
    );
    const Post = sequelize.define(
      'Post',
      {
        title: DataTypes.STRING,
      },
      {
        freezeTableName: true,
      },
    );

    const userPosts = User.hasMany(Post, { foreignKey: 'user_id' });

    expectsql(
      queryGenerator.selectQuery(
        'User',
        {
          attributes: ['name', 'age'],
          include: _validateIncludedElements({
            include: [
              {
                attributes: ['title'],
                association: userPosts,
              },
            ],
            model: User,
          }).include,
          model: User,
        },
        User,
      ),
      {
        ibmi: 'SELECT "User"."name", "User"."age", "posts"."id" AS "posts.id", "posts"."title" AS "posts.title" FROM "User" AS "User" LEFT OUTER JOIN "Post" AS "posts" ON "User"."id" = "posts"."user_id"',
        oracle: `SELECT "User"."name", "User"."age", "posts"."id" AS "posts.id", "posts"."title" AS "posts.title" FROM "User" "User" LEFT OUTER JOIN "Post" "posts" ON "User"."id" = "posts"."user_id";`,
        default:
          'SELECT [User].[name], [User].[age], [posts].[id] AS [posts.id], [posts].[title] AS [posts.title] FROM [User] AS [User] LEFT OUTER JOIN [Post] AS [posts] ON [User].[id] = [posts].[user_id];',
      },
    );
  });

  it('include (right outer join)', () => {
    const User = sequelize.define(
      'User',
      {
        name: DataTypes.STRING,
        age: DataTypes.INTEGER,
      },
      {
        freezeTableName: true,
      },
    );
    const Post = sequelize.define(
      'Post',
      {
        title: DataTypes.STRING,
      },
      {
        freezeTableName: true,
      },
    );

    const userPosts = User.hasMany(Post, { foreignKey: 'user_id' });

    expectsql(
      queryGenerator.selectQuery(
        'User',
        {
          attributes: ['name', 'age'],
          include: _validateIncludedElements({
            include: [
              {
                attributes: ['title'],
                association: userPosts,
                right: true,
              },
            ],
            model: User,
          }).include,
          model: User,
        },
        User,
      ),
      {
        default: `SELECT [User].[name], [User].[age], [posts].[id] AS [posts.id], [posts].[title] AS [posts.title] FROM [User] AS [User] ${sequelize.dialect.supports['RIGHT JOIN'] ? 'RIGHT' : 'LEFT'} OUTER JOIN [Post] AS [posts] ON [User].[id] = [posts].[user_id];`,
        oracle: `SELECT "User"."name", "User"."age", "posts"."id" AS "posts.id", "posts"."title" AS "posts.title" FROM "User" "User" ${sequelize.dialect.supports['RIGHT JOIN'] ? 'RIGHT' : 'LEFT'} OUTER JOIN "Post" "posts" ON "User"."id" = "posts"."user_id";`,
      },
    );
  });

  it('include through (right outer join)', () => {
    const User = sequelize.define('user', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id_user',
      },
    });
    const Project = sequelize.define('project', {
      title: DataTypes.STRING,
    });

    const ProjectUser = sequelize.define(
      'project_user',
      {
        userId: {
          type: DataTypes.INTEGER,
          field: 'user_id',
        },
        projectId: {
          type: DataTypes.INTEGER,
          field: 'project_id',
        },
      },
      { timestamps: false },
    );

    User.belongsToMany(Project, { through: ProjectUser });
    Project.belongsToMany(User, { through: ProjectUser });

    expectsql(
      queryGenerator.selectQuery(
        'User',
        {
          attributes: ['id_user', 'id'],
          include: _validateIncludedElements({
            include: [
              {
                model: Project,
                right: true,
              },
            ],
            model: User,
          }).include,
          model: User,
          // the order here is important, because a different piece of code is responsible for naming the through table name in ORDER BY
          //  than in LEFT JOIN
          order: [['projects', ProjectUser, 'userId', 'ASC']],
        },
        User,
      ),
      {
        default: `
        SELECT [user].[id_user],
               [user].[id],
               [projects].[id] AS [projects.id],
               [projects].[title] AS [projects.title],
               [projects].[createdAt] AS [projects.createdAt],
               [projects].[updatedAt] AS [projects.updatedAt],
               [projects->project_user].[user_id] AS [projects.project_user.userId],
               [projects->project_user].[project_id] AS [projects.project_user.projectId]
        FROM [User] AS [user]
        ${sequelize.dialect.supports['RIGHT JOIN'] ? 'RIGHT' : 'LEFT'} OUTER JOIN (
          [project_users] AS [projects->project_user]
          INNER JOIN [projects] AS [projects]
            ON [projects].[id] = [projects->project_user].[project_id]
        )
          ON [user].[id_user] = [projects->project_user].[user_id]
          ORDER BY [projects->project_user].[user_id] ASC;`,
        oracle: `
        SELECT "user"."id_user",
                "user"."id",
                "projects"."id" AS "projects.id",
                "projects"."title" AS "projects.title",
                "projects"."createdAt" AS "projects.createdAt",
                "projects"."updatedAt" AS "projects.updatedAt",
                "projects->project_user"."user_id" AS "projects.project_user.userId",
                "projects->project_user"."project_id" AS "projects.project_user.projectId"
        FROM "User" "user"
        ${sequelize.dialect.supports['RIGHT JOIN'] ? 'RIGHT' : 'LEFT'} OUTER JOIN (
          "project_users" "projects->project_user"
          INNER JOIN "projects" "projects"
            ON "projects"."id" = "projects->project_user"."project_id"
        )
          ON "user"."id_user" = "projects->project_user"."user_id"
          ORDER BY "projects->project_user"."user_id" ASC;`,
      },
    );
  });

  describe('include (subQuery alias)', () => {
    const vars = beforeAll2(() => {
      const User = sequelize.define(
        'User',
        {
          name: DataTypes.STRING,
          age: DataTypes.INTEGER,
        },
        {
          freezeTableName: true,
        },
      );

      const Post = sequelize.define(
        'Post',
        {
          title: DataTypes.STRING,
        },
        {
          freezeTableName: true,
        },
      );

      const userPosts = User.hasMany(Post, { foreignKey: 'user_id', as: 'postaliasname' });

      return { User, userPosts };
    });

    it('w/o filters', () => {
      const { User } = vars;

      expectsql(
        queryGenerator.selectQuery(
          'User',
          {
            model: User,
            attributes: ['name', 'age'],
            include: _validateIncludedElements({
              model: User,
              include: [
                {
                  attributes: ['title'],
                  association: vars.userPosts,
                  subQuery: true,
                  required: true,
                },
              ],
              as: 'User',
            }).include,
            subQuery: true,
          },
          User,
        ),
        {
          default:
            'SELECT [User].* FROM ' +
            '(SELECT [User].[name], [User].[age], [User].[id], [postaliasname].[id] AS [postaliasname.id], [postaliasname].[title] AS [postaliasname.title] FROM [User] AS [User] ' +
            'INNER JOIN [Post] AS [postaliasname] ON [User].[id] = [postaliasname].[user_id] ' +
            `WHERE EXISTS ( SELECT [user_id] FROM [Post] AS [postaliasname] WHERE [postaliasname].[user_id] = [User].[id]) ) AS [User];`,
          oracle:
            `SELECT "User".* FROM ` +
            `(SELECT "User"."name", "User"."age", "User"."id", "postaliasname"."id" AS "postaliasname.id", "postaliasname"."title" AS "postaliasname.title" FROM "User" "User" ` +
            `INNER JOIN "Post" "postaliasname" ON "User"."id" = "postaliasname"."user_id" ` +
            `WHERE EXISTS (SELECT "user_id" FROM "Post" "postaliasname" WHERE "postaliasname"."user_id" = "User"."id")) "User";`,
        },
      );
    });

    it('w/ nested column filter', () => {
      const { User } = vars;

      expectsql(
        () =>
          queryGenerator.selectQuery(
            'User',
            {
              model: User,
              attributes: ['name', 'age'],
              where: { '$postaliasname.title$': 'test' },
              include: _validateIncludedElements({
                model: User,
                include: [
                  {
                    attributes: ['title'],
                    association: vars.userPosts,
                    subQuery: true,
                    required: true,
                  },
                ],
                as: 'User',
              }).include,
              subQuery: true,
            },
            User,
          ),
        {
          default:
            'SELECT [User].* FROM ' +
            '(SELECT [User].[name], [User].[age], [User].[id], [postaliasname].[id] AS [postaliasname.id], [postaliasname].[title] AS [postaliasname.title] FROM [User] AS [User] ' +
            'INNER JOIN [Post] AS [postaliasname] ON [User].[id] = [postaliasname].[user_id] ' +
            `WHERE [postaliasname].[title] = ${queryGenerator.escape('test')} AND EXISTS ( SELECT [user_id] FROM [Post] AS [postaliasname] WHERE [postaliasname].[user_id] = [User].[id]) ) AS [User];`,
          oracle:
            `SELECT "User".* FROM ` +
            `(SELECT "User"."name", "User"."age", "User"."id", "postaliasname"."id" AS "postaliasname.id", "postaliasname"."title" AS "postaliasname.title" FROM "User" "User" ` +
            `INNER JOIN "Post" "postaliasname" ON "User"."id" = "postaliasname"."user_id" ` +
            `WHERE "postaliasname"."title" = 'test' AND EXISTS (SELECT "user_id" FROM "Post" "postaliasname" WHERE "postaliasname"."user_id" = "User"."id")) "User";`,
        },
      );
    });
  });

  it('include w/ subQuery + nested filter + paging', () => {
    const User = sequelize.define('User', {
      scopeId: DataTypes.INTEGER,
    });

    const Company = sequelize.define('Company', {
      name: DataTypes.STRING,
      public: DataTypes.BOOLEAN,
      scopeId: DataTypes.INTEGER,
    });

    const Profession = sequelize.define('Profession', {
      name: DataTypes.STRING,
      scopeId: DataTypes.INTEGER,
    });

    User.belongsTo(Company, { foreignKey: 'companyId' });
    const userProfession = User.belongsTo(Profession, { foreignKey: 'professionId' });
    const companyUsers = Company.hasMany(User, { as: 'Users', foreignKey: 'companyId' });
    Profession.hasMany(User, { as: 'Users', foreignKey: 'professionId' });

    expectsql(
      queryGenerator.selectQuery(
        'Company',
        {
          model: Company,
          attributes: ['name', 'public'],
          where: { '$Users.profession.name$': 'test', [Op.and]: { scopeId: [42] } },
          include: _validateIncludedElements({
            include: [
              {
                association: companyUsers,
                attributes: [],
                include: [
                  {
                    association: userProfession,
                    attributes: [],
                    required: true,
                  },
                ],
                subQuery: true,
                required: true,
              },
            ],
            model: Company,
          }).include,
          limit: 5,
          offset: 0,
          subQuery: true,
        },
        Company,
      ),
      {
        default:
          'SELECT [Company].* FROM (' +
          'SELECT [Company].[name], [Company].[public], [Company].[id] FROM [Company] AS [Company] ' +
          'INNER JOIN [Users] AS [Users] ON [Company].[id] = [Users].[companyId] ' +
          'INNER JOIN [Professions] AS [Users->profession] ON [Users].[professionId] = [Users->profession].[id] ' +
          `WHERE ([Company].[scopeId] IN (42) AND [Users->profession].[name] = ${queryGenerator.escape('test')}) AND ` +
          'EXISTS ( SELECT [Users].[companyId] FROM [Users] AS [Users] ' +
          'INNER JOIN [Professions] AS [profession] ON [Users].[professionId] = [profession].[id] ' +
          `WHERE [Users].[companyId] = [Company].[id] ) ORDER BY [Company].[id] LIMIT 5) AS [Company];`,
        'db2 ibmi':
          'SELECT [Company].* FROM (' +
          'SELECT [Company].[name], [Company].[public], [Company].[id] FROM [Company] AS [Company] ' +
          'INNER JOIN [Users] AS [Users] ON [Company].[id] = [Users].[companyId] ' +
          'INNER JOIN [Professions] AS [Users->profession] ON [Users].[professionId] = [Users->profession].[id] ' +
          `WHERE ([Company].[scopeId] IN (42) AND [Users->profession].[name] = ${queryGenerator.escape('test')}) AND ` +
          'EXISTS ( SELECT [Users].[companyId] FROM [Users] AS [Users] ' +
          'INNER JOIN [Professions] AS [profession] ON [Users].[professionId] = [profession].[id] ' +
          `WHERE [Users].[companyId] = [Company].[id] ) ` +
          `ORDER BY [Company].[id] FETCH NEXT 5 ROWS ONLY) AS [Company];`,
        mssql:
          'SELECT [Company].* FROM (' +
          'SELECT [Company].[name], [Company].[public], [Company].[id] FROM [Company] AS [Company] ' +
          'INNER JOIN [Users] AS [Users] ON [Company].[id] = [Users].[companyId] ' +
          'INNER JOIN [Professions] AS [Users->profession] ON [Users].[professionId] = [Users->profession].[id] ' +
          `WHERE ([Company].[scopeId] IN (42) AND [Users->profession].[name] = ${queryGenerator.escape('test')}) AND ` +
          'EXISTS ( SELECT [Users].[companyId] FROM [Users] AS [Users] ' +
          'INNER JOIN [Professions] AS [profession] ON [Users].[professionId] = [profession].[id] ' +
          `WHERE [Users].[companyId] = [Company].[id] ) ` +
          `ORDER BY [Company].[id] OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY) AS [Company];`,
        oracle:
          `SELECT "Company".* FROM (` +
          `SELECT "Company"."name", "Company"."public", "Company"."id" FROM "Company" "Company" ` +
          `INNER JOIN "Users" "Users" ON "Company"."id" = "Users"."companyId" ` +
          `INNER JOIN "Professions" "Users->profession" ON "Users"."professionId" = "Users->profession"."id" ` +
          `WHERE ("Company"."scopeId" IN (42) AND "Users->profession"."name" = 'test') AND EXISTS (` +
          `SELECT "Users"."companyId" FROM "Users" "Users" ` +
          `INNER JOIN "Professions" "profession" ON "Users"."professionId" = "profession"."id" ` +
          `WHERE "Users"."companyId" = "Company"."id"` +
          `) ORDER BY "Company"."id" OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY) "Company";`,
      },
    );
  });

  it('properly stringify IN values as per field definition', () => {
    const User = sequelize.define(
      'User',
      {
        name: DataTypes.STRING,
        age: DataTypes.INTEGER,
        data: DataTypes.BLOB,
      },
      {
        freezeTableName: true,
      },
    );

    expectsql(
      queryGenerator.selectQuery(
        'User',
        {
          attributes: ['name', 'age', 'data'],
          where: {
            data: ['123'],
          },
        },
        User,
      ),
      {
        ibmi: `SELECT "name", "age", "data" FROM "User" AS "User" WHERE "User"."data" IN (BLOB(X'313233'))`,
        db2: `SELECT "name", "age", "data" FROM "User" AS "User" WHERE "User"."data" IN (BLOB('123'));`,
        postgres: `SELECT "name", "age", "data" FROM "User" AS "User" WHERE "User"."data" IN ('\\x313233');`,
        snowflake: `SELECT "name", "age", "data" FROM "User" AS "User" WHERE "User"."data" IN (X'313233');`,
        'mariadb mysql sqlite3':
          "SELECT `name`, `age`, `data` FROM `User` AS `User` WHERE `User`.`data` IN (X'313233');",
        mssql:
          'SELECT [name], [age], [data] FROM [User] AS [User] WHERE [User].[data] IN (0x313233);',
        oracle: `SELECT "name", "age", "data" FROM "User" "User" WHERE "User"."data" IN ('313233');`,
      },
    );
  });

  describe('attribute escaping', () => {
    it('plain attributes (1)', () => {
      expectsql(
        queryGenerator.selectQuery('User', {
          attributes: [
            '* FROM [User];'
              .replaceAll('[', sequelize.dialect.TICK_CHAR_LEFT)
              .replaceAll(']', sequelize.dialect.TICK_CHAR_RIGHT),
          ],
        }),
        {
          default: `SELECT ${TICK_LEFT}* FROM ${TICK_LEFT}${TICK_LEFT}User${TICK_RIGHT}${TICK_RIGHT};${TICK_RIGHT} FROM ${TICK_LEFT}User${TICK_RIGHT};`,
        },
      );
    });

    it('plain attributes (2)', () => {
      expectsql(
        queryGenerator.selectQuery('User', {
          attributes: ['* FROM User; DELETE FROM User;SELECT id'],
        }),
        {
          default: 'SELECT [* FROM User; DELETE FROM User;SELECT id] FROM [User];',
          ibmi: 'SELECT "* FROM User; DELETE FROM User;SELECT id" FROM "User"',
        },
      );
    });

    it('plain attributes (3)', () => {
      expectsql(
        queryGenerator.selectQuery('User', {
          attributes: [`a', * FROM User; DELETE FROM User;SELECT id`],
        }),
        {
          default: `SELECT [a', * FROM User; DELETE FROM User;SELECT id] FROM [User];`,
          mssql: `SELECT [a', * FROM User; DELETE FROM User;SELECT id] FROM [User];`,
          ibmi: `SELECT "a', * FROM User; DELETE FROM User;SELECT id" FROM "User"`,
        },
      );
    });

    it('plain attributes (4)', () => {
      expectsql(
        queryGenerator.selectQuery('User', {
          attributes: ['*, COUNT(*) FROM User; DELETE FROM User;SELECT id'],
        }),
        {
          default: 'SELECT [*, COUNT(*) FROM User; DELETE FROM User;SELECT id] FROM [User];',
          ibmi: 'SELECT "*, COUNT(*) FROM User; DELETE FROM User;SELECT id" FROM "User"',
        },
      );
    });

    it('aliased attributes (1)', () => {
      expectsql(
        queryGenerator.selectQuery('User', {
          attributes: [
            // this is not wrapped in `literal()`, so it's a column name.
            // [ & ] will be escaped as [[ & ]]
            [
              '* FROM [User]; DELETE FROM [User];SELECT [id]'
                .replaceAll('[', sequelize.dialect.TICK_CHAR_LEFT)
                .replaceAll(']', sequelize.dialect.TICK_CHAR_RIGHT),
              'myCol',
            ],
          ],
        }),
        {
          default: `SELECT [* FROM ${TICK_LEFT}${TICK_LEFT}User${TICK_RIGHT}${TICK_RIGHT}; DELETE FROM ${TICK_LEFT}${TICK_LEFT}User${TICK_RIGHT}${TICK_RIGHT};SELECT ${TICK_LEFT}${TICK_LEFT}id${TICK_RIGHT}${TICK_RIGHT}${TICK_RIGHT} AS ${TICK_LEFT}myCol] FROM [User];`,
          ibmi: 'SELECT "* FROM ""User""; DELETE FROM ""User"";SELECT ""id""" AS "myCol" FROM "User"',
        },
      );
    });

    it('aliased attributes (2)', () => {
      expectsql(
        queryGenerator.selectQuery('User', {
          attributes: [['* FROM User; DELETE FROM User;SELECT id', 'myCol']],
        }),
        {
          default: 'SELECT [* FROM User; DELETE FROM User;SELECT id] AS [myCol] FROM [User];',
          ibmi: 'SELECT "* FROM User; DELETE FROM User;SELECT id" AS "myCol" FROM "User"',
        },
      );
    });

    it('aliased attributes (3)', () => {
      expectsql(
        queryGenerator.selectQuery('User', {
          attributes: [['id', '* FROM User; DELETE FROM User;SELECT id']],
        }),
        {
          default: 'SELECT [id] AS [* FROM User; DELETE FROM User;SELECT id] FROM [User];',
          ibmi: 'SELECT "id" AS "* FROM User; DELETE FROM User;SELECT id" FROM "User"',
        },
      );
    });

    it('attributes from includes', () => {
      const User = sequelize.define(
        'User',
        {
          name: DataTypes.STRING,
          age: DataTypes.INTEGER,
        },
        {
          freezeTableName: true,
        },
      );
      const Post = sequelize.define(
        'Post',
        {
          title: DataTypes.STRING,
        },
        {
          freezeTableName: true,
        },
      );

      // association name is Pascal case to test quoteIdentifier: false
      const userPosts = User.hasMany(Post, { foreignKey: 'user_id', as: 'Posts' });

      expectsql(
        queryGenerator.selectQuery(
          'User',
          {
            attributes: ['name', 'age'],
            include: _validateIncludedElements({
              include: [
                {
                  attributes: [
                    // this is not wrapped in `literal()`, so it's a column name.
                    // [ & ] will be escaped as [[ & ]]
                    '* FROM [User]; DELETE FROM [User];SELECT [id]'
                      .replaceAll('[', TICK_LEFT)
                      .replaceAll(']', TICK_RIGHT),
                  ],
                  association: userPosts,
                },
              ],
              model: User,
            }).include,
            model: User,
          },
          User,
        ),
        {
          // expectsql fails with consecutive TICKS so we add the dialect-specific one ourself
          default: `SELECT [User].[name], [User].[age], [Posts].[id] AS [Posts.id], [Posts].[* FROM ${TICK_LEFT}${TICK_LEFT}User${TICK_RIGHT}${TICK_RIGHT}; DELETE FROM ${TICK_LEFT}${TICK_LEFT}User${TICK_RIGHT}${TICK_RIGHT};SELECT ${TICK_LEFT}${TICK_LEFT}id${TICK_RIGHT}${TICK_RIGHT}${TICK_RIGHT} AS ${TICK_LEFT}Posts.* FROM ${TICK_LEFT}${TICK_LEFT}User${TICK_RIGHT}${TICK_RIGHT}; DELETE FROM ${TICK_LEFT}${TICK_LEFT}User${TICK_RIGHT}${TICK_RIGHT};SELECT ${TICK_LEFT}${TICK_LEFT}id${TICK_RIGHT}${TICK_RIGHT}${TICK_RIGHT} FROM ${TICK_LEFT}User] AS [User] LEFT OUTER JOIN [Post] AS [Posts] ON [User].[id] = [Posts].[user_id];`,
          ibmi: 'SELECT "User"."name", "User"."age", "Posts"."id" AS "Posts.id", "Posts"."* FROM ""User""; DELETE FROM ""User"";SELECT ""id""" AS "Posts.* FROM ""User""; DELETE FROM ""User"";SELECT ""id""" FROM "User" AS "User" LEFT OUTER JOIN "Post" AS "Posts" ON "User"."id" = "Posts"."user_id"',
          oracle: `SELECT "User"."name", "User"."age", "Posts"."id" AS "Posts.id", "Posts"."* FROM ${TICK_LEFT}${TICK_LEFT}User${TICK_RIGHT}${TICK_RIGHT}; DELETE FROM ${TICK_LEFT}${TICK_LEFT}User${TICK_RIGHT}${TICK_RIGHT};SELECT ${TICK_LEFT}${TICK_LEFT}id${TICK_RIGHT}${TICK_RIGHT}${TICK_RIGHT} AS ${TICK_LEFT}Posts.* FROM ${TICK_LEFT}${TICK_LEFT}User${TICK_RIGHT}${TICK_RIGHT}; DELETE FROM ${TICK_LEFT}${TICK_LEFT}User${TICK_RIGHT}${TICK_RIGHT};SELECT ${TICK_LEFT}${TICK_LEFT}id${TICK_RIGHT}${TICK_RIGHT}${TICK_RIGHT} FROM ${TICK_LEFT}User" "User" LEFT OUTER JOIN "Post" "Posts" ON "User"."id" = "Posts"."user_id";`,
        },
      );

      expectsql(
        queryGenerator.selectQuery(
          'User',
          {
            attributes: ['name', 'age'],
            include: _validateIncludedElements({
              include: [
                {
                  attributes: [
                    // this is not wrapped in `literal()`, so it's a column name.
                    // [ & ] will be escaped as [[ & ]]
                    [
                      '* FROM [User]; DELETE FROM [User];SELECT [id]'
                        .replaceAll('[', sequelize.dialect.TICK_CHAR_LEFT)
                        .replaceAll(']', sequelize.dialect.TICK_CHAR_RIGHT),
                      'data',
                    ],
                  ],
                  association: userPosts,
                },
              ],
              model: User,
            }).include,
            model: User,
          },
          User,
        ),
        {
          // expectsql fails with consecutive TICKS so we add the dialect-specific one ourself
          default: `SELECT [User].[name], [User].[age], [Posts].[id] AS [Posts.id], [Posts].[* FROM ${TICK_LEFT}${TICK_LEFT}User${TICK_RIGHT}${TICK_RIGHT}; DELETE FROM ${TICK_LEFT}${TICK_LEFT}User${TICK_RIGHT}${TICK_RIGHT};SELECT ${TICK_LEFT}${TICK_LEFT}id${TICK_RIGHT}${TICK_RIGHT}${TICK_RIGHT} AS ${TICK_LEFT}Posts.data] FROM [User] AS [User] LEFT OUTER JOIN [Post] AS [Posts] ON [User].[id] = [Posts].[user_id];`,
          ibmi: 'SELECT "User"."name", "User"."age", "Posts"."id" AS "Posts.id", "Posts"."* FROM ""User""; DELETE FROM ""User"";SELECT ""id""" AS "Posts.data" FROM "User" AS "User" LEFT OUTER JOIN "Post" AS "Posts" ON "User"."id" = "Posts"."user_id"',
          oracle: `SELECT "User"."name", "User"."age", "Posts"."id" AS "Posts.id", "Posts"."* FROM ${TICK_LEFT}${TICK_LEFT}User${TICK_RIGHT}${TICK_RIGHT}; DELETE FROM ${TICK_LEFT}${TICK_LEFT}User${TICK_RIGHT}${TICK_RIGHT};SELECT ${TICK_LEFT}${TICK_LEFT}id${TICK_RIGHT}${TICK_RIGHT}${TICK_RIGHT} AS ${TICK_LEFT}Posts.data" FROM "User" "User" LEFT OUTER JOIN "Post" "Posts" ON "User"."id" = "Posts"."user_id";`,
        },
      );

      expectsql(
        queryGenerator.selectQuery(
          'User',
          {
            attributes: ['name', 'age'],
            include: _validateIncludedElements({
              include: [
                {
                  attributes: [['* FROM User; DELETE FROM User;SELECT id', 'data']],
                  association: userPosts,
                },
              ],
              model: User,
            }).include,
            model: User,
          },
          User,
        ),
        {
          ibmi: 'SELECT "User"."name", "User"."age", "Posts"."id" AS "Posts.id", "Posts"."* FROM User; DELETE FROM User;SELECT id" AS "Posts.data" FROM "User" AS "User" LEFT OUTER JOIN "Post" AS "Posts" ON "User"."id" = "Posts"."user_id"',
          oracle: `SELECT "User"."name", "User"."age", "Posts"."id" AS "Posts.id", "Posts"."* FROM User; DELETE FROM User;SELECT id" AS "Posts.data" FROM "User" "User" LEFT OUTER JOIN "Post" "Posts" ON "User"."id" = "Posts"."user_id";`,
          default:
            'SELECT [User].[name], [User].[age], [Posts].[id] AS [Posts.id], [Posts].[* FROM User; DELETE FROM User;SELECT id] AS [Posts.data] FROM [User] AS [User] LEFT OUTER JOIN [Post] AS [Posts] ON [User].[id] = [Posts].[user_id];',
        },
      );
    });
  });
});

describe('QueryGenerator#selectQuery with quoteIdentifiers: false', () => {
  allowDeprecationsInSuite(['SEQUELIZE0023']);

  let sql: typeof queryGenerator;

  beforeEach(() => {
    sql = createSequelizeInstance({
      quoteIdentifiers: false,
    }).queryGenerator;
  });

  it('*', () => {
    expectsql(sql.selectQuery('User'), {
      default: 'SELECT * FROM [User];',
      ibmi: 'SELECT * FROM "User"',
      postgres: 'SELECT * FROM "User";',
      snowflake: 'SELECT * FROM User;',
    });
  });

  it('with attributes', () => {
    expectsql(
      sql.selectQuery('User', {
        attributes: ['name', 'age'],
      }),
      {
        default: 'SELECT [name], [age] FROM [User];',
        ibmi: 'SELECT "name", "age" FROM "User"',
        'postgres oracle': 'SELECT name, age FROM "User";',
        snowflake: 'SELECT name, age FROM User;',
      },
    );
  });

  it('include (left outer join)', () => {
    const User = sequelize.define(
      'User',
      {
        name: DataTypes.STRING,
        age: DataTypes.INTEGER,
      },
      {
        freezeTableName: true,
      },
    );
    const Post = sequelize.define(
      'Post',
      {
        title: DataTypes.STRING,
      },
      {
        freezeTableName: true,
      },
    );

    // association name is Pascal case to test quoteIdentifier: false
    const userPosts = User.hasMany(Post, { foreignKey: 'user_id', as: 'Posts' });

    expectsql(
      sql.selectQuery(
        'User',
        {
          attributes: ['name', 'age'],
          include: _validateIncludedElements({
            include: [
              {
                attributes: ['title'],
                association: userPosts,
              },
            ],
            model: User,
          }).include,
          model: User,
        },
        User,
      ),
      {
        default:
          'SELECT [User].[name], [User].[age], [Posts].[id] AS [Posts.id], [Posts].[title] AS [Posts.title] FROM [User] AS [User] LEFT OUTER JOIN [Post] AS [Posts] ON [User].[id] = [Posts].[user_id];',
        ibmi: 'SELECT "User"."name", "User"."age", "Posts"."id" AS "Posts.id", "Posts"."title" AS "Posts.title" FROM "User" AS "User" LEFT OUTER JOIN "Post" AS "Posts" ON "User"."id" = "Posts"."user_id"',
        postgres:
          'SELECT "User".name, "User".age, Posts.id AS "Posts.id", Posts.title AS "Posts.title" FROM "User" AS "User" LEFT OUTER JOIN Post AS Posts ON "User".id = Posts.user_id;',
        snowflake:
          'SELECT User.name, User.age, Posts.id AS "Posts.id", Posts.title AS "Posts.title" FROM User AS User LEFT OUTER JOIN Post AS Posts ON User.id = Posts.user_id;',
        oracle: `SELECT "User".name, "User".age, Posts.id AS "Posts.id", Posts.title AS "Posts.title" FROM "User" "User" LEFT OUTER JOIN Post Posts ON "User".id = Posts.user_id;`,
      },
    );
  });

  it('nested include (left outer join)', () => {
    const User = sequelize.define(
      'User',
      {
        name: DataTypes.STRING,
        age: DataTypes.INTEGER,
      },
      {
        freezeTableName: true,
      },
    );
    const Post = sequelize.define(
      'Post',
      {
        title: DataTypes.STRING,
      },
      {
        freezeTableName: true,
      },
    );
    const Comment = sequelize.define(
      'Comment',
      {
        title: DataTypes.STRING,
      },
      {
        freezeTableName: true,
      },
    );

    // association names are Pascal case to test quoteIdentifier: false
    const userPosts = User.hasMany(Post, { foreignKey: 'user_id', as: 'Posts' });
    Post.hasMany(Comment, { foreignKey: 'post_id', as: 'Comments' });

    expectsql(
      sql.selectQuery(
        'User',
        {
          attributes: ['name', 'age'],
          include: _validateIncludedElements({
            include: [
              {
                attributes: ['title'],
                association: userPosts,
                include: [
                  {
                    model: Comment,
                  },
                ],
              },
            ],
            model: User,
          }).include,
          model: User,
        },
        User,
      ),
      {
        default:
          'SELECT [User].[name], [User].[age], [Posts].[id] AS [Posts.id], [Posts].[title] AS [Posts.title], [Posts->Comments].[id] AS [Posts.Comments.id], [Posts->Comments].[title] AS [Posts.Comments.title], [Posts->Comments].[createdAt] AS [Posts.Comments.createdAt], [Posts->Comments].[updatedAt] AS [Posts.Comments.updatedAt], [Posts->Comments].[post_id] AS [Posts.Comments.post_id] FROM [User] AS [User] LEFT OUTER JOIN [Post] AS [Posts] ON [User].[id] = [Posts].[user_id] LEFT OUTER JOIN [Comment] AS [Posts->Comments] ON [Posts].[id] = [Posts->Comments].[post_id];',
        ibmi: 'SELECT "User"."name", "User"."age", "Posts"."id" AS "Posts.id", "Posts"."title" AS "Posts.title", "Posts->Comments"."id" AS "Posts.Comments.id", "Posts->Comments"."title" AS "Posts.Comments.title", "Posts->Comments"."createdAt" AS "Posts.Comments.createdAt", "Posts->Comments"."updatedAt" AS "Posts.Comments.updatedAt", "Posts->Comments"."post_id" AS "Posts.Comments.post_id" FROM "User" AS "User" LEFT OUTER JOIN "Post" AS "Posts" ON "User"."id" = "Posts"."user_id" LEFT OUTER JOIN "Comment" AS "Posts->Comments" ON "Posts"."id" = "Posts->Comments"."post_id"',
        postgres:
          'SELECT "User".name, "User".age, Posts.id AS "Posts.id", Posts.title AS "Posts.title", "Posts->Comments".id AS "Posts.Comments.id", "Posts->Comments".title AS "Posts.Comments.title", "Posts->Comments".createdAt AS "Posts.Comments.createdAt", "Posts->Comments".updatedAt AS "Posts.Comments.updatedAt", "Posts->Comments".post_id AS "Posts.Comments.post_id" FROM "User" AS "User" LEFT OUTER JOIN Post AS Posts ON "User".id = Posts.user_id LEFT OUTER JOIN Comment AS "Posts->Comments" ON Posts.id = "Posts->Comments".post_id;',
        snowflake:
          'SELECT User.name, User.age, Posts.id AS "Posts.id", Posts.title AS "Posts.title", "Posts->Comments".id AS "Posts.Comments.id", "Posts->Comments".title AS "Posts.Comments.title", "Posts->Comments".createdAt AS "Posts.Comments.createdAt", "Posts->Comments".updatedAt AS "Posts.Comments.updatedAt", "Posts->Comments".post_id AS "Posts.Comments.post_id" FROM User AS User LEFT OUTER JOIN Post AS Posts ON User.id = Posts.user_id LEFT OUTER JOIN Comment AS "Posts->Comments" ON Posts.id = "Posts->Comments".post_id;',
        oracle: `SELECT "User".name, "User".age, Posts.id AS "Posts.id", Posts.title AS "Posts.title", "Posts->Comments".id AS "Posts.Comments.id", "Posts->Comments".title AS "Posts.Comments.title", "Posts->Comments".createdAt AS "Posts.Comments.createdAt", "Posts->Comments".updatedAt AS "Posts.Comments.updatedAt", "Posts->Comments".post_id AS "Posts.Comments.post_id" FROM "User" "User" LEFT OUTER JOIN Post Posts ON "User".id = Posts.user_id LEFT OUTER JOIN "Comment" "Posts->Comments" ON Posts.id = "Posts->Comments".post_id;`,
      },
    );
  });

  it('attributes with dot notation', () => {
    const User = sequelize.define(
      'User',
      {
        name: DataTypes.STRING,
        age: DataTypes.INTEGER,
        statuslabel: {
          field: 'status.label',
          type: DataTypes.STRING,
        },
      },
      {
        freezeTableName: true,
      },
    );
    const Post = sequelize.define(
      'Post',
      {
        title: DataTypes.STRING,
        statuslabel: {
          field: 'status.label',
          type: DataTypes.STRING,
        },
      },
      {
        freezeTableName: true,
      },
    );

    // association name is Pascal case to test quoteIdentifier: false
    const userPosts = User.hasMany(Post, { foreignKey: 'user_id', as: 'Posts' });

    expectsql(
      sql.selectQuery(
        'User',
        {
          attributes: ['name', 'age', ['status.label', 'statuslabel']],
          include: _validateIncludedElements({
            include: [
              {
                attributes: ['title', ['status.label', 'statuslabel']],
                association: userPosts,
              },
            ],
            model: User,
          }).include,
          model: User,
          dotNotation: true,
        },
        User,
      ),
      {
        default:
          'SELECT [User].[name], [User].[age], [User].[status.label] AS [statuslabel], [Posts].[id] AS [Posts.id], [Posts].[title] AS [Posts.title], [Posts].[status.label] AS [Posts.statuslabel] FROM [User] AS [User] LEFT OUTER JOIN [Post] AS [Posts] ON [User].[id] = [Posts].[user_id];',
        postgres:
          'SELECT "User".name, "User".age, "User"."status.label" AS statuslabel, Posts.id AS "Posts.id", Posts.title AS "Posts.title", Posts."status.label" AS "Posts.statuslabel" FROM "User" AS "User" LEFT OUTER JOIN Post AS Posts ON "User".id = Posts.user_id;',
        snowflake:
          'SELECT User.name, User.age, User."status.label" AS statuslabel, Posts.id AS "Posts.id", Posts.title AS "Posts.title", Posts."status.label" AS "Posts.statuslabel" FROM User AS User LEFT OUTER JOIN Post AS Posts ON User.id = Posts.user_id;',
        oracle: `SELECT "User".name, "User".age, "User"."status.label" AS statuslabel, Posts.id AS "Posts.id", Posts.title AS "Posts.title", Posts."status.label" AS "Posts.statuslabel" FROM "User" "User" LEFT OUTER JOIN Post Posts ON "User".id = Posts.user_id;`,
      },
    );
  });
});
