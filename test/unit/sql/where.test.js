'use strict';

const Support   = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  util = require('util'),
  chai = require('chai'),
  expect = chai.expect,
  expectsql = Support.expectsql,
  current = Support.sequelize,
  sql = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

suite(Support.getTestDialectTeaser('SQL'), () => {
  suite('whereQuery', () => {
    const testsql = function(params, options, expectation) {
      if (expectation === undefined) {
        expectation = options;
        options = undefined;
      }

      test(util.inspect(params, {depth: 10})+(options && ', '+util.inspect(options) || ''), () => {
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

    test("{ id: 1 }, { prefix: current.literal(sql.quoteTable.call(current.dialect.QueryGenerator, {schema: 'yolo', tableName: 'User'})) }", () => {
      expectsql(sql.whereQuery({id: 1}, {prefix: current.literal(sql.quoteTable.call(current.dialect.QueryGenerator, {schema: 'yolo', tableName: 'User'}))}), {
        default: 'WHERE [yolo.User].[id] = 1',
        postgres: 'WHERE "yolo"."User"."id" = 1',
        mssql: 'WHERE [yolo].[User].[id] = 1'
      });
    });

    testsql({
      name: 'a project',
      $or: [
        { id: [1, 2, 3] },
        { id: { $gt: 10 } }
      ]
    }, {
      default: "WHERE [name] = 'a project' AND ([id] IN (1, 2, 3) OR [id] > 10)",
      mssql: "WHERE [name] = N'a project' AND ([id] IN (1, 2, 3) OR [id] > 10)"
    });

    testsql({
      name: 'a project',
      id: {
        $or: [
          [1, 2, 3],
          { $gt: 10 }
        ]
      }
    }, {
      default: "WHERE [name] = 'a project' AND ([id] IN (1, 2, 3) OR [id] > 10)",
      mssql: "WHERE [name] = N'a project' AND ([id] IN (1, 2, 3) OR [id] > 10)"
    });

    testsql({
      name: 'here is a null char: \0'
    }, {
      default: "WHERE [name] = 'here is a null char: \\0'",
      mssql: "WHERE [name] = N'here is a null char: \0'",
      sqlite: "WHERE `name` = 'here is a null char: \0'"
    });
  });

  suite('whereItemQuery', () => {
    const testsql = function(key, value, options, expectation) {
      if (expectation === undefined) {
        expectation = options;
        options = undefined;
      }

      test(key+': '+util.inspect(value, {depth: 10})+(options && ', '+util.inspect(options) || ''), () => {
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

    suite('$in', () => {
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

    suite('Buffer', () => {
      testsql('field', new Buffer('Sequelize'), {
        postgres: '"field" = E\'\\\\x53657175656c697a65\'',
        sqlite: "`field` = X'53657175656c697a65'",
        mysql: "`field` = X'53657175656c697a65'",
        mssql: '[field] = 0x53657175656c697a65'
      });
    });

    suite('$not', () => {
      testsql('deleted', {
        $not: true
      }, {
        default: '[deleted] IS NOT true',
        mssql: '[deleted] IS NOT 1',
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

    suite('$notIn', () => {
      testsql('equipment', {
        $notIn: []
      }, {
        default: ''
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

    suite('$ne', () => {
      testsql('email', {
        $ne: 'jack.bauer@gmail.com'
      }, {
        default: "[email] != 'jack.bauer@gmail.com'",
        mssql: "[email] != N'jack.bauer@gmail.com'"
      });
    });

    suite('$and/$or/$not', () => {
      suite('$or', () => {
        testsql('email', {
          $or: ['maker@mhansen.io', 'janzeh@gmail.com']
        }, {
          default: '([email] = \'maker@mhansen.io\' OR [email] = \'janzeh@gmail.com\')',
          mssql: '([email] = N\'maker@mhansen.io\' OR [email] = N\'janzeh@gmail.com\')'
        });

        testsql('rank', {
          $or: {
            $lt: 100,
            $eq: null
          }
        }, {
          default: '([rank] < 100 OR [rank] IS NULL)'
        });

        testsql('$or', [
          {email: 'maker@mhansen.io'},
          {email: 'janzeh@gmail.com'}
        ], {
          default: '([email] = \'maker@mhansen.io\' OR [email] = \'janzeh@gmail.com\')',
          mssql: '([email] = N\'maker@mhansen.io\' OR [email] = N\'janzeh@gmail.com\')'
        });

        testsql('$or', {
          email: 'maker@mhansen.io',
          name: 'Mick Hansen'
        }, {
          default: '([email] = \'maker@mhansen.io\' OR [name] = \'Mick Hansen\')',
          mssql: '([email] = N\'maker@mhansen.io\' OR [name] = N\'Mick Hansen\')'
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
          default: "([roleName] = 'NEW' OR ([roleName] = 'CLIENT' AND [type] = 'CLIENT'))",
          mssql: "([roleName] = N'NEW' OR ([roleName] = N'CLIENT' AND [type] = N'CLIENT'))"
        });

        test('sequelize.or({group_id: 1}, {user_id: 2})', function() {
          expectsql(sql.whereItemQuery(undefined, this.sequelize.or({group_id: 1}, {user_id: 2})), {
            default: '([group_id] = 1 OR [user_id] = 2)'
          });
        });

        test("sequelize.or({group_id: 1}, {user_id: 2, role: 'admin'})", function() {
          expectsql(sql.whereItemQuery(undefined, this.sequelize.or({group_id: 1}, {user_id: 2, role: 'admin'})), {
            default: "([group_id] = 1 OR ([user_id] = 2 AND [role] = 'admin'))",
            mssql: "([group_id] = 1 OR ([user_id] = 2 AND [role] = N'admin'))"
          });
        });

        testsql('$or', [], {
          default: '0 = 1'
        });

        testsql('$or', {}, {
          default: '0 = 1'
        });

        test('sequelize.or()', function() {
          expectsql(sql.whereItemQuery(undefined, this.sequelize.or()), {
            default: '0 = 1'
          });
        });
      });

      suite('$and', () => {
        testsql('$and', {
          $or: {
            group_id: 1,
            user_id: 2
          },
          shared: 1
        }, {
          default: '(([group_id] = 1 OR [user_id] = 2) AND [shared] = 1)'
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
          default: "([name] LIKE '%hello' AND [name] LIKE 'hello%')",
          mssql: "([name] LIKE N'%hello' AND [name] LIKE N'hello%')"
        });

        testsql('rank', {
          $and: {
            $ne: 15,
            $between: [10, 20]
          }
        }, {
          default: '([rank] != 15 AND [rank] BETWEEN 10 AND 20)'
        });

        testsql('name', {
          $and: [
            {like: '%someValue1%'},
            {like: '%someValue2%'}
          ]
        }, {
          default: "([name] LIKE '%someValue1%' AND [name] LIKE '%someValue2%')",
          mssql: "([name] LIKE N'%someValue1%' AND [name] LIKE N'%someValue2%')"
        });

        test('sequelize.and({shared: 1, sequelize.or({group_id: 1}, {user_id: 2}))', function() {
          expectsql(sql.whereItemQuery(undefined, this.sequelize.and({shared: 1}, this.sequelize.or({group_id: 1}, {user_id: 2}))), {
            default: '([shared] = 1 AND ([group_id] = 1 OR [user_id] = 2))'
          });
        });
      });

      suite('$not', () => {
        testsql('$not', {
          $or: {
            group_id: 1,
            user_id: 2
          },
          shared: 1
        }, {
          default: 'NOT (([group_id] = 1 OR [user_id] = 2) AND [shared] = 1)'
        });

        testsql('$not', [], {
          default: '0 = 1'
        });

        testsql('$not', {}, {
          default: '0 = 1'
        });
      });
    });

    suite('$col', () => {
      testsql('userId', {
        $col: 'user.id'
      }, {
        default: '[userId] = [user].[id]'
      });

      testsql('userId', {
        $eq: {
          $col: 'user.id'
        }
      }, {
        default: '[userId] = [user].[id]'
      });

      testsql('userId', {
        $gt: {
          $col: 'user.id'
        }
      }, {
        default: '[userId] > [user].[id]'
      });

      testsql('$or', [
        {'ownerId': {$col: 'user.id'}},
        {'ownerId': {$col: 'organization.id'}}
      ], {
        default: '([ownerId] = [user].[id] OR [ownerId] = [organization].[id])'
      });

      testsql('$organization.id$', {
        $col: 'user.organizationId'
      }, {
        default: '[organization].[id] = [user].[organizationId]'
      });

      testsql('$offer.organization.id$', {
        $col: 'offer.user.organizationId'
      }, {
        default: '[offer->organization].[id] = [offer->user].[organizationId]'
      });
    });

    suite('$gt', () => {
      testsql('rank', {
        $gt: 2
      }, {
        default: '[rank] > 2'
      });

      testsql('created_at', {
        $lt: {
          $col: 'updated_at'
        }
      }, {
        default: '[created_at] < [updated_at]'
      });
    });

    suite('$raw', () => {
      test('should fail on $raw', () => {
        expect(() => {
          sql.whereItemQuery('rank', {
            $raw: 'AGHJZ'
          });
        }).to.throw(Error, 'The `$raw` where property is no longer supported.  Use `sequelize.literal` instead.');
      });
    });

    suite('$like', () => {
      testsql('username', {
        $like: '%swagger'
      }, {
        default: "[username] LIKE '%swagger'",
        mssql: "[username] LIKE N'%swagger'"
      });
    });

    suite('$between', () => {
      testsql('date', {
        $between: ['2013-01-01', '2013-01-11']
      }, {
        default: "[date] BETWEEN '2013-01-01' AND '2013-01-11'",
        mssql: "[date] BETWEEN N'2013-01-01' AND N'2013-01-11'"
      });

      testsql('date', {
        between: ['2012-12-10', '2013-01-02'],
        nbetween: ['2013-01-04', '2013-01-20']
      }, {
        default: "([date] BETWEEN '2012-12-10' AND '2013-01-02' AND [date] NOT BETWEEN '2013-01-04' AND '2013-01-20')",
        mssql: "([date] BETWEEN N'2012-12-10' AND N'2013-01-02' AND [date] NOT BETWEEN N'2013-01-04' AND N'2013-01-20')"
      });
    });

    suite('$notBetween', () => {
      testsql('date', {
        $notBetween: ['2013-01-01', '2013-01-11']
      }, {
        default: "[date] NOT BETWEEN '2013-01-01' AND '2013-01-11'",
        mssql: "[date] NOT BETWEEN N'2013-01-01' AND N'2013-01-11'"
      });
    });

    if (current.dialect.supports.ARRAY) {
      suite('ARRAY', () => {
        suite('$contains', () => {
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

        suite('$overlap', () => {
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

        suite('$any', () => {
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

          suite('$values', () => {
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

        suite('$all', () => {
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

          suite('$values', () => {
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

        suite('$like', () => {
          testsql('userId', {
            $like: {
              $any: ['foo', 'bar', 'baz']
            }
          }, {
            postgres: "\"userId\" LIKE ANY (ARRAY['foo','bar','baz'])"
          });

          testsql('userId', {
            $iLike: {
              $any: ['foo', 'bar', 'baz']
            }
          }, {
            postgres: "\"userId\" ILIKE ANY (ARRAY['foo','bar','baz'])"
          });

          testsql('userId', {
            $notLike: {
              $any: ['foo', 'bar', 'baz']
            }
          }, {
            postgres: "\"userId\" NOT LIKE ANY (ARRAY['foo','bar','baz'])"
          });

          testsql('userId', {
            $notILike: {
              $any: ['foo', 'bar', 'baz']
            }
          }, {
            postgres: "\"userId\" NOT ILIKE ANY (ARRAY['foo','bar','baz'])"
          });

          testsql('userId', {
            $like: {
              $all: ['foo', 'bar', 'baz']
            }
          }, {
            postgres: "\"userId\" LIKE ALL (ARRAY['foo','bar','baz'])"
          });

          testsql('userId', {
            $iLike: {
              $all: ['foo', 'bar', 'baz']
            }
          }, {
            postgres: "\"userId\" ILIKE ALL (ARRAY['foo','bar','baz'])"
          });

          testsql('userId', {
            $notLike: {
              $all: ['foo', 'bar', 'baz']
            }
          }, {
            postgres: "\"userId\" NOT LIKE ALL (ARRAY['foo','bar','baz'])"
          });

          testsql('userId', {
            $notILike: {
              $all: ['foo', 'bar', 'baz']
            }
          }, {
            postgres: "\"userId\" NOT ILIKE ALL (ARRAY['foo','bar','baz'])"
          });
        });
      });
    }

    if (current.dialect.supports.RANGE) {
      suite('RANGE', () => {

        testsql('range', {
          $contains: new Date(Date.UTC(2000, 1, 1))
        }, {
          field: {
            type: new DataTypes.postgres.RANGE(DataTypes.DATE)
          },
          prefix: 'Timeline'
        }, {
          postgres: "\"Timeline\".\"range\" @> '2000-02-01 00:00:00.000 +00:00'::timestamptz"
        });

        testsql('range', {
          $contains: [new Date(Date.UTC(2000, 1, 1)), new Date(Date.UTC(2000, 2, 1))]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE(DataTypes.DATE)
          },
          prefix: 'Timeline'
        }, {
          postgres: "\"Timeline\".\"range\" @> '[\"2000-02-01 00:00:00.000 +00:00\",\"2000-03-01 00:00:00.000 +00:00\")'"
        });

        testsql('range', {
          $contained: [new Date(Date.UTC(2000, 1, 1)), new Date(Date.UTC(2000, 2, 1))]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE(DataTypes.DATE)
          },
          prefix: 'Timeline'
        }, {
          postgres: "\"Timeline\".\"range\" <@ '[\"2000-02-01 00:00:00.000 +00:00\",\"2000-03-01 00:00:00.000 +00:00\")'"
        });

        testsql('unboundedRange', {
          $contains: [new Date(Date.UTC(2000, 1, 1)), null]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE(DataTypes.DATE)
          },
          prefix: 'Timeline'
        }, {
          postgres: "\"Timeline\".\"unboundedRange\" @> '[\"2000-02-01 00:00:00.000 +00:00\",)'"
        });

        testsql('unboundedRange', {
          $contains: [-Infinity, Infinity]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE(DataTypes.DATE)
          },
          prefix: 'Timeline'
        }, {
          postgres: "\"Timeline\".\"unboundedRange\" @> '[-infinity,infinity)'"
        });

        testsql('reservedSeats', {
          $overlap: [1, 4]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE()
          },
          prefix: 'Room'
        }, {
          postgres: "\"Room\".\"reservedSeats\" && '[1,4)'"
        });

        testsql('reservedSeats', {
          $adjacent: [1, 4]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE()
          },
          prefix: 'Room'
        }, {
          postgres: "\"Room\".\"reservedSeats\" -|- '[1,4)'"
        });

        testsql('reservedSeats', {
          $strictLeft: [1, 4]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE()
          },
          prefix: 'Room'
        }, {
          postgres: "\"Room\".\"reservedSeats\" << '[1,4)'"
        });

        testsql('reservedSeats', {
          $strictRight: [1, 4]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE()
          },
          prefix: 'Room'
        }, {
          postgres: "\"Room\".\"reservedSeats\" >> '[1,4)'"
        });

        testsql('reservedSeats', {
          $noExtendRight: [1, 4]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE()
          },
          prefix: 'Room'
        }, {
          postgres: "\"Room\".\"reservedSeats\" &< '[1,4)'"
        });

        testsql('reservedSeats', {
          $noExtendLeft: [1, 4]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE()
          },
          prefix: 'Room'
        }, {
          postgres: "\"Room\".\"reservedSeats\" &> '[1,4)'"
        });

      });
    }

    if (current.dialect.supports.JSON) {
      suite('JSON', () => {
        test('sequelize.json("profile.id"), sequelize.cast(2, \'text\')")', function() {
          expectsql(sql.whereItemQuery(undefined, this.sequelize.json('profile.id', this.sequelize.cast('12346-78912', 'text'))), {
            postgres: "(\"profile\"#>>'{id}') = CAST('12346-78912' AS TEXT)",
            sqlite: "json_extract(`profile`, '$.id') = CAST('12346-78912' AS TEXT)",
            mysql: "`profile`->>'$.id' = CAST('12346-78912' AS CHAR)"
          });
        });

        test('sequelize.json({profile: {id: "12346-78912", name: "test"}})', function() {
          expectsql(sql.whereItemQuery(undefined, this.sequelize.json({profile: {id: '12346-78912', name: 'test'}})), {
            postgres: "(\"profile\"#>>'{id}') = '12346-78912' AND (\"profile\"#>>'{name}') = 'test'",
            sqlite: "json_extract(`profile`, '$.id') = '12346-78912' AND json_extract(`profile`, '$.name') = 'test'",
            mysql: "`profile`->>'$.id' = '12346-78912' and `profile`->>'$.name' = 'test'"
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
          mysql: "(`User`.`data`->>'$.\"nested\".\"attribute\"') = 'value'",
          postgres: "(\"User\".\"data\"#>>'{nested,attribute}') = 'value'",
          sqlite: "json_extract(`User`.`data`, '$.nested.attribute') = 'value'"
        });

        testsql('data', {
          nested: {
            $in: [1, 2]
          }
        }, {
          field: {
            type: new DataTypes.JSONB()
          }
        }, {
          mysql: "CAST((`data`->>'$.\"nested\"') AS DECIMAL) IN (1, 2)",
          postgres: "CAST((\"data\"#>>'{nested}') AS DOUBLE PRECISION) IN (1, 2)",
          sqlite: "CAST(json_extract(`data`, '$.nested') AS DOUBLE PRECISION) IN (1, 2)"
        });

        testsql('data', {
          nested: {
            $between: [1, 2]
          }
        }, {
          field: {
            type: new DataTypes.JSONB()
          }
        }, {
          mysql: "CAST((`data`->>'$.\"nested\"') AS DECIMAL) BETWEEN 1 AND 2",
          postgres: "CAST((\"data\"#>>'{nested}') AS DOUBLE PRECISION) BETWEEN 1 AND 2",
          sqlite: "CAST(json_extract(`data`, '$.nested') AS DOUBLE PRECISION) BETWEEN 1 AND 2"
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
          prefix: current.literal(sql.quoteTable.call(current.dialect.QueryGenerator, {tableName: 'User'}))
        }, {
          mysql: "((`User`.`data`->>'$.\"nested\".\"attribute\"') = 'value' AND (`User`.`data`->>'$.\"nested\".\"prop\"') != 'None')",
          postgres: "((\"User\".\"data\"#>>'{nested,attribute}') = 'value' AND (\"User\".\"data\"#>>'{nested,prop}') != 'None')",
          sqlite: "(json_extract(`User`.`data`, '$.nested.attribute') = 'value' AND json_extract(`User`.`data`, '$.nested.prop') != 'None')"
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
          mysql: "((`User`.`data`->>'$.\"name\".\"last\"') = 'Simpson' AND (`User`.`data`->>'$.\"employment\"') != 'None')",
          postgres: "((\"User\".\"data\"#>>'{name,last}') = 'Simpson' AND (\"User\".\"data\"#>>'{employment}') != 'None')",
          sqlite: "(json_extract(`User`.`data`, '$.name.last') = 'Simpson' AND json_extract(`User`.`data`, '$.employment') != 'None')"
        });

        testsql('data', {
          price: 5,
          name: 'Product'
        }, {
          field: {
            type: new DataTypes.JSONB()
          }
        }, {
          mysql: "(CAST((`data`->>'$.\"price\"') AS DECIMAL) = 5 AND (`data`->>'$.\"name\"') = 'Product')",
          postgres: "(CAST((\"data\"#>>'{price}') AS DOUBLE PRECISION) = 5 AND (\"data\"#>>'{name}') = 'Product')",
          sqlite: "(CAST(json_extract(`data`, '$.price') AS DOUBLE PRECISION) = 5 AND json_extract(`data`, '$.name') = 'Product')"
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
          mysql: "(`data`->>'$.\"nested\".\"attribute\"') = 'value'",
          postgres: "(\"data\"#>>'{nested,attribute}') = 'value'",
          sqlite: "json_extract(`data`, '$.nested.attribute') = 'value'"
        });

        testsql('data.nested.attribute', 4, {
          model: {
            rawAttributes: {
              data: {
                type: new DataTypes.JSON()
              }
            }
          }
        }, {
          mysql: "CAST((`data`->>'$.\"nested\".\"attribute\"') AS DECIMAL) = 4",
          postgres: "CAST((\"data\"#>>'{nested,attribute}') AS DOUBLE PRECISION) = 4",
          sqlite: "CAST(json_extract(`data`, '$.nested.attribute') AS DOUBLE PRECISION) = 4"
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
          mysql: "CAST((`data`->>'$.\"nested\".\"attribute\"') AS DECIMAL) IN (3, 7)",
          postgres: "CAST((\"data\"#>>'{nested,attribute}') AS DOUBLE PRECISION) IN (3, 7)",
          sqlite: "CAST(json_extract(`data`, '$.nested.attribute') AS DOUBLE PRECISION) IN (3, 7)"
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
          mysql: "CAST((`data`->>'$.\"nested\".\"attribute\"') AS DECIMAL) > 2",
          postgres: "CAST((\"data\"#>>'{nested,attribute}') AS DOUBLE PRECISION) > 2",
          sqlite: "CAST(json_extract(`data`, '$.nested.attribute') AS DOUBLE PRECISION) > 2"
        });

        testsql('data', {
          nested: {
            'attribute::integer': {
              $gt: 2
            }
          }
        }, {
          field: {
            type: new DataTypes.JSONB()
          }
        }, {
          mysql: "CAST((`data`->>'$.\"nested\".\"attribute\"') AS DECIMAL) > 2",
          postgres: "CAST((\"data\"#>>'{nested,attribute}') AS INTEGER) > 2",
          sqlite: "CAST(json_extract(`data`, '$.nested.attribute') AS INTEGER) > 2"
        });

        const dt = new Date();
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
          mysql: "CAST((`data`->>'$.\"nested\".\"attribute\"') AS DATETIME) > "+sql.escape(dt),
          postgres: "CAST((\"data\"#>>'{nested,attribute}') AS TIMESTAMPTZ) > "+sql.escape(dt),
          sqlite: "json_extract(`data`, '$.nested.attribute') > " + sql.escape(dt.toISOString())
        });

        testsql('data', {
          nested: {
            attribute: true
          }
        }, {
          field: {
            type: new DataTypes.JSONB()
          }
        }, {
          mysql: "(`data`->>'$.\"nested\".\"attribute\"') = 'true'",
          postgres: "CAST((\"data\"#>>'{nested,attribute}') AS BOOLEAN) = true",
          sqlite: "CAST(json_extract(`data`, '$.nested.attribute') AS BOOLEAN) = 1"
        });

        testsql('metaData.nested.attribute', 'value', {
          model: {
            rawAttributes: {
              metaData: {
                field: 'meta_data',
                fieldName: 'metaData',
                type: new DataTypes.JSONB()
              }
            }
          }
        }, {
          mysql: "(`meta_data`->>'$.\"nested\".\"attribute\"') = 'value'",
          postgres: "(\"meta_data\"#>>'{nested,attribute}') = 'value'",
          sqlite: "json_extract(`meta_data`, '$.nested.attribute') = 'value'"
        });
      });
    }

    if (current.dialect.supports.JSONB) {
      suite('JSONB', () => {
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

    if (current.dialect.supports.REGEXP) {
      suite('$regexp', () => {
        testsql('username', {
          $regexp: '^sw.*r$'
        }, {
          mysql: "`username` REGEXP '^sw.*r$'",
          postgres: '"username" ~ \'^sw.*r$\''
        });
      });

      suite('$regexp', () => {
        testsql('newline', {
          $regexp: '^new\nline$'
        }, {
          mysql: "`newline` REGEXP '^new\\nline$'",
          postgres: '"newline" ~ \'^new\nline$\''
        });
      });

      suite('$notRegexp', () => {
        testsql('username', {
          $notRegexp: '^sw.*r$'
        }, {
          mysql: "`username` NOT REGEXP '^sw.*r$'",
          postgres: '"username" !~ \'^sw.*r$\''
        });
      });

      suite('$notRegexp', () => {
        testsql('newline', {
          $notRegexp: '^new\nline$'
        }, {
          mysql: "`newline` NOT REGEXP '^new\\nline$'",
          postgres: '"newline" !~ \'^new\nline$\''
        });
      });

      if (current.dialect.name === 'postgres') {
        suite('$iRegexp', () => {
          testsql('username', {
            $iRegexp: '^sw.*r$'
          }, {
            postgres: '"username" ~* \'^sw.*r$\''
          });
        });

        suite('$iRegexp', () => {
          testsql('newline', {
            $iRegexp: '^new\nline$'
          }, {
            postgres: '"newline" ~* \'^new\nline$\''
          });
        });

        suite('$notIRegexp', () => {
          testsql('username', {
            $notIRegexp: '^sw.*r$'
          }, {
            postgres: '"username" !~* \'^sw.*r$\''
          });
        });

        suite('$notIRegexp', () => {
          testsql('newline', {
            $notIRegexp: '^new\nline$'
          }, {
            postgres: '"newline" !~* \'^new\nline$\''
          });
        });
      }
    }

    suite('fn', () => {
      test('{name: this.sequelize.fn(\'LOWER\', \'DERP\')}', function() {
        expectsql(sql.whereQuery({name: this.sequelize.fn('LOWER', 'DERP')}), {
          default: "WHERE [name] = LOWER('DERP')",
          mssql: "WHERE [name] = LOWER(N'DERP')"
        });
      });
    });
  });

  suite('getWhereConditions', () => {
    const testsql = function(value, expectation) {
      const User = current.define('user', {});

      test(util.inspect(value, {depth: 10}), () => {
        return expectsql(sql.getWhereConditions(value, User.tableName, User), expectation);
      });
    };

    testsql(current.where(current.fn('lower', current.col('name')), null), {
      default: 'lower([name]) IS NULL'
    });

    testsql(current.where(current.fn('SUM', current.col('hours')), '>', 0), {
      default: 'SUM([hours]) > 0'
    });

    testsql(current.where(current.fn('SUM', current.col('hours')), current.Op.gt, 0), {
      default: 'SUM([hours]) > 0'
    });
  });
});
