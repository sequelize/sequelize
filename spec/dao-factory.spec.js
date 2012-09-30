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
      it("doesn't allow duplicated records with unique:true", function(done) {
        var User = this.sequelize.define('UserWithUniqueUsername', {
          username: { type: Sequelize.STRING, unique: true }
        })

        User.sync({ force: true }).success(function() {
          User.create({ username:'foo' }).success(function() {
            User.create({ username: 'foo' }).error(function(err) {
              expect(err).toBeDefined()

              Helpers.checkMatchForDialects(dialect, err.message, {
                sqlite: /.*SQLITE_CONSTRAINT.*/,
                mysql: /.*Duplicate\ entry.*/,
                postgres: /.*duplicate\ key\ value.*/
              })

              done()
            })
          })
        })
      })

      it("raises an error if created object breaks definition contraints", function(done) {
        var User = this.sequelize.define('UserWithNonNullSmth', {
          username: { type: Sequelize.STRING, unique: true },
          smth:     { type: Sequelize.STRING, allowNull: false }
        })

        User.sync({ force: true }).success(function() {
          User.create({ username: 'foo', smth: null }).error(function(err) {
            expect(err).toBeDefined()

            Helpers.checkMatchForDialects(dialect, err.message, {
              sqlite: /.*SQLITE_CONSTRAINT.*/,
              mysql: "Column 'smth' cannot be null",
              postgres: /.*column "smth" violates not-null.*/
            })

            User.create({ username: 'foo', smth: 'foo' }).success(function() {
              User.create({ username: 'foo', smth: 'bar' }).error(function(err) {
                expect(err).toBeDefined()

                Helpers.checkMatchForDialects(dialect, err.message, {
                  sqlite: /.*SQLITE_CONSTRAINT.*/,
                  mysql: "Duplicate entry 'foo' for key 'username'",
                  postgres: /.*duplicate key value violates unique constraint.*/
                })

                done()
              })
            })
          })
        })
      })

      it('sets auto increment fields', function(done) {
        var User = this.sequelize.define('UserWithAutoIncrementField', {
          userid: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false }
        })

        User.sync({ force: true }).success(function() {
          User.create({}).on('success', function(user) {
            expect(user.userid).toEqual(1)

            User.create({}).on('success', function(user) {
              expect(user.userid).toEqual(2)
              done()
            })
          })
        })
      })

      it('allows the usage of options as attribute', function(done) {
        var User = this.sequelize.define('UserWithNameAndOptions', {
          name: Sequelize.STRING,
          options: Sequelize.TEXT
        })

        var options = JSON.stringify({ foo: 'bar', bar: 'foo' })

        User.sync({ force: true }).success(function() {
          User
            .create({ name: 'John Doe', options: options })
            .success(function(user) {
              expect(user.options).toEqual(options)
              done()
            })
        })
      })

      it('allows sql logging', function(done) {
        var User = this.sequelize.define('UserWithUniqueNameAndNonNullSmth', {
          name: {type: Sequelize.STRING, unique: true},
          smth: {type: Sequelize.STRING, allowNull: false}
        })

        User.sync({ force: true }).success(function() {
          User
            .create({ name: 'Fluffy Bunny', smth: 'else' })
            .on('sql', function(sql) {
              expect(sql).toBeDefined()
              expect(sql.toUpperCase().indexOf("INSERT")).toBeGreaterThan(-1)
              done()
            })
          })
      })

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

    describe('find', function find() {
      before(function(done) {
        this.User.create({
          username: 'barfooz'
        }).success(function(user) {
          this.user = user
          done()
        }.bind(this))
      })

      it('returns a single dao', function(done) {
        this.User.find(this.user.id).success(function(user) {
          expect(Array.isArray(user)).toBeFalsy()
          expect(user.id).toEqual(this.user.id)
          expect(user.id).toEqual(1)
          done()
        }.bind(this))
      })

      it("should make aliased attributes available", function(done) {
        this.User.find({
          where: { id: 1 },
          attributes: ['id', ['username', 'name']]
        }).success(function(user) {
          expect(user.name).toEqual('barfooz')
          done()
        })
      })

      it('finds a specific user via where option', function(done) {
        this.User.find({ where: { username: 'barfooz' } }).success(function(user) {
          expect(user.username).toEqual('barfooz')
          done()
        })
      })

      it("doesn't find a user if conditions are not matching", function(done) {
        this.User.find({ where: { username: 'foo' } }).success(function(user) {
          expect(user).toBeNull()
          done()
        })
      })

      it('allows sql logging', function(done) {
        this.User.find({ where: { username: 'foo' } })
          .on('sql', function(sql) {
            expect(sql).toBeDefined()
            expect(sql.toUpperCase().indexOf("SELECT")).toBeGreaterThan(-1)
            done()
          })
      })

      it('ignores passed limit option', function(done) {
        this.User.find({ limit: 10 }).success(function(user) {
          // it returns an object instead of an array
          expect(Array.isArray(user)).toBeFalsy()
          expect(user.hasOwnProperty('username')).toBeTruthy()
          done()
        })
      })

      it('finds entries via primary keys', function(done) {
        var User = this.sequelize.define('UserWithPrimaryKey', {
          identifier: {type: Sequelize.STRING, primaryKey: true},
          name: Sequelize.STRING
        })

        User.sync({ force: true }).success(function() {
          User.create({
            identifier: 'an identifier',
            name: 'John'
          }).success(function(u) {
            expect(u.id).not.toBeDefined()

            User.find('an identifier').success(function(u2) {
              expect(u2.identifier).toEqual('an identifier')
              expect(u2.name).toEqual('John')
              done()
            })
          })
        })
      })

      it('//fetches associated objects for 1:1 associations', function(done) {
        var Task = this.sequelize.define('Task', {
          title: Sequelize.STRING
        })

        var User = this.sequelize.define('UserWithName', {
          name: Sequelize.STRING
        })

        User.hasOne(Task)
        Task.belongsTo(User)

        this.sequelize.sync({ force: true }).success(function() {
          User.create({ name: 'barfooz' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              user.setTask(task).success(function() {
                User.find({
                  where: { 'UserWithNames.id': 1 },
                  include: [ 'Task' ]
                }).success(function(user) {
                  expect(user.task).toBeDefined()
                  expect(user.task).toEqual(task)
                  done()
                })
              }) //- setTask
            }) //- Task.create
          }) //- User.create
        }) //- sequelize.sync
      })
    })
  })
})
