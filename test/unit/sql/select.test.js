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
      +') AS [User];'
    });

    (function() {
      var User = Support.sequelize.define('user', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          field: 'id_user'
        }
      });
      var Project = Support.sequelize.define('project', {
        title: DataTypes.STRING
      });

      var ProjectUser = Support.sequelize.define('project_user', {
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
        default: 'SELECT [user].* FROM ('+
        [
          '(SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND [project_users].[project_id] = 1 ORDER BY [subquery_order_0] ASC'+ (current.dialect.name === 'mssql' ? ', [id_user]' : '') + sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+')',
          '(SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND [project_users].[project_id] = 5 ORDER BY [subquery_order_0] ASC'+ (current.dialect.name === 'mssql' ? ', [id_user]' : '') +sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+')'
        ].join(current.dialect.supports['UNION ALL'] ?' UNION ALL ' : ' UNION ')
        +') AS [user] ORDER BY [subquery_order_0] ASC;'
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
        default: 'SELECT [user].* FROM ('+
        [
          '(SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND [project_users].[project_id] = 1 AND [project_users].[status] = 1 ORDER BY [subquery_order_0] ASC'+ (current.dialect.name === 'mssql' ? ', [id_user]' : '') + sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+')',
          '(SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND [project_users].[project_id] = 5 AND [project_users].[status] = 1 ORDER BY [subquery_order_0] ASC'+ (current.dialect.name === 'mssql' ? ', [id_user]' : '') +sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+')'
        ].join(current.dialect.supports['UNION ALL'] ?' UNION ALL ' : ' UNION ')
        +') AS [user] ORDER BY [subquery_order_0] ASC;'
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
            $gte: 21
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
        default: 'SELECT [user].* FROM ('+
        [
          '(SELECT [user].[id_user] AS [id], [user].[id_user] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND [project_users].[project_id] = 1 WHERE [user].[age] >= 21 ORDER BY [subquery_order_0] ASC'+ (current.dialect.name === 'mssql' ? ', [id_user]' : '') + sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+')',
          '(SELECT [user].[id_user] AS [id], [user].[id_user] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND [project_users].[project_id] = 5 WHERE [user].[age] >= 21 ORDER BY [subquery_order_0] ASC'+ (current.dialect.name === 'mssql' ? ', [id_user]' : '') +sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+')'
        ].join(current.dialect.supports['UNION ALL'] ?' UNION ALL ' : ' UNION ')
        +') AS [user] ORDER BY [subquery_order_0] ASC;'
      });
    }());

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
        +') AS [user] LEFT OUTER JOIN [post] AS [POSTS] ON [user].[id] = [POSTS].[user_id];'
      });

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
        order: '[user].[last_name] ASC'.replace(/\[/g, Support.sequelize.dialect.TICK_CHAR_LEFT).replace(/\]/g, Support.sequelize.dialect.TICK_CHAR_RIGHT),
        limit: 30,
        offset: 10,
        hasMultiAssociation: true,//must be set only for mssql dialect here
        subQuery: true
      }, {
          default: 'SELECT [user].*, [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title] FROM (' +
            'SELECT [user].[id_user] AS [id], [user].[email], [user].[first_name] AS [firstName], [user].[last_name] AS [lastName] FROM [users] AS [user] ORDER BY [user].[last_name] ASC' +
             sql.addLimitAndOffset({ limit: 30, offset:10, order: '`user`.`last_name` ASC' }) +
          ') AS [user] LEFT OUTER JOIN [post] AS [POSTS] ON [user].[id_user] = [POSTS].[user_id] ORDER BY [user].[last_name] ASC;'
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
        default: 'SELECT [User].[name], [User].[age], [Posts].[id] AS [Posts.id], [Posts].[title] AS [Posts.title] FROM [User] AS [User] LEFT OUTER JOIN [Post] AS [Posts] ON [User].[id] = [Posts].[user_id];'
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
        postgres: 'SELECT * FROM User;'
      });
    });

    test('with attributes', function () {
      expectsql(sql.selectQuery('User', {
        attributes: ['name', 'age']
      }), {
        default: 'SELECT [name], [age] FROM [User];',
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
        mssql: "SELECT * FROM [User] HAVING name IN (1,N'test',3,N'derp');"
      });
    });
  });
});
