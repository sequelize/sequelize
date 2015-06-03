'use strict';

/* jshint -W110 */
var Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , expectsql = Support.expectsql
  , current   = Support.sequelize
  , sql       = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe(Support.getTestDialectTeaser('SQL'), function() {
  describe('select', function () {
    it('*', function () {
      expectsql(sql.selectQuery('User'), {
        default: 'SELECT * FROM [User];'
      });
    });

    it('with attributes', function () {
      expectsql(sql.selectQuery('User', {
        attributes: ['name', 'age']
      }), {
        default: 'SELECT [name], [age] FROM [User];'
      });
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

      expectsql(sql.selectQuery('User', {
        attributes: ['name', 'age'],
        include: [ {
          model: Post,
          attributes: ['title'],
          association: {
            source: User,
            target: Post,
            identifier: 'user_id'
          },
          as: 'Post'
        } ],
        tableAs: 'User'
      }), {
        default: 'SELECT [User].[name], [User].[age], [Post].[title] AS [Post.title] FROM [User] AS [User] LEFT OUTER JOIN [Post] AS [Post] ON [User].[id] = [Post].[user_id];'
      });
    });
  });

  describe('queryIdentifiersFalse', function () {
    before(function () {
      sql.options.quoteIdentifiers = false;
    });
    after(function () {
      sql.options.quoteIdentifiers = true;
    });

    it('*', function () {
      expectsql(sql.selectQuery('User'), {
        default: 'SELECT * FROM [User];',
        postgres: 'SELECT * FROM User;'
      });
    });

    it('with attributes', function () {
      expectsql(sql.selectQuery('User', {
        attributes: ['name', 'age']
      }), {
        default: 'SELECT [name], [age] FROM [User];',
        postgres: 'SELECT name, age FROM User;'
      });
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

      expectsql(sql.selectQuery('User', {
        attributes: ['name', 'age'],
        include: [ {
          model: Post,
          attributes: ['title'],
          association: {
            source: Post,
            target: User,
            identifier: 'user_id'
          },
          as: 'Post'
        } ],
        tableAs: 'User'
      }), {
        default: 'SELECT [User].[name], [User].[age], [Post].[title] AS [Post.title] FROM [User] AS [User] LEFT OUTER JOIN [Post] AS [Post] ON [User].[id] = [Post].[user_id];',
        postgres: 'SELECT User.name, User.age, Post.title AS "Post.title" FROM User AS User LEFT OUTER JOIN Post AS Post ON User.id = Post.user_id;'
      });
    });

  });
});
