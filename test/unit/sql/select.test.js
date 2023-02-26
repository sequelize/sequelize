'use strict';

const Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
  Model = require('sequelize/lib/model'),
  util = require('util'),
  chai = require('chai'),
  expect = chai.expect,
  expectsql = Support.expectsql,
  current = Support.sequelize,
  sql = current.dialect.queryGenerator,
  Op = Support.Sequelize.Op;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('select', () => {
    const testsql = function(options, expectation, testFunction = it) {
      const model = options.model;

      testFunction(util.inspect(options, { depth: 2 }), () => {
        return expectsql(
          sql.selectQuery(
            options.table || model && model.getTableName(),
            options,
            options.model
          ),
          expectation
        );
      });
    };

    testsql.only = (options, expectation) => testsql(options, expectation, it.only);

    testsql({
      table: 'User',
      attributes: [
        'email',
        ['first_name', 'firstName']
      ],
      where: {
        email: 'jon.snow@gmail.com'
      },
      order: [
        ['email', 'DESC']
      ],
      limit: 10
    }, {
      default: "SELECT [email], [first_name] AS [firstName] FROM [User] WHERE [User].[email] = 'jon.snow@gmail.com' ORDER BY [email] DESC LIMIT 10;",
      db2: 'SELECT "email", "first_name" AS "firstName" FROM "User" WHERE "User"."email" = \'jon.snow@gmail.com\' ORDER BY "email" DESC FETCH NEXT 10 ROWS ONLY;',
      oracle: 'SELECT "email", "first_name" AS "firstName" FROM "User" WHERE "User"."email" = \'jon.snow@gmail.com\' ORDER BY "email" DESC OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY;',
      mssql: "SELECT [email], [first_name] AS [firstName] FROM [User] WHERE [User].[email] = N'jon.snow@gmail.com' ORDER BY [email] DESC OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY;"
    });

    testsql({
      table: 'User',
      attributes: [
        'email',
        ['first_name', 'firstName'],
        ['last_name', 'lastName']
      ],
      order: [
        ['last_name', 'ASC']
      ],
      groupedLimit: {
        limit: 3,
        on: 'companyId',
        values: [
          1,
          5
        ]
      }
    }, {
      oracle: `SELECT "User".* FROM (${
        [
          `SELECT * FROM (SELECT "email", "first_name" AS "firstName", "last_name" AS "lastName" FROM "User" WHERE "User"."companyId" = 1 ORDER BY "last_name" ASC${sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })}) sub`,
          `SELECT * FROM (SELECT "email", "first_name" AS "firstName", "last_name" AS "lastName" FROM "User" WHERE "User"."companyId" = 5 ORDER BY "last_name" ASC${sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })}) sub`
        ].join(current.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ')
      }) "User" ORDER BY "last_name" ASC;`,
      default: `SELECT [User].* FROM (${
        [
          `SELECT * FROM (SELECT [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [User] WHERE [User].[companyId] = 1 ORDER BY [last_name] ASC${sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })}) AS sub`,
          `SELECT * FROM (SELECT [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [User] WHERE [User].[companyId] = 5 ORDER BY [last_name] ASC${sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })}) AS sub`
        ].join(current.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ')
      }) AS [User];`
    });

    (function() {
      const User = Support.sequelize.define('user', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          field: 'id_user'
        }
      });
      const Project = Support.sequelize.define('project', {
        title: DataTypes.STRING
      });

      const ProjectUser = Support.sequelize.define('project_user', {
        userId: {
          type: DataTypes.INTEGER,
          field: 'user_id'
        },
        projectId: {
          type: DataTypes.INTEGER,
          field: 'project_id'
        }
      }, { timestamps: false });

      User.Projects = User.belongsToMany(Project, { through: ProjectUser });
      Project.belongsToMany(User, { through: ProjectUser });

      testsql({
        table: User.getTableName(),
        model: User,
        attributes: [
          ['id_user', 'id']
        ],
        order: [
          ['last_name', 'ASC']
        ],
        groupedLimit: {
          limit: 3,
          on: User.Projects,
          values: [
            1,
            5
          ]
        }
      }, {
        default: `SELECT [user].* FROM (${
          [
            `SELECT * FROM (SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND [project_users].[project_id] = 1 ORDER BY [subquery_order_0] ASC${ current.dialect.name === 'mssql' ? ', [user].[id_user]' : ''}${sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })}) AS sub`,
            `SELECT * FROM (SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND [project_users].[project_id] = 5 ORDER BY [subquery_order_0] ASC${ current.dialect.name === 'mssql' ? ', [user].[id_user]' : ''}${sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })}) AS sub`
          ].join(current.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ')
        }) AS [user] ORDER BY [subquery_order_0] ASC;`,
        oracle: 'SELECT "user".* FROM (' +
          'SELECT * FROM (SELECT "user"."id_user" AS "id", "user"."last_name" AS "subquery_order_0", "project_users"."user_id" AS "project_users.userId", "project_users"."project_id" AS "project_users.projectId" FROM "users" "user" INNER JOIN "project_users" "project_users" ON "user"."id_user" = "project_users"."user_id" AND "project_users"."project_id" = 1 ORDER BY "subquery_order_0" ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY) sub UNION ALL ' +
          'SELECT * FROM (SELECT "user"."id_user" AS "id", "user"."last_name" AS "subquery_order_0", "project_users"."user_id" AS "project_users.userId", "project_users"."project_id" AS "project_users.projectId" FROM "users" "user" INNER JOIN "project_users" "project_users" ON "user"."id_user" = "project_users"."user_id" AND "project_users"."project_id" = 5 ORDER BY "subquery_order_0" ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY) sub)' +
          ' "user" ORDER BY "subquery_order_0" ASC;'
      });

      testsql({
        table: User.getTableName(),
        model: User,
        attributes: [
          ['id_user', 'id']
        ],
        order: [
          ['last_name', 'ASC']
        ],
        groupedLimit: {
          limit: 3,
          through: {
            where: {
              status: 1
            }
          },
          on: User.Projects,
          values: [
            1,
            5
          ]
        }
      }, {
        default: `SELECT [user].* FROM (${
          [
            `SELECT * FROM (SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND [project_users].[project_id] = 1 AND [project_users].[status] = 1 ORDER BY [subquery_order_0] ASC${ current.dialect.name === 'mssql' ? ', [user].[id_user]' : ''}${sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })}) AS sub`,
            `SELECT * FROM (SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND [project_users].[project_id] = 5 AND [project_users].[status] = 1 ORDER BY [subquery_order_0] ASC${ current.dialect.name === 'mssql' ? ', [user].[id_user]' : ''}${sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })}) AS sub`
          ].join(current.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ')
        }) AS [user] ORDER BY [subquery_order_0] ASC;`,
        oracle: 'SELECT "user".* FROM (' +
          'SELECT * FROM (SELECT "user"."id_user" AS "id", "user"."last_name" AS "subquery_order_0", "project_users"."user_id" AS "project_users.userId", "project_users"."project_id" AS "project_users.projectId" FROM "users" "user" INNER JOIN "project_users" "project_users" ON "user"."id_user" = "project_users"."user_id" AND "project_users"."project_id" = 1 AND "project_users"."status" = 1 ORDER BY "subquery_order_0" ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY) sub UNION ALL ' +
          'SELECT * FROM (SELECT "user"."id_user" AS "id", "user"."last_name" AS "subquery_order_0", "project_users"."user_id" AS "project_users.userId", "project_users"."project_id" AS "project_users.projectId" FROM "users" "user" INNER JOIN "project_users" "project_users" ON "user"."id_user" = "project_users"."user_id" AND "project_users"."project_id" = 5 AND "project_users"."status" = 1 ORDER BY "subquery_order_0" ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY) sub)' +
          ' "user" ORDER BY "subquery_order_0" ASC;'
      });

      testsql({
        table: User.getTableName(),
        model: User,
        attributes: [
          ['id_user', 'id']
        ],
        order: [
          ['id_user', 'ASC']
        ],
        where: {
          age: {
            [Op.gte]: 21
          }
        },
        groupedLimit: {
          limit: 3,
          on: User.Projects,
          values: [
            1,
            5
          ]
        }
      }, {
        default: `SELECT [user].* FROM (${
          [
            `SELECT * FROM (SELECT [user].[id_user] AS [id], [user].[id_user] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND [project_users].[project_id] = 1 WHERE [user].[age] >= 21 ORDER BY [subquery_order_0] ASC${ current.dialect.name === 'mssql' ? ', [user].[id_user]' : ''}${sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })}) AS sub`,
            `SELECT * FROM (SELECT [user].[id_user] AS [id], [user].[id_user] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND [project_users].[project_id] = 5 WHERE [user].[age] >= 21 ORDER BY [subquery_order_0] ASC${ current.dialect.name === 'mssql' ? ', [user].[id_user]' : ''}${sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })}) AS sub`
          ].join(current.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ')
        }) AS [user] ORDER BY [subquery_order_0] ASC;`,
        oracle: 'SELECT "user".* FROM (' +
        'SELECT * FROM (SELECT "user"."id_user" AS "id", "user"."id_user" AS "subquery_order_0", "project_users"."user_id" AS "project_users.userId", "project_users"."project_id" AS "project_users.projectId" FROM "users" "user" INNER JOIN "project_users" "project_users" ON "user"."id_user" = "project_users"."user_id" AND "project_users"."project_id" = 1 WHERE "user"."age" >= 21 ORDER BY "subquery_order_0" ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY) sub UNION ALL ' +
        'SELECT * FROM (SELECT "user"."id_user" AS "id", "user"."id_user" AS "subquery_order_0", "project_users"."user_id" AS "project_users.userId", "project_users"."project_id" AS "project_users.projectId" FROM "users" "user" INNER JOIN "project_users" "project_users" ON "user"."id_user" = "project_users"."user_id" AND "project_users"."project_id" = 5 WHERE "user"."age" >= 21 ORDER BY "subquery_order_0" ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY) sub) ' +
        '"user" ORDER BY "subquery_order_0" ASC;'

      });
    }());

    (function() {
      const User = Support.sequelize.define('user', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          field: 'id_user'
        },
        email: DataTypes.STRING,
        firstName: {
          type: DataTypes.STRING,
          field: 'first_name'
        },
        lastName: {
          type: DataTypes.STRING,
          field: 'last_name'
        }
      },
      {
        tableName: 'users'
      });
      const Post = Support.sequelize.define('Post', {
        title: DataTypes.STRING,
        userId: {
          type: DataTypes.INTEGER,
          field: 'user_id'
        }
      },
      {
        tableName: 'post'
      });

      User.Posts = User.hasMany(Post, { foreignKey: 'userId', as: 'POSTS' });

      const Comment = Support.sequelize.define('Comment', {
        title: DataTypes.STRING,
        postId: {
          type: DataTypes.INTEGER,
          field: 'post_id'
        }
      },
      {
        tableName: 'comment'
      });

      Post.Comments = Post.hasMany(Comment, { foreignKey: 'postId', as: 'COMMENTS' });

      const include = Model._validateIncludedElements({
        include: [{
          attributes: ['title'],
          association: User.Posts
        }],
        model: User
      }).include;

      testsql({
        table: User.getTableName(),
        model: User,
        include,
        attributes: [
          ['id_user', 'id'],
          'email',
          ['first_name', 'firstName'],
          ['last_name', 'lastName']
        ],
        order: [
          ['last_name', 'ASC']
        ],
        groupedLimit: {
          limit: 3,
          on: 'companyId',
          values: [
            1,
            5
          ]
        }
      }, {
        oracle: 'SELECT "user".*, "POSTS"."id" AS "POSTS.id", "POSTS"."title" AS "POSTS.title" FROM (' +
        'SELECT * FROM (SELECT "id_user" AS "id", "email", "first_name" AS "firstName", "last_name" AS "lastName" FROM "users" "user" WHERE "user"."companyId" = 1 ORDER BY "lastName" ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY) sub UNION ALL ' +
        'SELECT * FROM (SELECT "id_user" AS "id", "email", "first_name" AS "firstName", "last_name" AS "lastName" FROM "users" "user" WHERE "user"."companyId" = 5 ORDER BY "lastName" ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY) sub) ' +
        '"user" LEFT OUTER JOIN "post" "POSTS" ON "user"."id" = "POSTS"."user_id" ORDER BY "lastName" ASC;',
        default: `SELECT [user].*, [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title] FROM (${
          [
            `SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE [user].[companyId] = 1 ORDER BY [lastName] ASC${sql.addLimitAndOffset({ limit: 3, order: [['last_name', 'ASC']] })}) AS sub`,
            `SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE [user].[companyId] = 5 ORDER BY [lastName] ASC${sql.addLimitAndOffset({ limit: 3, order: [['last_name', 'ASC']] })}) AS sub`
          ].join(current.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ')
        }) AS [user] LEFT OUTER JOIN [post] AS [POSTS] ON [user].[id] = [POSTS].[user_id];`
      });

      testsql({
        table: User.getTableName(),
        model: User,
        include,
        attributes: [
          ['id_user', 'id'],
          'email',
          ['first_name', 'firstName'],
          ['last_name', 'lastName']
        ],
        order: [['[last_name]'.replace(/\[/g, Support.sequelize.dialect.TICK_CHAR_LEFT).replace(/\]/g, Support.sequelize.dialect.TICK_CHAR_RIGHT), 'ASC']],
        limit: 30,
        offset: 10,
        hasMultiAssociation: true, //must be set only for mssql dialect here
        subQuery: true
      }, {
        oracle: 'SELECT "user".*, "POSTS"."id" AS "POSTS.id", "POSTS"."title" AS "POSTS.title" FROM (' +
          'SELECT "user"."id_user" AS "id", "user"."email", "user"."first_name" AS "firstName", "user"."last_name" AS "lastName" FROM "users" "user" ORDER BY "user"."last_name" ASC OFFSET 10 ROWS FETCH NEXT 30 ROWS ONLY)' +
          ' "user" LEFT OUTER JOIN "post" "POSTS" ON "user"."id_user" = "POSTS"."user_id" ORDER BY "user"."last_name" ASC;',
        default: `${'SELECT [user].*, [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title] FROM (' +
                       'SELECT [user].[id_user] AS [id], [user].[email], [user].[first_name] AS [firstName], [user].[last_name] AS [lastName] FROM [users] AS [user] ORDER BY [user].[last_name] ASC'}${
          sql.addLimitAndOffset({ limit: 30, offset: 10, order: [['`user`.`last_name`', 'ASC']] })
        }) AS [user] LEFT OUTER JOIN [post] AS [POSTS] ON [user].[id_user] = [POSTS].[user_id] ORDER BY [user].[last_name] ASC;`
      });

      // By default, SELECT with include of a multi association & limit will be ran as a subQuery
      //  This checks the result when the query is forced to be ran without a subquery
      testsql({
        table: User.getTableName(),
        model: User,
        include,
        attributes: [
          ['id_user', 'id'],
          'email',
          ['first_name', 'firstName'],
          ['last_name', 'lastName']
        ],
        order: [['[last_name]'.replace(/\[/g, Support.sequelize.dialect.TICK_CHAR_LEFT).replace(/\]/g, Support.sequelize.dialect.TICK_CHAR_RIGHT), 'ASC']],
        limit: 30,
        offset: 10,
        hasMultiAssociation: true, // must be set only for mssql dialect here
        subQuery: false
      }, {
        oracle: 'SELECT "user"."id_user" AS "id", "user"."email", "user"."first_name" AS "firstName", "user"."last_name" AS "lastName", "POSTS"."id" AS "POSTS.id", "POSTS"."title" AS "POSTS.title" FROM "users" "user" LEFT OUTER JOIN "post" "POSTS" ON "user"."id_user" = "POSTS"."user_id" ORDER BY "user"."last_name" ASC OFFSET 10 ROWS FETCH NEXT 30 ROWS ONLY;',
        default: Support.minifySql(`SELECT [user].[id_user] AS [id], [user].[email], [user].[first_name] AS [firstName], [user].[last_name] AS [lastName], [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title]
          FROM [users] AS [user] LEFT OUTER JOIN [post] AS [POSTS]
          ON [user].[id_user] = [POSTS].[user_id]
          ORDER BY [user].[last_name] ASC
          ${sql.addLimitAndOffset({ limit: 30, offset: 10, order: [['last_name', 'ASC']], include }, User)};
        `)
      });

      const nestedInclude = Model._validateIncludedElements({
        include: [{
          attributes: ['title'],
          association: User.Posts,
          include: [{
            attributes: ['title'],
            association: Post.Comments
          }]
        }],
        model: User
      }).include;

      testsql({
        table: User.getTableName(),
        model: User,
        include: nestedInclude,
        attributes: [
          ['id_user', 'id'],
          'email',
          ['first_name', 'firstName'],
          ['last_name', 'lastName']
        ],
        order: [
          ['last_name', 'ASC']
        ],
        groupedLimit: {
          limit: 3,
          on: 'companyId',
          values: [
            1,
            5
          ]
        }
      }, {
        oracle: 'SELECT "user".*, "POSTS"."id" AS "POSTS.id", "POSTS"."title" AS "POSTS.title", "POSTS->COMMENTS"."id" AS "POSTS.COMMENTS.id", "POSTS->COMMENTS"."title" AS "POSTS.COMMENTS.title" FROM (' +
        'SELECT * FROM (SELECT "id_user" AS "id", "email", "first_name" AS "firstName", "last_name" AS "lastName" FROM "users" "user" WHERE "user"."companyId" = 1 ORDER BY "lastName" ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY) sub UNION ALL ' +
        'SELECT * FROM (SELECT "id_user" AS "id", "email", "first_name" AS "firstName", "last_name" AS "lastName" FROM "users" "user" WHERE "user"."companyId" = 5 ORDER BY "lastName" ASC OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY) sub)' +
        ' "user" LEFT OUTER JOIN "post" "POSTS" ON "user"."id" = "POSTS"."user_id" LEFT OUTER JOIN "comment" "POSTS->COMMENTS" ON "POSTS"."id" = "POSTS->COMMENTS"."post_id" ORDER BY "lastName" ASC;',
        default: `SELECT [user].*, [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title], [POSTS->COMMENTS].[id] AS [POSTS.COMMENTS.id], [POSTS->COMMENTS].[title] AS [POSTS.COMMENTS.title] FROM (${
          [
            `SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE [user].[companyId] = 1 ORDER BY [lastName] ASC${sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })}) AS sub`,
            `SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE [user].[companyId] = 5 ORDER BY [lastName] ASC${sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })}) AS sub`
          ].join(current.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ')
        }) AS [user] LEFT OUTER JOIN [post] AS [POSTS] ON [user].[id] = [POSTS].[user_id] LEFT OUTER JOIN [comment] AS [POSTS->COMMENTS] ON [POSTS].[id] = [POSTS->COMMENTS].[post_id];`
      });
    })();

    it('include (left outer join)', () => {
      const User = Support.sequelize.define('User', {
        name: DataTypes.STRING,
        age: DataTypes.INTEGER
      },
      {
        freezeTableName: true
      });
      const Post = Support.sequelize.define('Post', {
        title: DataTypes.STRING
      },
      {
        freezeTableName: true
      });

      User.Posts = User.hasMany(Post, { foreignKey: 'user_id' });

      expectsql(sql.selectQuery('User', {
        attributes: ['name', 'age'],
        include: Model._validateIncludedElements({
          include: [{
            attributes: ['title'],
            association: User.Posts
          }],
          model: User
        }).include,
        model: User
      }, User), {
        oracle: 'SELECT "User"."name", "User"."age", "Posts"."id" AS "Posts.id", "Posts"."title" AS "Posts.title" FROM "User" "User" LEFT OUTER JOIN "Post" "Posts" ON "User"."id" = "Posts"."user_id";',
        default: 'SELECT [User].[name], [User].[age], [Posts].[id] AS [Posts.id], [Posts].[title] AS [Posts.title] FROM [User] AS [User] LEFT OUTER JOIN [Post] AS [Posts] ON [User].[id] = [Posts].[user_id];'
      });
    });

    it('include (right outer join)', () => {
      const User = Support.sequelize.define('User', {
        name: DataTypes.STRING,
        age: DataTypes.INTEGER
      },
      {
        freezeTableName: true
      });
      const Post = Support.sequelize.define('Post', {
        title: DataTypes.STRING
      },
      {
        freezeTableName: true
      });

      User.Posts = User.hasMany(Post, { foreignKey: 'user_id' });

      expectsql(sql.selectQuery('User', {
        attributes: ['name', 'age'],
        include: Model._validateIncludedElements({
          include: [{
            attributes: ['title'],
            association: User.Posts,
            right: true
          }],
          model: User
        }).include,
        model: User
      }, User), {
        oracle: 'SELECT "User"."name", "User"."age", "Posts"."id" AS "Posts.id", "Posts"."title" AS "Posts.title" FROM "User" "User" RIGHT OUTER JOIN "Post" "Posts" ON "User"."id" = "Posts"."user_id";',
        default: `SELECT [User].[name], [User].[age], [Posts].[id] AS [Posts.id], [Posts].[title] AS [Posts.title] FROM [User] AS [User] ${current.dialect.supports['RIGHT JOIN'] ? 'RIGHT' : 'LEFT'} OUTER JOIN [Post] AS [Posts] ON [User].[id] = [Posts].[user_id];`
      });
    });

    it('include through (right outer join)', () => {
      const User = Support.sequelize.define('user', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          field: 'id_user'
        }
      });
      const Project = Support.sequelize.define('project', {
        title: DataTypes.STRING
      });

      const ProjectUser = Support.sequelize.define('project_user', {
        userId: {
          type: DataTypes.INTEGER,
          field: 'user_id'
        },
        projectId: {
          type: DataTypes.INTEGER,
          field: 'project_id'
        }
      }, { timestamps: false });

      User.Projects = User.belongsToMany(Project, { through: ProjectUser });
      Project.belongsToMany(User, { through: ProjectUser });

      expectsql(sql.selectQuery('User', {
        attributes: ['id_user', 'id'],
        include: Model._validateIncludedElements({
          include: [{
            model: Project,
            right: true
          }],
          model: User
        }).include,
        model: User
      }, User), {
        default: `SELECT [user].[id_user], [user].[id], [projects].[id] AS [projects.id], [projects].[title] AS [projects.title], [projects].[createdAt] AS [projects.createdAt], [projects].[updatedAt] AS [projects.updatedAt], [projects->project_user].[user_id] AS [projects.project_user.userId], [projects->project_user].[project_id] AS [projects.project_user.projectId] FROM [User] AS [user] ${current.dialect.supports['RIGHT JOIN'] ? 'RIGHT' : 'LEFT'} OUTER JOIN ( [project_users] AS [projects->project_user] INNER JOIN [projects] AS [projects] ON [projects].[id] = [projects->project_user].[project_id]) ON [user].[id_user] = [projects->project_user].[user_id];`,
        oracle: 'SELECT "user"."id_user", "user"."id", "projects"."id" AS "projects.id", "projects"."title" AS "projects.title", "projects"."createdAt" AS "projects.createdAt", "projects"."updatedAt" AS "projects.updatedAt", "projects->project_user"."user_id" AS "projects.project_user.userId", "projects->project_user"."project_id" AS "projects.project_user.projectId" FROM "User" "user" RIGHT OUTER JOIN ( "project_users" "projects->project_user" INNER JOIN "projects" "projects" ON "projects"."id" = "projects->project_user"."project_id") ON "user"."id_user" = "projects->project_user"."user_id";'
      });
    });

    describe('include (subQuery alias)', () => {
      const User = Support.sequelize.define('User', {
        name: DataTypes.STRING,
        age: DataTypes.INTEGER
      },
      {
        freezeTableName: true
      });
      const Post = Support.sequelize.define('Post', {
        title: DataTypes.STRING
      },
      {
        freezeTableName: true
      });

      User.Posts = User.hasMany(Post, { foreignKey: 'user_id', as: 'postaliasname' });

      it('w/o filters', () => {
        expectsql(sql.selectQuery('User', {
          table: User.getTableName(),
          model: User,
          attributes: ['name', 'age'],
          include: Model._validateIncludedElements({
            include: [{
              attributes: ['title'],
              association: User.Posts,
              subQuery: true,
              required: true
            }],
            as: 'User'
          }).include,
          subQuery: true
        }, User), {
          oracle: 'SELECT "User".* FROM ' +
            '(SELECT "User"."name", "User"."age", "User"."id" AS "id", "postaliasname"."id" AS "postaliasname.id", "postaliasname"."title" AS "postaliasname.title" FROM "User" "User" ' +
            'INNER JOIN "Post" "postaliasname" ON "User"."id" = "postaliasname"."user_id" WHERE ( SELECT "user_id" FROM "Post" "postaliasname" WHERE ("postaliasname"."user_id" = "User"."id") ORDER BY "postaliasname"."id" OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY ) IS NOT NULL) "User";',
          default: 'SELECT [User].* FROM ' +
            '(SELECT [User].[name], [User].[age], [User].[id] AS [id], [postaliasname].[id] AS [postaliasname.id], [postaliasname].[title] AS [postaliasname.title] FROM [User] AS [User] ' +
            'INNER JOIN [Post] AS [postaliasname] ON [User].[id] = [postaliasname].[user_id] ' +
            `WHERE ( SELECT [user_id] FROM [Post] AS [postaliasname] WHERE ([postaliasname].[user_id] = [User].[id])${sql.addLimitAndOffset({ limit: 1, tableAs: 'postaliasname' }, User)} ) IS NOT NULL) AS [User];`
        });
      });

      it('w/ nested column filter', () => {
        expectsql(sql.selectQuery('User', {
          table: User.getTableName(),
          model: User,
          attributes: ['name', 'age'],
          where: { '$postaliasname.title$': 'test' },
          include: Model._validateIncludedElements({
            include: [{
              attributes: ['title'],
              association: User.Posts,
              subQuery: true,
              required: true
            }],
            as: 'User'
          }).include,
          subQuery: true
        }, User), {
          oracle: 'SELECT "User".* FROM ' +
          '(SELECT "User"."name", "User"."age", "User"."id" AS "id", "postaliasname"."id" AS "postaliasname.id", "postaliasname"."title" AS "postaliasname.title" FROM "User" "User" ' +
          'INNER JOIN "Post" "postaliasname" ON "User"."id" = "postaliasname"."user_id" WHERE "postaliasname"."title" = \'test\' AND ( SELECT "user_id" FROM "Post" "postaliasname" ' +
          'WHERE ("postaliasname"."user_id" = "User"."id") ORDER BY "postaliasname"."id" OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY ) IS NOT NULL) "User";',
          default: 'SELECT [User].* FROM ' +
            '(SELECT [User].[name], [User].[age], [User].[id] AS [id], [postaliasname].[id] AS [postaliasname.id], [postaliasname].[title] AS [postaliasname.title] FROM [User] AS [User] ' +
            'INNER JOIN [Post] AS [postaliasname] ON [User].[id] = [postaliasname].[user_id] ' +
            `WHERE [postaliasname].[title] = ${sql.escape('test')} AND ( SELECT [user_id] FROM [Post] AS [postaliasname] WHERE ([postaliasname].[user_id] = [User].[id])${sql.addLimitAndOffset({ limit: 1, tableAs: 'postaliasname' }, User)} ) IS NOT NULL) AS [User];`
        });
      });
    });

    it('include w/ subQuery + nested filter + paging', () => {
      const User = Support.sequelize.define('User', {
        scopeId: DataTypes.INTEGER
      });

      const Company = Support.sequelize.define('Company', {
        name: DataTypes.STRING,
        public: DataTypes.BOOLEAN,
        scopeId: DataTypes.INTEGER
      });

      const Profession = Support.sequelize.define('Profession', {
        name: DataTypes.STRING,
        scopeId: DataTypes.INTEGER
      });

      User.Company = User.belongsTo(Company, { foreignKey: 'companyId' });
      User.Profession = User.belongsTo(Profession, { foreignKey: 'professionId' });
      Company.Users = Company.hasMany(User, { as: 'Users', foreignKey: 'companyId' });
      Profession.Users = Profession.hasMany(User, { as: 'Users', foreignKey: 'professionId' });

      expectsql(sql.selectQuery('Company', {
        table: Company.getTableName(),
        model: Company,
        attributes: ['name', 'public'],
        where: { '$Users.Profession.name$': 'test', [Op.and]: { scopeId: [42] } },
        include: Model._validateIncludedElements({
          include: [{
            association: Company.Users,
            attributes: [],
            include: [{
              association: User.Profession,
              attributes: [],
              required: true
            }],
            subQuery: true,
            required: true
          }],
          model: Company
        }).include,
        limit: 5,
        offset: 0,
        subQuery: true
      }, Company), {
        oracle: 'SELECT "Company".* FROM (' +
        'SELECT "Company"."name", "Company"."public", "Company"."id" AS "id" FROM "Company" "Company" ' +
        'INNER JOIN "Users" "Users" ON "Company"."id" = "Users"."companyId" ' +
        'INNER JOIN "Professions" "Users->Profession" ON "Users"."professionId" = "Users->Profession"."id" ' +
        'WHERE ("Company"."scopeId" IN (42)) AND "Users->Profession"."name" = \'test\' AND ( ' +
        'SELECT "Users"."companyId" FROM "Users" "Users" ' +
        'INNER JOIN "Professions" "Profession" ON "Users"."professionId" = "Profession"."id" ' +
        'WHERE ("Users"."companyId" = "Company"."id") ORDER BY "Users"."id" OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY ) ' +
        'IS NOT NULL ORDER BY "Company"."id" OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY) "Company";',
        default: 'SELECT [Company].* FROM (' +
        'SELECT [Company].[name], [Company].[public], [Company].[id] AS [id] FROM [Company] AS [Company] ' +
        'INNER JOIN [Users] AS [Users] ON [Company].[id] = [Users].[companyId] ' +
        'INNER JOIN [Professions] AS [Users->Profession] ON [Users].[professionId] = [Users->Profession].[id] ' +
        `WHERE ([Company].[scopeId] IN (42)) AND [Users->Profession].[name] = ${sql.escape('test')} AND ( ` +
        'SELECT [Users].[companyId] FROM [Users] AS [Users] ' +
        'INNER JOIN [Professions] AS [Profession] ON [Users].[professionId] = [Profession].[id] ' +
        `WHERE ([Users].[companyId] = [Company].[id])${sql.addLimitAndOffset({ limit: 1, tableAs: 'Users' }, User)} ` +
        `) IS NOT NULL${sql.addLimitAndOffset({ limit: 5, offset: 0, tableAs: 'Company' }, Company)}) AS [Company];`
      });
    });

    it('properly stringify IN values as per field definition', () => {
      const User = Support.sequelize.define('User', {
        name: DataTypes.STRING,
        age: DataTypes.INTEGER,
        data: DataTypes.BLOB
      }, {
        freezeTableName: true
      });

      expectsql(sql.selectQuery('User', {
        attributes: ['name', 'age', 'data'],
        where: {
          data: ['123']
        }
      }, User), {
        postgres: 'SELECT "name", "age", "data" FROM "User" AS "User" WHERE "User"."data" IN (E\'\\\\x313233\');',
        snowflake: 'SELECT "name", "age", "data" FROM "User" AS "User" WHERE "User"."data" IN (X\'313233\');',
        mariadb: 'SELECT `name`, `age`, `data` FROM `User` AS `User` WHERE `User`.`data` IN (X\'313233\');',
        mysql: 'SELECT `name`, `age`, `data` FROM `User` AS `User` WHERE `User`.`data` IN (X\'313233\');',
        sqlite: 'SELECT `name`, `age`, `data` FROM `User` AS `User` WHERE `User`.`data` IN (X\'313233\');',
        db2: "SELECT \"name\", \"age\", \"data\" FROM \"User\" AS \"User\" WHERE \"User\".\"data\" IN ('x''313233''');",
        oracle: 'SELECT "name", "age", "data" FROM "User" "User" WHERE "User"."data" IN (\'313233\');',
        mssql: 'SELECT [name], [age], [data] FROM [User] AS [User] WHERE [User].[data] IN (0x313233);'
      });
    });

    describe('attribute escaping', () => {
      it('plain attributes (1)', () => {
        expectsql(sql.selectQuery('User', {
          attributes: ['* FROM [User]; DELETE FROM [User];SELECT [id]'.replace(/\[/g, Support.sequelize.dialect.TICK_CHAR_LEFT).replace(/\]/g, Support.sequelize.dialect.TICK_CHAR_RIGHT)]
        }), {
          default: 'SELECT \'* FROM [User]; DELETE FROM [User];SELECT [id]\' FROM [User];',
          db2: 'SELECT \'* FROM "User"; DELETE FROM "User";SELECT "id"\' FROM "User";',
          snowflake: 'SELECT \'* FROM "User"; DELETE FROM "User";SELECT "id"\' FROM "User";',
          mssql: 'SELECT [* FROM User; DELETE FROM User;SELECT id] FROM [User];'
        });
      });

      it('plain attributes (2)', () => {
        expectsql(sql.selectQuery('User', {
          attributes: ['* FROM User; DELETE FROM User;SELECT id']
        }), {
          default: 'SELECT [* FROM User; DELETE FROM User;SELECT id] FROM [User];'
        });
      });

      it('plain attributes (3)', () => {
        expectsql(sql.selectQuery('User', {
          attributes: ['a\', * FROM User; DELETE FROM User;SELECT id']
        }), {
          default: "SELECT [a', * FROM User; DELETE FROM User;SELECT id] FROM [User];",
          mssql: 'SELECT [a, * FROM User; DELETE FROM User;SELECT id] FROM [User];'
        });
      });

      it('plain attributes (4)', () => {
        expectsql(sql.selectQuery('User', {
          attributes: ['*, COUNT(*) FROM User; DELETE FROM User;SELECT id']
        }), {
          default: 'SELECT [*, COUNT(*) FROM User; DELETE FROM User;SELECT id] FROM [User];'
        });
      });

      it('aliased attributes (1)', () => {
        expectsql(sql.selectQuery('User', {
          attributes: [
            ['* FROM [User]; DELETE FROM [User];SELECT [id]'.replace(/\[/g, Support.sequelize.dialect.TICK_CHAR_LEFT).replace(/\]/g, Support.sequelize.dialect.TICK_CHAR_RIGHT), 'myCol']
          ]
        }), {
          default: 'SELECT [* FROM User; DELETE FROM User;SELECT id] AS [myCol] FROM [User];'
        });
      });

      it('aliased attributes (2)', () => {
        expectsql(sql.selectQuery('User', {
          attributes: [
            ['* FROM User; DELETE FROM User;SELECT id', 'myCol']
          ]
        }), {
          default: 'SELECT [* FROM User; DELETE FROM User;SELECT id] AS [myCol] FROM [User];'
        });
      });

      it('aliased attributes (3)', () => {
        expectsql(sql.selectQuery('User', {
          attributes: [
            ['id', '* FROM User; DELETE FROM User;SELECT id']
          ]
        }), {
          default: 'SELECT [id] AS [* FROM User; DELETE FROM User;SELECT id] FROM [User];'
        });
      });

      it('attributes from includes', () => {
        const User = Support.sequelize.define('User', {
          name: DataTypes.STRING,
          age: DataTypes.INTEGER
        },
        {
          freezeTableName: true
        });
        const Post = Support.sequelize.define('Post', {
          title: DataTypes.STRING
        },
        {
          freezeTableName: true
        });

        User.Posts = User.hasMany(Post, { foreignKey: 'user_id' });

        expectsql(sql.selectQuery('User', {
          attributes: ['name', 'age'],
          include: Model._validateIncludedElements({
            include: [{
              attributes: ['* FROM [User]; DELETE FROM [User];SELECT [id]'.replace(/\[/g, Support.sequelize.dialect.TICK_CHAR_LEFT).replace(/\]/g, Support.sequelize.dialect.TICK_CHAR_RIGHT)],
              association: User.Posts
            }],
            model: User
          }).include,
          model: User
        }, User), {
          default: 'SELECT [User].[name], [User].[age], [Posts].[id] AS [Posts.id], [Posts].[* FROM User; DELETE FROM User;SELECT id] AS [Posts.* FROM User; DELETE FROM User;SELECT id] FROM [User] AS [User] LEFT OUTER JOIN [Post] AS [Posts] ON [User].[id] = [Posts].[user_id];',
          oracle: 'SELECT "User"."name", "User"."age", "Posts"."id" AS "Posts.id", "Posts"."* FROM User; DELETE FROM User;SELECT id" AS "Posts.* FROM User; DELETE FROM User;SELECT id" FROM "User" "User" LEFT OUTER JOIN "Post" "Posts" ON "User"."id" = "Posts"."user_id";'
        });

        expectsql(sql.selectQuery('User', {
          attributes: ['name', 'age'],
          include: Model._validateIncludedElements({
            include: [{
              attributes: [
                ['* FROM [User]; DELETE FROM [User];SELECT [id]'.replace(/\[/g, Support.sequelize.dialect.TICK_CHAR_LEFT).replace(/\]/g, Support.sequelize.dialect.TICK_CHAR_RIGHT), 'data']
              ],
              association: User.Posts
            }],
            model: User
          }).include,
          model: User
        }, User), {
          oracle: 'SELECT "User"."name", "User"."age", "Posts"."id" AS "Posts.id", "Posts"."* FROM User; DELETE FROM User;SELECT id" AS "Posts.data" FROM "User" "User" LEFT OUTER JOIN "Post" "Posts" ON "User"."id" = "Posts"."user_id";',
          default: 'SELECT [User].[name], [User].[age], [Posts].[id] AS [Posts.id], [Posts].[* FROM User; DELETE FROM User;SELECT id] AS [Posts.data] FROM [User] AS [User] LEFT OUTER JOIN [Post] AS [Posts] ON [User].[id] = [Posts].[user_id];'
        });

        expectsql(sql.selectQuery('User', {
          attributes: ['name', 'age'],
          include: Model._validateIncludedElements({
            include: [{
              attributes: [
                ['* FROM User; DELETE FROM User;SELECT id', 'data']
              ],
              association: User.Posts
            }],
            model: User
          }).include,
          model: User
        }, User), {
          oracle: 'SELECT "User"."name", "User"."age", "Posts"."id" AS "Posts.id", "Posts"."* FROM User; DELETE FROM User;SELECT id" AS "Posts.data" FROM "User" "User" LEFT OUTER JOIN "Post" "Posts" ON "User"."id" = "Posts"."user_id";',
          default: 'SELECT [User].[name], [User].[age], [Posts].[id] AS [Posts.id], [Posts].[* FROM User; DELETE FROM User;SELECT id] AS [Posts.data] FROM [User] AS [User] LEFT OUTER JOIN [Post] AS [Posts] ON [User].[id] = [Posts].[user_id];'
        });
      });
    });
  });

  describe('queryIdentifiers: false', () => {
    beforeEach(() => {
      sql.options.quoteIdentifiers = false;
    });
    afterEach(() => {
      sql.options.quoteIdentifiers = true;
    });

    it('*', () => {
      expectsql(sql.selectQuery('User'), {
        default: 'SELECT * FROM [User];',
        postgres: 'SELECT * FROM "User";',
        oracle: 'SELECT * FROM "User";',
        snowflake: 'SELECT * FROM User;'
      });
    });

    it('with attributes', () => {
      expectsql(sql.selectQuery('User', {
        attributes: ['name', 'age']
      }), {
        default: 'SELECT [name], [age] FROM [User];',
        postgres: 'SELECT name, age FROM "User";',
        oracle: 'SELECT name, age FROM "User";',
        snowflake: 'SELECT name, age FROM User;'
      });
    });

    it('include (left outer join)', () => {
      const User = Support.sequelize.define('User', {
        name: DataTypes.STRING,
        age: DataTypes.INTEGER
      },
      {
        freezeTableName: true
      });
      const Post = Support.sequelize.define('Post', {
        title: DataTypes.STRING
      },
      {
        freezeTableName: true
      });

      User.Posts = User.hasMany(Post, { foreignKey: 'user_id' });

      expectsql(sql.selectQuery('User', {
        attributes: ['name', 'age'],
        include: Model._validateIncludedElements({
          include: [{
            attributes: ['title'],
            association: User.Posts
          }],
          model: User
        }).include,
        model: User
      }, User), {
        default: 'SELECT [User].[name], [User].[age], [Posts].[id] AS [Posts.id], [Posts].[title] AS [Posts.title] FROM [User] AS [User] LEFT OUTER JOIN [Post] AS [Posts] ON [User].[id] = [Posts].[user_id];',
        postgres: 'SELECT "User".name, "User".age, Posts.id AS "Posts.id", Posts.title AS "Posts.title" FROM "User" AS "User" LEFT OUTER JOIN Post AS Posts ON "User".id = Posts.user_id;',
        oracle: 'SELECT "User".name, "User".age, Posts.id AS "Posts.id", Posts.title AS "Posts.title" FROM "User" "User" LEFT OUTER JOIN Post Posts ON "User".id = Posts.user_id;',
        snowflake: 'SELECT User.name, User.age, Posts.id AS "Posts.id", Posts.title AS "Posts.title" FROM User AS User LEFT OUTER JOIN Post AS Posts ON User.id = Posts.user_id;'
      });
    });


    it('nested include (left outer join)', () => {
      const User = Support.sequelize.define('User', {
        name: DataTypes.STRING,
        age: DataTypes.INTEGER
      },
      {
        freezeTableName: true
      });
      const Post = Support.sequelize.define('Post', {
        title: DataTypes.STRING
      },
      {
        freezeTableName: true
      });
      const Comment = Support.sequelize.define('Comment', {
        title: DataTypes.STRING
      },
      {
        freezeTableName: true
      });

      User.Posts = User.hasMany(Post, { foreignKey: 'user_id' });
      Post.Comments = Post.hasMany(Comment, { foreignKey: 'post_id' });

      expectsql(sql.selectQuery('User', {
        attributes: ['name', 'age'],
        include: Model._validateIncludedElements({
          include: [{
            attributes: ['title'],
            association: User.Posts,
            include: [
              {
                model: Comment
              }
            ]
          }],
          model: User
        }).include,
        model: User
      }, User), {
        default: 'SELECT [User].[name], [User].[age], [Posts].[id] AS [Posts.id], [Posts].[title] AS [Posts.title], [Posts->Comments].[id] AS [Posts.Comments.id], [Posts->Comments].[title] AS [Posts.Comments.title], [Posts->Comments].[createdAt] AS [Posts.Comments.createdAt], [Posts->Comments].[updatedAt] AS [Posts.Comments.updatedAt], [Posts->Comments].[post_id] AS [Posts.Comments.post_id] FROM [User] AS [User] LEFT OUTER JOIN [Post] AS [Posts] ON [User].[id] = [Posts].[user_id] LEFT OUTER JOIN [Comment] AS [Posts->Comments] ON [Posts].[id] = [Posts->Comments].[post_id];',
        postgres: 'SELECT "User".name, "User".age, Posts.id AS "Posts.id", Posts.title AS "Posts.title", "Posts->Comments".id AS "Posts.Comments.id", "Posts->Comments".title AS "Posts.Comments.title", "Posts->Comments".createdAt AS "Posts.Comments.createdAt", "Posts->Comments".updatedAt AS "Posts.Comments.updatedAt", "Posts->Comments".post_id AS "Posts.Comments.post_id" FROM "User" AS "User" LEFT OUTER JOIN Post AS Posts ON "User".id = Posts.user_id LEFT OUTER JOIN Comment AS "Posts->Comments" ON Posts.id = "Posts->Comments".post_id;',
        oracle: 'SELECT "User".name, "User".age, Posts.id AS "Posts.id", Posts.title AS "Posts.title", "Posts->Comments".id AS "Posts.Comments.id", "Posts->Comments".title AS "Posts.Comments.title", "Posts->Comments".createdAt AS "Posts.Comments.createdAt", "Posts->Comments".updatedAt AS "Posts.Comments.updatedAt", "Posts->Comments".post_id AS "Posts.Comments.post_id" FROM "User" "User" LEFT OUTER JOIN Post Posts ON "User".id = Posts.user_id LEFT OUTER JOIN "Comment" "Posts->Comments" ON Posts.id = "Posts->Comments".post_id;',
        snowflake: 'SELECT User.name, User.age, Posts.id AS "Posts.id", Posts.title AS "Posts.title", "Posts->Comments".id AS "Posts.Comments.id", "Posts->Comments".title AS "Posts.Comments.title", "Posts->Comments".createdAt AS "Posts.Comments.createdAt", "Posts->Comments".updatedAt AS "Posts.Comments.updatedAt", "Posts->Comments".post_id AS "Posts.Comments.post_id" FROM User AS User LEFT OUTER JOIN Post AS Posts ON User.id = Posts.user_id LEFT OUTER JOIN Comment AS "Posts->Comments" ON Posts.id = "Posts->Comments".post_id;'
      });
    });

    it('attributes with dot notation', () => {
      const User = Support.sequelize.define('User', {
        name: DataTypes.STRING,
        age: DataTypes.INTEGER,
        'status.label': DataTypes.STRING
      },
      {
        freezeTableName: true
      });
      const Post = Support.sequelize.define('Post', {
        title: DataTypes.STRING,
        'status.label': DataTypes.STRING
      },
      {
        freezeTableName: true
      });

      User.Posts = User.hasMany(Post, { foreignKey: 'user_id' });

      expectsql(sql.selectQuery('User', {
        attributes: ['name', 'age', 'status.label'],
        include: Model._validateIncludedElements({
          include: [{
            attributes: ['title', 'status.label'],
            association: User.Posts
          }],
          model: User
        }).include,
        model: User,
        dotNotation: true
      }, User), {
        default: 'SELECT [User].[name], [User].[age], [User].[status.label], [Posts].[id] AS [Posts.id], [Posts].[title] AS [Posts.title], [Posts].[status.label] AS [Posts.status.label] FROM [User] AS [User] LEFT OUTER JOIN [Post] AS [Posts] ON [User].[id] = [Posts].[user_id];',
        postgres: 'SELECT "User".name, "User".age, "User"."status.label", Posts.id AS "Posts.id", Posts.title AS "Posts.title", Posts."status.label" AS "Posts.status.label" FROM "User" AS "User" LEFT OUTER JOIN Post AS Posts ON "User".id = Posts.user_id;',
        oracle: 'SELECT "User".name, "User".age, "User"."status.label", Posts.id AS "Posts.id", Posts.title AS "Posts.title", Posts."status.label" AS "Posts.status.label" FROM "User" "User" LEFT OUTER JOIN Post Posts ON "User".id = Posts.user_id;',
        snowflake: 'SELECT User.name, User.age, User."status.label", Posts.id AS "Posts.id", Posts.title AS "Posts.title", Posts."status.label" AS "Posts.status.label" FROM User AS User LEFT OUTER JOIN Post AS Posts ON User.id = Posts.user_id;'
      });
    });

  });

  describe('raw query', () => {
    it('raw replacements for where', () => {
      expect(() => {
        sql.selectQuery('User', {
          attributes: ['*'],
          where: ['name IN (?)', [1, 'test', 3, 'derp']]
        });
      }).to.throw(Error, 'Support for literal replacements in the `where` object has been removed.');
    });

    it('raw replacements for nested where', () => {
      expect(() => {
        sql.selectQuery('User', {
          attributes: ['*'],
          where: [['name IN (?)', [1, 'test', 3, 'derp']]]
        });
      }).to.throw(Error, 'Support for literal replacements in the `where` object has been removed.');
    });

    it('raw replacements for having', () => {
      expect(() => {
        sql.selectQuery('User', {
          attributes: ['*'],
          having: ['name IN (?)', [1, 'test', 3, 'derp']]
        });
      }).to.throw(Error, 'Support for literal replacements in the `where` object has been removed.');
    });

    it('raw replacements for nested having', () => {
      expect(() => {
        sql.selectQuery('User', {
          attributes: ['*'],
          having: [['name IN (?)', [1, 'test', 3, 'derp']]]
        });
      }).to.throw(Error, 'Support for literal replacements in the `where` object has been removed.');
    });

    it('raw string from where', () => {
      expect(() => {
        sql.selectQuery('User', {
          attributes: ['*'],
          where: 'name = \'something\''
        });
      }).to.throw(Error, 'Support for `{where: \'raw query\'}` has been removed.');
    });

    it('raw string from having', () => {
      expect(() => {
        sql.selectQuery('User', {
          attributes: ['*'],
          having: 'name = \'something\''
        });
      }).to.throw(Error, 'Support for `{where: \'raw query\'}` has been removed.');
    });
  });


  describe('queryGenerator: selectQuery', () => {
    const User = Support.sequelize.define('User', {
      username: DataTypes.STRING
    }, { timestamps: false });


    const Project = Support.sequelize.define('Project', {
      duration: DataTypes.BIGINT
    }, { timestamps: false });

    const ProjectContributor = Support.sequelize.define('ProjectContributor', {}, { timestamps: false });

    // project owners
    User.hasMany(Project, { as: 'projects' });
    Project.belongsTo(User, { as: 'owner' });

    // project contributors
    Project.belongsToMany(User, {
      through: ProjectContributor,
      as: 'contributors'
    });

    it('supports offset without limit', () => {
      const query = sql.selectQuery(User.tableName, {
        model: User,
        attributes: ['id'],
        offset: 1
      }, User);

      expectsql(query, {
        postgres: 'SELECT "id" FROM "Users" AS "User" OFFSET 1;',
        mysql: 'SELECT `id` FROM `Users` AS `User` LIMIT 1, 10000000000000;',   //original 'SELECT `id` FROM `Users` AS `User` LIMIT 18446744073709551615 OFFSET 1;',
        mariadb: 'SELECT `id` FROM `Users` AS `User` LIMIT 1, 10000000000000;', //original 'SELECT `id` FROM `Users` AS `User` LIMIT 18446744073709551615 OFFSET 1;',
        sqlite: 'SELECT `id` FROM `Users` AS `User` LIMIT 1, 10000000000000;',  //original 'SELECT `id` FROM `Users` AS `User` LIMIT -1 OFFSET 1;'
        oracle: 'SELECT "id" FROM "Users" "User" ORDER BY "User"."id" OFFSET 1 ROWS;',
        snowflake: 'SELECT "id" FROM "Users" AS "User" LIMIT NULL OFFSET 1;',
        db2: 'SELECT "id" FROM "Users" AS "User" OFFSET 1 ROWS;',
        ibmi: 'SELECT "id" FROM "Users" AS "User" OFFSET 1 ROWS',
        mssql: 'SELECT [id] FROM [Users] AS [User] ORDER BY [User].[id] OFFSET 1 ROWS;'
      });
    });

    it('supports querying for bigint values', () => {
      const query = sql.selectQuery(Project.tableName, {
        model: Project,
        attributes: ['id'],
        where: {
          duration: { [Op.eq]: 9007199254740993n }
        }
      }, Project);

      expectsql(query, {
        postgres: 'SELECT "id" FROM "Projects" AS "Project" WHERE "Project"."duration" = 9007199254740993;',
        mysql: 'SELECT `id` FROM `Projects` AS `Project` WHERE `Project`.`duration` = 9007199254740993;',
        mariadb: 'SELECT `id` FROM `Projects` AS `Project` WHERE `Project`.`duration` = 9007199254740993;',
        sqlite: 'SELECT `id` FROM `Projects` AS `Project` WHERE `Project`.`duration` = 9007199254740993;',
        oracle: 'SELECT "id" FROM "Projects" "Project" WHERE "Project"."duration" = 9007199254740993;',
        snowflake: 'SELECT "id" FROM "Projects" AS "Project" WHERE "Project"."duration" = 9007199254740993;',
        db2: 'SELECT "id" FROM "Projects" AS "Project" WHERE "Project"."duration" = 9007199254740993;',
        ibmi: 'SELECT "id" FROM "Projects" AS "Project" WHERE "Project"."duration" = \'9007199254740993\'',
        mssql: 'SELECT [id] FROM [Projects] AS [Project] WHERE [Project].[duration] = 9007199254740993;'
      });
    });

    it('throws an error if encountering parentheses in an attribute', () => {
      expect(() => sql.selectQuery(Project.tableName, {
        model: Project,
        attributes: [['count(*)', 'count']]
      }, Project)).to.throw('In order to fix the vulnerability CVE-2023-22578, we had to remove support for treating attributes as raw SQL if they included parentheses.');
    });

    it('escapes attributes with parentheses if attributeBehavior is escape', () => {
      const escapeSequelize = Support.createSequelizeInstance({
        attributeBehavior: 'escape'
      });

      expectsql(escapeSequelize.queryInterface.queryGenerator.selectQuery(Project.tableName, {
        model: Project,
        attributes: [['count(*)', 'count']]
      }, Project), {
        default: 'SELECT [count(*)] AS [count] FROM [Projects] AS [Project];',
        oracle: 'SELECT "count(*)" AS "count" FROM "Projects" "Project";'
      });
    });

    it('inlines attributes with parentheses if attributeBehavior is unsafe-legacy', () => {
      const escapeSequelize = Support.createSequelizeInstance({
        attributeBehavior: 'unsafe-legacy'
      });

      expectsql(escapeSequelize.queryInterface.queryGenerator.selectQuery(Project.tableName, {
        model: Project,
        attributes: [['count(*)', 'count']]
      }, Project), {
        default: 'SELECT count(*) AS [count] FROM [Projects] AS [Project];',
        oracle: 'SELECT count(*) AS "count" FROM "Projects" "Project";'
      });
    });
  });
});
