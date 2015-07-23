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
            options.table || option.model && option.model.getTableName(),
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
      ]
    }, {
      default: 'SELECT [email], [first_name] AS [firstName] FROM [User];'
    });

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
});
