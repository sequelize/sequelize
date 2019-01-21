'use strict';

const Support = require('../support'),
  DataTypes = require('../../../lib/data-types'),
  Model = require('../../../lib/model'),
  util = require('util'),
  chai = require('chai'),
  expect = chai.expect,
  expectsql = Support.expectsql,
  current = Support.sequelize,
  sql = current.dialect.QueryGenerator,
  Op = Support.Sequelize.Op;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('select', () => {
    const testsql = function(options, expectation) {
      const model = options.model;

      it(util.inspect(options, { depth: 2 }), () => {
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
      query: {
        default: 'SELECT [email], [first_name] AS [firstName] FROM [User] WHERE [User].[email] = $1 ORDER BY [email] DESC LIMIT $2;',
        mssql: 'SELECT [email], [first_name] AS [firstName] FROM [User] WHERE [User].[email] = @0 ORDER BY [email] DESC OFFSET 0 ROWS FETCH NEXT @1 ROWS ONLY;'
      },
      bind: {
        default: ['jon.snow@gmail.com', 10]
      }
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
      query: {
        default: `SELECT [User].* FROM (${
          [
            'SELECT * FROM (SELECT [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [User] WHERE ([User].[companyId] = $1) ORDER BY [last_name] ASC LIMIT $2) AS sub',
            'SELECT * FROM (SELECT [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [User] WHERE ([User].[companyId] = $3) ORDER BY [last_name] ASC LIMIT $4) AS sub'
          ].join(current.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ')
        }) AS [User];`,
        mssql: `SELECT [User].* FROM (${
          [
            'SELECT * FROM (SELECT [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [User] WHERE ([User].[companyId] = @0) ORDER BY [last_name] ASC OFFSET 0 ROWS FETCH NEXT @1 ROWS ONLY) AS sub',
            'SELECT * FROM (SELECT [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [User] WHERE ([User].[companyId] = @2) ORDER BY [last_name] ASC OFFSET 0 ROWS FETCH NEXT @3 ROWS ONLY) AS sub'
          ].join(current.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ')
        }) AS [User];`
      },
      bind: {
        default: [1, 3, 5, 3]
      }
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
        query: {
          default: `SELECT [user].* FROM (${
            [
              'SELECT * FROM (SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND ([project_users].[project_id] = $1) ORDER BY [subquery_order_0] ASC LIMIT $2) AS sub',
              'SELECT * FROM (SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND ([project_users].[project_id] = $3) ORDER BY [subquery_order_0] ASC LIMIT $4) AS sub'
            ].join(current.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ')
          }) AS [user] ORDER BY [subquery_order_0] ASC;`,
          mssql: `SELECT [user].* FROM (${
            [
              'SELECT * FROM (SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND ([project_users].[project_id] = @0) ORDER BY [subquery_order_0] ASC, [user].[id_user] OFFSET 0 ROWS FETCH NEXT @1 ROWS ONLY) AS sub',
              'SELECT * FROM (SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND ([project_users].[project_id] = @2) ORDER BY [subquery_order_0] ASC, [user].[id_user] OFFSET 0 ROWS FETCH NEXT @3 ROWS ONLY) AS sub'
            ].join(current.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ')
          }) AS [user] ORDER BY [subquery_order_0] ASC;`
        },
        bind: {
          default: [1, 3, 5, 3]
        }
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
        query: {
          default: `SELECT [user].* FROM (${
            [
              'SELECT * FROM (SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND ([project_users].[project_id] = $1 AND [project_users].[status] = $2) ORDER BY [subquery_order_0] ASC LIMIT $3) AS sub',
              'SELECT * FROM (SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND ([project_users].[project_id] = $4 AND [project_users].[status] = $5) ORDER BY [subquery_order_0] ASC LIMIT $6) AS sub'
            ].join(current.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ')
          }) AS [user] ORDER BY [subquery_order_0] ASC;`,
          mssql: `SELECT [user].* FROM (${
            [
              'SELECT * FROM (SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND ([project_users].[project_id] = @0 AND [project_users].[status] = @1) ORDER BY [subquery_order_0] ASC, [user].[id_user] OFFSET 0 ROWS FETCH NEXT @2 ROWS ONLY) AS sub',
              'SELECT * FROM (SELECT [user].[id_user] AS [id], [user].[last_name] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND ([project_users].[project_id] = @3 AND [project_users].[status] = @4) ORDER BY [subquery_order_0] ASC, [user].[id_user] OFFSET 0 ROWS FETCH NEXT @5 ROWS ONLY) AS sub'
            ].join(current.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ')
          }) AS [user] ORDER BY [subquery_order_0] ASC;`
        },
        bind: {
          default: [1, 1, 3, 5, 1, 3]
        }
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
        query: {
          default: `SELECT [user].* FROM (${
            [
              'SELECT * FROM (SELECT [user].[id_user] AS [id], [user].[id_user] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND ([project_users].[project_id] = $1) WHERE [user].[age] >= $2 ORDER BY [subquery_order_0] ASC LIMIT $3) AS sub',
              'SELECT * FROM (SELECT [user].[id_user] AS [id], [user].[id_user] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND ([project_users].[project_id] = $4) WHERE [user].[age] >= $5 ORDER BY [subquery_order_0] ASC LIMIT $6) AS sub'
            ].join(current.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ')
          }) AS [user] ORDER BY [subquery_order_0] ASC;`,
          mssql: `SELECT [user].* FROM (${
            [
              'SELECT * FROM (SELECT [user].[id_user] AS [id], [user].[id_user] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND ([project_users].[project_id] = @0) WHERE [user].[age] >= @1 ORDER BY [subquery_order_0] ASC, [user].[id_user] OFFSET 0 ROWS FETCH NEXT @2 ROWS ONLY) AS sub',
              'SELECT * FROM (SELECT [user].[id_user] AS [id], [user].[id_user] AS [subquery_order_0], [project_users].[user_id] AS [project_users.userId], [project_users].[project_id] AS [project_users.projectId] FROM [users] AS [user] INNER JOIN [project_users] AS [project_users] ON [user].[id_user] = [project_users].[user_id] AND ([project_users].[project_id] = @3) WHERE [user].[age] >= @4 ORDER BY [subquery_order_0] ASC, [user].[id_user] OFFSET 0 ROWS FETCH NEXT @5 ROWS ONLY) AS sub'
            ].join(current.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ')
          }) AS [user] ORDER BY [subquery_order_0] ASC;`
        },
        bind: {
          default: [1, 21, 3, 5, 21, 3]
        }
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
        query: {
          default: `SELECT [user].*, [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title] FROM (${
            [
              'SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE ([user].[companyId] = $1) ORDER BY [user].[last_name] ASC LIMIT $2) AS sub',
              'SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE ([user].[companyId] = $3) ORDER BY [user].[last_name] ASC LIMIT $4) AS sub'
            ].join(current.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ')
          }) AS [user] LEFT OUTER JOIN [post] AS [POSTS] ON [user].[id] = [POSTS].[user_id];`,
          mssql: `SELECT [user].*, [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title] FROM (${
            [
              'SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE ([user].[companyId] = @0) ORDER BY [user].[last_name] ASC OFFSET 0 ROWS FETCH NEXT @1 ROWS ONLY) AS sub',
              'SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE ([user].[companyId] = @2) ORDER BY [user].[last_name] ASC OFFSET 0 ROWS FETCH NEXT @3 ROWS ONLY) AS sub'
            ].join(current.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ')
          }) AS [user] LEFT OUTER JOIN [post] AS [POSTS] ON [user].[id] = [POSTS].[user_id];`
        },
        bind: {
          default: [1, 3, 5, 3]
        }
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
        query: {
          default: `${'SELECT [user].*, [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title] FROM (' +
                         'SELECT [user].[id_user] AS [id], [user].[email], [user].[first_name] AS [firstName], [user].[last_name] AS [lastName] FROM [users] AS [user] ORDER BY [user].[last_name] ASC'} LIMIT $1, $2) AS [user] LEFT OUTER JOIN [post] AS [POSTS] ON [user].[id_user] = [POSTS].[user_id] ORDER BY [user].[last_name] ASC;`,
          postgres: `${'SELECT "user".*, "POSTS"."id" AS "POSTS.id", "POSTS"."title" AS "POSTS.title" FROM (' +
                         'SELECT "user"."id_user" AS "id", "user"."email", "user"."first_name" AS "firstName", "user"."last_name" AS "lastName" FROM "users" AS "user" ORDER BY "user"."last_name" ASC'} LIMIT $1 OFFSET $2) AS "user" LEFT OUTER JOIN "post" AS "POSTS" ON "user"."id_user" = "POSTS"."user_id" ORDER BY "user"."last_name" ASC;`,
          mssql: `${'SELECT [user].*, [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title] FROM (' +
                         'SELECT [user].[id_user] AS [id], [user].[email], [user].[first_name] AS [firstName], [user].[last_name] AS [lastName] FROM [users] AS [user] ORDER BY [user].[last_name] ASC'} OFFSET @0 ROWS FETCH NEXT @1 ROWS ONLY) AS [user] LEFT OUTER JOIN [post] AS [POSTS] ON [user].[id_user] = [POSTS].[user_id] ORDER BY [user].[last_name] ASC;`
        },
        bind: {
          default: [10, 30],
          postgres: [30, 10]
        }
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
        query: {
          default: `SELECT [user].*, [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title], [POSTS->COMMENTS].[id] AS [POSTS.COMMENTS.id], [POSTS->COMMENTS].[title] AS [POSTS.COMMENTS.title] FROM (${
            [
              'SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE ([user].[companyId] = $1) ORDER BY [user].[last_name] ASC LIMIT $2) AS sub',
              'SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE ([user].[companyId] = $3) ORDER BY [user].[last_name] ASC LIMIT $4) AS sub'
            ].join(current.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ')
          }) AS [user] LEFT OUTER JOIN [post] AS [POSTS] ON [user].[id] = [POSTS].[user_id] LEFT OUTER JOIN [comment] AS [POSTS->COMMENTS] ON [POSTS].[id] = [POSTS->COMMENTS].[post_id];`,
          mssql: `SELECT [user].*, [POSTS].[id] AS [POSTS.id], [POSTS].[title] AS [POSTS.title], [POSTS->COMMENTS].[id] AS [POSTS.COMMENTS.id], [POSTS->COMMENTS].[title] AS [POSTS.COMMENTS.title] FROM (${
            [
              'SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE ([user].[companyId] = @0) ORDER BY [user].[last_name] ASC OFFSET 0 ROWS FETCH NEXT @1 ROWS ONLY) AS sub',
              'SELECT * FROM (SELECT [id_user] AS [id], [email], [first_name] AS [firstName], [last_name] AS [lastName] FROM [users] AS [user] WHERE ([user].[companyId] = @2) ORDER BY [user].[last_name] ASC OFFSET 0 ROWS FETCH NEXT @3 ROWS ONLY) AS sub'
            ].join(current.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ')
          }) AS [user] LEFT OUTER JOIN [post] AS [POSTS] ON [user].[id] = [POSTS].[user_id] LEFT OUTER JOIN [comment] AS [POSTS->COMMENTS] ON [POSTS].[id] = [POSTS->COMMENTS].[post_id];`
        },
        bind: {
          default: [1, 3, 5, 3]
        }
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

      User.Posts = User.hasMany(Post, { foreignKey: 'user_id', as: 'postaliasname' });

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
        query: {
          default: 'SELECT [User].*, [postaliasname].[id] AS [postaliasname.id], [postaliasname].[title] AS [postaliasname.title] FROM ' +
            '(SELECT [User].[name], [User].[age], [User].[id] AS [id] FROM [User] AS [User] ' +
            'WHERE ( SELECT [user_id] FROM [Post] AS [postaliasname] WHERE ([postaliasname].[user_id] = [User].[id]) LIMIT $1 ) IS NOT NULL) AS [User] ' +
            'INNER JOIN [Post] AS [postaliasname] ON [User].[id] = [postaliasname].[user_id];',
          mssql: 'SELECT [User].*, [postaliasname].[id] AS [postaliasname.id], [postaliasname].[title] AS [postaliasname.title] FROM ' +
            '(SELECT [User].[name], [User].[age], [User].[id] AS [id] FROM [User] AS [User] ' +
            'WHERE ( SELECT [user_id] FROM [Post] AS [postaliasname] WHERE ([postaliasname].[user_id] = [User].[id]) ORDER BY [postaliasname].[id] OFFSET 0 ROWS FETCH NEXT @0 ROWS ONLY ) IS NOT NULL) AS [User] ' +
            'INNER JOIN [Post] AS [postaliasname] ON [User].[id] = [postaliasname].[user_id];'
        },
        bind: {
          default: [1]
        }
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
        query: {
          default: 'SELECT [name], [age], [data] FROM [User] AS [User] WHERE [User].[data] IN ($1);'
        },
        bind: {
          default: [Buffer.from('123')]
        }
      });
    });

    describe('attribute escaping', () => {
      it('plain attributes (1)', () => {
        expectsql(sql.selectQuery('User', {
          attributes: ['* FROM [User]; DELETE FROM [User];SELECT [id]'.replace(/\[/g, Support.sequelize.dialect.TICK_CHAR_LEFT).replace(/\]/g, Support.sequelize.dialect.TICK_CHAR_RIGHT)]
        }), {
          default: 'SELECT \'* FROM [User]; DELETE FROM [User];SELECT [id]\' FROM [User];',
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
          default: "SELECT [a\', * FROM User; DELETE FROM User;SELECT id] FROM [User];",
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
        postgres: 'SELECT * FROM "User";'
      });
    });

    it('with attributes', () => {
      expectsql(sql.selectQuery('User', {
        attributes: ['name', 'age']
      }), {
        default: 'SELECT [name], [age] FROM [User];',
        postgres: 'SELECT name, age FROM "User";'
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
        postgres: 'SELECT "User".name, "User".age, Posts.id AS "Posts.id", Posts.title AS "Posts.title" FROM "User" AS "User" LEFT OUTER JOIN Post AS Posts ON "User".id = Posts.user_id;'
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
        postgres: 'SELECT "User".name, "User".age, Posts.id AS "Posts.id", Posts.title AS "Posts.title", "Posts->Comments".id AS "Posts.Comments.id", "Posts->Comments".title AS "Posts.Comments.title", "Posts->Comments".createdAt AS "Posts.Comments.createdAt", "Posts->Comments".updatedAt AS "Posts.Comments.updatedAt", "Posts->Comments".post_id AS "Posts.Comments.post_id" FROM "User" AS "User" LEFT OUTER JOIN Post AS Posts ON "User".id = Posts.user_id LEFT OUTER JOIN Comment AS "Posts->Comments" ON Posts.id = "Posts->Comments".post_id;'
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
});
