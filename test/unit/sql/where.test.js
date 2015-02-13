'use strict';

var Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , util      = require('util')
  , expectsql = Support.expectsql
  , current   = Support.sequelize
  , sql       = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

suite(Support.getTestDialectTeaser('SQL'), function() {
  suite('whereQuery', function () {
    var testsql = function (params, options, expectation) {
      if (expectation === undefined) {
        expectation = options;
        options = undefined;
      }

      test(util.inspect(params, {depth: 10})+(options && ', '+util.inspect(options) || ''), function () {
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
        default: 'WHERE [yolo.User].[id] = 1',
        postgres: 'WHERE "yolo"."User"."id" = 1',
        mssql: 'WHERE [yolo].[User].[id] = 1',
      });
    });

    testsql({
      name: 'a project',
      $or: [
        { id: [1,2,3] },
        { id: { $gt: 10 } }
      ]
    }, {
      default: "WHERE [name] = 'a project' AND ([id] IN (1, 2, 3) OR [id] > 10)"
    });

    testsql({
      name: 'a project',
      id: {
        $or: [
          [1,2,3],
          { $gt: 10 }
        ]
      }
    }, {
      default: "WHERE [name] = 'a project' AND ([id] IN (1, 2, 3) OR [id] > 10)"
    });
  });

  suite('whereItemQuery', function () {
    var testsql = function (key, value, options, expectation) {
      if (expectation === undefined) {
        expectation = options;
        options = undefined;
      }

      test(key+": "+util.inspect(value, {depth: 10})+(options && ', '+util.inspect(options) || ''), function () {
        return expectsql(sql.whereItemQuery(key, value, options), expectation);
      });
    };

    testsql(undefined, 'lol=1', {
      default: "lol=1"
    });

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

      testsql('equipment', {
        $in: []
      }, {
        default: '[equipment] IN (NULL)'
      });

      testsql('muscles', {
        in: [2, 4]
      }, {
        default: '[muscles] IN (2, 4)'
      });
    });

    suite('Buffer', function () {
      testsql('field', new Buffer('Sequelize'), {
        postgres: '"field" = E\'\\\\x53657175656c697a65\'',
        sqlite: "`field` = X'53657175656c697a65'",
        mysql: "`field` = X'53657175656c697a65'",
        mssql: "[field] = 0x53657175656c697a65"
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

    suite('$notIn', function () {
      testsql('equipment', {
        $notIn: []
      }, {
        default: '[equipment] NOT IN (NULL)'
      });
    });

    suite('$and/$or', function () {
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

        testsql('$or', [
          {
            roleName: 'NEW'
          }, {
            roleName: 'CLIENT',
            type: 'CLIENT'
          }
        ], {
          default: "([roleName] = 'NEW' OR ([roleName] = 'CLIENT' AND [type] = 'CLIENT'))"
        });

        test("sequelize.or({group_id: 1}, {user_id: 2})", function () {
          expectsql(sql.whereItemQuery(undefined, this.sequelize.or({group_id: 1}, {user_id: 2})), {
            default: "([group_id] = 1 OR [user_id] = 2)"
          });
        });

        test("sequelize.or({group_id: 1}, {user_id: 2, role: 'admin'})", function () {
          expectsql(sql.whereItemQuery(undefined, this.sequelize.or({group_id: 1}, {user_id: 2, role: 'admin'})), {
            default: "([group_id] = 1 OR ([user_id] = 2 AND [role] = 'admin'))"
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

    if (current.dialect.supports['ARRAY']) {
      suite('ARRAY', function () {
        suite('$contains', function () {
          testsql('muscles', {
            $contains: [2, 3]
          }, {
            postgres: '"muscles" @> ARRAY[2,3]'
          });

          testsql('muscles', {
            $contained: [6, 8]
          }, {
            postgres: '"muscles" <@ ARRAY[6,8]'
          });

          testsql('muscles', {
            $overlap: [3, 11]
          }, {
            postgres: '"muscles" && ARRAY[3,11]'
          });

          testsql('muscles', {
            $overlap: [3, 1]
          }, {
            postgres: '"muscles" && ARRAY[3,1]'
          });

          testsql('muscles', {
            $contains: [2, 5]
          }, {
            field: {
              type: DataTypes.ARRAY(DataTypes.INTEGER)
            }
          }, {
            postgres: '"muscles" @> ARRAY[2,5]::INTEGER[]'
          });
        });

        suite('$any', function() {
          testsql('userId', {
            $any: [4, 5, 6]
          }, {
            postgres: '"userId" = ANY (ARRAY[4,5,6])'
          });

          testsql('userId', {
            $any: [2, 5]
          }, {
            field: {
              type: DataTypes.ARRAY(DataTypes.INTEGER)
            }
          }, {
            postgres: '"userId" = ANY (ARRAY[2,5]::INTEGER[])'
          });

          suite('$values', function () {
            testsql('userId', {
              $any: {
                $values: [4, 5, 6]
              }
            }, {
              postgres: '"userId" = ANY (VALUES (4), (5), (6))'
            });

            testsql('userId', {
              $any: {
                $values: [2, 5]
              }
            }, {
              field: {
                type: DataTypes.ARRAY(DataTypes.INTEGER)
              }
            }, {
              postgres: '"userId" = ANY (VALUES (2), (5))'
            });
          });
        });
      });
    }
  });
});