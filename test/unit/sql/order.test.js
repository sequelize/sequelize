'use strict';

/* jshint -W110 */
var Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , Model = require(__dirname + '/../../../lib/model')
  , expectsql = Support.expectsql
  , current   = Support.sequelize
  , sql       = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

suite(Support.getTestDialectTeaser('SQL'), function() {
  suite('order', function () {
    test('single column', function () {
      expectsql(sql.selectQuery('User', {
        order: [['title', 'ASC']]
      }), {
        default: 'SELECT * FROM [User] ORDER BY [title] ASC;'
      });
    });

    test('limit', function () {
      expectsql(sql.selectQuery('User', {
        order: [['title', 'ASC']],
        limit: 100
      }), {
        default: 'SELECT * FROM [User] ORDER BY [title] ASC' +
                 sql.addLimitAndOffset({
                   limit: 100,
                   order: ['title', 'ASC']
                 }) + ';'
      });
    });

    test('single column custom field', function () {
      expectsql(sql.selectQuery('User', {
        attributes: [
          'email',
          ['first_name', 'firstName']
        ],
        order: [['first_name', 'ASC']]
      }), {
        default: "SELECT [email], [first_name] AS [firstName] FROM [User] ORDER BY [first_name] ASC;"
      });
    });

    var User = Support.sequelize.define('User', {
      firstName: {
        type: DataTypes.STRING,
        field: 'first_name'
      }
    }, {
      tableName: 'users'
    });
    var Post = Support.sequelize.define('Post', {
      leTitle: {
        type: DataTypes.STRING,
        field: 'le_title'
      }
    }, {
      tableName: 'posts'
    });

    User.Posts = User.hasMany(Post, {as: 'Posts', foreignKey: 'user_id'});

    test('custom table name and field', function () {
      expectsql(sql.selectQuery('users', {
        attributes: [['first_name', 'firstName']],
        order: [['first_name', 'DESC']]
      }, User), {
        default: 'SELECT [first_name] AS [firstName] FROM [users] AS [User] ORDER BY [User].[first_name] DESC;'
      });
    });

    var include = Model.$validateIncludedElements({
      include: [{
        attributes: [['le_title', 'leTitle']],
        association: User.Posts
      }],
      model: User
    }).include;

    var limit = sql.addLimitAndOffset({
      limit: 100,
      order: [['first_name', 'DESC']],
    }, User);

    test('include (hasMany), custom table and field', function () {
      expectsql(sql.selectQuery('users', {
        attributes: [
          ['first_name', 'firstName']
        ],
        order: [['first_name', 'DESC']],
        include: include,
        limit: 100,
        model: User
      }, User), {
        default: [
          'SELECT [User].[first_name] AS [firstName],',
          '[Posts].[id] AS [Posts.id], [Posts].[le_title] AS [Posts.leTitle]',
          'FROM [users] AS [User]',
          'LEFT OUTER JOIN [posts] AS [Posts]',
          'ON [User].[id] = [Posts].[user_id]',
          'ORDER BY [User].[first_name] DESC' + limit + ';'
        ].join(' ')
      });
    });

    test('include (hasMany) with subQuery, custom table and field', function () {
      expectsql(sql.selectQuery('users', {
        attributes: [
          ['first_name', 'firstName']
        ],
        order: [['first_name', 'DESC']],
        subQuery: true,
        include: include,
        limit: 100,
        model: User
      }, User), {
        default: [
          'SELECT [User].*,',
          '[Posts].[id] AS [Posts.id], [Posts].[le_title] AS [Posts.leTitle]',
          'FROM',
          '(SELECT [User].[first_name] AS [firstName], [User].[id] AS [id]',
          'FROM [users] AS [User]',
          'ORDER BY [User].[first_name] DESC' + limit + ')',
          'AS [User] LEFT OUTER JOIN [posts] AS [Posts]',
          'ON [User].[id] = [Posts].[user_id]',
          'ORDER BY [User].[firstName] DESC;'
        ].join(' ')
      });
    });
  });
});
