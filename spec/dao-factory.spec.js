if(typeof require === 'function') {
  const buster    = require("buster")
      , Sequelize = require("../index")
      , Helpers   = require('./buster-helpers')
      , dialects  = Helpers.getSupportedDialects()
}

buster.spec.expose()

dialects.forEach(function(dialect) {
  describe('DAOFactory@' + dialect, function() {
    before(function(done) {
      Helpers.initTests({
        dialect: dialect,
        beforeComplete: function(sequelize, DataTypes) {
          this.sequelize = sequelize
          this.User      = sequelize.define('User', {
            username:     DataTypes.STRING,
            secretValue:  DataTypes.STRING,
            data:         DataTypes.STRING
          })
        }.bind(this),
        onComplete: function(sequelize) {
          this.User.sync({ force: true }).success(done)
        }.bind(this)
      })
    })

    describe('constructor', function() {
      it("uses the passed dao name as tablename if freezeTableName", function() {
        var User = this.sequelize.define('FrozenUser', {}, { freezeTableName: true })
        expect(User.tableName).toEqual('FrozenUser')
      })

      it("uses the pluralized dao name as tablename unless freezeTableName", function() {
        var User = this.sequelize.define('SuperUser', {}, { freezeTableName: false })
        expect(User.tableName).toEqual('SuperUsers')
      })

      it("attaches class and instance methods", function() {
        var User = this.sequelize.define('UserWithClassAndInstanceMethods', {}, {
          classMethods: { doSmth: function(){ return 1 } },
          instanceMethods: { makeItSo: function(){ return 2}}
        })

        expect(User.doSmth).toBeDefined()
        expect(User.doSmth()).toEqual(1)
        expect(User.makeItSo).not.toBeDefined()

        expect(User.build().doSmth).not.toBeDefined()
        expect(User.build().makeItSo).toBeDefined()
        expect(User.build().makeItSo()).toEqual(2)
      })

      it("throws an error if 2 autoIncrements are passed", function() {
        try {
          var User = this.sequelize.define('UserWithTwoAutoIncrements', {
            userid:    { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
            userscore: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true }
          })
          // the parse shouldn't execute the following line
          // this tests needs to be refactored...
          // we need to use expect.toThrow when a later version than 0.6 was released
          expect(1).toEqual(2)
        } catch(e) {
          expect(e.message).toEqual('Invalid DAO definition. Only one autoincrement field allowed.')
        }
      })
    })

    describe('build', function() {
      it("doesn't create database entries", function(done) {
        this.User.build({ username: 'John Wayne' })
        this.User.all().success(function(users) {
          expect(users.length).toEqual(0)
          done()
        })
      })

      it("fills the objects with default values", function() {
        var Task = this.sequelize.define('Task', {
          title:  {type: Sequelize.STRING, defaultValue: 'a task!'},
          foo:    {type: Sequelize.INTEGER, defaultValue: 2},
          bar:    {type: Sequelize.DATE},
          foobar: {type: Sequelize.TEXT, defaultValue: 'asd'},
          flag:   {type: Sequelize.BOOLEAN, defaultValue: false}
        })
        expect(Task.build().title).toEqual('a task!')
        expect(Task.build().foo).toEqual(2)
        expect(Task.build().bar).toEqual(null)
        expect(Task.build().foobar).toEqual('asd')
        expect(Task.build().flag).toEqual(false)
      })
    })

    describe('create', function() {
      it('should only store the values passed in the witelist', function(done) {
        var self = this
          , data = { username: 'Peter', secretValue: '42' }

        this.User.create(data, ['username']).success(function(user) {
          self.User.find(user.id).success(function(_user) {
            expect(_user.username).toEqual(data.username)
            expect(_user.secretValue).not.toEqual(data.secretValue)
            expect(_user.secretValue).toEqual(null)
            done()
          })
        })
      })

      it('should store all values if no whitelist is specified', function(done) {
        var self = this
          , data = { username: 'Peter', secretValue: '42' }

        this.User.create(data).success(function(user) {
          self.User.find(user.id).success(function(_user) {
            expect(_user.username).toEqual(data.username)
            expect(_user.secretValue).toEqual(data.secretValue)
            done()
          })
        })
      })

      it('saves data with single quote', function(done) {
        var quote = "single'quote"
          , self  = this

        this.User.create({ data: quote }).success(function(user) {
          expect(user.data).toEqual(quote, 'memory single quote')

          self.User.find({where: { id: user.id }}).success(function(user) {
            expect(user.data).toEqual(quote, 'SQL single quote')
            done()
          })
        })
      })

      it('saves data with double quote', function(done) {
        var quote = 'double"quote'
          , self  = this

        this.User.create({ data: quote }).success(function(user) {
          expect(user.data).toEqual(quote, 'memory double quote')

          self.User.find({where: { id: user.id }}).success(function(user) {
            expect(user.data).toEqual(quote, 'SQL double quote')
            done()
          })
        })
      })

      it('saves stringified JSON data', function(done) {
        var json = JSON.stringify({ key: 'value' })
          , self = this

        this.User.create({ data: json }).success(function(user) {
          expect(user.data).toEqual(json, 'memory data')
          self.User.find({where: { id: user.id }}).success(function(user) {
            expect(user.data).toEqual(json, 'SQL data')
            done()
          })
        })
      })

      it('stores the current date in createdAt', function(done) {
        this.User.create({ username: 'foo' }).success(function(user) {
          expect(parseInt(+user.createdAt/5000)).toEqual(parseInt(+new Date()/5000))
          done()
        })
      })
    })
  })
})
