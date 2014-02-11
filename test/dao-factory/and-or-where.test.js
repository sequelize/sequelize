/* jshint camelcase: false */
/* jshint expr: true */
var chai      = require('chai')
  , Sequelize = require('../../index')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + "/../../lib/data-types")
  , dialect   = Support.getTestDialect()
  , config    = require(__dirname + "/../config/config")
  , sinon     = require('sinon')
  , datetime  = require('chai-datetime')
  , _         = require('lodash')
  , moment    = require('moment')
  , async     = require('async')

chai.use(datetime)
chai.Assertion.includeStack = true

describe(Support.getTestDialectTeaser("DAOFactory"), function () {
  beforeEach(function(done) {
    this.User = this.sequelize.define('User', {
      username:     DataTypes.STRING,
      secretValue:  DataTypes.STRING,
      data:         DataTypes.STRING,
      intVal:       DataTypes.INTEGER,
      theDate:      DataTypes.DATE,
      aBool:        DataTypes.BOOLEAN
    })

    this.User.sync({ force: true }).success(function() {
      done()
    })
  })

  ;(['or', 'and']).forEach(function(method) {
    var word = method.toUpperCase()

    describe('Sequelize.' + method, function() {
      it('can handle plain strings', function(done) {
        this.User.find({
          where: Sequelize[method]( "1=1", "2=2" )
        }).on('sql', function(sql) {
          expect(sql).to.contain("WHERE (1=1 " + word + " 2=2) LIMIT 1")
          done()
        })
      })

      it('can handle arrays', function(done) {
        this.User.find({
          where: Sequelize[method]( ["1=?", 1], ["2=?", 2] )
        }).on('sql', function(sql) {
          expect(sql).to.contain("WHERE (1=1 " + word + " 2=2) LIMIT 1")
          done()
        })
      })

      it('can handle objects', function(done) {
        this.User.find({
          where: Sequelize[method]( { username: "foo", intVal: 2 }, { secretValue: 'bar' } )
        }).on('sql', function(sql) {
          var expectation = ({
            mysql: "WHERE (`Users`.`username`='foo' AND `Users`.`intVal`=2 " + word + " `Users`.`secretValue`='bar')",
            sqlite: "WHERE (`Users`.`username`='foo' AND `Users`.`intVal`=2 " + word + " `Users`.`secretValue`='bar')",
            postgres: 'WHERE ("Users"."username"=\'foo\' AND "Users"."intVal"=2 ' + word + ' "Users"."secretValue"=\'bar\')',
            mariadb: "WHERE (`Users`.`username`='foo' AND `Users`.`intVal`=2 " + word + " `Users`.`secretValue`='bar')"
          })[Support.getTestDialect()]

          if (!expectation) {
            console.log(sql)
            throw new Error('Undefined expectation for ' + Support.getTestDialect())
          }

          expect(sql).to.contain(expectation)

          done()
        })
      })

      it('can handle numbers', function(done) {
        this.User.find({
          where: Sequelize[method]( 1, 2 )
        }).on('sql', function(sql) {
          var expectation = ({
            mysql: "WHERE (`Users`.`id`=1 " + word + " `Users`.`id`=2)",
            sqlite: "WHERE (`Users`.`id`=1 " + word + " `Users`.`id`=2)",
            postgres: 'WHERE ("Users"."id"=1 ' + word + ' "Users"."id"=2)',
            mariadb: "WHERE (`Users`.`id`=1 " + word + " `Users`.`id`=2)"
          })[Support.getTestDialect()]

          if (!expectation) {
            console.log(sql)
            throw new Error('Undefined expectation for ' + Support.getTestDialect())
          }

          expect(sql).to.contain(expectation)

          done()
        })
      })
    })
  })

  describe('Combinations of Sequelize.and and Sequelize.or', function() {
    it('allows nesting of Sequelize.or', function(done) {
      this.User.find({
        where: Sequelize.and( Sequelize.or("1=1", "2=2"), Sequelize.or("3=3", "4=4") )
      }).on('sql', function(sql) {
        expect(sql).to.contain("WHERE ((1=1 OR 2=2) AND (3=3 OR 4=4)) LIMIT 1")
        done()
      })
    })

    it('allows nesting of Sequelize.and', function(done) {
      this.User.find({
        where: Sequelize.or( Sequelize.and("1=1", "2=2"), Sequelize.and("3=3", "4=4") )
      }).on('sql', function(sql) {
        expect(sql).to.contain("WHERE ((1=1 AND 2=2) OR (3=3 AND 4=4)) LIMIT 1")
        done()
      })
    })

    ;(['find', 'findAll']).forEach(function(finderMethod) {
      it('correctly handles complex combinations', function(done) {
        this.User[finderMethod]({
          where: [
            42, "2=2", ["1=?", 1], { username: "foo" },
            Sequelize.or(
              42, "2=2", ["1=?", 1], { username: "foo" },
              Sequelize.and( 42, "2=2", ["1=?", 1], { username: "foo" } ),
              Sequelize.or( 42, "2=2", ["1=?", 1], { username: "foo" } )
            ),
            Sequelize.and(
              42, "2=2", ["1=?", 1], { username: "foo" },
              Sequelize.or( 42, "2=2", ["1=?", 1], { username: "foo" } ),
              Sequelize.and( 42, "2=2", ["1=?", 1], { username: "foo" } )
            )
          ]
        }).on('sql', function(sql) {
          if (Support.getTestDialect() === 'postgres') {
            expect(sql).to.contain(
              'WHERE (' + [
                '"Users"."id"=42 AND 2=2 AND 1=1 AND "Users"."username"=\'foo\' AND ',
                  '(',
                    '"Users"."id"=42 OR 2=2 OR 1=1 OR "Users"."username"=\'foo\' OR ',
                    '("Users"."id"=42 AND 2=2 AND 1=1 AND "Users"."username"=\'foo\') OR ',
                    '("Users"."id"=42 OR 2=2 OR 1=1 OR "Users"."username"=\'foo\')',
                  ') AND ',
                  '(',
                    '"Users"."id"=42 AND 2=2 AND 1=1 AND "Users"."username"=\'foo\' AND ',
                    '("Users"."id"=42 OR 2=2 OR 1=1 OR "Users"."username"=\'foo\') AND ',
                    '("Users"."id"=42 AND 2=2 AND 1=1 AND "Users"."username"=\'foo\')',
                  ')'
                ].join("") +
              ')'
            )
          } else {
            expect(sql).to.contain(
              "WHERE (" + [
                "`Users`.`id`=42 AND 2=2 AND 1=1 AND `Users`.`username`='foo' AND ",
                  "(",
                    "`Users`.`id`=42 OR 2=2 OR 1=1 OR `Users`.`username`='foo' OR ",
                    "(`Users`.`id`=42 AND 2=2 AND 1=1 AND `Users`.`username`='foo') OR ",
                    "(`Users`.`id`=42 OR 2=2 OR 1=1 OR `Users`.`username`='foo')",
                  ") AND ",
                  "(",
                    "`Users`.`id`=42 AND 2=2 AND 1=1 AND `Users`.`username`='foo' AND ",
                    "(`Users`.`id`=42 OR 2=2 OR 1=1 OR `Users`.`username`='foo') AND ",
                    "(`Users`.`id`=42 AND 2=2 AND 1=1 AND `Users`.`username`='foo')",
                  ")"
                ].join("") +
              ")"
            )
          }

          done()
        })
      })
    })
  })
})
