'use strict';

var Support   = require(__dirname + '/../support')
  , util      = require('util')
  , expectsql = Support.expectsql
  , current   = Support.sequelize
  , sql       = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

suite('SQL', function() {
  suite('whereQuery', function () {
    var testsql = function (params, options, expectation) {
      if (expectation === undefined) {
        expectation = options;
        options = undefined;
      }

      test(util.inspect(params)+(options && ', '+util.inspect(options) || ''), function () {
        return expectsql(sql.whereQuery(params, options), expectation);
      });
    };

    testsql({}, {
      default: ''
    });
    testsql([], {
      default: ''
    });
    testsql({id: 1}, {
      default: 'WHERE [id] = 1'
    });
    testsql({id: 1}, {prefix: 'User'}, {
      default: 'WHERE [User].[id] = 1'
    });

    test("{ id: 1 }, { prefix: current.literal(sql.quoteTable.call(current.dialect.QueryGenerator, {schema: 'yolo', tableName: 'User'})) }", function () {
      expectsql(sql.whereQuery({id: 1}, {prefix: current.literal(sql.quoteTable.call(current.dialect.QueryGenerator, {schema: 'yolo', tableName: 'User'}))}), {
        default: 'WHERE [yolo.User].[id] = 1'
      });
    });
  });

  suite('whereItemQuery', function () {
    var testsql = function (key, value, options, expectation) {
      if (expectation === undefined) {
        expectation = options;
        options = undefined;
      }

      test(key+": "+util.inspect(value), function () {
        return expectsql(sql.whereItemQuery(key, value, options), expectation);
      });
    };

    testsql('deleted', null, {
      default: "`deleted` IS NULL",
      postgres: '"deleted" IS NULL',
      mssql: '[deleted] IS NULL'
    });

    suite('$in', function () {
      testsql('equipment', {
        $in: [1, 3]
      }, {
        default: '[equipment] IN (1, 3)'
      });

      testsql('muscles', {
        in: [2, 4]
      }, {
        default: '[muscles] IN (2, 4)'
      });
    });

    suite('$not', function () {
      testsql('deleted', {
        $not: true
      }, {
        default: "[deleted] NOT true",
        mssql: "[deleted] NOT 'true'",
        sqlite: "`deleted` NOT 1"
      });

      testsql('deleted', {
        $not: null
      }, {
        default: "[deleted] NOT NULL"
      });

      testsql('muscles', {
        $not: [2, 4]
      }, {
        default: '[muscles] NOT IN (2, 4)'
      });

      testsql('muscles', {
        $notIn: [2, 4]
      }, {
        default: '[muscles] NOT IN (2, 4)'
      });
    });

    suite('$or', function () {
      testsql('email', {
        $or: ['maker@mhansen.io', 'janzeh@gmail.com']
      }, {
        default: '([email] = \'maker@mhansen.io\' OR [email] = \'janzeh@gmail.com\')'
      });

      testsql('$or', [
        {email: 'maker@mhansen.io'},
        {email: 'janzeh@gmail.com'}
      ], {
        default: '([email] = \'maker@mhansen.io\' OR [email] = \'janzeh@gmail.com\')'
      });

      testsql('$or', {
        email: 'maker@mhansen.io',
        name: 'Mick Hansen'
      }, {
        default: '([email] = \'maker@mhansen.io\' OR [name] = \'Mick Hansen\')'
      });

      testsql('$or', {
        equipment: [1, 3],
        muscles: {
          $in: [2, 4]
        }
      }, {
        default: '([equipment] IN (1, 3) OR [muscles] IN (2, 4))'
      });

      test("sequelize.or({group_id: 1}, {user_id: 2})", function () {
        expectsql(sql.whereItemQuery(undefined, this.sequelize.or({group_id: 1}, {user_id: 2})), {
          default: "([group_id] = 1 OR [user_id] = 2)"
        });
      });
    });

    suite('$and', function () {
      testsql('$and', {
        shared: 1,
        $or: {
          group_id: 1,
          user_id: 2
        }
      }, {
        default: "([shared] = 1 AND ([group_id] = 1 OR [user_id] = 2))"
      });

      test("sequelize.and({shared: 1, sequelize.or({group_id: 1}, {user_id: 2}))", function () {
        expectsql(sql.whereItemQuery(undefined, this.sequelize.and({shared: 1}, this.sequelize.or({group_id: 1}, {user_id: 2}))), {
          default: "([shared] = 1 AND ([group_id] = 1 OR [user_id] = 2))"
        });
      });
    });

    suite('$gt', function () {
      testsql('rank', {
        $gt: 2
      }, {
        default: "[rank] > 2"
      });
    });

    suite('$like', function () {
      testsql('username', {
        $like: '%swagger'
      }, {
        default: "[username] LIKE '%swagger'"
      });
    });

    suite('$between', function () {
      testsql('date', {
        $between: ['2013-01-01', '2013-01-11']
      }, {
        default: "[date] BETWEEN '2013-01-01' AND '2013-01-11'"
      });

      testsql('date', {
        between: ['2012-12-10', '2013-01-02'],
        nbetween: ['2013-01-04', '2013-01-20']
      }, {
        default: "([date] BETWEEN '2012-12-10' AND '2013-01-02' AND [date] NOT BETWEEN '2013-01-04' AND '2013-01-20')"
      });
    });

    suite('$notBetween', function () {
      testsql('date', {
        $notBetween: ['2013-01-01', '2013-01-11']
      }, {
        default: "[date] NOT BETWEEN '2013-01-01' AND '2013-01-11'"
      });
    });
  });
});