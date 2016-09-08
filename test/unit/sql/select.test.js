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

      User.Projects = User.belongsToMany(Project, { through: 'project_user' });
      Project.belongsToMany(User, { through: 'project_user' });

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
          attributes: ['projectId'],
          on: User.Projects,
          values: [
            1,
            5
          ]
        }
      }, {
        default: 'SELECT [user].* FROM ('+
          [
            '(SELECT [user].[id_user] AS [id], [projects].[userId] AS [projects.userId], [projects].[projectId] AS [projects.projectId] FROM [users] AS [user] INNER JOIN [project_user] AS [projects] ON [user].[id_user] = [projects].[userId] AND [projects].[projectId] = 1 ORDER BY [user].[last_name] ASC'+ (current.dialect.name === 'mssql' ? ', [user].[id_user]' : '') + sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+')',
            '(SELECT [user].[id_user] AS [id], [projects].[userId] AS [projects.userId], [projects].[projectId] AS [projects.projectId] FROM [users] AS [user] INNER JOIN [project_user] AS [projects] ON [user].[id_user] = [projects].[userId] AND [projects].[projectId] = 5 ORDER BY [user].[last_name] ASC'+ (current.dialect.name === 'mssql' ? ', [user].[id_user]' : '') +sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+')'
          ].join(current.dialect.supports['UNION ALL'] ?' UNION ALL ' : ' UNION ')
        +') AS [user];'
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

      var include = Model._validateIncludedElements({
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

      var nestedInclude = Model._validateIncludedElements({
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
        include: Model._validateIncludedElements({
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
        postgres: 'SELECT User.name, User.age, Posts.id AS "Posts.id", Posts.title AS "Posts.title" FROM User AS User LEFT OUTER JOIN Post AS Posts ON User.id = Posts.user_id;'
      });
    });


    test('nested include (left outer join)', function () {
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
      var Comment = Support.sequelize.define('Comment', {
          title: DataTypes.STRING
        },
        {
          freezeTableName: true
        });

      User.Posts = User.hasMany(Post, {foreignKey: 'user_id'});
      Post.Comments = Post.hasMany(Comment, {foreignKey: 'post_id'});

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
        default: 'SELECT [User].[name], [User].[age], [Posts].[id] AS [Posts.id], [Posts].[title] AS [Posts.title], [Posts.Comments].[id] AS [Posts.Comments.id], [Posts.Comments].[title] AS [Posts.Comments.title], [Posts.Comments].[createdAt] AS [Posts.Comments.createdAt], [Posts.Comments].[updatedAt] AS [Posts.Comments.updatedAt], [Posts.Comments].[post_id] AS [Posts.Comments.post_id] FROM [User] AS [User] LEFT OUTER JOIN [Post] AS [Posts] ON [User].[id] = [Posts].[user_id] LEFT OUTER JOIN [Comment] AS [Posts.Comments] ON [Posts].[id] = [Posts.Comments].[post_id];',
        postgres: 'SELECT User.name, User.age, Posts.id AS "Posts.id", Posts.title AS "Posts.title", "Posts.Comments".id AS "Posts.Comments.id", "Posts.Comments".title AS "Posts.Comments.title", "Posts.Comments".createdAt AS "Posts.Comments.createdAt", "Posts.Comments".updatedAt AS "Posts.Comments.updatedAt", "Posts.Comments".post_id AS "Posts.Comments.post_id" FROM User AS User LEFT OUTER JOIN Post AS Posts ON User.id = Posts.user_id LEFT OUTER JOIN Comment AS "Posts.Comments" ON Posts.id = "Posts.Comments".post_id;'
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
