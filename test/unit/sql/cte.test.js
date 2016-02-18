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
      var Project = current.define('project', { name: DataTypes.STRING});
      
      User.hasOne(User, { as: 'report' });
      User.hasMany(Project, { as: 'assigned'});

      it('automatically connects to single CTE', function () {

        var options = {
          cte: [{
            name: 'a',
            initial: { where: { username: 'user3' } },
            recursive: { next: 'report' }
          }]
        };

        current.Model.$conformOptions.call(User, options, User);

        current.Model.$validateCTEElements.call(User, options);

        //console.log(sql.selectQuery(User.getTableName, options, User));

        expectsql(sql.selectQuery(User.getTableName(), options, User),
        {
          sqlite: 'WITH RECURSIVE a( `id`,`amount`,`createdAt`,`updatedAt`,`userId` ) AS ( SELECT `id`, `amount`, `createdAt`, `updatedAt`, `userId` FROM `users` AS `user` WHERE `user`.`username` = \'user3\' UNION SELECT `report`.`id`, `report`.`amount`, `report`.`createdAt`, `report`.`updatedAt`, `report`.`userId` FROM `a` INNER JOIN `users` AS `report` ON `a`.`id` = `report`.`userId`  ) SELECT * FROM `users` AS `user` INNER JOIN `a` ON `user`.`id` = `a`.`id`;'
        });
      
      });
      
      it('correctly adds additional attributes to CTE', function () {

        var options = {
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
        };

        current.Model.$conformOptions.call(User, options, User);

        current.Model.$validateCTEElements.call(User, options);

        //console.log(sql.selectQuery(User.getTableName, options, User));

        expectsql(sql.selectQuery(User.getTableName(), options, User),
        {
          sqlite: 'WITH RECURSIVE a( `id`,`amount`,`createdAt`,`updatedAt`,`userId`,`total` ) AS ( SELECT `id`, `amount`, `createdAt`, `updatedAt`, `userId`, `user`.`amount` FROM `users` AS `user` WHERE `user`.`username` = \'user3\' UNION SELECT `report`.`id`, `report`.`amount`, `report`.`createdAt`, `report`.`updatedAt`, `report`.`userId`, (`a`.`total` + `report`.`amount`) FROM `a` INNER JOIN `users` AS `report` ON `a`.`id` = `report`.`userId`  ) SELECT * FROM `users` AS `user` INNER JOIN `a` ON `user`.`id` = `a`.`id`;'
        });
      
      });
      
      it('correctly includes associated models in intial statement and uses it to select', function () {

        var options = {
          cte: [{
            name: 'a',
            initial: {
              total: { $model: 'amount' },
              include: { 
                model: Project, 
                as: 'assigned',
                where : { name: 'Rebuilding'}
              }
            },
            recursive: { 
              next: 'report',
              total: { $add: [{ $cte: 'total'}, {$model: 'amount'}]} 
            }
          }]
        };

        current.Model.$conformOptions.call(User, options, User);

        current.Model.$validateCTEElements.call(User, options);

        //console.log(sql.selectQuery(User.getTableName, options, User));

        expectsql(sql.selectQuery(User.getTableName(), options, User),
        {
          sqlite: 'WITH RECURSIVE a( `id`,`amount`,`createdAt`,`updatedAt`,`userId` ) AS ( SELECT `id`, `amount`, `createdAt`, `updatedAt`, `userId` FROM `users` AS `user` INNER JOIN `projects` AS `assigned` ON `user`.`id` = `assigned`.`userId` AND `assigned`.`name` = \'Rebuilding\' UNION SELECT `report`.`id`, `report`.`amount`, `report`.`createdAt`, `report`.`updatedAt`, `report`.`userId` FROM `a` INNER JOIN `users` AS `report` ON `a`.`id` = `report`.`userId`  ) SELECT * FROM `users` AS `user` INNER JOIN `a` ON `user`.`id` = `a`.`id`;'
        });
      
      });
      
    });

  }
});