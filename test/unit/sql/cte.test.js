'use strict';


/* jshint -W110 */
var Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , expectsql = Support.expectsql
  , current   = Support.sequelize
  , sql       = current.dialect.QueryGenerator;
  
describe(Support.getTestDialectTeaser('SQL'), function () {
  if (current.dialect.supports.cteQueries) {
    describe('CTE', function () {
      var User = current.define('user', { amount: DataTypes.INTEGER});
      var Project = current.define('project', { name: DataTypes.STRING, budget: DataTypes.INTEGER});
      
      User.hasOne(User, { as: 'report' });
      User.hasMany(Project, { as: 'assigned'});

      var selectTest = function(options, expected) {
        
        // just for testing
        options.model = User;

        current.Model._conformOptions.call(User, options, User);
        if (options.cte) {
          current.Model._validateCTEElements.call(User, options);
        }
        expectsql(sql.selectQuery(User.getTableName(), options, User), expected);
      };

      it('automatically connects to single CTE', function () {
        selectTest(
          {
            cte: [{
              name: 'a',
              initial: { where: { username: 'user3' } },
              recursive: { next: 'report' }
            }]
          },
          {
            default: 'WITH RECURSIVE a([id],[amount],[createdAt],[updatedAt],[reportId]) AS (SELECT [id], [amount], [createdAt], [updatedAt], [reportId] FROM [users] AS [user] WHERE [user].[username] = \'user3\' UNION SELECT [report].[id], [report].[amount], [report].[createdAt], [report].[updatedAt], [report].[reportId] FROM [a] INNER JOIN [users] AS [report] ON [a].[id] = [report].[reportId]) SELECT [user].* FROM [users] AS [user] INNER JOIN [a] ON [user].[id] = [a].[id];'
          });
      });

      it('removes empty CTE', function () {
        selectTest(
          {
            cte: []
          },
          {
            default: 'SELECT * FROM [users] AS [user];'
          });
      });

      it('handles single, non-array cte', function () {
        selectTest(
          {
            cte: {
              name: 'a',
              initial: { where: { username: 'user3' } },
              recursive: { next: 'report' }
            }
          },
          {
            default: 'WITH RECURSIVE a([id],[amount],[createdAt],[updatedAt],[reportId]) AS (SELECT [id], [amount], [createdAt], [updatedAt], [reportId] FROM [users] AS [user] WHERE [user].[username] = \'user3\' UNION SELECT [report].[id], [report].[amount], [report].[createdAt], [report].[updatedAt], [report].[reportId] FROM [a] INNER JOIN [users] AS [report] ON [a].[id] = [report].[reportId]) SELECT [user].* FROM [users] AS [user] INNER JOIN [a] ON [user].[id] = [a].[id];'
          });
      });
      
      it('correctly adds additional attributes to CTE', function () {
        selectTest(
          {
          cte: [{
            name: 'a',
            cteAttributes: ['total'],
            initial: {
              total: { $model: 'amount' },
              where: { username: 'user3' }
            },
            recursive: { 
              next: 'report',
              total: { $add: [{ $cte: 'total'}, {$model: 'amount'}]} 
            }
          }]
        },
        {
          default: 'WITH RECURSIVE a([id],[amount],[createdAt],[updatedAt],[reportId],[total]) AS (SELECT [id], [amount], [createdAt], [updatedAt], [reportId], [user].[amount] FROM [users] AS [user] WHERE [user].[username] = \'user3\' UNION SELECT [report].[id], [report].[amount], [report].[createdAt], [report].[updatedAt], [report].[reportId], ([a].[total] + [report].[amount]) FROM [a] INNER JOIN [users] AS [report] ON [a].[id] = [report].[reportId]) SELECT [user].* FROM [users] AS [user] INNER JOIN [a] ON [user].[id] = [a].[id];'
        });
      });
      
      it('correctly includes associated models in intial statement and uses it to select', function () {
        selectTest(
          {
            cte: [{
              name: 'a',
              initial: {
                include: {
                  model: Project,
                  as: 'assigned',
                  where: { name: 'Rebuilding' }
                }
              },
              recursive: {
                next: 'report'
              }
            }]
          },
          {
            default: 'WITH RECURSIVE a([id],[amount],[createdAt],[updatedAt],[reportId]) AS (SELECT [user].[id], [user].[amount], [user].[createdAt], [user].[updatedAt], [user].[reportId] FROM [users] AS [user] INNER JOIN [projects] AS [assigned] ON [user].[id] = [assigned].[userId] AND [assigned].[name] = \'Rebuilding\' UNION SELECT [report].[id], [report].[amount], [report].[createdAt], [report].[updatedAt], [report].[reportId] FROM [a] INNER JOIN [users] AS [report] ON [a].[id] = [report].[reportId]) SELECT [user].* FROM [users] AS [user] INNER JOIN [a] ON [user].[id] = [a].[id];'
          });
      });
      
      it('correctly handles a non-unique result', function () {
        selectTest(
          {
            cte: [{
              name: 'a',
              initial: {
                where: { username: 'user3' }
              },
              recursive: {
                next: 'report'
              },
              unique: false
            }]
          },
          {
            default: 'WITH RECURSIVE a([id],[amount],[createdAt],[updatedAt],[reportId]) AS (SELECT [id], [amount], [createdAt], [updatedAt], [reportId] FROM [users] AS [user] WHERE [user].[username] = \'user3\' UNION ALL SELECT [report].[id], [report].[amount], [report].[createdAt], [report].[updatedAt], [report].[reportId] FROM [a] INNER JOIN [users] AS [report] ON [a].[id] = [report].[reportId]) SELECT [user].* FROM [users] AS [user] INNER JOIN [a] ON [user].[id] = [a].[id];'
          });
      });     
      
      it('correctly handles a recursive include', function () {
        selectTest(
          {
            cte: [{
              name: 'a',
              initial: {
                where: { username: 'user3' }
              },
              recursive: {
                next: 'report',
                include: { 
                  model: Project,
                  as: 'assigned'
                }
              },
            }]
          },
          {
            default: 'WITH RECURSIVE a([id],[amount],[createdAt],[updatedAt],[reportId]) AS (SELECT [id], [amount], [createdAt], [updatedAt], [reportId] FROM [users] AS [user] WHERE [user].[username] = \'user3\' UNION SELECT [report].[id], [report].[amount], [report].[createdAt], [report].[updatedAt], [report].[reportId] FROM [a] INNER JOIN [users] AS [report] ON [a].[id] = [report].[reportId] INNER JOIN [projects] AS [assigned] ON [report].[id] = [assigned].[userId]) SELECT [user].* FROM [users] AS [user] INNER JOIN [a] ON [user].[id] = [a].[id];'
          });
      });
      
      it('correctly handles a recursive where with model attributes', function () {
        selectTest(
          {
            cte: [{
              name: 'a',
              initial: {
                where: { username: 'user3' }
              },
              recursive: {
                next: 'report',
                where: {
                  model: { amount: { $gt: 30 } }
                }
              },
            }]
          },
          {
            default: 'WITH RECURSIVE a([id],[amount],[createdAt],[updatedAt],[reportId]) AS (SELECT [id], [amount], [createdAt], [updatedAt], [reportId] FROM [users] AS [user] WHERE [user].[username] = \'user3\' UNION SELECT [report].[id], [report].[amount], [report].[createdAt], [report].[updatedAt], [report].[reportId] FROM [a] INNER JOIN [users] AS [report] ON [a].[id] = [report].[reportId] WHERE [user].[amount] > 30) SELECT [user].* FROM [users] AS [user] INNER JOIN [a] ON [user].[id] = [a].[id];'
          });
      });
      
      it('correctly handles a recursive where with cte attributes', function () {
        selectTest(
          {
            cte: [{
              name: 'a',
              cteAttributes: ['total'],
              initial: {
                total: { $model: 'amount' },
                where: { username: 'user3' }
              },
              recursive: {
                next: 'report',
                total: { $add: [{ $cte: 'total'}, {$model: 'amount'}]},
                where : {
                  cte: { total: { $lt: 500 } }
                } 
              },
            }]
          },
          {
            default: 'WITH RECURSIVE a([id],[amount],[createdAt],[updatedAt],[reportId],[total]) AS (SELECT [id], [amount], [createdAt], [updatedAt], [reportId], [user].[amount] FROM [users] AS [user] WHERE [user].[username] = \'user3\' UNION SELECT [report].[id], [report].[amount], [report].[createdAt], [report].[updatedAt], [report].[reportId], ([a].[total] + [report].[amount]) FROM [a] INNER JOIN [users] AS [report] ON [a].[id] = [report].[reportId] WHERE [a].[total] < 500) SELECT [user].* FROM [users] AS [user] INNER JOIN [a] ON [user].[id] = [a].[id];'
          });
      });
      
      it('correctly handles a recursive where with model & cte attributes', function () {
        selectTest(
          {
            cte: [{
              name: 'a',
              cteAttributes: ['total'],
              initial: {
                total: { $model: 'amount' },
                where: { username: 'user3' }
              },
              recursive: {
                next: 'report',
                total: { $add: [{ $cte: 'total' }, { $model: 'amount' }] },
                where: {
                  model: { amount: { $gt: 30 } },
                  cte: { total: { $lt: 500 } }
                }
              },
            }]
          },
          {
            default: 'WITH RECURSIVE a([id],[amount],[createdAt],[updatedAt],[reportId],[total]) AS (SELECT [id], [amount], [createdAt], [updatedAt], [reportId], [user].[amount] FROM [users] AS [user] WHERE [user].[username] = \'user3\' UNION SELECT [report].[id], [report].[amount], [report].[createdAt], [report].[updatedAt], [report].[reportId], ([a].[total] + [report].[amount]) FROM [a] INNER JOIN [users] AS [report] ON [a].[id] = [report].[reportId] WHERE [user].[amount] > 30 AND [a].[total] < 500) SELECT [user].* FROM [users] AS [user] INNER JOIN [a] ON [user].[id] = [a].[id];'
          });
      });
      
      it('correctly selects attributes from the CTE in the final result', function () {
        selectTest(
          {
            cte: [{
              name: 'a',
              cteAttributes: ['total'],
              initial: {
                total: { $model: 'amount' },
                where: { username: 'user3' }
              },
              recursive: {
                next: 'report',
                total: { $add: [{ $cte: 'total'}, {$model: 'amount'}]},
                where : {
                  cte: { total: { $lt: 500 } }
                } 
              }
            }],
            includeCTEAttributes: ['total']
          },
          {
            default: 'WITH RECURSIVE a([id],[amount],[createdAt],[updatedAt],[reportId],[total]) AS (SELECT [id], [amount], [createdAt], [updatedAt], [reportId], [user].[amount] FROM [users] AS [user] WHERE [user].[username] = \'user3\' UNION SELECT [report].[id], [report].[amount], [report].[createdAt], [report].[updatedAt], [report].[reportId], ([a].[total] + [report].[amount]) FROM [a] INNER JOIN [users] AS [report] ON [a].[id] = [report].[reportId] WHERE [a].[total] < 500) SELECT [user].*, [a].[total] FROM [users] AS [user] INNER JOIN [a] ON [user].[id] = [a].[id];'
          });
      });
      
      if (current.dialect.supports.cteLimitOffsetOrder) {

        it('correctly adds order to recursion', function () {
          selectTest(
            {
              cte: [{
                name: 'a',
                initial: {
                  where: { username: 'user3' }
                },
                recursive: {
                  next: 'report',
                },
                order: [['amount', 'ASC']]
              }]
            },
            {
              default: 'WITH RECURSIVE a([id],[amount],[createdAt],[updatedAt],[reportId]) AS (SELECT [id], [amount], [createdAt], [updatedAt], [reportId] FROM [users] AS [user] WHERE [user].[username] = \'user3\' UNION SELECT [report].[id], [report].[amount], [report].[createdAt], [report].[updatedAt], [report].[reportId] FROM [a] INNER JOIN [users] AS [report] ON [a].[id] = [report].[reportId] ORDER BY 2 ASC) SELECT [user].* FROM [users] AS [user] INNER JOIN [a] ON [user].[id] = [a].[id];'
            });
        });

        it('correctly adds limit & offset to recursion', function () {
          selectTest(
            {
              cte: [{
                name: 'a',
                initial: {
                  where: { username: 'user3' }
                },
                recursive: {
                  next: 'report',
                },
                limit: 2,
                offset: 2
              }]
            },
            {
              default: 'WITH RECURSIVE a([id],[amount],[createdAt],[updatedAt],[reportId]) AS (SELECT [id], [amount], [createdAt], [updatedAt], [reportId] FROM [users] AS [user] WHERE [user].[username] = \'user3\' UNION SELECT [report].[id], [report].[amount], [report].[createdAt], [report].[updatedAt], [report].[reportId] FROM [a] INNER JOIN [users] AS [report] ON [a].[id] = [report].[reportId] LIMIT 2, 2) SELECT [user].* FROM [users] AS [user] INNER JOIN [a] ON [user].[id] = [a].[id];'
            });
        });
      
        it('correctly adds order to CTE with no recursion', function () {
          selectTest(
            {
              cte: [{
                name: 'a',
                initial: {
                  where: { username: 'user3' }
                },
                order: [['amount', 'ASC']],
              }]
            },
            {
              default: 'WITH a([id],[amount],[createdAt],[updatedAt],[reportId]) AS (SELECT [id], [amount], [createdAt], [updatedAt], [reportId] FROM [users] AS [user] WHERE [user].[username] = \'user3\' ORDER BY 2 ASC) SELECT [user].* FROM [users] AS [user] INNER JOIN [a] ON [user].[id] = [a].[id];'
            });
        });

      }
      
    });

  }
});