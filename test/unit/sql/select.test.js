'use strict';

/* jshint -W110 */
var Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , Model = require(__dirname + '/../../../lib/model')
  , util = require('util')
  , expectsql = Support.expectsql
  , current   = Support.sequelize
  , sql       = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

suite(Support.getTestDialectTeaser('SQL'), function() {
  suite('select', function () {
    var testsql = function (options, expectation) {
      var model = options.model;

      test(util.inspect(options, {depth: 2}), function () {
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
      oracle: 'SELECT "email", "first_name" AS "firstName" FROM "User" WHERE "User"."email" = \'jon.snow@gmail.com\'',
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
      default: 'SELECT [User].* FROM ('+
        [
          '(SELECT [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [User] WHERE [User].[companyId] = 1 ORDER BY [last_name] ASC'+sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+')',
          '(SELECT [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [User] WHERE [User].[companyId] = 5 ORDER BY [last_name] ASC'+sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+')'
        ].join(current.dialect.supports['UNION ALL'] ?' UNION ALL ' : ' UNION ')
      +') AS [User];',
      oracle: 'SELECT "User".* FROM ('+
        [
          '(SELECT "email", "first_name" AS "firstName", "last_name" AS "lastName" FROM "User" WHERE "User"."companyId" = 1 AND ROWNUM <= 3 ORDER BY "last_name" ASC)',
          '(SELECT "email", "first_name" AS "firstName", "last_name" AS "lastName" FROM "User" WHERE "User"."companyId" = 5 AND ROWNUM <= 3 ORDER BY "last_name" ASC)'
        ].join(current.dialect.supports['UNION ALL'] ?' UNION ALL ' : ' UNION ')
      +') "User"'
    });

    (function () {
      var User = Support.sequelize.define('user', {
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
      var Post = Support.sequelize.define('Post', {
        title: DataTypes.STRING,
        userId: {
          type: DataTypes.INTEGER,
          field: 'user_id'
        }
      },
      {
        tableName: 'post'
      });

      User.Posts = User.hasMany(Post, {foreignKey: 'userId', as: 'POSTS'});

      var Comment = Support.sequelize.define('Comment', {
        title: DataTypes.STRING,
        postId: {
          type: DataTypes.INTEGER,
          field: 'post_id'
        }
      },
      {
        tableName: 'comment'
      });

      Post.Comments = Post.hasMany(Comment, {foreignKey: 'postId', as: 'COMMENTS'});

      var include = Model.$validateIncludedElements({
        include: [{
          attributes: ['title'],
          association: User.Posts
        }],
        model: User
      }).include;

      testsql({
        table: User.getTableName(),
        model: User,
        include: include,
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
        default: 'SELECT [user].*, [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title] FROM ('+
          [
            '(SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE [user].[companyId] = 1 ORDER BY [user].[last_name] ASC'+sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+')',
            '(SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE [user].[companyId] = 5 ORDER BY [user].[last_name] ASC'+sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+')'
          ].join(current.dialect.supports['UNION ALL'] ?' UNION ALL ' : ' UNION ')
        +') AS [user] LEFT OUTER JOIN [post] AS [POSTS] ON [user].[id] = [POSTS].[user_id];',
        oracle: 'SELECT "user".*, "POSTS"."id" AS "POSTS.id", "POSTS"."title" AS "POSTS.title" FROM ('+
          [
            '(SELECT "id_user" AS "id", "email", "first_name" AS "firstName", "last_name" AS "lastName" FROM "users" "user" WHERE "user"."companyId" = 1 AND ROWNUM <= 3 ORDER BY "user"."last_name" ASC'+sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+')',
            '(SELECT "id_user" AS "id", "email", "first_name" AS "firstName", "last_name" AS "lastName" FROM "users" "user" WHERE "user"."companyId" = 5 AND ROWNUM <= 3 ORDER BY "user"."last_name" ASC'+sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+')'
          ].join(current.dialect.supports['UNION ALL'] ?' UNION ALL ' : ' UNION ')
        +') "user" LEFT OUTER JOIN "post" "POSTS" ON "user"."id" = "POSTS"."user_id"'
      });

      var nestedInclude = Model.$validateIncludedElements({
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
        default: 'SELECT [user].*, [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title], [POSTS.COMMENTS].[id] AS [POSTS.COMMENTS.id], [POSTS.COMMENTS].[title] AS [POSTS.COMMENTS.title] FROM ('+
          [
            '(SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE [user].[companyId] = 1 ORDER BY [user].[last_name] ASC'+sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+')',
            '(SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE [user].[companyId] = 5 ORDER BY [user].[last_name] ASC'+sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+')'
          ].join(current.dialect.supports['UNION ALL'] ?' UNION ALL ' : ' UNION ')
        +') AS [user] LEFT OUTER JOIN [post] AS [POSTS] ON [user].[id] = [POSTS].[user_id] LEFT OUTER JOIN [comment] AS [POSTS.COMMENTS] ON [POSTS].[id] = [POSTS.COMMENTS].[post_id];'
      });
    })();

    it('include (left outer join)', function () {
      var User = Support.sequelize.define('User', {
        name: DataTypes.STRING,
        age: DataTypes.INTEGER
      },
      {
        freezeTableName: true
      });
      var Post = Support.sequelize.define('Post', {
        title: DataTypes.STRING
      },
      {
        freezeTableName: true
      });

      User.Posts = User.hasMany(Post, {foreignKey: 'user_id'});

      expectsql(sql.selectQuery('User', {
        attributes: ['name', 'age'],
        include: Model.$validateIncludedElements({
          include: [{
            attributes: ['title'],
            association: User.Posts
          }],
          model: User
        }).include,
        model: User
      }, User), {
        default: 'SELECT [User].[name], [User].[age], [Posts].[id] AS [Posts.id], [Posts].[title] AS [Posts.title] FROM [User] AS [User] LEFT OUTER JOIN [Post] AS [Posts] ON [User].[id] = [Posts].[user_id];',
        oracle: 'SELECT "User"."name", "User"."age", "Posts"."id" AS "Posts.id", "Posts"."title" AS "Posts.title" FROM "User" "User" LEFT OUTER JOIN "Post" "Posts" ON "User"."id" = "Posts"."user_id"'
      });
    });
  });

  suite('queryIdentifiersFalse', function () {
    suiteSetup(function () {
      sql.options.quoteIdentifiers = false;
    });
    suiteTeardown(function () {
      sql.options.quoteIdentifiers = true;
    });

    test('*', function () {
      expectsql(sql.selectQuery('User'), {
        default: 'SELECT * FROM [User];',
        oracle: 'SELECT * FROM "User"',
        postgres: 'SELECT * FROM User;'
      });
    });

    test('with attributes', function () {
      expectsql(sql.selectQuery('User', {
        attributes: ['name', 'age']
      }), {
        default: 'SELECT [name], [age] FROM [User];',
        oracle: 'SELECT "name", "age" FROM "User"',
        postgres: 'SELECT name, age FROM User;'
      });
    });

    test('include (left outer join)', function () {
      var User = Support.sequelize.define('User', {
        name: DataTypes.STRING,
        age: DataTypes.INTEGER
      },
      {
        freezeTableName: true
      });
      var Post = Support.sequelize.define('Post', {
        title: DataTypes.STRING
      },
      {
        freezeTableName: true
      });

      User.Posts = User.hasMany(Post, {foreignKey: 'user_id'});

      expectsql(sql.selectQuery('User', {
        attributes: ['name', 'age'],
        include: Model.$validateIncludedElements({
          include: [{
            attributes: ['title'],
            association: User.Posts
          }],
          model: User
        }).include,
        model: User
      }, User), {
        default: 'SELECT [User].[name], [User].[age], [Posts].[id] AS [Posts.id], [Posts].[title] AS [Posts.title] FROM [User] AS [User] LEFT OUTER JOIN [Post] AS [Posts] ON [User].[id] = [Posts].[user_id];',
        oracle:  'SELECT "User"."name", "User"."age", "Posts"."id" AS "Posts.id", "Posts"."title" AS "Posts.title" FROM "User" "User" LEFT OUTER JOIN "Post" "Posts" ON "User"."id" = "Posts"."user_id"',
        postgres: 'SELECT User.name, User.age, Posts.id AS "Posts.id", Posts.title AS "Posts.title" FROM User AS User LEFT OUTER JOIN Post AS Posts ON User.id = Posts.user_id;'
      });
    });

  });

  suite('raw query', function () {
    test('raw replacements', function () {
      expectsql(sql.selectQuery('User', {
        attributes: ['*'],
        having: ['name IN (?)', [1, 'test', 3, "derp"]]
      }), {
        default: "SELECT * FROM [User] HAVING name IN (1,'test',3,'derp');",
        oracle:  "SELECT * FROM \"User\" HAVING name IN (1,'test',3,'derp')",
        mssql: "SELECT * FROM [User] HAVING name IN (1,N'test',3,N'derp');"
      });
    });
  });
});
