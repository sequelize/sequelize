'use strict';

/* jshint -W110 */
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

      test(key+': '+util.inspect(value, {depth: 10})+(options && ', '+util.inspect(options) || ''), function () {
        return expectsql(sql.whereItemQuery(key, value, options), expectation);
      });
    };

    testsql(undefined, 'lol=1', {
      default: 'lol=1'
    });

    testsql('deleted', null, {
      default: '`deleted` IS NULL',
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

      testsql('equipment', {
        $in: current.literal(
          '(select order_id from product_orders where product_id = 3)'
        )
      }, {
        default: '[equipment] IN (select order_id from product_orders where product_id = 3)'
      });
    });

    suite('Buffer', function () {
      testsql('field', new Buffer('Sequelize'), {
        postgres: '"field" = E\'\\\\x53657175656c697a65\'',
        sqlite: "`field` = X'53657175656c697a65'",
        mysql: "`field` = X'53657175656c697a65'",
        mssql: '[field] = 0x53657175656c697a65'
      });
    });

    suite('$not', function () {
      testsql('deleted', {
        $not: true
      }, {
        default: '[deleted] IS NOT true',
        mssql: "[deleted] IS NOT 'true'",
        sqlite: '`deleted` IS NOT 1'
      });

      testsql('deleted', {
        $not: null
      }, {
        default: '[deleted] IS NOT NULL'
      });

      testsql('muscles', {
        $not: 3
      }, {
        default: '[muscles] != 3'
      });
    });

    suite('$notIn', function () {
      testsql('equipment', {
        $notIn: []
      }, {
        default: '[equipment] NOT IN (NULL)'
      });

      testsql('equipment', {
        $notIn: [4, 19]
      }, {
        default: '[equipment] NOT IN (4, 19)'
      });

      testsql('equipment', {
        $notIn: current.literal(
          '(select order_id from product_orders where product_id = 3)'
        )
      }, {
        default: '[equipment] NOT IN (select order_id from product_orders where product_id = 3)'
      });
    });

    suite('$ne', function () {
      testsql('email', {
        $ne: 'jack.bauer@gmail.com'
      }, {
        default: "[email] != 'jack.bauer@gmail.com'"
      });
    });

    suite('$and/$or/$not', function () {
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

        test('sequelize.or({group_id: 1}, {user_id: 2})', function () {
          expectsql(sql.whereItemQuery(undefined, this.sequelize.or({group_id: 1}, {user_id: 2})), {
            default: '([group_id] = 1 OR [user_id] = 2)'
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

        testsql('$and', [
          {
            name: {
              $like: '%hello'
            }
          },
          {
            name: {
              $like: 'hello%'
            }
          }
        ], {
          default: "([name] LIKE '%hello' AND [name] LIKE 'hello%')"
        });

        testsql('name', {
            $and: [
              {like : '%someValue1%'},
              {like : '%someValue2%'}
            ]
        }, {
          default: "([name] LIKE '%someValue1%' AND [name] LIKE '%someValue2%')"
        });

        test('sequelize.and({shared: 1, sequelize.or({group_id: 1}, {user_id: 2}))', function () {
          expectsql(sql.whereItemQuery(undefined, this.sequelize.and({shared: 1}, this.sequelize.or({group_id: 1}, {user_id: 2}))), {
            default: '([shared] = 1 AND ([group_id] = 1 OR [user_id] = 2))'
          });
        });
      });

      suite('$not', function () {
        testsql('$not', {
          shared: 1,
          $or: {
            group_id: 1,
            user_id: 2
          }
        }, {
          default: 'NOT ([shared] = 1 AND ([group_id] = 1 OR [user_id] = 2))'
        });
      });
    });

    suite('$gt', function () {
      testsql('rank', {
        $gt: 2
      }, {
        default: '[rank] > 2'
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

    if (current.dialect.supports.ARRAY) {
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
            $contains: [2, 5]
          }, {
            field: {
              type: DataTypes.ARRAY(DataTypes.INTEGER)
            }
          }, {
            postgres: '"muscles" @> ARRAY[2,5]::INTEGER[]'
          });
        });

        suite('$overlap', function () {
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
            '&&': [9, 182]
          }, {
            postgres: '"muscles" && ARRAY[9,182]'
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

        suite('$all', function() {
          testsql('userId', {
            $all: [4, 5, 6]
          }, {
            postgres: '"userId" = ALL (ARRAY[4,5,6])'
          });

          testsql('userId', {
            $all: [2, 5]
          }, {
            field: {
              type: DataTypes.ARRAY(DataTypes.INTEGER)
            }
          }, {
            postgres: '"userId" = ALL (ARRAY[2,5]::INTEGER[])'
          });

          suite('$values', function () {
            testsql('userId', {
              $all: {
                $values: [4, 5, 6]
              }
            }, {
              postgres: '"userId" = ALL (VALUES (4), (5), (6))'
            });

            testsql('userId', {
              $all: {
                $values: [2, 5]
              }
            }, {
              field: {
                type: DataTypes.ARRAY(DataTypes.INTEGER)
              }
            }, {
              postgres: '"userId" = ALL (VALUES (2), (5))'
            });
          });
        });

        suite('$like', function() {
          testsql('userId', {
            $like: {
              $any: ['foo', 'bar', 'baz']
            }
          }, {
            postgres: "\"userId\" LIKE ANY ARRAY['foo','bar','baz']"
          });
          testsql('userId', {
            $iLike: {
              $any: ['foo', 'bar', 'baz']
            }
          }, {
            postgres: "\"userId\" ILIKE ANY ARRAY['foo','bar','baz']"
          });
          testsql('userId', {
            $notLike: {
              $any: ['foo', 'bar', 'baz']
            }
          }, {
            postgres: "\"userId\" NOT LIKE ANY ARRAY['foo','bar','baz']"
          });
          testsql('userId', {
            $notILike: {
              $any: ['foo', 'bar', 'baz']
            }
          }, {
            postgres: "\"userId\" NOT ILIKE ANY ARRAY['foo','bar','baz']"
          });
        });
      });
    }

    if (current.dialect.supports.JSON) {
      suite('JSON', function () {
        test('sequelize.json("profile->>\'id\', sequelize.cast(2, \'text\')")', function () {
          expectsql(sql.whereItemQuery(undefined, this.sequelize.json("profile->>'id'", this.sequelize.cast('12346-78912', 'text'))), {
            postgres: "profile->>'id' = CAST('12346-78912' AS TEXT)"
          });
        });

        testsql('data', {
          nested: {
            attribute: 'value'
          }
        }, {
          field: {
            type: new DataTypes.JSONB()
          },
          prefix: 'User'
        }, {
          default: "([User].[data]#>>'{nested, attribute}') = 'value'"
        });

        testsql('data', {
          nested: {
            attribute: 'value',
            prop: {
              $ne: 'None'
            }
          }
        }, {
          field: {
            type: new DataTypes.JSONB()
          },
          prefix: 'User'
        }, {
          default: "(([User].[data]#>>'{nested, attribute}') = 'value' AND ([User].[data]#>>'{nested, prop}') != 'None')"
        });

        testsql('data', {
          name: {
            last: 'Simpson'
          },
          employment: {
            $ne: 'None'
          }
        }, {
          field: {
            type: new DataTypes.JSONB()
          },
          prefix: 'User'
        }, {
          default: "(([User].[data]#>>'{name, last}') = 'Simpson' AND ([User].[data]#>>'{employment}') != 'None')"
        });

        testsql('data.nested.attribute', 'value', {
          model: {
            rawAttributes: {
              data: {
                type: new DataTypes.JSONB()
              }
            }
          }
        }, {
          default: "([data]#>>'{nested, attribute}') = 'value'"
        });

        testsql('data.nested.attribute', {
          $in: [3, 7]
        }, {
          model: {
            rawAttributes: {
              data: {
                type: new DataTypes.JSONB()
              }
            }
          }
        }, {
          default: "([data]#>>'{nested, attribute}') IN (3, 7)"
        });

        testsql('data', {
          nested: {
            attribute: {
              $gt: 2
            }
          }
        }, {
          field: {
            type: new DataTypes.JSONB()
          }
        }, {
          default: "([data]#>>'{nested, attribute}')::double precision > 2"
        });

        testsql('data', {
          nested: {
            "attribute::integer": {
              $gt: 2
            }
          }
        }, {
          field: {
            type: new DataTypes.JSONB()
          }
        }, {
          default: "([data]#>>'{nested, attribute}')::integer > 2"
        });

        var dt = new Date();
        testsql('data', {
          nested: {
            attribute: {
              $gt: dt
            }
          }
        }, {
          field: {
            type: new DataTypes.JSONB()
          }
        }, {
          default: "([data]#>>'{nested, attribute}')::timestamptz > "+sql.escape(dt)
        });

        testsql('data', {
          $contains: {
            company: 'Magnafone'
          }
        }, {
          field: {
            type: new DataTypes.JSONB()
          }
        }, {
          default: '[data] @> \'{"company":"Magnafone"}\''
        });
      });
    }

    suite('fn', function () {
      test('{name: this.sequelize.fn(\'LOWER\', \'DERP\')}', function () {
        expectsql(sql.whereQuery({name: this.sequelize.fn('LOWER', 'DERP')}), {
          default: "WHERE [name] = LOWER('DERP')"
        });
      });
    });
  });
});
