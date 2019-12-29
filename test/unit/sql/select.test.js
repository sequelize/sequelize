'use strict';

const Support   = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  Model = require(__dirname + '/../../../lib/model'),
  util = require('util'),
  chai = require('chai'),
  expect = chai.expect,
  expectsql = Support.expectsql,
  current   = Support.sequelize,
  sql       = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

suite(Support.getTestDialectTeaser('SQL'), () => {
  suite('select', () => {
    const testsql = function(options, expectation) {
      const model = options.model;

      test(util.inspect(options, {depth: 2}), () => {
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
          'SELECT * FROM (SELECT [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [User] WHERE [User].[companyId] = 1 ORDER BY [last_name] ASC'+sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+') AS sub',
          'SELECT * FROM (SELECT [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [User] WHERE [User].[companyId] = 5 ORDER BY [last_name] ASC'+sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+') AS sub'
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
        default: 'SELECT [user].* FROM ('+
          [
            'SELECT * FROM (SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND [project_users].[project_id] = 1 ORDER BY [subquery_order_0] ASC'+ (current.dialect.name === 'mssql' ? ', [user].[id_user]' : '') + sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+') AS sub',
            'SELECT * FROM (SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND [project_users].[project_id] = 5 ORDER BY [subquery_order_0] ASC'+ (current.dialect.name === 'mssql' ? ', [user].[id_user]' : '') +sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+') AS sub'
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
          'SELECT * FROM (SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND [project_users].[project_id] = 1 AND [project_users].[status] = 1 ORDER BY [subquery_order_0] ASC'+ (current.dialect.name === 'mssql' ? ', [user].[id_user]' : '') + sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+') AS sub',
          'SELECT * FROM (SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND [project_users].[project_id] = 5 AND [project_users].[status] = 1 ORDER BY [subquery_order_0] ASC'+ (current.dialect.name === 'mssql' ? ', [user].[id_user]' : '') +sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+') AS sub'
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
            'SELECT * FROM (SELECT [user].[id_user] AS [id], [user].[id_user] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND [project_users].[project_id] = 1 WHERE [user].[age] >= 21 ORDER BY [subquery_order_0] ASC'+ (current.dialect.name === 'mssql' ? ', [user].[id_user]' : '') + sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+') AS sub',
            'SELECT * FROM (SELECT [user].[id_user] AS [id], [user].[id_user] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND [project_users].[project_id] = 5 WHERE [user].[age] >= 21 ORDER BY [subquery_order_0] ASC'+ (current.dialect.name === 'mssql' ? ', [user].[id_user]' : '') +sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+') AS sub'
          ].join(current.dialect.supports['UNION ALL'] ?' UNION ALL ' : ' UNION ')
        +') AS [user] ORDER BY [subquery_order_0] ASC;'
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

      User.Posts = User.hasMany(Post, {foreignKey: 'userId', as: 'POSTS'});

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

      Post.Comments = Post.hasMany(Comment, {foreignKey: 'postId', as: 'COMMENTS'});

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
        default: 'SELECT [user].*, [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title] FROM ('+
          [
            'SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE [user].[companyId] = 1 ORDER BY [user].[last_name] ASC'+sql.addLimitAndOffset({ limit: 3, order: [['last_name', 'ASC']] })+') AS sub',
            'SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE [user].[companyId] = 5 ORDER BY [user].[last_name] ASC'+sql.addLimitAndOffset({ limit: 3, order: [['last_name', 'ASC']] })+') AS sub'
          ].join(current.dialect.supports['UNION ALL'] ?' UNION ALL ' : ' UNION ')
        +') AS [user] LEFT OUTER JOIN [post] AS [POSTS] ON [user].[id] = [POSTS].[user_id];'
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
        default: 'SELECT [user].*, [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title] FROM (' +
                       'SELECT [user].[id_user] AS [id], [user].[email], [user].[first_name] AS [firstName], [user].[last_name] AS [lastName] FROM [users] AS [user] ORDER BY [user].[last_name] ASC' +
                       sql.addLimitAndOffset({ limit: 30, offset: 10, order: [['`user`.`last_name`', 'ASC']]}) +
                   ') AS [user] LEFT OUTER JOIN [post] AS [POSTS] ON [user].[id_user] = [POSTS].[user_id] ORDER BY [user].[last_name] ASC;'
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
        default: 'SELECT [user].*, [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title], [POSTS->COMMENTS].[id] AS [POSTS.COMMENTS.id], [POSTS->COMMENTS].[title] AS [POSTS.COMMENTS.title] FROM ('+
          [
            'SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE [user].[companyId] = 1 ORDER BY [user].[last_name] ASC'+sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+') AS sub',
            'SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE [user].[companyId] = 5 ORDER BY [user].[last_name] ASC'+sql.addLimitAndOffset({ limit: 3, order: ['last_name', 'ASC'] })+') AS sub'
          ].join(current.dialect.supports['UNION ALL'] ?' UNION ALL ' : ' UNION ')
        +') AS [user] LEFT OUTER JOIN [post] AS [POSTS] ON [user].[id] = [POSTS].[user_id] LEFT OUTER JOIN [comment] AS [POSTS->COMMENTS] ON [POSTS].[id] = [POSTS->COMMENTS].[post_id];'
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

    it('include (subQuery alias)', () => {
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

      User.Posts = User.hasMany(Post, {foreignKey: 'user_id', as: 'postaliasname'});

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
        default: 'SELECT [User].*, [postaliasname].[id] AS [postaliasname.id], [postaliasname].[title] AS [postaliasname.title] FROM ' +
          '(SELECT [User].[name], [User].[age], [User].[id] AS [id] FROM [User] AS [User] ' +
          'WHERE ( SELECT [user_id] FROM [Post] AS [postaliasname] WHERE ([postaliasname].[user_id] = [User].[id]) LIMIT 1 ) IS NOT NULL) AS [User] ' +
          'INNER JOIN [Post] AS [postaliasname] ON [User].[id] = [postaliasname].[user_id];',
        mssql: 'SELECT [User].*, [postaliasname].[id] AS [postaliasname.id], [postaliasname].[title] AS [postaliasname.title] FROM ' +
          '(SELECT [User].[name], [User].[age], [User].[id] AS [id] FROM [User] AS [User] ' +
          'WHERE ( SELECT [user_id] FROM [Post] AS [postaliasname] WHERE ([postaliasname].[user_id] = [User].[id]) ORDER BY [postaliasname].[id] OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY ) IS NOT NULL) AS [User] ' +
          'INNER JOIN [Post] AS [postaliasname] ON [User].[id] = [postaliasname].[user_id];'
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
        mysql: 'SELECT `name`, `age`, `data` FROM `User` AS `User` WHERE `User`.`data` IN (X\'313233\');',
        sqlite: 'SELECT `name`, `age`, `data` FROM `User` AS `User` WHERE `User`.`data` IN (X\'313233\');',
        mssql: 'SELECT [name], [age], [data] FROM [User] AS [User] WHERE [User].[data] IN (0x313233);'
      });
    });

    suite('attribute escaping', () => {
      test('plain attributes (1)', () => {
        expectsql(sql.selectQuery('User', {
          attributes: ['* FROM [User]; DELETE FROM [User];SELECT [id]'.replace(/\[/g, Support.sequelize.dialect.TICK_CHAR_LEFT).replace(/\]/g, Support.sequelize.dialect.TICK_CHAR_RIGHT)]
        }), {
          default: 'SELECT \'* FROM [User]; DELETE FROM [User];SELECT [id]\' FROM [User];',
          mssql: 'SELECT [* FROM User; DELETE FROM User;SELECT id] FROM [User];'
        });
      });

      test('plain attributes (2)', () => {
        expectsql(sql.selectQuery('User', {
          attributes: ['* FROM User; DELETE FROM User;SELECT id']
        }), {
          default: 'SELECT [* FROM User; DELETE FROM User;SELECT id] FROM [User];'
        });
      });

      test('plain attributes (3)', () => {
        expectsql(sql.selectQuery('User', {
          attributes: ['a\', * FROM User; DELETE FROM User;SELECT id']
        }), {
          default: "SELECT [a\', * FROM User; DELETE FROM User;SELECT id] FROM [User];",
          mssql: 'SELECT [a, * FROM User; DELETE FROM User;SELECT id] FROM [User];'
        });
      });

      test('plain attributes (4)', () => {
        expectsql(sql.selectQuery('User', {
          attributes: ['*, COUNT(*) FROM User; DELETE FROM User;SELECT id']
        }), {
          default: 'SELECT [*, COUNT(*) FROM User; DELETE FROM User;SELECT id] FROM [User];'
        });
      });

      test('aliased attributes (1)', () => {
        expectsql(sql.selectQuery('User', {
          attributes: [
            ['* FROM [User]; DELETE FROM [User];SELECT [id]'.replace(/\[/g, Support.sequelize.dialect.TICK_CHAR_LEFT).replace(/\]/g, Support.sequelize.dialect.TICK_CHAR_RIGHT), 'myCol']
          ]
        }), {
          default: 'SELECT [* FROM User; DELETE FROM User;SELECT id] AS [myCol] FROM [User];'
        });
      });

      test('aliased attributes (2)', () => {
        expectsql(sql.selectQuery('User', {
          attributes: [
            ['* FROM User; DELETE FROM User;SELECT id', 'myCol']
          ]
        }), {
          default: 'SELECT [* FROM User; DELETE FROM User;SELECT id] AS [myCol] FROM [User];'
        });
      });

      test('aliased attributes (3)', () => {
        expectsql(sql.selectQuery('User', {
          attributes: [
            ['id', '* FROM User; DELETE FROM User;SELECT id']
          ]
        }), {
          default: 'SELECT [id] AS [* FROM User; DELETE FROM User;SELECT id] FROM [User];'
        });
      });

      test('attributes from includes', () => {
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

        User.Posts = User.hasMany(Post, {foreignKey: 'user_id'});

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
          default: 'SELECT [User].[name], [User].[age], [Posts].[id] AS [Posts.id], [Posts].[* FROM User; DELETE FROM User;SELECT id] AS [Posts.* FROM User; DELETE FROM User;SELECT id] FROM [User] AS [User] LEFT OUTER JOIN [Post] AS [Posts] ON [User].[id] = [Posts].[user_id];'
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
          default: 'SELECT [User].[name], [User].[age], [Posts].[id] AS [Posts.id], [Posts].[* FROM User; DELETE FROM User;SELECT id] AS [Posts.data] FROM [User] AS [User] LEFT OUTER JOIN [Post] AS [Posts] ON [User].[id] = [Posts].[user_id];'
        });
      });
    });
  });

  suite('queryIdentifiersFalse', () => {
    suiteSetup(() => {
      sql.options.quoteIdentifiers = false;
    });
    suiteTeardown(() => {
      sql.options.quoteIdentifiers = true;
    });

    test('*', () => {
      expectsql(sql.selectQuery('User'), {
        default: 'SELECT * FROM [User];',
        postgres: 'SELECT * FROM User;'
      });
    });

    test('with attributes', () => {
      expectsql(sql.selectQuery('User', {
        attributes: ['name', 'age']
      }), {
        default: 'SELECT [name], [age] FROM [User];',
        postgres: 'SELECT name, age FROM User;'
      });
    });

    test('include (left outer join)', () => {
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


    test('nested include (left outer join)', () => {
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
        default: 'SELECT [User].[name], [User].[age], [Posts].[id] AS [Posts.id], [Posts].[title] AS [Posts.title], [Posts->Comments].[id] AS [Posts.Comments.id], [Posts->Comments].[title] AS [Posts.Comments.title], [Posts->Comments].[createdAt] AS [Posts.Comments.createdAt], [Posts->Comments].[updatedAt] AS [Posts.Comments.updatedAt], [Posts->Comments].[post_id] AS [Posts.Comments.post_id] FROM [User] AS [User] LEFT OUTER JOIN [Post] AS [Posts] ON [User].[id] = [Posts].[user_id] LEFT OUTER JOIN [Comment] AS [Posts->Comments] ON [Posts].[id] = [Posts->Comments].[post_id];',
        postgres: 'SELECT User.name, User.age, Posts.id AS "Posts.id", Posts.title AS "Posts.title", "Posts->Comments".id AS "Posts.Comments.id", "Posts->Comments".title AS "Posts.Comments.title", "Posts->Comments".createdAt AS "Posts.Comments.createdAt", "Posts->Comments".updatedAt AS "Posts.Comments.updatedAt", "Posts->Comments".post_id AS "Posts.Comments.post_id" FROM User AS User LEFT OUTER JOIN Post AS Posts ON User.id = Posts.user_id LEFT OUTER JOIN Comment AS "Posts->Comments" ON Posts.id = "Posts->Comments".post_id;'
      });
    });

  });

  suite('raw query', () => {
    test('raw replacements for where', () => {
      expect(() => {
        sql.selectQuery('User', {
          attributes: ['*'],
          where: ['name IN (?)', [1, 'test', 3, 'derp']]
        });
      }).to.throw(Error, 'Support for literal replacements in the `where` object has been removed.');
    });

    test('raw replacements for nested where', () => {
      expect(() => {
        sql.selectQuery('User', {
          attributes: ['*'],
          where: [['name IN (?)', [1, 'test', 3, 'derp']]]
        });
      }).to.throw(Error, 'Support for literal replacements in the `where` object has been removed.');
    });

    test('raw replacements for having', () => {
      expect(() => {
        sql.selectQuery('User', {
          attributes: ['*'],
          having: ['name IN (?)', [1, 'test', 3, 'derp']]
        });
      }).to.throw(Error, 'Support for literal replacements in the `where` object has been removed.');
    });

    test('raw replacements for nested having', () => {
      expect(() => {
        sql.selectQuery('User', {
          attributes: ['*'],
          having: [['name IN (?)', [1, 'test', 3, 'derp']]]
        });
      }).to.throw(Error, 'Support for literal replacements in the `where` object has been removed.');
    });

    test('raw string from where', () => {
      expect(() => {
        sql.selectQuery('User', {
          attributes: ['*'],
          where: 'name = \'something\''
        });
      }).to.throw(Error, 'Support for `{where: \'raw query\'}` has been removed.');
    });

    test('raw string from having', () => {
      expect(() => {
        sql.selectQuery('User', {
          attributes: ['*'],
          having: 'name = \'something\''
        });
      }).to.throw(Error, 'Support for `{where: \'raw query\'}` has been removed.');
    });
  });
});
