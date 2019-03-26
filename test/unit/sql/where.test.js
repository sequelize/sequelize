'use strict';

const Support = require('../support'),
  DataTypes = require('../../../lib/data-types'),
  QueryTypes = require('../../../lib/query-types'),
  util = require('util'),
  _ = require('lodash'),
  moment = require('moment'),
  expectsql = Support.expectsql,
  current = Support.sequelize,
  sql = current.dialect.QueryGenerator,
  Op = Support.Sequelize.Op;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('whereQuery', () => {
    const testsql = function(params, options, expectation) {
      if (expectation === undefined) {
        expectation = options;
        options = undefined;
      }

      it(util.inspect(params, { depth: 10 })+(options && `, ${util.inspect(options)}` || ''), () => {
        const sqlOrError = _.attempt(() => sql.composeQuery(sql.whereQuery.apply(sql, arguments)), params, options);
        return expectsql(sqlOrError, expectation);
      });
    };

    testsql({}, {
      default: ';'
    });
    testsql([], {
      default: ';'
    });
    testsql({ id: undefined }, {
      default: new Error('WHERE parameter "id" has invalid "undefined" value')
    });
    testsql({ id: 1 }, {
      query: {
        default: 'WHERE [id] = $1;'
      },
      bind: {
        default: [1]
      }
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
      query: {
        default: 'WHERE [User].[id] = $1;'
      },
      bind: {
        default: [1]
      }
    });

    it("{ id: 1 }, { prefix: current.literal(sql.quoteTable.call(current.dialect.QueryGenerator, { schema: 'yolo', tableName: 'User' })) }", () => {
      testsql(sql.whereQuery({ id: 1 }, { prefix: current.literal(sql.quoteTable.call(current.dialect.QueryGenerator, { schema: 'yolo', tableName: 'User' })) }), {
        query: {
          default: 'WHERE [yolo].[User].[id] = $1;',
          sqlite: 'WHERE `yolo.User`.`id` = ?1;'
        },
        bind: {
          default: [1]
        }
      });
    });

    testsql({
      name: 'a project',
      [Op.or]: [
        { id: [1, 2, 3] },
        { id: { [Op.gt]: 10 } }
      ]
    }, {
      query: {
        default: 'WHERE ([id] IN ($1, $2, $3) OR [id] > $4) AND [name] = $5;'
      },
      bind: {
        default: [1, 2, 3, 10, 'a project']
      }
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
      query: {
        default: 'WHERE [name] = $1 AND ([id] IN ($2, $3, $4) OR [id] > $5);'
      },
      bind: {
        default: ['a project', 1, 2, 3, 10]
      }
    });

    testsql({
      name: 'here is a null char: \0'
    }, {
      query: {
        default: 'WHERE [name] = $1;'
      },
      bind: {
        default: ['here is a null char: \0']
      }
    });
  });

  describe('whereItemQuery', () => {
    const testsql = function(key, value, options, expectation) {
      if (expectation === undefined) {
        expectation = options;
        options = undefined;
      }

      it(`${String(key)}: ${util.inspect(value, { depth: 10 })}${options && `, ${util.inspect(options)}` || ''}`, () => {
        return expectsql(sql.composeQuery(sql.whereItemQuery(key, value, options)), expectation);
      });
    };

    testsql(undefined, 'lol=1', {
      default: 'lol=1;'
    });

    testsql('deleted', null, {
      default: '[deleted] IS NULL;'
    });

    describe('Op.in', () => {
      testsql('equipment', {
        [Op.in]: [1, 3]
      }, {
        query: {
          default: '[equipment] IN ($1, $2);'
        },
        bind: {
          default: [1, 3]
        }
      });

      testsql('equipment', {
        [Op.in]: []
      }, {
        default: '[equipment] IN (NULL);'
      });

      testsql('muscles', {
        [Op.in]: [2, 4]
      }, {
        query: {
          default: '[muscles] IN ($1, $2);'
        },
        bind: {
          default: [2, 4]
        }
      });

      testsql('equipment', {
        [Op.in]: current.literal(
          '(select order_id from product_orders where product_id = 3)'
        )
      }, {
        default: '[equipment] IN (select order_id from product_orders where product_id = 3);'
      });
    });

    describe('Buffer', () => {
      testsql('field', Buffer.from('Sequelize'), {
        query: {
          default: '[field] = $1;'
        },
        bind: {
          default: [Buffer.from('Sequelize')]
        }
      });
    });

    describe('Op.not', () => {
      testsql('deleted', {
        [Op.not]: true
      }, {
        query: {
          default: '[deleted] IS NOT $1;'
        },
        bind: {
          default: [true]
        }
      });

      testsql('deleted', {
        [Op.not]: null
      }, {
        default: '[deleted] IS NOT NULL;'
      });

      testsql('muscles', {
        [Op.not]: 3
      }, {
        query: {
          default: '[muscles] != $1;'
        },
        bind: {
          default: [3]
        }
      });
    });

    describe('Op.notIn', () => {
      testsql('equipment', {
        [Op.notIn]: []
      }, {
        query: {
          default: ';'
        }
      });

      testsql('equipment', {
        [Op.notIn]: [4, 19]
      }, {
        query: {
          default: '[equipment] NOT IN ($1, $2);'
        },
        bind: {
          default: [4, 19]
        }
      });

      testsql('equipment', {
        [Op.notIn]: current.literal(
          '(select order_id from product_orders where product_id = 3)'
        )
      }, {
        default: '[equipment] NOT IN (select order_id from product_orders where product_id = 3);'
      });
    });

    describe('Op.ne', () => {
      testsql('email', {
        [Op.ne]: 'jack.bauer@gmail.com'
      }, {
        query: {
          default: '[email] != $1;'
        },
        bind: {
          default: ['jack.bauer@gmail.com']
        }
      });
    });

    describe('Op.and/Op.or/Op.not', () => {
      describe('Op.or', () => {
        testsql('email', {
          [Op.or]: ['maker@mhansen.io', 'janzeh@gmail.com']
        }, {
          query: {
            default: '([email] = $1 OR [email] = $2);'
          },
          bind: {
            default: ['maker@mhansen.io', 'janzeh@gmail.com']
          }
        });

        testsql('rank', {
          [Op.or]: {
            [Op.lt]: 100,
            [Op.eq]: null
          }
        }, {
          query: {
            default: '([rank] < $1 OR [rank] IS NULL);'
          },
          bind: {
            default: [100]
          }
        });

        testsql(Op.or, [
          { email: 'maker@mhansen.io' },
          { email: 'janzeh@gmail.com' }
        ], {
          query: {
            default: '([email] = $1 OR [email] = $2);'
          },
          bind: {
            default: ['maker@mhansen.io', 'janzeh@gmail.com']
          }
        });

        testsql(Op.or, {
          email: 'maker@mhansen.io',
          name: 'Mick Hansen'
        }, {
          query: {
            default: '([email] = $1 OR [name] = $2);'
          },
          bind: {
            default: ['maker@mhansen.io', 'Mick Hansen']
          }
        });

        testsql(Op.or, {
          equipment: [1, 3],
          muscles: {
            [Op.in]: [2, 4]
          }
        }, {
          query: {
            default: '([equipment] IN ($1, $2) OR [muscles] IN ($3, $4));'
          },
          bind: {
            default: [1, 3, 2, 4]
          }
        });

        testsql(Op.or, [
          {
            roleName: 'NEW'
          }, {
            roleName: 'CLIENT',
            type: 'CLIENT'
          }
        ], {
          query: {
            default: '([roleName] = $1 OR ([roleName] = $2 AND [type] = $3));'
          },
          bind: {
            default: ['NEW', 'CLIENT', 'CLIENT']
          }
        });

        it('sequelize.or({group_id: 1}, {user_id: 2})', function() {
          testsql(sql.whereItemQuery(undefined, this.sequelize.or({ group_id: 1 }, { user_id: 2 })), {
            query: {
              default: '([group_id] = $1 OR [user_id] = $2)'
            },
            bind: {
              default: [1, 2]
            }
          });
        });

        it("sequelize.or({group_id: 1}, {user_id: 2, role: 'admin'})", function() {
          testsql(sql.whereItemQuery(undefined, this.sequelize.or({ group_id: 1 }, { user_id: 2, role: 'admin' })), {
            query: {
              default: '([group_id] = $1 OR ([user_id] = $2 AND [role] = $3));'
            },
            bind: {
              default: [1, 2, 'admin']
            }
          });
        });

        testsql(Op.or, [], {
          default: '0 = 1;'
        });

        testsql(Op.or, {}, {
          default: '0 = 1;'
        });

        it('sequelize.or()', function() {
          testsql(sql.whereItemQuery(undefined, this.sequelize.or()), {
            default: '0 = 1;'
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
          query: {
            default: '(([group_id] = $1 OR [user_id] = $2) AND [shared] = $3);'
          },
          bind: {
            default: [1, 2, 1]
          }
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
          query: {
            default: '([name] LIKE $1 AND [name] LIKE $2);'
          },
          bind: {
            default: ['%hello', 'hello%']
          }
        });

        testsql('rank', {
          [Op.and]: {
            [Op.ne]: 15,
            [Op.between]: [10, 20]
          }
        }, {
          query: {
            default: '([rank] != $1 AND [rank] BETWEEN $2 AND $3);'
          },
          bind: {
            default: [15, 10, 20]
          }
        });

        testsql('name', {
          [Op.and]: [
            { [Op.like]: '%someValue1%' },
            { [Op.like]: '%someValue2%' }
          ]
        }, {
          query: {
            default: '([name] LIKE $1 AND [name] LIKE $2);'
          },
          bind: {
            default: ['%someValue1%', '%someValue2%']
          }
        });

        it('sequelize.and({shared: 1, sequelize.or({group_id: 1}, {user_id: 2}))', function() {
          testsql(sql.whereItemQuery(undefined, this.sequelize.and({ shared: 1 }, this.sequelize.or({ group_id: 1 }, { user_id: 2 }))), {
            query: {
              default: '([shared] = $1 AND ([group_id] = $2 OR [user_id] = $3));'
            },
            bind: {
              default: [1, 1, 2]
            }
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
          query: {
            default: 'NOT (([group_id] = $1 OR [user_id] = $2) AND [shared] = $3);'
          },
          bind: {
            default: [1, 2, 1]
          }
        });

        testsql(Op.not, [], {
          default: '0 = 1;'
        });

        testsql(Op.not, {}, {
          default: '0 = 1;'
        });
      });
    });

    describe('Op.col', () => {
      testsql('userId', {
        [Op.col]: 'user.id'
      }, {
        default: '[userId] = [user].[id];'
      });

      testsql('userId', {
        [Op.eq]: {
          [Op.col]: 'user.id'
        }
      }, {
        default: '[userId] = [user].[id];'
      });

      testsql('userId', {
        [Op.gt]: {
          [Op.col]: 'user.id'
        }
      }, {
        default: '[userId] > [user].[id];'
      });

      testsql(Op.or, [
        { 'ownerId': { [Op.col]: 'user.id' } },
        { 'ownerId': { [Op.col]: 'organization.id' } }
      ], {
        default: '([ownerId] = [user].[id] OR [ownerId] = [organization].[id]);'
      });

      testsql('$organization.id$', {
        [Op.col]: 'user.organizationId'
      }, {
        default: '[organization].[id] = [user].[organizationId];'
      });

      testsql('$offer.organization.id$', {
        [Op.col]: 'offer.user.organizationId'
      }, {
        default: '[offer->organization].[id] = [offer->user].[organizationId];'
      });
    });

    describe('Op.gt', () => {
      testsql('rank', {
        [Op.gt]: 2
      }, {
        query: {
          default: '[rank] > $1;'
        },
        bind: {
          default: [2]
        }
      });

      testsql('created_at', {
        [Op.lt]: {
          [Op.col]: 'updated_at'
        }
      }, {
        default: '[created_at] < [updated_at];'
      });
    });

    describe('Op.like', () => {
      testsql('username', {
        [Op.like]: '%swagger'
      }, {
        query: {
          default: '[username] LIKE $1;'
        },
        bind: {
          default: ['%swagger']
        }
      });
    });

    describe('Op.startsWith', () => {
      testsql('username', {
        [Op.startsWith]: 'swagger'
      }, {
        query: {
          default: '[username] LIKE $1;'
        },
        bind: {
          default: ['%swagger']
        }
      });
    });

    describe('Op.endsWith', () => {
      testsql('username', {
        [Op.endsWith]: 'swagger'
      }, {
        query: {
          default: '[username] LIKE $1;'
        },
        bind: {
          default: ['swagger%']
        }
      });
    });

    describe('Op.substring', () => {
      testsql('username', {
        [Op.substring]: 'swagger'
      }, {
        query: {
          default: '[username] LIKE $1;'
        },
        bind: {
          default: ['%swagger%']
        }
      });
    });

    describe('Op.between', () => {
      testsql('date', {
        [Op.between]: ['2013-01-01', '2013-01-11']
      }, {
        query: {
          default: '[date] BETWEEN $1 AND $2;'
        },
        bind: {
          default: ['2013-01-01', '2013-01-11']
        }
      });

      testsql('date', {
        [Op.between]: [new Date('2013-01-01'), new Date('2013-01-11')]
      }, {
        query: {
          default: '[date] BETWEEN $1 AND $2;'
        },
        bind: {
          default: ['2013-01-01 00:00:00.000 +00:00', '2013-01-11 00:00:00.000 +00:00'],
          mysql: ['2013-01-01 00:00:00', '2013-01-11 00:00:00'],
          mariadb: ['2013-01-01 00:00:00.000', '2013-01-11 00:00:00.000']
        }
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
        query: {
          default: '[date] BETWEEN $1 AND $2;'
        },
        bind: {
          default: ['2013-01-01 00:00:00.000 +00:00', '2013-01-11 00:00:00.000 +00:00']
        }
      });

      testsql('date', {
        [Op.between]: ['2012-12-10', '2013-01-02'],
        [Op.notBetween]: ['2013-01-04', '2013-01-20']
      }, {
        query: {
          default: '([date] BETWEEN $1 AND $2 AND [date] NOT BETWEEN $3 AND $4);'
        },
        bind: {
          default: ['2012-12-10', '2013-01-02', '2013-01-04', '2013-01-20']
        }
      });
    });

    describe('Op.notBetween', () => {
      testsql('date', {
        [Op.notBetween]: ['2013-01-01', '2013-01-11']
      }, {
        query: {
          default: '[date] NOT BETWEEN $1 AND $2;'
        },
        bind: {
          default: ['2013-01-01', '2013-01-11']
        }
      });
    });

    if (current.dialect.supports.ARRAY) {
      describe('ARRAY', () => {
        describe('Op.contains', () => {
          testsql('muscles', {
            [Op.contains]: [2, 3]
          }, {
            query: {
              postgres: '"muscles" @> $1;'
            },
            bind: {
              default: [[2, 3]]
            }
          });

          testsql('muscles', {
            [Op.contained]: [6, 8]
          }, {
            query: {
              postgres: '"muscles" <@ $1;'
            },
            bind: {
              default: [[6, 8]]
            }
          });

          testsql('muscles', {
            [Op.contains]: [2, 5]
          }, {
            field: {
              type: DataTypes.ARRAY(DataTypes.INTEGER)
            }
          }, {
            query: {
              postgres: '"muscles" @> $1;'
            },
            bind: {
              default: [[2, 5]]
            }
          });
        });

        describe('Op.overlap', () => {
          testsql('muscles', {
            [Op.overlap]: [3, 11]
          }, {
            query: {
              postgres: '"muscles" && $1;'
            },
            bind: {
              default: [[3, 11]]
            }
          });
        });

        describe('Op.any', () => {
          testsql('userId', {
            [Op.any]: [4, 5, 6]
          }, {
            query: {
              postgres: '"userId" = ANY ($1);'
            },
            bind: {
              default: [[4, 5, 6]]
            }
          });

          testsql('userId', {
            [Op.any]: [2, 5]
          }, {
            field: {
              type: DataTypes.ARRAY(DataTypes.INTEGER)
            }
          }, {
            query: {
              postgres: '"userId" = ANY ($1);'
            },
            bind: {
              default: [[2, 5]]
            }
          });

          describe('Op.values', () => {
            testsql('userId', {
              [Op.any]: {
                [Op.values]: [4, 5, 6]
              }
            }, {
              query: {
                postgres: '"userId" = ANY (VALUES ($1), ($2), ($3));'
              },
              bind: {
                default: [4, 5, 6]
              }
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
              query: {
                postgres: '"userId" = ANY (VALUES ($1), ($2));'
              },
              bind: {
                default: [2, 5]
              }
            });
          });
        });

        describe('Op.all', () => {
          testsql('userId', {
            [Op.all]: [4, 5, 6]
          }, {
            query: {
              postgres: '"userId" = ALL ($1);'
            },
            bind: {
              default: [[4, 5, 6]]
            }
          });

          testsql('userId', {
            [Op.all]: [2, 5]
          }, {
            field: {
              type: DataTypes.ARRAY(DataTypes.INTEGER)
            }
          }, {
            query: {
              postgres: '"userId" = ALL ($1);'
            },
            bind: {
              default: [[2, 5]]
            }
          });

          describe('Op.values', () => {
            testsql('userId', {
              [Op.all]: {
                [Op.values]: [4, 5, 6]
              }
            }, {
              query: {
                postgres: '"userId" = ALL (VALUES ($1), ($2), ($3));'
              },
              bind: {
                default: [4, 5, 6]
              }
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
              query: {
                postgres: '"userId" = ALL (VALUES ($1), ($2));'
              },
              bind: {
                default: [2, 5]
              }
            });
          });
        });

        describe('Op.like', () => {
          testsql('userId', {
            [Op.like]: {
              [Op.any]: ['foo', 'bar', 'baz']
            }
          }, {
            query: {
              postgres: '"userId" LIKE ANY ($1);'
            },
            bind: {
              default: [['foo', 'bar', 'baz']]
            }
          });

          testsql('userId', {
            [Op.iLike]: {
              [Op.any]: ['foo', 'bar', 'baz']
            }
          }, {
            query: {
              postgres: '"userId" ILIKE ANY ($1);'
            },
            bind: {
              default: [['foo', 'bar', 'baz']]
            }
          });

          testsql('userId', {
            [Op.notLike]: {
              [Op.any]: ['foo', 'bar', 'baz']
            }
          }, {
            query: {
              postgres: '"userId" NOT LIKE ANY ($1);'
            },
            bind: {
              default: [['foo', 'bar', 'baz']]
            }
          });

          testsql('userId', {
            [Op.notILike]: {
              [Op.any]: ['foo', 'bar', 'baz']
            }
          }, {
            query: {
              postgres: '"userId" NOT ILIKE ANY ($1);'
            },
            bind: {
              default: [['foo', 'bar', 'baz']]
            }
          });

          testsql('userId', {
            [Op.like]: {
              [Op.all]: ['foo', 'bar', 'baz']
            }
          }, {
            query: {
              postgres: '"userId" LIKE ALL ($1);'
            },
            bind: {
              default: [['foo', 'bar', 'baz']]
            }
          });

          testsql('userId', {
            [Op.iLike]: {
              [Op.all]: ['foo', 'bar', 'baz']
            }
          }, {
            query: {
              postgres: '"userId" ILIKE ALL ($1);'
            },
            bind: {
              default: [['foo', 'bar', 'baz']]
            }
          });

          testsql('userId', {
            [Op.notLike]: {
              [Op.all]: ['foo', 'bar', 'baz']
            }
          }, {
            query: {
              postgres: '"userId" NOT LIKE ALL ($1);'
            },
            bind: {
              default: [['foo', 'bar', 'baz']]
            }
          });

          testsql('userId', {
            [Op.notILike]: {
              [Op.all]: ['foo', 'bar', 'baz']
            }
          }, {
            query: {
              postgres: '"userId" NOT ILIKE ALL ($1);'
            },
            bind: {
              default: [['foo', 'bar', 'baz']]
            }
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
          query: {
            postgres: '"Timeline"."range" @> $1::timestamptz;'
          },
          bind: {
            default: ['2000-02-01 00:00:00.000 +00:00']
          }
        });

        testsql('range', {
          [Op.contains]: [new Date(Date.UTC(2000, 1, 1)), new Date(Date.UTC(2000, 2, 1))]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE(DataTypes.DATE)
          },
          prefix: 'Timeline'
        }, {
          query: {
            postgres: '"Timeline"."range" @> $1;'
          },
          bind: {
            default: ['["2000-02-01 00:00:00.000 +00:00","2000-03-01 00:00:00.000 +00:00")']
          }
        });

        testsql('range', {
          [Op.contained]: [new Date(Date.UTC(2000, 1, 1)), new Date(Date.UTC(2000, 2, 1))]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE(DataTypes.DATE)
          },
          prefix: 'Timeline'
        }, {
          query: {
            postgres: '"Timeline"."range" <@ $1;'
          },
          bind: {
            default: ['["2000-02-01 00:00:00.000 +00:00","2000-03-01 00:00:00.000 +00:00")']
          }
        });

        testsql('unboundedRange', {
          [Op.contains]: [new Date(Date.UTC(2000, 1, 1)), null]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE(DataTypes.DATE)
          },
          prefix: 'Timeline'
        }, {
          query: {
            postgres: '"Timeline"."unboundedRange" @> $1;'
          },
          bind: {
            default: ['["2000-02-01 00:00:00.000 +00:00",)']
          }
        });

        testsql('unboundedRange', {
          [Op.contains]: [-Infinity, Infinity]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE(DataTypes.DATE)
          },
          prefix: 'Timeline'
        }, {
          query: {
            postgres: '"Timeline"."unboundedRange" @> $1;'
          },
          bind: {
            default: ['[-infinity,infinity)']
          }
        });

        testsql('reservedSeats', {
          [Op.overlap]: [1, 4]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE()
          },
          prefix: 'Room'
        }, {
          query: {
            postgres: '"Room"."reservedSeats" && $1;'
          },
          bind: {
            default: ['[1,4)']
          }
        });

        testsql('reservedSeats', {
          [Op.adjacent]: [1, 4]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE()
          },
          prefix: 'Room'
        }, {
          query: {
            postgres: '"Room"."reservedSeats" -|- $1;'
          },
          bind: {
            default: ['[1,4)']
          }
        });

        testsql('reservedSeats', {
          [Op.strictLeft]: [1, 4]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE()
          },
          prefix: 'Room'
        }, {
          query: {
            postgres: '"Room"."reservedSeats" << $1;'
          },
          bind: {
            default: ['[1,4)']
          }
        });

        testsql('reservedSeats', {
          [Op.strictRight]: [1, 4]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE()
          },
          prefix: 'Room'
        }, {
          query: {
            postgres: '"Room"."reservedSeats" >> $1;'
          },
          bind: {
            default: ['[1,4)']
          }
        });

        testsql('reservedSeats', {
          [Op.noExtendRight]: [1, 4]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE()
          },
          prefix: 'Room'
        }, {
          query: {
            postgres: '"Room"."reservedSeats" &< $1;'
          },
          bind: {
            default: ['[1,4)']
          }
        });

        testsql('reservedSeats', {
          [Op.noExtendLeft]: [1, 4]
        }, {
          field: {
            type: new DataTypes.postgres.RANGE()
          },
          prefix: 'Room'
        }, {
          query: {
            postgres: '"Room"."reservedSeats" &> $1;'
          },
          bind: {
            default: ['[1,4)']
          }
        });

      });
    }

    if (current.dialect.supports.JSON) {
      describe('JSON', () => {
        it('sequelize.json("profile.id"), sequelize.cast(2, \'text\')")', function() {
          return expectsql(sql.composeQuery(sql.whereItemQuery(undefined, this.sequelize.json('profile.id', this.sequelize.cast('12346-78912', 'text')))), {
            query: {
              postgres: '("profile"#>>$1) = CAST($2 AS TEXT);',
              sqlite: 'json_extract(`profile`, ?1) = CAST(?2 AS TEXT);',
              mysql: 'json_unquote(json_extract(`profile`,?)) = CAST(? AS CHAR);',
              mariadb: 'json_unquote(json_extract(`profile`,?)) = CAST(? AS CHAR);'
            },
            bind: {
              default: ['$.id', '12346-78912'],
              postgres: ['{id}', '12346-78912']
            }
          });
        });

        it('sequelize.json({profile: {id: "12346-78912", name: "test"}})', function() {
          return expectsql(sql.composeQuery(sql.whereItemQuery(undefined, this.sequelize.json({ profile: { id: '12346-78912', name: 'test' } }))), {
            query: {
              postgres: '("profile"#>>$1) = $2 AND ("profile"#>>$3) = $4;',
              sqlite: 'json_extract(`profile`, ?1) = ?2 AND json_extract(`profile`, ?3) = ?4;',
              mysql: 'json_unquote(json_extract(`profile`,?)) = ? and json_unquote(json_extract(`profile`,?)) = ?;',
              mariadb: 'json_unquote(json_extract(`profile`,?)) = ? and json_unquote(json_extract(`profile`,?)) = ?;'
            },
            bind: {
              default: ['$.id', '12346-78912', '$.name', 'test'],
              postgres: ['{id}', '12346-78912', '{name}', 'test']
            }
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
          query: {
            postgres: '("User"."data"#>>$1) = $2;',
            mysql: 'json_unquote(json_extract(`User`.`data`,?)) = ?;',
            mariadb: 'json_unquote(json_extract(`User`.`data`,?)) = ?;',
            sqlite: 'json_extract(`User`.`data`, ?1) = ?2;'
          },
          bind: {
            postgres: ['{nested,attribute}', 'value'],
            mysql: ['$."nested"."attribute"', 'value'],
            mariadb: ['$.nested.attribute', 'value'],
            sqlite: ['$.nested.attribute', 'value']
          }
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
          query: {
            postgres: 'CAST(("data"#>>$1) AS DOUBLE PRECISION) IN ($2, $3);',
            mysql: 'CAST(json_unquote(json_extract(`data`,?)) AS DECIMAL) IN (?, ?);',
            mariadb: 'CAST(json_unquote(json_extract(`data`,?)) AS DECIMAL) IN (?, ?);',
            sqlite: 'CAST(json_extract(`data`, ?1) AS DOUBLE PRECISION) IN (?2, ?3);'
          },
          bind: {
            postgres: ['{nested}', 1, 2],
            mysql: ['$."nested"', 1, 2],
            mariadb: ['$.nested', 1, 2],
            sqlite: ['$.nested', 1, 2]
          }
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
          query: {
            postgres: 'CAST(("data"#>>$1) AS DOUBLE PRECISION) BETWEEN $2 AND $3;',
            mysql: 'CAST(json_unquote(json_extract(`data`,?)) AS DECIMAL) BETWEEN ? AND ?;',
            mariadb: 'CAST(json_unquote(json_extract(`data`,?)) AS DECIMAL) BETWEEN ? AND ?;',
            sqlite: 'CAST(json_extract(`data`, ?1) AS DOUBLE PRECISION) BETWEEN ?2 AND ?3;'
          },
          bind: {
            postgres: ['{nested}', 1, 2],
            mysql: ['$."nested"', 1, 2],
            mariadb: ['$.nested', 1, 2],
            sqlite: ['$.nested', 1, 2]
          }
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
          prefix: current.literal(sql.quoteTable.call(current.dialect.QueryGenerator, { tableName: 'User' }))
        }, {
          query: {
            postgres: '(("User"."data"#>>$1) = $2 AND ("User"."data"#>>$3) != $4);',
            mysql: '(json_unquote(json_extract(`User`.`data`,?)) = ? AND json_unquote(json_extract(`User`.`data`,?)) != ?);',
            mariadb: '(json_unquote(json_extract(`User`.`data`,?)) = ? AND json_unquote(json_extract(`User`.`data`,?)) != ?);',
            sqlite: '(json_extract(`User`.`data`, ?1) = ?2 AND json_extract(`User`.`data`, ?3) != ?4);'
          },
          bind: {
            postgres: ['{nested,attribute}', 'value', '{nested,prop}', 'None'],
            mysql: ['$."nested"."attribute"', 'value', '$."nested"."prop"', 'None'],
            mariadb: ['$.nested.attribute', 'value', '$.nested.prop', 'None'],
            sqlite: ['$.nested.attribute', 'value', '$.nested.prop', 'None']
          }
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
          query: {
            postgres: '(("User"."data"#>>$1) = $2 AND ("User"."data"#>>$3) != $4);',
            mysql: '(json_unquote(json_extract(`User`.`data`,?)) = ? AND json_unquote(json_extract(`User`.`data`,?)) != ?);',
            mariadb: '(json_unquote(json_extract(`User`.`data`,?)) = ? AND json_unquote(json_extract(`User`.`data`,?)) != ?);',
            sqlite: '(json_extract(`User`.`data`, ?1) = ?2 AND json_extract(`User`.`data`, ?3) != ?4);'
          },
          bind: {
            postgres: ['{name,last}', 'Simpson', '{employment}', 'None'],
            mysql: ['$."name"."last"', 'Simpson', '$."employment"', 'None'],
            mariadb: ['$.name.last', 'Simpson', '$.employment', 'None'],
            sqlite: ['$.name.last', 'Simpson', '$.employment', 'None']
          }
        });

        testsql('data', {
          price: 5,
          name: 'Product'
        }, {
          field: {
            type: new DataTypes.JSONB()
          }
        }, {
          query: {
            postgres: '(CAST(("data"#>>$1) AS DOUBLE PRECISION) = $2 AND ("data"#>>$3) = $4);',
            mysql: '(CAST(json_unquote(json_extract(`data`,?)) AS DECIMAL) = ? AND json_unquote(json_extract(`data`,?)) = ?);',
            mariadb: '(CAST(json_unquote(json_extract(`data`,?)) AS DECIMAL) = ? AND json_unquote(json_extract(`data`,?)) = ?);',
            sqlite: '(CAST(json_extract(`data`, ?1) AS DOUBLE PRECISION) = ?2 AND json_extract(`data`, ?3) = ?4);'
          },
          bind: {
            postgres: ['{price}', 5, '{name}', 'Product'],
            mysql: ['$."price"', 5, '$."name"', 'Product'],
            mariadb: ['$.price', 5, '$.name', 'Product'],
            sqlite: ['$.price', 5, '$.name', 'Product']
          }
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
          query: {
            postgres: '("data"#>>$1) = $2;',
            mysql: 'json_unquote(json_extract(`data`,?)) = ?;',
            mariadb: 'json_unquote(json_extract(`data`,?)) = ?;',
            sqlite: 'json_extract(`data`, ?1) = ?2;'
          },
          bind: {
            postgres: ['{nested,attribute}', 'value'],
            mysql: ['$."nested"."attribute"', 'value'],
            mariadb: ['$.nested.attribute', 'value'],
            sqlite: ['$.nested.attribute', 'value']
          }
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
          query: {
            postgres: 'CAST(("data"#>>$1) AS DOUBLE PRECISION) = $2;',
            mysql: 'CAST(json_unquote(json_extract(`data`,?)) AS DECIMAL) = ?;',
            mariadb: 'CAST(json_unquote(json_extract(`data`,?)) AS DECIMAL) = ?;',
            sqlite: 'CAST(json_extract(`data`, ?1) AS DOUBLE PRECISION) = ?2;'
          },
          bind: {
            postgres: ['{nested,attribute}', 4],
            mysql: ['$."nested"."attribute"', 4],
            mariadb: ['$.nested.attribute', 4],
            default: ['$.nested.attribute', 4]
          }
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
          query: {
            postgres: 'CAST(("data"#>>$1) AS DOUBLE PRECISION) IN ($2, $3);',
            mysql: 'CAST(json_unquote(json_extract(`data`,?)) AS DECIMAL) IN (?, ?);',
            mariadb: 'CAST(json_unquote(json_extract(`data`,?)) AS DECIMAL) IN (?, ?);',
            sqlite: 'CAST(json_extract(`data`, ?1) AS DOUBLE PRECISION) IN (?2, ?3);'
          },
          bind: {
            postgres: ['{nested,attribute}', 3, 7],
            mysql: ['$."nested"."attribute"', 3, 7],
            mariadb: ['$.nested.attribute', 3, 7],
            sqlite: ['$.nested.attribute', 3, 7]
          }
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
          query: {
            postgres: 'CAST(("data"#>>$1) AS DOUBLE PRECISION) > $2;',
            mysql: 'CAST(json_unquote(json_extract(`data`,?)) AS DECIMAL) > ?;',
            mariadb: 'CAST(json_unquote(json_extract(`data`,?)) AS DECIMAL) > ?;',
            sqlite: 'CAST(json_extract(`data`, ?1) AS DOUBLE PRECISION) > ?2;'
          },
          bind: {
            postgres: ['{nested,attribute}', 2],
            mysql: ['$."nested"."attribute"', 2],
            mariadb: ['$.nested.attribute', 2],
            sqlite: ['$.nested.attribute', 2]
          }
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
          query: {
            postgres: 'CAST(("data"#>>$1) AS INTEGER) > $2;',
            mysql: 'CAST(json_unquote(json_extract(`data`,?)) AS DECIMAL) > ?;',
            mariadb: 'CAST(json_unquote(json_extract(`data`,?)) AS DECIMAL) > ?;',
            sqlite: 'CAST(json_extract(`data`, ?1) AS INTEGER) > ?2;'
          },
          bind: {
            postgres: ['{nested,attribute}', 2],
            mysql: ['$."nested"."attribute"', 2],
            mariadb: ['$.nested.attribute', 2],
            sqlite: ['$.nested.attribute', 2]
          }
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
          query: {
            postgres: 'CAST(("data"#>>$1) AS TIMESTAMPTZ) > $2;',
            mysql: 'CAST(json_unquote(json_extract(`data`,?)) AS DATETIME) > ?;',
            mariadb: 'CAST(json_unquote(json_extract(`data`,?)) AS DATETIME) > ?;',
            sqlite: 'json_extract(`data`, ?1) > ?2;'
          },
          bind: {
            postgres: ['{nested,attribute}', moment(dt).utc().format('YYYY-MM-DD HH:mm:ss.SSS Z')],
            mysql: ['$."nested"."attribute"', moment(dt).utc().format('YYYY-MM-DD HH:mm:ss')],
            mariadb: ['$.nested.attribute', moment(dt).utc().format('YYYY-MM-DD HH:mm:ss.SSS')],
            // sqlite has a different QG._toJSONValue()
            sqlite: ['$.nested.attribute', dt.toJSON()]
          }
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
          query: {
            postgres: 'CAST(("data"#>>$1) AS BOOLEAN) = $2;',
            mysql: 'json_unquote(json_extract(`data`,?)) = ?;',
            mariadb: 'json_unquote(json_extract(`data`,?)) = ?;',
            sqlite: 'CAST(json_extract(`data`, ?1) AS BOOLEAN) = ?2;'
          },
          bind: {
            postgres: ['{nested,attribute}', true],
            mysql: ['$."nested"."attribute"', 'true'],
            mariadb: ['$.nested.attribute', 'true'],
            sqlite: ['$.nested.attribute', true]
          }
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
          query: {
            postgres: '("meta_data"#>>$1) = $2;',
            mysql: 'json_unquote(json_extract(`meta_data`,?)) = ?;',
            mariadb: 'json_unquote(json_extract(`meta_data`,?)) = ?;',
            sqlite: 'json_extract(`meta_data`, ?1) = ?2;'
          },
          bind: {
            postgres: ['{nested,attribute}', 'value'],
            mysql: ['$."nested"."attribute"', 'value'],
            mariadb: ['$.nested.attribute', 'value'],
            sqlite: ['$.nested.attribute', 'value']
          }
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
          query: {
            default: '[data] @> $1;'
          },
          bind: {
            default: ['{"company":"Magnafone"}']
          }
        });
      });
    }

    if (current.dialect.supports.REGEXP) {
      describe('Op.regexp', () => {
        testsql('username', {
          [Op.regexp]: '^sw.*r$'
        }, {
          query: {
            default: '`username` REGEXP $1;',
            postgres: '"username" ~ $1;'
          },
          bind: {
            default: ['^sw.*r$']
          }
        });
      });

      describe('Op.regexp', () => {
        testsql('newline', {
          [Op.regexp]: '^new\nline$'
        }, {
          query: {
            default: '`newline` REGEXP $1;',
            postgres: '"newline" ~ $1;'
          },
          bind: {
            default: ['^new\nline$']
          }
        });
      });

      describe('Op.notRegexp', () => {
        testsql('username', {
          [Op.notRegexp]: '^sw.*r$'
        }, {
          query: {
            default: '`username` NOT REGEXP $1;',
            postgres: '"username" !~ $1;'
          },
          bind: {
            default: ['^sw.*r$']
          }
        });
      });

      describe('Op.notRegexp', () => {
        testsql('newline', {
          [Op.notRegexp]: '^new\nline$'
        }, {
          query: {
            default: '`newline` NOT REGEXP $1;',
            postgres: '"newline" !~ $1;'
          },
          bind: {
            default: ['^new\nline$']
          }
        });
      });

      if (current.dialect.name === 'postgres') {
        describe('Op.iRegexp', () => {
          testsql('username', {
            [Op.iRegexp]: '^sw.*r$'
          }, {
            query: {
              postgres: '"username" ~* $1;'
            },
            bind: {
              postgres: ['^sw.*r$']
            }
          });
        });

        describe('Op.iRegexp', () => {
          testsql('newline', {
            [Op.iRegexp]: '^new\nline$'
          }, {
            query: {
              postgres: '"newline" ~* $1;'
            },
            bind: {
              postgres: ['^new\nline$']
            }
          });
        });

        describe('Op.notIRegexp', () => {
          testsql('username', {
            [Op.notIRegexp]: '^sw.*r$'
          }, {
            query: {
              postgres: '"username" !~* $1;'
            },
            bind: {
              postgres: ['^sw.*r$']
            }
          });
        });

        describe('Op.notIRegexp', () => {
          testsql('newline', {
            [Op.notIRegexp]: '^new\nline$'
          }, {
            query: {
              postgres: '"newline" !~* $1;'
            },
            bind: {
              postgres: ['^new\nline$']
            }
          });
        });
      }
    }

    describe('fn', () => {
      it('{name: this.sequelize.fn(\'LOWER\', \'DERP\')}', function() {
        testsql(sql.whereQuery({ name: this.sequelize.fn('LOWER', 'DERP') }), {
          query: {
            default: 'WHERE [name] = LOWER($1);'
          },
          bind: {
            default: ['DERP']
          }
        });
      });
    });
  });

  describe('getWhereConditions', () => {
    const testsql = function(value, expectation) {
      const User = current.define('user', {});

      it(util.inspect(value, { depth: 10 }), () => {
        return expectsql(sql.composeQuery(sql.getWhereConditions(value, User.tableName, User)), expectation);
      });
    };

    testsql(current.where(current.fn('lower', current.col('name')), null), {
      query: {
        default: 'lower([name]) IS NULL;'
      },
      bind: {
        default: []
      }
    });

    testsql(current.where(current.fn('SUM', current.col('hours')), '>', 0), {
      query: {
        default: 'SUM([hours]) > $1;'
      },
      bind: {
        default: [0]
      }
    });

    testsql(current.where(current.fn('SUM', current.col('hours')), Op.gt, 0), {
      query: {
        default: 'SUM([hours]) > $1;'
      },
      bind: {
        default: [0]
      }
    });
  });
});
