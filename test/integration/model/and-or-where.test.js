'use strict';

/* jshint -W110 */
var chai = require('chai')
  , Sequelize = require('../../../index')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('Model'), function() {
  beforeEach(function() {
    this.User = this.sequelize.define('User', {
      username: DataTypes.STRING,
      secretValue: DataTypes.STRING,
      data: DataTypes.STRING,
      intVal: DataTypes.INTEGER,
      theDate: DataTypes.DATE,
      aBool: DataTypes.BOOLEAN
    });

    return this.User.sync({ force: true });
  });

(['or', 'and']).forEach(function(method) {
    var word = method.toUpperCase();

    describe('Sequelize.' + method, function() {
      it('can handle plain strings', function() {
        return this.User.find({
          where: Sequelize[method]('1=1', '2=2')
        }, {
          logging: function(sql) {
            if (dialect === 'mssql') {
              expect(sql).to.contain('WHERE (1=1 ' + word + ' 2=2)');
            } else {
              expect(sql).to.contain('WHERE (1=1 ' + word + ' 2=2) LIMIT 1');
            }
          }
        });
      });

      it.skip('can handle arrays', function() {
        return this.User.find({
          where: Sequelize[method](['1=?', 1], ['2=?', 2])
        }, {
          logging: function(sql) {
            if (dialect === 'mssql') {
              expect(sql).to.contain('WHERE (1=1 ' + word + ' 2=2)');
            } else {
              expect(sql).to.contain('WHERE (1=1 ' + word + ' 2=2) LIMIT 1');
            }
          }
        });
      });

      it.skip('can handle objects', function() {
        return this.User.find({
          where: Sequelize[method]({ username: 'foo', intVal: 2 }, { secretValue: 'bar' })
        }, {
          logging: function(sql) {
            var expectation = ({
              mysql: "WHERE (`User`.`username` = 'foo' AND `User`.`intVal` = 2 " + word + " `User`.`secretValue` = 'bar')",
              mssql: 'WHERE ([User].[username] = \'foo\' AND [User].[intVal] = 2 ' + word + ' [User].[secretValue] = \'bar\')',
              sqlite: "WHERE (`User`.`username` = 'foo' AND `User`.`intVal` = 2 " + word + " `User`.`secretValue` = 'bar')",
              postgres: 'WHERE ("User"."username" = \'foo\' AND "User"."intVal" = 2 ' + word + ' "User"."secretValue" = \'bar\')',
              mariadb: "WHERE (`User`.`username` = 'foo' AND `User`.`intVal` = 2 " + word + " `User`.`secretValue` = 'bar')"
            })[Support.getTestDialect()];

            if (!expectation) {
              throw new Error('Undefined expectation for ' + Support.getTestDialect());
            }
            expect(sql).to.contain(expectation);
          }
        });
      });

      it('can handle numbers', function() {
        return this.User.find({
          where: Sequelize[method](1, 2)
        }, {
          logging: function(sql) {
            var expectation = ({
              mysql: 'WHERE (`User`.`id` = 1 ' + word + ' `User`.`id` = 2)',
              sqlite: 'WHERE (`User`.`id` = 1 ' + word + ' `User`.`id` = 2)',
              postgres: 'WHERE ("User"."id" = 1 ' + word + ' "User"."id" = 2)',
              mssql: 'WHERE ([User].[id] = 1 ' + word + ' [User].[id] = 2)',
              mariadb: 'WHERE (`User`.`id` = 1 ' + word + ' `User`.`id` = 2)'
            })[Support.getTestDialect()];

            if (!expectation) {
              throw new Error('Undefined expectation for ' + Support.getTestDialect());
            }
            expect(sql).to.contain(expectation);
          }
        });
      });
    });
  });

  describe('Combinations of Sequelize.and and Sequelize.or', function() {
    it('allows nesting of Sequelize.or', function() {
      return this.User.find({
        where: Sequelize.and(Sequelize.or('1=1', '2=2'), Sequelize.or('3=3', '4=4'))
      }, {
        logging: function(sql) {
          if (dialect === 'mssql') {
            expect(sql).to.contain('WHERE ((1=1 OR 2=2) AND (3=3 OR 4=4))');
          }else {
            expect(sql).to.contain('WHERE ((1=1 OR 2=2) AND (3=3 OR 4=4)) LIMIT 1');
          }
        }
      });
    });

    it('allows nesting of Sequelize.or using object notation', function() {
      return this.User.find({
        where: Sequelize.and(Sequelize.or({username: {$eq: 'foo'}}, {username: {$eq: 'bar'}}),
                              Sequelize.or({id: {$eq: 1}}, {id: {$eq: 4}}))
      }, {
        logging: function(sql) {
          var expectation = ({
            mysql: "WHERE ((`User`.`username` = 'foo' OR `User`.`username` = 'bar') AND (`User`.`id` = 1 OR `User`.`id` = 4)) LIMIT 1",
            sqlite: "WHERE ((`User`.`username` = 'foo' OR `User`.`username` = 'bar') AND (`User`.`id` = 1 OR `User`.`id` = 4)) LIMIT 1",
            postgres: 'WHERE (("User"."username" = \'foo\' OR "User"."username" = \'bar\') AND ("User"."id" = 1 OR "User"."id" = 4)) LIMIT 1',
            mssql: 'WHERE (([User].[username] = \'foo\' OR [User].[username] = \'bar\') AND ([User].[id] = 1 OR [User].[id] = 4))',
            mariadb: "WHERE ((`User`.`username` = 'foo' OR `User`.`username` = 'bar') AND (`User`.`id` = 1 OR `User`.`id` = 4)) LIMIT 1"
          })[Support.getTestDialect()];

          if (!expectation) {
            throw new Error('Undefined expectation for ' + Support.getTestDialect());
          }

          expect(sql).to.contain(expectation);
        }
      });
    });

    it('allows nesting of Sequelize.and', function() {
      return this.User.find({
        where: Sequelize.or(Sequelize.and('1=1', '2=2'), Sequelize.and('3=3', '4=4'))
      }, {
        logging: function(sql) {
          if (dialect === 'mssql') {
            expect(sql).to.contain('WHERE ((1=1 AND 2=2) OR (3=3 AND 4=4))');
          }else {
            expect(sql).to.contain('WHERE ((1=1 AND 2=2) OR (3=3 AND 4=4)) LIMIT 1');
          }
        }
      });
    });

    it('allows nesting of Sequelize.and using object notation', function() {
      return this.User.find({
        where: Sequelize.or(Sequelize.and({username: {$eq: 'foo'}}, {username: {$eq: 'bar'}}),
                              Sequelize.and({id: {$eq: 1}}, {id: {$eq: 4}}))
      }, {
        logging: function(sql) {
          var expectation = ({
            mysql: "WHERE ((`User`.`username` = 'foo' AND `User`.`username` = 'bar') OR (`User`.`id` = 1 AND `User`.`id` = 4)) LIMIT 1",
            sqlite: "WHERE ((`User`.`username` = 'foo' AND `User`.`username` = 'bar') OR (`User`.`id` = 1 AND `User`.`id` = 4)) LIMIT 1",
            postgres: 'WHERE (("User"."username" = \'foo\' AND "User"."username" = \'bar\') OR ("User"."id" = 1 AND "User"."id" = 4)) LIMIT 1',
            mssql: 'WHERE (([User].[username] = \'foo\' AND [User].[username] = \'bar\') OR ([User].[id] = 1 AND [User].[id] = 4))',
            mariadb: "WHERE ((`User`.`username` = 'foo' AND `User`.`username` = 'bar') OR (`User`.`id` = 1 AND `User`.`id` = 4)) LIMIT 1"
          })[Support.getTestDialect()];

          if (!expectation) {
            throw new Error('Undefined expectation for ' + Support.getTestDialect());
          }

          expect(sql).to.contain(expectation);
        }
      });
    });

    if (dialect !== 'postgres') {
      // TODO: Fix this. There's a weird output produced by SqlString.arrayToList
      it('still allows simple arrays lookups', function() {
        return this.User.find({
          where: ['id IN (?) OR id IN (?)', [1, 2], [3, 4]]
        }, {
          logging: function(sql) {
            expect(sql).to.contain('id IN (1, 2) OR id IN (3, 4)');
          }
        });
      });
    }

    (['find', 'findAll']).forEach(function(finderMethod) {
      it('correctly handles complex combinations', function() {
        return this.User[finderMethod]({
          where: [
            42, '2=2', ['1=?', 1], { username: 'foo' },
            Sequelize.or(
              42, '2=2', ['1=?', 1], { username: 'foo' },
              Sequelize.and(42, '2=2', ['1=?', 1], { username: 'foo' }),
              Sequelize.or(42, '2=2', ['1=?', 1], { username: 'foo' })
            ),
            Sequelize.and(
              42, '2=2', ['1=?', 1], { username: 'foo' },
              Sequelize.or(42, '2=2', ['1=?', 1], { username: 'foo' }),
              Sequelize.and(42, '2=2', ['1=?', 1], { username: 'foo' })
            )
          ]
        }, {
          logging: function(sql) {
            if (dialect === 'postgres') {
              expect(sql).to.contain(
                'WHERE (' + [
                  '"User"."id" = 42 AND 2=2 AND (1=1) AND "User"."username" = \'foo\' AND ',
                    '(',
                      '"User"."id" = 42 OR 2=2 OR (1=1) OR "User"."username" = \'foo\' OR ',
                      '("User"."id" = 42 AND 2=2 AND (1=1) AND "User"."username" = \'foo\') OR ',
                      '("User"."id" = 42 OR 2=2 OR (1=1) OR "User"."username" = \'foo\')',
                    ') AND ',
                    '(',
                      '"User"."id" = 42 AND 2=2 AND (1=1) AND "User"."username" = \'foo\' AND ',
                      '("User"."id" = 42 OR 2=2 OR (1=1) OR "User"."username" = \'foo\') AND ',
                      '("User"."id" = 42 AND 2=2 AND (1=1) AND "User"."username" = \'foo\')',
                    ')'
                  ].join('') +
                ')'
              );
            } else if (dialect === 'mssql') {
              expect(sql).to.contain(
                'WHERE (' + [
                  '[User].[id] = 42 AND 2=2 AND (1=1) AND [User].[username] = \'foo\' AND ',
                    '(',
                      '[User].[id] = 42 OR 2=2 OR (1=1) OR [User].[username] = \'foo\' OR ',
                      '([User].[id] = 42 AND 2=2 AND (1=1) AND [User].[username] = \'foo\') OR ',
                      '([User].[id] = 42 OR 2=2 OR (1=1) OR [User].[username] = \'foo\')',
                    ') AND ',
                    '(',
                      '[User].[id] = 42 AND 2=2 AND (1=1) AND [User].[username] = \'foo\' AND ',
                      '([User].[id] = 42 OR 2=2 OR (1=1) OR [User].[username] = \'foo\') AND ',
                      '([User].[id] = 42 AND 2=2 AND (1=1) AND [User].[username] = \'foo\')',
                    ')'
                  ].join('') +
                ')'
              );
            } else {
              expect(sql).to.contain(
                'WHERE (' + [
                  "`User`.`id` = 42 AND 2=2 AND (1=1) AND `User`.`username` = 'foo' AND ",
                    '(',
                      "`User`.`id` = 42 OR 2=2 OR (1=1) OR `User`.`username` = 'foo' OR ",
                      "(`User`.`id` = 42 AND 2=2 AND (1=1) AND `User`.`username` = 'foo') OR ",
                      "(`User`.`id` = 42 OR 2=2 OR (1=1) OR `User`.`username` = 'foo')",
                    ') AND ',
                    '(',
                      "`User`.`id` = 42 AND 2=2 AND (1=1) AND `User`.`username` = 'foo' AND ",
                      "(`User`.`id` = 42 OR 2=2 OR (1=1) OR `User`.`username` = 'foo') AND ",
                      "(`User`.`id` = 42 AND 2=2 AND (1=1) AND `User`.`username` = 'foo')",
                    ')'
                  ].join('') +
                ')'
              );
            }
          }
        });
      });
    });
  });
});
