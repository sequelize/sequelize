'use strict';

const Support = require('../support'),
  DataTypes = require('../../../lib/data-types'),
  QueryTypes = require('../../../lib/query-types'),
  util = require('util'),
  _ = require('lodash'),
  expectsql = Support.expectsql,
  current = Support.sequelize,
  sql = current.dialect.queryGenerator,
  Op = Support.Sequelize.Op;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('whereQuery', () => {
    const testsql = function(params, options, expectation) {
      if (expectation === undefined) {
        expectation = options;
        options = undefined;
      }

      it(util.inspect(params, { depth: 10 }) + (options && `, ${util.inspect(options)}` || ''), () => {
        const sqlOrError = _.attempt(sql.whereQuery.bind(sql), params, options);
        return expectsql(sqlOrError, expectation);
      });
    };

    testsql({}, {
      default: ''
    });
    testsql([], {
      default: ''
    });
    testsql({ id: undefined }, {
      default: new Error('WHERE parameter "id" has invalid "undefined" value')
    });
    testsql({ id: 1 }, {
      default: 'WHERE [id] = 1'
    });
    testsql({ id: 1, user: undefined }, {
      default: new Error('WHERE parameter "user" has invalid "undefined" value')
    });
    testsql({ id: 1, user: undefined }, { type: QueryTypes.SELECT }, {
      default: new Error('WHERE parameter "user" has invalid "undefined" value')
    });
    testsql({ id: 1, user: undefined }, { type: QueryTypes.BULKDELETE }, {
      default: new Error('WHERE parameter "user" has invalid "undefined" value')
    });
    testsql({ id: 1, user: undefined }, { type: QueryTypes.BULKUPDATE }, {
      default: new Error('WHERE parameter "user" has invalid "undefined" value')
    });
    testsql({ id: 1 }, { prefix: 'User' }, {
      default: 'WHERE [User].[id] = 1'
    });

    it("{ id: 1 }, { prefix: current.literal(sql.quoteTable.call(current.dialect.queryGenerator, {schema: 'yolo', tableName: 'User'})) }", () => {
      expectsql(sql.whereQuery({ id: 1 }, { prefix: current.literal(sql.quoteTable.call(current.dialect.queryGenerator, { schema: 'yolo', tableName: 'User' })) }), {
        default: 'WHERE [yolo.User].[id] = 1',
        postgres: 'WHERE "yolo"."User"."id" = 1',
        mariadb: 'WHERE `yolo`.`User`.`id` = 1',
        mssql: 'WHERE [yolo].[User].[id] = 1'
      });
    });

    testsql({
      name: 'a project',
      [Op.or]: [
        { id: [1, 2, 3] },
        { id: { [Op.gt]: 10 } }
      ]
    }, {
      default: "WHERE ([id] IN (1, 2, 3) OR [id] > 10) AND [name] = 'a project'",
      mssql: "WHERE ([id] IN (1, 2, 3) OR [id] > 10) AND [name] = N'a project'"
    });

    testsql({
      name: 'a project',
      id: {
        [Op.or]: [
          [1, 2, 3],
          { [Op.gt]: 10 }
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

  describe('whereItemQuery', () => {
    const testsql = function(key, value, options, expectation) {
      if (expectation === undefined) {
        expectation = options;
        options = undefined;
      }

      it(`${String(key)}: ${util.inspect(value, { depth: 10 })}${options && `, ${util.inspect(options)}` || ''}`, () => {
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

    describe('Op.in', () => {
      testsql('equipment', {
        [Op.in]: [1, 3]
      }, {
        default: '[equipment] IN (1, 3)'
      });

      testsql('equipment', {
        [Op.in]: []
      }, {
        default: '[equipment] IN (NULL)'
      });

      testsql('muscles', {
        [Op.in]: [2, 4]
      }, {
        default: '[muscles] IN (2, 4)'
      });

      testsql('equipment', {
        [Op.in]: current.literal(
          '(select order_id from product_orders where product_id = 3)'
        )
      }, {
        default: '[equipment] IN (select order_id from product_orders where product_id = 3)'
      });
    });

    describe('Buffer', () => {
      testsql('field', Buffer.from('Sequelize'), {
        postgres: '"field" = E\'\\\\x53657175656c697a65\'',
        sqlite: "`field` = X'53657175656c697a65'",
        mariadb: "`field` = X'53657175656c697a65'",
        mysql: "`field` = X'53657175656c697a65'",
        mssql: '[field] = 0x53657175656c697a65'
      });
    });

    describe('Op.not', () => {
      testsql('deleted', {
        [Op.not]: true
      }, {
        default: '[deleted] IS NOT true',
        mssql: '[deleted] IS NOT 1',
        sqlite: '`deleted` IS NOT 1'
      });

      testsql('deleted', {
        [Op.not]: null
      }, {
        default: '[deleted] IS NOT NULL'
      });

      testsql('muscles', {
        [Op.not]: 3
      }, {
        default: '[muscles] != 3'
      });
    });

    describe('Op.notIn', () => {
      testsql('equipment', {
        [Op.notIn]: []
      }, {
        default: ''
      });

      testsql('equipment', {
        [Op.notIn]: [4, 19]
      }, {
        default: '[equipment] NOT IN (4, 19)'
      });

      testsql('equipment', {
        [Op.notIn]: current.literal(
          '(select order_id from product_orders where product_id = 3)'
        )
      }, {
        default: '[equipment] NOT IN (select order_id from product_orders where product_id = 3)'
      });
    });

    describe('Op.ne', () => {
      testsql('email', {
        [Op.ne]: 'jack.bauer@gmail.com'
      }, {
        default: "[email] != 'jack.bauer@gmail.com'",
        mssql: "[email] != N'jack.bauer@gmail.com'"
      });
    });

    describe('Op.and/Op.or/Op.not', () => {
      describe('Op.or', () => {
        testsql('email', {
          [Op.or]: ['maker@mhansen.io', 'janzeh@gmail.com']
        }, {
          default: '([email] = \'maker@mhansen.io\' OR [email] = \'janzeh@gmail.com\')',
          mssql: '([email] = N\'maker@mhansen.io\' OR [email] = N\'janzeh@gmail.com\')'
        });

        testsql('rank', {
          [Op.or]: {
            [Op.lt]: 100,
            [Op.eq]: null
          }
        }, {
          default: '([rank] < 100 OR [rank] IS NULL)'
        });

        testsql(Op.or, [
          { email: 'maker@mhansen.io' },
          { email: 'janzeh@gmail.com' }
        ], {
          default: '([email] = \'maker@mhansen.io\' OR [email] = \'janzeh@gmail.com\')',
          mssql: '([email] = N\'maker@mhansen.io\' OR [email] = N\'janzeh@gmail.com\')'
        });

        testsql(Op.or, {
          email: 'maker@mhansen.io',
          name: 'Mick Hansen'
        }, {
          default: '([email] = \'maker@mhansen.io\' OR [name] = \'Mick Hansen\')',
          mssql: '([email] = N\'maker@mhansen.io\' OR [name] = N\'Mick Hansen\')'
        });

        testsql(Op.or, {
          equipment: [1, 3],
          muscles: {
            [Op.in]: [2, 4]
          }
        }, {
          default: '([equipment] IN (1, 3) OR [muscles] IN (2, 4))'
        });

        testsql(Op.or, [
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

        it('sequelize.or({group_id: 1}, {user_id: 2})', function() {
          expectsql(sql.whereItemQuery(undefined, this.sequelize.or({ group_id: 1 }, { user_id: 2 })), {
            default: '([group_id] = 1 OR [user_id] = 2)'
          });
        });

        it("sequelize.or({group_id: 1}, {user_id: 2, role: 'admin'})", function() {
          expectsql(sql.whereItemQuery(undefined, this.sequelize.or({ group_id: 1 }, { user_id: 2, role: 'admin' })), {
            default: "([group_id] = 1 OR ([user_id] = 2 AND [role] = 'admin'))",
            mssql: "([group_id] = 1 OR ([user_id] = 2 AND [role] = N'admin'))"
          });
        });

        testsql(Op.or, [], {
          default: '0 = 1'
        });

        testsql(Op.or, {}, {
          default: '0 = 1'
        });

        it('sequelize.or()', function() {
          expectsql(sql.whereItemQuery(undefined, this.sequelize.or()), {
            default: '0 = 1'
          });
        });
      });

      describe('Op.and', () => {
        testsql(Op.and, {
          [Op.or]: {
            group_id: 1,
            user_id: 2
          },
          shared: 1
        }, {
          default: '(([group_id] = 1 OR [user_id] = 2) AND [shared] = 1)'
        });

        testsql(Op.and, [
          {
            name: {
              [Op.like]: '%hello'
            }
          },
          {
            name: {
              [Op.like]: 'hello%'
            }
          }
        ], {
          default: "([name] LIKE '%hello' AND [name] LIKE 'hello%')",
          mssql: "([name] LIKE N'%hello' AND [name] LIKE N'hello%')"
        });

        testsql('rank', {
          [Op.and]: {
            [Op.ne]: 15,
            [Op.between]: [10, 20]
          }
        }, {
          default: '([rank] != 15 AND [rank] BETWEEN 10 AND 20)'
        });

        testsql('name', {
          [Op.and]: [
            { [Op.like]: '%someValue1%' },
            { [Op.like]: '%someValue2%' }
          ]
        }, {
          default: "([name] LIKE '%someValue1%' AND [name] LIKE '%someValue2%')",
          mssql: "([name] LIKE N'%someValue1%' AND [name] LIKE N'%someValue2%')"
        });

        it('sequelize.and({shared: 1, sequelize.or({group_id: 1}, {user_id: 2}))', function() {
          expectsql(sql.whereItemQuery(undefined, this.sequelize.and({ shared: 1 }, this.sequelize.or({ group_id: 1 }, { user_id: 2 }))), {
            default: '([shared] = 1 AND ([group_id] = 1 OR [user_id] = 2))'
          });
        });
      });

      describe('Op.not', () => {
        testsql(Op.not, {
          [Op.or]: {
            group_id: 1,
            user_id: 2
          },
          shared: 1
        }, {
          default: 'NOT (([group_id] = 1 OR [user_id] = 2) AND [shared] = 1)'
        });

        testsql(Op.not, [], {
          default: '0 = 1'
        });

        testsql(Op.not, {}, {
          default: '0 = 1'
        });
      });
    });

    describe('Op.col', () => {
      testsql('userId', {
        [Op.col]: 'user.id'
      }, {
        default: '[userId] = [user].[id]'
      });

      testsql('userId', {
        [Op.eq]: {
          [Op.col]: 'user.id'
        }
      }, {
        default: '[userId] = [user].[id]'
      });

      testsql('userId', {
        [Op.gt]: {
          [Op.col]: 'user.id'
        }
      }, {
        default: '[userId] > [user].[id]'
      });

      testsql(Op.or, [
        { 'ownerId': { [Op.col]: 'user.id' } },
        { 'ownerId': { [Op.col]: 'organization.id' } }
      ], {
        default: '([ownerId] = [user].[id] OR [ownerId] = [organization].[id])'
      });

      testsql('$organization.id$', {
        [Op.col]: 'user.organizationId'
      }, {
        default: '[organization].[id] = [user].[organizationId]'
      });

      testsql('$offer.organization.id$', {
        [Op.col]: 'offer.user.organizationId'
      }, {
        default: '[offer->organization].[id] = [offer->user].[organizationId]'
      });
    });

    describe('Op.gt', () => {
      testsql('rank', {
        [Op.gt]: 2
      }, {
        default: '[rank] > 2'
      });

      testsql('created_at', {
        [Op.lt]: {
          [Op.col]: 'updated_at'
        }
      }, {
        default: '[created_at] < [updated_at]'
      });
    });

    describe('Op.like', () => {
      testsql('username', {
        [Op.like]: '%swagger'
      }, {
        default: "[username] LIKE '%swagger'",
        mssql: "[username] LIKE N'%swagger'"
      });
    });

    describe('Op.startsWith', () => {
      testsql('username', {
        [Op.startsWith]: 'swagger'
      }, {
        default: "[username] LIKE 'swagger%'",
        mssql: "[username] LIKE N'swagger%'"
      });

      testsql('username', {
        [Op.startsWith]: current.literal('swagger')
      }, {
        default: "[username] LIKE 'swagger%'",
        mssql: "[username] LIKE N'swagger%'"
      });
    });

    describe('Op.endsWith', () => {
      testsql('username', {
        [Op.endsWith]: 'swagger'
      }, {
        default: "[username] LIKE '%swagger'",
        mssql: "[username] LIKE N'%swagger'"
      });

      testsql('username', {
        [Op.endsWith]: current.literal('swagger')
      }, {
        default: "[username] LIKE '%swagger'",
        mssql: "[username] LIKE N'%swagger'"
      });
    });

    describe('Op.substring', () => {
      testsql('username', {
        [Op.substring]: 'swagger'
      }, {
        default: "[username] LIKE '%swagger%'",
        mssql: "[username] LIKE N'%swagger%'"
      });

      testsql('username', {
        [Op.substring]: current.literal('swagger')
      }, {
        default: "[username] LIKE '%swagger%'",
        mssql: "[username] LIKE N'%swagger%'"
      });
    });

    describe('Op.between', () => {
      testsql('date', {
        [Op.between]: ['2013-01-01', '2013-01-11']
      }, {
        default: "[date] BETWEEN '2013-01-01' AND '2013-01-11'",
        mssql: "[date] BETWEEN N'2013-01-01' AND N'2013-01-11'"
      });

      testsql('date', {
        [Op.between]: [new Date('2013-01-01'), new Date('2013-01-11')]
      }, {
        default: "[date] BETWEEN '2013-01-01 00:00:00.000 +00:00' AND '2013-01-11 00:00:00.000 +00:00'",
        mysql: "`date` BETWEEN '2013-01-01 00:00:00' AND '2013-01-11 00:00:00'",
        mariadb: "`date` BETWEEN '2013-01-01 00:00:00.000' AND '2013-01-11 00:00:00.000'"
      });

      testsql('date', {
        [Op.between]: [1356998400000, 1357862400000]
      }, {
        model: {
          rawAttributes: {
            date: {
              type: new DataTypes.DATE()
            }
          }
        }
      },
      {
        default: "[date] BETWEEN '2013-01-01 00:00:00.000 +00:00' AND '2013-01-11 00:00:00.000 +00:00'",
        mssql: "[date] BETWEEN N'2013-01-01 00:00:00.000 +00:00' AND N'2013-01-11 00:00:00.000 +00:00'"
      });

      testsql('date', {
        [Op.between]: ['2012-12-10', '2013-01-02'],
        [Op.notBetween]: ['2013-01-04', '2013-01-20']
      }, {
        default: "([date] BETWEEN '2012-12-10' AND '2013-01-02' AND [date] NOT BETWEEN '2013-01-04' AND '2013-01-20')",
        mssql: "([date] BETWEEN N'2012-12-10' AND N'2013-01-02' AND [date] NOT BETWEEN N'2013-01-04' AND N'2013-01-20')"
      });
    });

    describe('Op.notBetween', () => {
      testsql('date', {
        [Op.notBetween]: ['2013-01-01', '2013-01-11']
      }, {
        default: "[date] NOT BETWEEN '2013-01-01' AND '2013-01-11'",
        mssql: "[date] NOT BETWEEN N'2013-01-01' AND N'2013-01-11'"
      });
    });

    if (current.dialect.supports.ARRAY) {
      describe('ARRAY', () => {
        describe('Op.contains', () => {
          testsql('muscles', {
            [Op.contains]: [2, 3]
          }, {
            postgres: '"muscles" @> ARRAY[2,3]'
          });

          testsql('muscles', {
            [Op.contained]: [6, 8]
          }, {
            postgres: '"muscles" <@ ARRAY[6,8]'
          });

          testsql('muscles', {
            [Op.contains]: [2, 5]
          }, {
            field: {
              type: DataTypes.ARRAY(DataTypes.INTEGER)
            }
          }, {
            postgres: '"muscles" @> ARRAY[2,5]::INTEGER[]'
          });

          testsql('muscles', {
            [Op.contains]: ['stringValue1', 'stringValue2', 'stringValue3']
          }, {
            postgres: '"muscles" @> ARRAY[\'stringValue1\',\'stringValue2\',\'stringValue3\']'
          });

          testsql('muscles', {
            [Op.contained]: ['stringValue1', 'stringValue2', 'stringValue3']
          }, {
            postgres: '"muscles" <@ ARRAY[\'stringValue1\',\'stringValue2\',\'stringValue3\']'
          });

          testsql('muscles', {
            [Op.contains]: ['stringValue1', 'stringValue2']
          }, {
            field: {
              type: DataTypes.ARRAY(DataTypes.STRING)
            }
          }, {
            postgres: '"muscles" @> ARRAY[\'stringValue1\',\'stringValue2\']::VARCHAR(255)[]'
          });
        });

        describe('Op.overlap', () => {
          testsql('muscles', {
            [Op.overlap]: [3, 11]
          }, {
            postgres: '"muscles" && ARRAY[3,11]'
          });
        });

        describe('Op.any', () => {
          testsql('userId', {
            [Op.any]: [4, 5, 6]
          }, {
            postgres: '"userId" = ANY (ARRAY[4,5,6])'
          });

          testsql('userId', {
            [Op.any]: [2, 5]
          }, {
            field: {
              type: DataTypes.ARRAY(DataTypes.INTEGER)
            }
          }, {
            postgres: '"userId" = ANY (ARRAY[2,5]::INTEGER[])'
          });

          describe('Op.values', () => {
            testsql('userId', {
              [Op.any]: {
                [Op.values]: [4, 5, 6]
              }
            }, {
              postgres: '"userId" = ANY (VALUES (4), (5), (6))'
            });

            testsql('userId', {
              [Op.any]: {
                [Op.values]: [2, 5]
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

        describe('Op.all', () => {
          testsql('userId', {
            [Op.all]: [4, 5, 6]
          }, {
            postgres: '"userId" = ALL (ARRAY[4,5,6])'
          });

          testsql('userId', {
            [Op.all]: [2, 5]
          }, {
            field: {
              type: DataTypes.ARRAY(DataTypes.INTEGER)
            }
          }, {
            postgres: '"userId" = ALL (ARRAY[2,5]::INTEGER[])'
          });

          describe('Op.values', () => {
            testsql('userId', {
              [Op.all]: {
                [Op.values]: [4, 5, 6]
              }
            }, {
              postgres: '"userId" = ALL (VALUES (4), (5), (6))'
            });

            testsql('userId', {
              [Op.all]: {
                [Op.values]: [2, 5]
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

        describe('Op.like', () => {
          testsql('userId', {
            [Op.like]: {
              [Op.any]: ['foo', 'bar', 'baz']
            }
          }, {
            postgres: "\"userId\" LIKE ANY (ARRAY['foo','bar','baz'])"
          });

          testsql('userId', {
            [Op.iLike]: {
              [Op.any]: ['foo', 'bar', 'baz']
            }
          }, {
            postgres: "\"userId\" ILIKE ANY (ARRAY['foo','bar','baz'])"
          });

          testsql('userId', {
            [Op.notLike]: {
              [Op.any]: ['foo', 'bar', 'baz']
            }
          }, {
            postgres: "\"userId\" NOT LIKE ANY (ARRAY['foo','bar','baz'])"
          });

          testsql('userId', {
            [Op.notILike]: {
              [Op.any]: ['foo', 'bar', 'baz']
            }
          }, {
            postgres: "\"userId\" NOT ILIKE ANY (ARRAY['foo','bar','baz'])"
          });

          testsql('userId', {
            [Op.like]: {
              [Op.all]: ['foo', 'bar', 'baz']
            }
          }, {
            postgres: "\"userId\" LIKE ALL (ARRAY['foo','bar','baz'])"
          });

          testsql('userId', {
            [Op.iLike]: {
              [Op.all]: ['foo', 'bar', 'baz']
            }
          }, {
            postgres: "\"userId\" ILIKE ALL (ARRAY['foo','bar','baz'])"
          });

          testsql('userId', {
            [Op.notLike]: {
              [Op.all]: ['foo', 'bar', 'baz']
            }
          }, {
            postgres: "\"userId\" NOT LIKE ALL (ARRAY['foo','bar','baz'])"
          });

          testsql('userId', {
            [Op.notILike]: {
              [Op.all]: ['foo', 'bar', 'baz']
            }
          }, {
            postgres: "\"userId\" NOT ILIKE ALL (ARRAY['foo','bar','baz'])"
          });
        });
      });
    }

    if (current.dialect.supports.RANGE) {
      describe('RANGE', () => {

        testsql('range', {
          [Op.contains]: new Date(Date.UTC(2000, 1, 1))
        }, {
          field: {
            type: new DataTypes.postgres.RANGE(DataTypes.DATE)
          },
          prefix: 'Timeline'
        }, {
          postgres: "\"Timeline\".\"range\" @> '2000-02-01 00:00:00.000 +00:00'::timestamptz"
        });

        testsql('range', {
          [Op.contains]: [new Date(Date.UTC(2000, 1, 1)), new Date(Date.UTC(2000, 2, 1))]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE(DataTypes.DATE)
          },
          prefix: 'Timeline'
        }, {
          postgres: "\"Timeline\".\"range\" @> '[\"2000-02-01 00:00:00.000 +00:00\",\"2000-03-01 00:00:00.000 +00:00\")'"
        });

        testsql('range', {
          [Op.contained]: [new Date(Date.UTC(2000, 1, 1)), new Date(Date.UTC(2000, 2, 1))]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE(DataTypes.DATE)
          },
          prefix: 'Timeline'
        }, {
          postgres: "\"Timeline\".\"range\" <@ '[\"2000-02-01 00:00:00.000 +00:00\",\"2000-03-01 00:00:00.000 +00:00\")'"
        });

        testsql('unboundedRange', {
          [Op.contains]: [new Date(Date.UTC(2000, 1, 1)), null]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE(DataTypes.DATE)
          },
          prefix: 'Timeline'
        }, {
          postgres: "\"Timeline\".\"unboundedRange\" @> '[\"2000-02-01 00:00:00.000 +00:00\",)'"
        });

        testsql('unboundedRange', {
          [Op.contains]: [-Infinity, Infinity]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE(DataTypes.DATE)
          },
          prefix: 'Timeline'
        }, {
          postgres: "\"Timeline\".\"unboundedRange\" @> '[-infinity,infinity)'"
        });

        testsql('reservedSeats', {
          [Op.overlap]: [1, 4]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE()
          },
          prefix: 'Room'
        }, {
          postgres: "\"Room\".\"reservedSeats\" && '[1,4)'"
        });

        testsql('reservedSeats', {
          [Op.adjacent]: [1, 4]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE()
          },
          prefix: 'Room'
        }, {
          postgres: "\"Room\".\"reservedSeats\" -|- '[1,4)'"
        });

        testsql('reservedSeats', {
          [Op.strictLeft]: [1, 4]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE()
          },
          prefix: 'Room'
        }, {
          postgres: "\"Room\".\"reservedSeats\" << '[1,4)'"
        });

        testsql('reservedSeats', {
          [Op.strictRight]: [1, 4]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE()
          },
          prefix: 'Room'
        }, {
          postgres: "\"Room\".\"reservedSeats\" >> '[1,4)'"
        });

        testsql('reservedSeats', {
          [Op.noExtendRight]: [1, 4]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE()
          },
          prefix: 'Room'
        }, {
          postgres: "\"Room\".\"reservedSeats\" &< '[1,4)'"
        });

        testsql('reservedSeats', {
          [Op.noExtendLeft]: [1, 4]
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
      describe('JSON', () => {
        it('sequelize.json("profile.id"), sequelize.cast(2, \'text\')")', function() {
          expectsql(sql.whereItemQuery(undefined, this.sequelize.json('profile.id', this.sequelize.cast('12346-78912', 'text'))), {
            postgres: "(\"profile\"#>>'{id}') = CAST('12346-78912' AS TEXT)",
            sqlite: "json_extract(`profile`,'$.id') = CAST('12346-78912' AS TEXT)",
            mariadb: "json_unquote(json_extract(`profile`,'$.id')) = CAST('12346-78912' AS CHAR)",
            mysql: "json_unquote(json_extract(`profile`,'$.\\\"id\\\"')) = CAST('12346-78912' AS CHAR)"
          });
        });

        it('sequelize.json({profile: {id: "12346-78912", name: "test"}})', function() {
          expectsql(sql.whereItemQuery(undefined, this.sequelize.json({ profile: { id: '12346-78912', name: 'test' } })), {
            postgres: "(\"profile\"#>>'{id}') = '12346-78912' AND (\"profile\"#>>'{name}') = 'test'",
            sqlite: "json_extract(`profile`,'$.id') = '12346-78912' AND json_extract(`profile`,'$.name') = 'test'",
            mariadb: "json_unquote(json_extract(`profile`,'$.id')) = '12346-78912' AND json_unquote(json_extract(`profile`,'$.name')) = 'test'",
            mysql: "json_unquote(json_extract(`profile`,'$.\\\"id\\\"')) = '12346-78912' AND json_unquote(json_extract(`profile`,'$.\\\"name\\\"')) = 'test'"
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
          mariadb: "json_unquote(json_extract(`User`.`data`,'$.nested.attribute')) = 'value'",
          mysql: "json_unquote(json_extract(`User`.`data`,'$.\\\"nested\\\".\\\"attribute\\\"')) = 'value'",
          postgres: "(\"User\".\"data\"#>>'{nested,attribute}') = 'value'",
          sqlite: "json_extract(`User`.`data`,'$.nested.attribute') = 'value'"
        });

        testsql('data', {
          nested: {
            [Op.in]: [1, 2]
          }
        }, {
          field: {
            type: new DataTypes.JSONB()
          }
        }, {
          mariadb: "CAST(json_unquote(json_extract(`data`,'$.nested')) AS DECIMAL) IN (1, 2)",
          mysql: "CAST(json_unquote(json_extract(`data`,'$.\\\"nested\\\"')) AS DECIMAL) IN (1, 2)",
          postgres: "CAST((\"data\"#>>'{nested}') AS DOUBLE PRECISION) IN (1, 2)",
          sqlite: "CAST(json_extract(`data`,'$.nested') AS DOUBLE PRECISION) IN (1, 2)"
        });

        testsql('data', {
          nested: {
            [Op.between]: [1, 2]
          }
        }, {
          field: {
            type: new DataTypes.JSONB()
          }
        }, {
          mariadb: "CAST(json_unquote(json_extract(`data`,'$.nested')) AS DECIMAL) BETWEEN 1 AND 2",
          mysql: "CAST(json_unquote(json_extract(`data`,'$.\\\"nested\\\"')) AS DECIMAL) BETWEEN 1 AND 2",
          postgres: "CAST((\"data\"#>>'{nested}') AS DOUBLE PRECISION) BETWEEN 1 AND 2",
          sqlite: "CAST(json_extract(`data`,'$.nested') AS DOUBLE PRECISION) BETWEEN 1 AND 2"
        });

        testsql('data', {
          nested: {
            attribute: 'value',
            prop: {
              [Op.ne]: 'None'
            }
          }
        }, {
          field: {
            type: new DataTypes.JSONB()
          },
          prefix: current.literal(sql.quoteTable.call(current.dialect.queryGenerator, { tableName: 'User' }))
        }, {
          mariadb: "(json_unquote(json_extract(`User`.`data`,'$.nested.attribute')) = 'value' AND json_unquote(json_extract(`User`.`data`,'$.nested.prop')) != 'None')",
          mysql: "(json_unquote(json_extract(`User`.`data`,'$.\\\"nested\\\".\\\"attribute\\\"')) = 'value' AND json_unquote(json_extract(`User`.`data`,'$.\\\"nested\\\".\\\"prop\\\"')) != 'None')",
          postgres: "((\"User\".\"data\"#>>'{nested,attribute}') = 'value' AND (\"User\".\"data\"#>>'{nested,prop}') != 'None')",
          sqlite: "(json_extract(`User`.`data`,'$.nested.attribute') = 'value' AND json_extract(`User`.`data`,'$.nested.prop') != 'None')"
        });

        testsql('data', {
          name: {
            last: 'Simpson'
          },
          employment: {
            [Op.ne]: 'None'
          }
        }, {
          field: {
            type: new DataTypes.JSONB()
          },
          prefix: 'User'
        }, {
          mariadb: "(json_unquote(json_extract(`User`.`data`,'$.name.last')) = 'Simpson' AND json_unquote(json_extract(`User`.`data`,'$.employment')) != 'None')",
          mysql: "(json_unquote(json_extract(`User`.`data`,'$.\\\"name\\\".\\\"last\\\"')) = 'Simpson' AND json_unquote(json_extract(`User`.`data`,'$.\\\"employment\\\"')) != 'None')",
          postgres: "((\"User\".\"data\"#>>'{name,last}') = 'Simpson' AND (\"User\".\"data\"#>>'{employment}') != 'None')",
          sqlite: "(json_extract(`User`.`data`,'$.name.last') = 'Simpson' AND json_extract(`User`.`data`,'$.employment') != 'None')"
        });

        testsql('data', {
          price: 5,
          name: 'Product'
        }, {
          field: {
            type: new DataTypes.JSONB()
          }
        }, {
          mariadb: "(CAST(json_unquote(json_extract(`data`,'$.price')) AS DECIMAL) = 5 AND json_unquote(json_extract(`data`,'$.name')) = 'Product')",
          mysql: "(CAST(json_unquote(json_extract(`data`,'$.\\\"price\\\"')) AS DECIMAL) = 5 AND json_unquote(json_extract(`data`,'$.\\\"name\\\"')) = 'Product')",
          postgres: "(CAST((\"data\"#>>'{price}') AS DOUBLE PRECISION) = 5 AND (\"data\"#>>'{name}') = 'Product')",
          sqlite: "(CAST(json_extract(`data`,'$.price') AS DOUBLE PRECISION) = 5 AND json_extract(`data`,'$.name') = 'Product')"
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
          mariadb: "json_unquote(json_extract(`data`,'$.nested.attribute')) = 'value'",
          mysql: "json_unquote(json_extract(`data`,'$.\\\"nested\\\".\\\"attribute\\\"')) = 'value'",
          postgres: "(\"data\"#>>'{nested,attribute}') = 'value'",
          sqlite: "json_extract(`data`,'$.nested.attribute') = 'value'"
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
          mariadb: "CAST(json_unquote(json_extract(`data`,'$.nested.attribute')) AS DECIMAL) = 4",
          mysql: "CAST(json_unquote(json_extract(`data`,'$.\\\"nested\\\".\\\"attribute\\\"')) AS DECIMAL) = 4",
          postgres: "CAST((\"data\"#>>'{nested,attribute}') AS DOUBLE PRECISION) = 4",
          sqlite: "CAST(json_extract(`data`,'$.nested.attribute') AS DOUBLE PRECISION) = 4"
        });

        testsql('data.nested.attribute', {
          [Op.in]: [3, 7]
        }, {
          model: {
            rawAttributes: {
              data: {
                type: new DataTypes.JSONB()
              }
            }
          }
        }, {
          mariadb: "CAST(json_unquote(json_extract(`data`,'$.nested.attribute')) AS DECIMAL) IN (3, 7)",
          mysql: "CAST(json_unquote(json_extract(`data`,'$.\\\"nested\\\".\\\"attribute\\\"')) AS DECIMAL) IN (3, 7)",
          postgres: "CAST((\"data\"#>>'{nested,attribute}') AS DOUBLE PRECISION) IN (3, 7)",
          sqlite: "CAST(json_extract(`data`,'$.nested.attribute') AS DOUBLE PRECISION) IN (3, 7)"
        });

        testsql('data', {
          nested: {
            attribute: {
              [Op.gt]: 2
            }
          }
        }, {
          field: {
            type: new DataTypes.JSONB()
          }
        }, {
          mariadb: "CAST(json_unquote(json_extract(`data`,'$.nested.attribute')) AS DECIMAL) > 2",
          mysql: "CAST(json_unquote(json_extract(`data`,'$.\\\"nested\\\".\\\"attribute\\\"')) AS DECIMAL) > 2",
          postgres: "CAST((\"data\"#>>'{nested,attribute}') AS DOUBLE PRECISION) > 2",
          sqlite: "CAST(json_extract(`data`,'$.nested.attribute') AS DOUBLE PRECISION) > 2"
        });

        testsql('data', {
          nested: {
            'attribute::integer': {
              [Op.gt]: 2
            }
          }
        }, {
          field: {
            type: new DataTypes.JSONB()
          }
        }, {
          mariadb: "CAST(json_unquote(json_extract(`data`,'$.nested.attribute')) AS DECIMAL) > 2",
          mysql: "CAST(json_unquote(json_extract(`data`,'$.\\\"nested\\\".\\\"attribute\\\"')) AS DECIMAL) > 2",
          postgres: "CAST((\"data\"#>>'{nested,attribute}') AS INTEGER) > 2",
          sqlite: "CAST(json_extract(`data`,'$.nested.attribute') AS INTEGER) > 2"
        });

        const dt = new Date();
        testsql('data', {
          nested: {
            attribute: {
              [Op.gt]: dt
            }
          }
        }, {
          field: {
            type: new DataTypes.JSONB()
          }
        }, {
          mariadb: `CAST(json_unquote(json_extract(\`data\`,'$.nested.attribute')) AS DATETIME) > ${sql.escape(dt)}`,
          mysql: `CAST(json_unquote(json_extract(\`data\`,'$.\\"nested\\".\\"attribute\\"')) AS DATETIME) > ${sql.escape(dt)}`,
          postgres: `CAST(("data"#>>'{nested,attribute}') AS TIMESTAMPTZ) > ${sql.escape(dt)}`,
          sqlite: `json_extract(\`data\`,'$.nested.attribute') > ${sql.escape(dt.toISOString())}`
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
          mariadb: "json_unquote(json_extract(`data`,'$.nested.attribute')) = 'true'",
          mysql: "json_unquote(json_extract(`data`,'$.\\\"nested\\\".\\\"attribute\\\"')) = 'true'",
          postgres: "CAST((\"data\"#>>'{nested,attribute}') AS BOOLEAN) = true",
          sqlite: "CAST(json_extract(`data`,'$.nested.attribute') AS BOOLEAN) = 1"
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
          mariadb: "json_unquote(json_extract(`meta_data`,'$.nested.attribute')) = 'value'",
          mysql: "json_unquote(json_extract(`meta_data`,'$.\\\"nested\\\".\\\"attribute\\\"')) = 'value'",
          postgres: "(\"meta_data\"#>>'{nested,attribute}') = 'value'",
          sqlite: "json_extract(`meta_data`,'$.nested.attribute') = 'value'"
        });
      });
    }

    if (current.dialect.supports.JSONB) {
      describe('JSONB', () => {
        testsql('data', {
          [Op.contains]: {
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
      describe('Op.regexp', () => {
        testsql('username', {
          [Op.regexp]: '^sw.*r$'
        }, {
          mariadb: "`username` REGEXP '^sw.*r$'",
          mysql: "`username` REGEXP '^sw.*r$'",
          postgres: '"username" ~ \'^sw.*r$\''
        });
      });

      describe('Op.regexp', () => {
        testsql('newline', {
          [Op.regexp]: '^new\nline$'
        }, {
          mariadb: "`newline` REGEXP '^new\\nline$'",
          mysql: "`newline` REGEXP '^new\\nline$'",
          postgres: '"newline" ~ \'^new\nline$\''
        });
      });

      describe('Op.notRegexp', () => {
        testsql('username', {
          [Op.notRegexp]: '^sw.*r$'
        }, {
          mariadb: "`username` NOT REGEXP '^sw.*r$'",
          mysql: "`username` NOT REGEXP '^sw.*r$'",
          postgres: '"username" !~ \'^sw.*r$\''
        });
      });

      describe('Op.notRegexp', () => {
        testsql('newline', {
          [Op.notRegexp]: '^new\nline$'
        }, {
          mariadb: "`newline` NOT REGEXP '^new\\nline$'",
          mysql: "`newline` NOT REGEXP '^new\\nline$'",
          postgres: '"newline" !~ \'^new\nline$\''
        });
      });

      if (current.dialect.name === 'postgres') {
        describe('Op.iRegexp', () => {
          testsql('username', {
            [Op.iRegexp]: '^sw.*r$'
          }, {
            postgres: '"username" ~* \'^sw.*r$\''
          });
        });

        describe('Op.iRegexp', () => {
          testsql('newline', {
            [Op.iRegexp]: '^new\nline$'
          }, {
            postgres: '"newline" ~* \'^new\nline$\''
          });
        });

        describe('Op.notIRegexp', () => {
          testsql('username', {
            [Op.notIRegexp]: '^sw.*r$'
          }, {
            postgres: '"username" !~* \'^sw.*r$\''
          });
        });

        describe('Op.notIRegexp', () => {
          testsql('newline', {
            [Op.notIRegexp]: '^new\nline$'
          }, {
            postgres: '"newline" !~* \'^new\nline$\''
          });
        });
      }
    }

    if (current.dialect.supports.TSVESCTOR) {
      describe('Op.match', () => {
        testsql(
          'username',
          {
            [Op.match]: Support.sequelize.fn('to_tsvector', 'swagger')
          },
          {
            postgres: "[username] @@ to_tsvector('swagger')"
          }
        );
      });
    }

    describe('fn', () => {
      it('{name: this.sequelize.fn(\'LOWER\', \'DERP\')}', function() {
        expectsql(sql.whereQuery({ name: this.sequelize.fn('LOWER', 'DERP') }), {
          default: "WHERE [name] = LOWER('DERP')",
          mssql: "WHERE [name] = LOWER(N'DERP')"
        });
      });
    });
  });

  describe('getWhereConditions', () => {
    const testsql = function(value, expectation) {
      const User = current.define('user', {});

      it(util.inspect(value, { depth: 10 }), () => {
        return expectsql(sql.getWhereConditions(value, User.tableName, User), expectation);
      });
    };

    testsql(current.where(current.fn('lower', current.col('name')), null), {
      default: 'lower([name]) IS NULL'
    });

    testsql(current.where(current.fn('SUM', current.col('hours')), '>', 0), {
      default: 'SUM([hours]) > 0'
    });

    testsql(current.where(current.fn('SUM', current.col('hours')), Op.gt, 0), {
      default: 'SUM([hours]) > 0'
    });

    testsql(current.where(current.fn('lower', current.col('name')), Op.ne, null), {
      default: 'lower([name]) IS NOT NULL'
    });

    testsql(current.where(current.fn('lower', current.col('name')), Op.not, null), {
      default: 'lower([name]) IS NOT NULL'
    });

    testsql([current.where(current.fn('SUM', current.col('hours')), Op.gt, 0),
      current.where(current.fn('lower', current.col('name')), null)], {
      default: '(SUM([hours]) > 0 AND lower([name]) IS NULL)'
    });
    
    testsql(current.where(current.col('hours'), Op.between, [0, 5]), {
      default: '[hours] BETWEEN 0 AND 5'
    });
    
    testsql(current.where(current.col('hours'), Op.notBetween, [0, 5]), {
      default: '[hours] NOT BETWEEN 0 AND 5'
    });
  });
});
