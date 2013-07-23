var buster  = require("buster")
    , Helpers = require('./buster-helpers')
    , config    = require(__dirname + "/config/config")
    , dialect = Helpers.getTestDialect()
    , moment  = require('moment')

var qq = function(str) {
  if (dialect == 'postgres' || dialect == 'sqlite') {
    return '"' + str + '"'
  } else if (dialect == 'mysql') {
    return '`' + str + '`'
  } else {
    return str
  }
}

buster.spec.expose()
buster.testRunner.timeout = 1000

describe(Helpers.getTestDialectTeaser("Sequelize"), function() {
  var sequelize = Helpers.createSequelizeInstance({dialect: dialect})

  before(function(done) {
    var self = this
    self.sequelize = sequelize
    Helpers.clearDatabase(self.sequelize, done)
  })

  describe('constructor', function() {
    it('should pass the global options correctly', function(done) {
      var sequelize = Helpers.createSequelizeInstance({ logging: false, define: { underscored:true } })
        , DAO = sequelize.define('dao', {name: Helpers.Sequelize.STRING})

      expect(DAO.options.underscored).toBeTruthy()
      done()
    })

    it('should correctly set the host and the port', function(done) {
      var sequelize = Helpers.createSequelizeInstance({ host: '127.0.0.1', port: 1234 })
      expect(sequelize.config.port).toEqual(1234)
      expect(sequelize.config.host).toEqual('127.0.0.1')
      done()
    })
  })

  describe('isDefined', function() {
    it("returns false if the dao wasn't defined before", function() {
      expect(this.sequelize.isDefined('Project')).toBeFalse()
    })

    it("returns true if the dao was defined before", function() {
      this.sequelize.define('Project', {
        name: Helpers.Sequelize.STRING
      })
      expect(this.sequelize.isDefined('Project')).toBeTrue()
    })
  })

  describe('query', function() {
    before(function(done) {
      this.sequelize.options.quoteIdentifiers = true
      this.User = this.sequelize.define('User', {
        username: Helpers.Sequelize.STRING
      })

      this.insertQuery = "INSERT INTO " + qq(this.User.tableName) + " (username, " + qq("createdAt") + ", " + qq("updatedAt") + ") VALUES ('john', '2012-01-01 10:10:10', '2012-01-01 10:10:10')"

      this.User.sync({ force: true }).success(done)
    })

    it('executes a query the internal way', function(done) {
      this.sequelize.query(this.insertQuery, null, { raw: true })
      .complete(function(err, result) {
        expect(err).toBeNull()
        expect(result).toBeNull()
        done()
      })
    })

    it('executes a query if only the sql is passed', function(done) {
      this.sequelize.query(this.insertQuery)
      .complete(function(err, result) {
        expect(err).toBeNull()
        expect(result).not.toBeDefined()
        done()
      })
    })

    it('executes select queries correctly', function(done) {
      var self = this
      sequelize.query(this.insertQuery).success(function() {
        sequelize
          .query("select * from " + qq(self.User.tableName) + "")
          .complete(function(err, users) {
            expect(err).toBeNull()
            expect(users.map(function(u){ return u.username })).toEqual(['john'])
            done()
          })
      })
    })

    it('executes select queries correctly when quoteIdentifiers is false', function(done) {
      var self = this
        , seq = Object.create(self.sequelize)

      seq.options.quoteIdentifiers = false
      seq.query(this.insertQuery).success(function() {
        seq.query("select * from " + qq(self.User.tableName) + "")
          .complete(function(err, users) {
            expect(err).toBeNull()
            expect(users.map(function(u){ return u.username })).toEqual(['john'])
            done()
          })
      })
    })

    it('executes select query and parses dot notation results', function(done) {
      var self = this
      sequelize.query('DELETE FROM ' + qq(self.User.tableName)).complete(function() {
        sequelize.query(self.insertQuery).success(function() {
          sequelize
            .query("select username as " + qq("user.username") + " from " + qq(self.User.tableName) + "")
            .complete(function(err, users) {
              expect(err).toBeNull()
              expect(users.map(function(u){ return u.user })).toEqual([{'username':'john'}])
              done()
            })
        })
      })
    })

    if (dialect == 'mysql') {
      it('executes stored procedures', function(done) {
        var self = this
        sequelize.query(this.insertQuery).success(function() {
          sequelize.query('DROP PROCEDURE IF EXISTS foo').success(function() {
            sequelize.query(
              "CREATE PROCEDURE foo()\nSELECT * FROM " + self.User.tableName + ";"
            ).success(function() {
              sequelize.query('CALL foo()').success(function(users) {
                expect(users.map(function(u){ return u.username })).toEqual(['john'])
                done()
              })
            })
          })
        })
      })
    } else {
      console.log('FIXME: I want to be supported in this dialect as well :-(')
    }

    it('uses the passed DAOFactory', function(done) {
      var self = this
      sequelize.query(this.insertQuery).success(function() {
        sequelize.query("SELECT * FROM " + qq(self.User.tableName) + ";", self.User).success(function(users) {
          expect(users[0].__factory).toEqual(self.User)
          done()
        })
      })
    })

    it('destructs dot separated attributes when doing a raw query', function(done) {
      var tickChar = (dialect === 'postgres') ? '"' : '`'
        , sql      = "select 1 as " + Helpers.Sequelize.Utils.addTicks('foo.bar.baz', tickChar)

      sequelize.query(sql, null, { raw: true }).success(function(result) {
        expect(result).toEqual([ { foo: { bar: { baz: 1 } } } ])
        done()
      })
    })

    it('replaces token with the passed array', function(done) {
      sequelize.query('select ? as foo, ? as bar', null, { raw: true }, [ 1, 2 ]).success(function(result) {
        expect(result).toEqual([{ foo: 1, bar: 2 }])
        done()
      })
    })

    it('handles AS in conjunction with functions just fine', function(done) {
      sequelize.query('SELECT ' + (dialect === "sqlite" ? 'date(\'now\')' : 'NOW()') + ' AS t').success(function(result) {
        expect(moment(result[0].t).isValid()).toBeTrue()
        done()
      })
    })
  })

  describe('define', function() {
    it("adds a new dao to the dao manager", function(done) {
      expect(sequelize.daoFactoryManager.all.length).toEqual(0)
      sequelize.define('foo', { title: Helpers.Sequelize.STRING })
      expect(sequelize.daoFactoryManager.all.length).toEqual(1)
      done()
    })

    it("overwrites global options", function(done) {
      var sequelize = Helpers.createSequelizeInstance({ define: { collate: 'utf8_general_ci' } })
      var DAO = sequelize.define('foo', {bar: Helpers.Sequelize.STRING}, {collate: 'utf8_bin'})
      expect(DAO.options.collate).toEqual('utf8_bin')
      done()
    })

    it("inherits global collate option", function(done) {
      var sequelize = Helpers.createSequelizeInstance({ define: { collate: 'utf8_general_ci' } })
      var DAO = sequelize.define('foo', {bar: Helpers.Sequelize.STRING})
      expect(DAO.options.collate).toEqual('utf8_general_ci')
      done()
    })

    it("inherits global classMethods and instanceMethods", function(done) {
      var sequelize = Helpers.createSequelizeInstance({
        define: {
          classMethods : { globalClassMethod : function() {} },
          instanceMethods : { globalInstanceMethod : function() {} }
        }
      })

      var DAO = sequelize.define('foo', {bar: Helpers.Sequelize.STRING}, {
        classMethods : { localClassMethod : function() {} }
      })

      expect(typeof DAO.options.classMethods.globalClassMethod).toEqual('function')
      expect(typeof DAO.options.classMethods.localClassMethod).toEqual('function')
      expect(typeof DAO.options.instanceMethods.globalInstanceMethod).toEqual('function')
      done()
    })

    it("uses the passed tableName", function(done) {
      var self = this
        , Photo = this.sequelize.define('Foto', { name: Helpers.Sequelize.STRING }, { tableName: 'photos' })
      Photo.sync({ force: true }).success(function() {
        sequelize.getQueryInterface().showAllTables().success(function(tableNames) {
          expect(tableNames).toContain('photos')
          done()
        })
      })
    })
  })

  describe('sync', function() {
    it("synchronizes all daos", function(done) {
      var Project = this.sequelize.define('project' + config.rand(), { title: Helpers.Sequelize.STRING })
      var Task = this.sequelize.define('task' + config.rand(), { title: Helpers.Sequelize.STRING })

      Project.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          Project.create({title: 'bla'}).success(function() {
            Task.create({title: 'bla'}).success(function(task){
              expect(task).toBeDefined()
              expect(task.title).toEqual('bla')
              done()
            })
          })
        })
      })
    })

    it('works with correct database credentials', function(done) {
      var User = sequelize.define('User', { username: Helpers.Sequelize.STRING })
      User.sync().success(function() {
        expect(true).toBeTrue()
        done()
      })
    })

    it("fails with incorrect database credentials", function(done) {
      var sequelize2 = Helpers.getSequelizeInstance('foo', 'bar', null, { logging: false })
        , User2      = sequelize2.define('User', { name: Helpers.Sequelize.STRING, bio: Helpers.Sequelize.TEXT })

      User2.sync().error(function(err) {
        expect(err.message).toMatch(/.*Access\ denied.*/)
        done()
      })
    })
  })

  describe('drop should work', function() {
    it('correctly succeeds', function(done) {
      var User = sequelize.define('Users', {username: Helpers.Sequelize.STRING })
      User.sync({ force: true }).success(function() {
        User.drop().success(function() {
          expect(true).toBeTrue()
          done()
        })
      })
    })
  })

  describe('import', function() {
    it("imports a dao definition from a file", function(done) {
      var Project = sequelize.import(__dirname + "/assets/project")
      expect(Project).toBeDefined()
      done()
    })
  })

  describe('define', function() {
    [
      { type: Helpers.Sequelize.ENUM, values: ['scheduled', 'active', 'finished']},
      Helpers.Sequelize.ENUM('scheduled', 'active', 'finished')
    ].forEach(function(status) {
      describe('enum', function() {
        before(function(done) {
          this.Review = sequelize.define('review', { status: status })
          this.Review.sync({ force: true }).success(done)
        })

        it('raises an error if no values are defined', function(done) {
          expect(function() {
            sequelize.define('omnomnom', {
              bla: { type: Helpers.Sequelize.ENUM }
            })
          }).toThrow('Error', 'Values for ENUM haven\'t been defined.')
          done()
        })

        it('correctly stores values', function(done) {
          this.Review.create({ status: 'active' }).success(function(review) {
            expect(review.status).toEqual('active')
            done()
          })
        })

        it('correctly loads values', function(done) {
          var self = this
          this.Review.create({ status: 'active' }).success(function() {
            self.Review.findAll().success(function(reviews) {
              expect(reviews[0].status).toEqual('active')
              done()
            })
          })
        })

        it("doesn't save an instance if value is not in the range of enums", function(done) {
          var self = this
          expect(function() {
            self.Review.create({ status: 'fnord' })
          }).toThrow('Error', 'Value "fnord" for ENUM status is out of allowed scope. Allowed values: scheduled, active, finished')
          done()
        })
      })
    })

    describe('table', function() {
      [
        { id: { type: Helpers.Sequelize.BIGINT } },
        { id: { type: Helpers.Sequelize.STRING, allowNull: true } },
        { id: { type: Helpers.Sequelize.BIGINT, allowNull: false, primaryKey: true, autoIncrement: true } }
      ].forEach(function(customAttributes) {

        it('should be able to override options on the default attributes', function(done) {
          var Picture = sequelize.define('picture', Helpers.Sequelize.Utils._.cloneDeep(customAttributes))
          Picture.sync({ force: true }).success(function() {
            Object.keys(customAttributes).forEach(function(attribute) {
              Object.keys(customAttributes[attribute]).forEach(function(option) {
                var optionValue = customAttributes[attribute][option];
                expect(Picture.rawAttributes[attribute][option]).toBe(optionValue)
              });
            })
            done()
          })
        })

      })
    })
  })
})
