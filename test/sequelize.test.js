var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/support')
  , DataTypes = require(__dirname + "/../lib/data-types")
  , dialect   = Support.getTestDialect()
  , _         = require('lodash')
  , Sequelize = require(__dirname + '/../index')
  , config    = require(__dirname + "/config/config")
  , moment    = require('moment')

chai.Assertion.includeStack = true

var qq = function(str) {
  if (dialect == 'postgres' || dialect == 'sqlite') {
    return '"' + str + '"'
  } else if (dialect == 'mysql') {
    return '`' + str + '`'
  } else {
    return str
  }
}

describe(Support.getTestDialectTeaser("Sequelize"), function () {
  describe('constructor', function() {
    it('should pass the global options correctly', function(done) {
      var sequelize = Support.createSequelizeInstance({ logging: false, define: { underscored:true } })
        , DAO = sequelize.define('dao', {name: DataTypes.STRING})

      expect(DAO.options.underscored).to.be.ok
      done()
    })

    it('should correctly set the host and the port', function(done) {
      var sequelize = Support.createSequelizeInstance({ host: '127.0.0.1', port: 1234 })
      expect(sequelize.config.port).to.equal(1234)
      expect(sequelize.config.host).to.equal('127.0.0.1')
      done()
    })
  })

  describe('isDefined', function() {
    it("returns false if the dao wasn't defined before", function() {
      expect(this.sequelize.isDefined('Project')).to.be.false
    })

    it("returns true if the dao was defined before", function() {
      this.sequelize.define('Project', {
        name: DataTypes.STRING
      })
      expect(this.sequelize.isDefined('Project')).to.be.true
    })
  })

  describe('model', function() {
    it('throws an error if the dao being accessed is undefined', function() {
      var self = this
      expect(function() {
        self.sequelize.model('Project')
      }).to.throw(/project has not been defined/i)
    })

    it('returns the dao factory defined by daoName', function() {
      var project = this.sequelize.define('Project', {
        name: DataTypes.STRING
      })

      expect(this.sequelize.model('Project')).to.equal(project)
    })
  })

  describe('query', function() {
    afterEach(function(done) {
      this.sequelize.options.quoteIdentifiers = true
      done()
    })

    beforeEach(function(done) {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING
      })

      this.insertQuery = "INSERT INTO " + qq(this.User.tableName) + " (username, " + qq("createdAt") + ", " + qq("updatedAt") + ") VALUES ('john', '2012-01-01 10:10:10', '2012-01-01 10:10:10')"

      this.User.sync({ force: true }).success(function() {
        done()
      })
    })

    it('executes a query the internal way', function(done) {
      this.sequelize.query(this.insertQuery, null, { raw: true })
      .complete(function(err, result) {
        expect(err).to.be.null
        expect(result).to.be.null
        done()
      })
    })

    it('executes a query if only the sql is passed', function(done) {
      this.sequelize.query(this.insertQuery)
      .complete(function(err, result) {
        expect(err).to.be.null
        expect(result).to.not.exist
        done()
      })
    })

    it('executes select queries correctly', function(done) {
      var self = this
      self.sequelize.query(this.insertQuery).success(function() {
        self.sequelize
          .query("select * from " + qq(self.User.tableName) + "")
          .complete(function(err, users) {
            expect(err).to.be.null
            expect(users.map(function(u){ return u.username })).to.include('john')
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
            expect(err).to.be.null
            expect(users.map(function(u){ return u.username })).to.include('john')
            done()
          })
      })
    })

    it('executes select query and parses dot notation results', function(done) {
      var self = this
      self.sequelize.query('DELETE FROM ' + qq(self.User.tableName)).complete(function() {
        self.sequelize.query(self.insertQuery).success(function() {
          self.sequelize
            .query("select username as " + qq("user.username") + " from " + qq(self.User.tableName) + "")
            .complete(function(err, users) {
              expect(err).to.be.null
              expect(users.map(function(u){ return u.user })).to.deep.equal([{'username':'john'}])
              done()
            })
        })
      })
    })

    if (dialect == 'mysql') {
      it('executes stored procedures', function(done) {
        var self = this
        self.sequelize.query(this.insertQuery).success(function() {
          self.sequelize.query('DROP PROCEDURE IF EXISTS foo').success(function() {
            self.sequelize.query(
              "CREATE PROCEDURE foo()\nSELECT * FROM " + self.User.tableName + ";"
            ).success(function() {
              self.sequelize.query('CALL foo()').success(function(users) {
                expect(users.map(function(u){ return u.username })).to.include('john')
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
      self.sequelize.query(this.insertQuery).success(function() {
        self.sequelize.query("SELECT * FROM " + qq(self.User.tableName) + ";", self.User).success(function(users) {
          expect(users[0].__factory).to.equal(self.User)
          done()
        })
      })
    })

    it('destructs dot separated attributes when doing a raw query', function(done) {
      var tickChar = (dialect === 'postgres') ? '"' : '`'
        , sql      = "select 1 as " + Sequelize.Utils.addTicks('foo.bar.baz', tickChar)

      this.sequelize.query(sql, null, { raw: true }).success(function(result) {
        expect(result).to.deep.equal([ { foo: { bar: { baz: 1 } } } ])
        done()
      })
    })

    it('replaces token with the passed array', function(done) {
      this.sequelize.query('select ? as foo, ? as bar', null, { raw: true }, [ 1, 2 ]).success(function(result) {
        expect(result).to.deep.equal([{ foo: 1, bar: 2 }])
        done()
      })
    })

    it('replaces named parameters with the passed object', function(done) {
      this.sequelize.query('select :one as foo, :two as bar', null, { raw: true }, { one: 1, two: 2 }).success(function(result) {
        expect(result).to.deep.equal([{ foo: 1, bar: 2 }])
        done()
      })
    })

    it('replaces named parameters with the passed object using the same key twice', function(done) {
      this.sequelize.query('select :one as foo, :two as bar, :one as baz', null, { raw: true }, { one: 1, two: 2 }).success(function(result) {
        expect(result).to.deep.equal([{ foo: 1, bar: 2, baz: 1 }])
        done()
      })
    })

    it('replaces named parameters with the passed object having a null property', function(done) {
      this.sequelize.query('select :one as foo, :two as bar', null, { raw: true }, { one: 1, two: null }).success(function(result) {
        expect(result).to.deep.equal([{ foo: 1, bar: null }])
        done()
      })
    })

    it('throw an exception when key is missing in the passed object', function(done) {
      var self = this
      expect(function() {
        self.sequelize.query('select :one as foo, :two as bar, :three as baz', null, { raw: true }, { one: 1, two: 2 })
      }).to.throw(Error, /Named parameter ":\w+" has no value in the given object\./g)
      done()
    })

    it('throw an exception with the passed number', function(done) {
      var self = this
      expect(function() {
        self.sequelize.query('select :one as foo, :two as bar', null, { raw: true }, 2)
      }).to.throw(Error, /Named parameter ":\w+" has no value in the given object\./g)
      done()
    })

    it('throw an exception with the passed empty object', function(done) {
      var self = this
      expect(function() {
        self.sequelize.query('select :one as foo, :two as bar', null, { raw: true }, {})
      }).to.throw(Error, /Named parameter ":\w+" has no value in the given object\./g)
      done()
    })

    it('throw an exception with the passed string', function(done) {
      var self = this
      expect(function() {
        self.sequelize.query('select :one as foo, :two as bar', null, { raw: true }, 'foobar')
      }).to.throw(Error, /Named parameter ":\w+" has no value in the given object\./g)
      done()
    })

    it('throw an exception with the passed date', function(done) {
      var self = this
      expect(function() {
        self.sequelize.query('select :one as foo, :two as bar', null, { raw: true }, new Date())
      }).to.throw(Error, /Named parameter ":\w+" has no value in the given object\./g)
      done()
    })

    it('handles AS in conjunction with functions just fine', function(done) {
      this.sequelize.query('SELECT ' + (dialect === "sqlite" ? 'date(\'now\')' : 'NOW()') + ' AS t').success(function(result) {
        expect(moment(result[0].t).isValid()).to.be.true
        done()
      })
    })
  })

  describe('define', function() {
    it("adds a new dao to the dao manager", function(done) {
      expect(this.sequelize.daoFactoryManager.all.length).to.equal(0)
      this.sequelize.define('foo', { title: DataTypes.STRING })
      expect(this.sequelize.daoFactoryManager.all.length).to.equal(1)
      done()
    })

    it("overwrites global options", function(done) {
      var sequelize = Support.createSequelizeInstance({ define: { collate: 'utf8_general_ci' } })
      var DAO = sequelize.define('foo', {bar: DataTypes.STRING}, {collate: 'utf8_bin'})
      expect(DAO.options.collate).to.equal('utf8_bin')
      done()
    })

    it("inherits global collate option", function(done) {
      var sequelize = Support.createSequelizeInstance({ define: { collate: 'utf8_general_ci' } })
      var DAO = sequelize.define('foo', {bar: DataTypes.STRING})
      expect(DAO.options.collate).to.equal('utf8_general_ci')
      done()
    })

    it("inherits global classMethods and instanceMethods", function(done) {
      var sequelize = Support.createSequelizeInstance({
        define: {
          classMethods : { globalClassMethod : function() {} },
          instanceMethods : { globalInstanceMethod : function() {} }
        }
      })

      var DAO = sequelize.define('foo', {bar: DataTypes.STRING}, {
        classMethods : { localClassMethod : function() {} }
      })

      expect(typeof DAO.options.classMethods.globalClassMethod).to.equal('function')
      expect(typeof DAO.options.classMethods.localClassMethod).to.equal('function')
      expect(typeof DAO.options.instanceMethods.globalInstanceMethod).to.equal('function')
      done()
    })

    it("uses the passed tableName", function(done) {
      var self = this
        , Photo = this.sequelize.define('Foto', { name: DataTypes.STRING }, { tableName: 'photos' })
      Photo.sync({ force: true }).success(function() {
        self.sequelize.getQueryInterface().showAllTables().success(function(tableNames) {
          expect(tableNames).to.include('photos')
          done()
        })
      })
    })
  })

  describe('sync', function() {
    it("synchronizes all daos", function(done) {
      var Project = this.sequelize.define('project' + config.rand(), { title: DataTypes.STRING })
      var Task = this.sequelize.define('task' + config.rand(), { title: DataTypes.STRING })

      Project.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          Project.create({title: 'bla'}).success(function() {
            Task.create({title: 'bla'}).success(function(task){
              expect(task).to.exist
              expect(task.title).to.equal('bla')
              done()
            })
          })
        })
      })
    })

    it('works with correct database credentials', function(done) {
      var User = this.sequelize.define('User', { username: DataTypes.STRING })
      User.sync().success(function() {
        expect(true).to.be.true
        done()
      })
    })

    it("fails with incorrect database credentials", function(done) {
      // sqlite doesn't have a concept of database credentials
      if (dialect === "sqlite") {
        expect(true).to.be.true
        return done()
      }

      var sequelize2 = Support.getSequelizeInstance('foo', 'bar', null, { logging: false })
        , User2      = sequelize2.define('User', { name: DataTypes.STRING, bio: DataTypes.TEXT })

      User2.sync().error(function(err) {
        if (dialect === "postgres" || dialect === "postgres-native") {
          expect(err.message).to.equal('role "bar" does not exist')
        } else {
          expect(err.message.toString()).to.match(/.*Access\ denied.*/)
        }
        done()
      })
    })
  })

  describe('drop should work', function() {
    it('correctly succeeds', function(done) {
      var User = this.sequelize.define('Users', {username: DataTypes.STRING })
      User.sync({ force: true }).success(function() {
        User.drop().success(function() {
          expect(true).to.be.true
          done()
        })
      })
    })
  })

  describe('import', function() {
    it("imports a dao definition from a file", function(done) {
      var Project = this.sequelize.import(__dirname + "/assets/project")
      expect(Project).to.exist
      done()
    })
  })

  describe('define', function() {
    [
      { type: DataTypes.ENUM, values: ['scheduled', 'active', 'finished']},
      DataTypes.ENUM('scheduled', 'active', 'finished')
    ].forEach(function(status) {
      describe('enum', function() {
        beforeEach(function(done) {
          this.Review = this.sequelize.define('review', { status: status })
          this.Review.sync({ force: true }).success(function() {
            done()
          })
        })

        it('raises an error if no values are defined', function(done) {
          var self = this
          expect(function() {
            self.sequelize.define('omnomnom', {
              bla: { type: DataTypes.ENUM }
            })
          }).to.throw(Error, 'Values for ENUM haven\'t been defined.')
          done()
        })

        it('correctly stores values', function(done) {
          this.Review.create({ status: 'active' }).success(function(review) {
            expect(review.status).to.equal('active')
            done()
          })
        })

        it('correctly loads values', function(done) {
          var self = this
          this.Review.create({ status: 'active' }).success(function() {
            self.Review.findAll().success(function(reviews) {
              expect(reviews[0].status).to.equal('active')
              done()
            })
          })
        })

        it("doesn't save an instance if value is not in the range of enums", function(done) {
          var self = this
          expect(function() {
            self.Review.create({ status: 'fnord' })
          }).to.throw(Error, 'Value "fnord" for ENUM status is out of allowed scope. Allowed values: scheduled, active, finished')
          done()
        })
      })
    })

    describe('table', function() {
      [
        { id: { type: DataTypes.BIGINT } },
        { id: { type: DataTypes.STRING, allowNull: true } },
        { id: { type: DataTypes.BIGINT, allowNull: false, primaryKey: true, autoIncrement: true } }
      ].forEach(function(customAttributes) {

        it('should be able to override options on the default attributes', function(done) {
          var Picture = this.sequelize.define('picture', _.cloneDeep(customAttributes))
          Picture.sync({ force: true }).success(function() {
            Object.keys(customAttributes).forEach(function(attribute) {
              Object.keys(customAttributes[attribute]).forEach(function(option) {
                var optionValue = customAttributes[attribute][option];
                expect(Picture.rawAttributes[attribute][option]).to.be.equal(optionValue)
              })
            })
            done()
          })
        })

      })
    })
  })
})
