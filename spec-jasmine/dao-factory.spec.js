var config    = require("./config/config")
  , Sequelize = require("../index")
  , dialects  = ['sqlite', 'mysql', 'postgres']

describe('DAOFactory', function() {
  dialects.forEach(function(dialect) {
    describe('with dialect "' + dialect + '"', function() {
      var User      = null
        , sequelize = new Sequelize(
            config[dialect].database,
            config[dialect].username,
            config[dialect].password,
            {
              logging: false,
              dialect: dialect,
              port: config[dialect].port
            }
          )
        , Helpers   = new (require("./config/helpers"))(sequelize)

      var setup = function(options) {
        User = sequelize.define('User', options || {
          age: Sequelize.INTEGER,
          name: Sequelize.STRING,
          bio: Sequelize.TEXT
        })

        Helpers.dropAllTables()

        Helpers.async(function(done) {
          User.sync({force: true}).success(done).error(function(err) { console.log(err) })
        })
      }

      var checkMatchForDialects = function(value, expectations) {
        if(!!expectations[dialect])
          expect(value).toMatch(expectations[dialect])
        else
          throw new Error('Undefined expectation for "' + dialect + '"!')
      }

      beforeEach(function() { setup() })
      afterEach(function() { Helpers.dropAllTables() })

      describe('constructor', function() {
        it("uses the passed dao name as tablename if freezeTableName", function() {
          var User = sequelize.define('User', {}, {freezeTableName: true})
          expect(User.tableName).toEqual('User')
        })

        it("uses the pluralized daoname as tablename unless freezeTableName", function() {
          var User = sequelize.define('User', {}, {freezeTableName: false})
          expect(User.tableName).toEqual('Users')
        })

        it("attaches class and instance methods", function() {
          var User = sequelize.define('User', {}, {
            classMethods: { doSmth: function(){ return 1 } },
            instanceMethods: { makeItSo: function(){ return 2}}
          })
          expect(User.doSmth).toBeDefined()
          expect(User.doSmth()).toEqual(1)
          expect(User.makeItSo).toBeUndefined()

          expect(User.build().makeItSo).toBeDefined()
          expect(User.build().makeItSo()).toEqual(2)
        })

        it("throws an error if 2 autoIncrements are passed", function() {
          expect(function () {
            var User = sequelize.define('User', {
              userid: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
              userscore: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
            })
          }).toThrow('Invalid DAO definition. Only one autoincrement field allowed.')

        })
      })

      describe('build', function() {
        it("doesn't create database entries", function() {
          Helpers.async(function(done) {
            User.build({ name: 'John Wayne', bio: 'noot' })
            User.all().success(function(users) {
              expect(users.length).toEqual(0)
              done()
            })
          })
        })

        it("fills the objects with default values", function() {
          var Task = sequelize.define('Task' + config.rand(), {
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
        it("doesn't allow duplicated records with unique:true", function() {
          setup({ username: {type: Sequelize.STRING, unique: true} })

          Helpers.async(function(done) {
            User.create({ username:'foo' }).success(function() {
              User.create({ username: 'foo' }).error(function(err) {
                expect(err).toBeDefined()

                checkMatchForDialects(err.message, {
                  sqlite: /.*SQLITE_CONSTRAINT.*/,
                  mysql: /.*Duplicate\ entry.*/,
                  postgres: /.*duplicate\ key\ value.*/
                })

                done()
              })
            })
          })
        })

        it("raises an error if created object breaks definition contraints", function() {
          setup({
            username: {type: Sequelize.STRING, unique: true},
            smth: {type: Sequelize.STRING, allowNull: false}
          })

          Helpers.async(function(done) {
            User.create({ username: 'foo', smth: null }).error(function(err) {
              expect(err).toBeDefined()

              checkMatchForDialects(err.message, {
                sqlite: /.*SQLITE_CONSTRAINT.*/,
                mysql: "Column 'smth' cannot be null",
                postgres: /.*column "smth" violates not-null.*/
              })

              User.create({username: 'foo', smth: 'foo'}).success(function() {
                User.create({username: 'foo', smth: 'bar'}).error(function(err) {
                  expect(err).toBeDefined()

                  checkMatchForDialects(err.message, {
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

        it('sets auto increment fields', function() {
          setup({
            userid: {type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false}
          })

          Helpers.async(function(done) {
            User.create({}).on('success', function(user) {
              expect(user.userid).toEqual(1)
              done()
            })
          })

          Helpers.async(function(done) {
            User.create({}).on('success', function(user) {
              expect(user.userid).toEqual(2)
              done()
            })
          })
        })

        it('allows the usage of options as attribute', function() {
          setup({ name: Sequelize.STRING, options: Sequelize.TEXT })

          Helpers.async(function(done) {
            var options = JSON.stringify({ foo: 'bar', bar: 'foo' })

            User
              .create({ name: 'John Doe', options: options })
              .success(function(user) {
                expect(user.options).toEqual(options)
                done()
              })
          })
        })

        it('allows sql logging', function() {
          Helpers.async(function(done) {
            User
              .create({ name: 'Fluffy Bunny', smth: 'else' })
              .on('sql', function(sql) {
                expect(sql).toBeDefined()
                expect(sql.toUpperCase().indexOf("INSERT")).toBeGreaterThan(-1)
                done()
              })
          })
        })

      })

      describe('destroy', function() {
        it('deletes a record from the database if dao is not paranoid', function() {
          Helpers.async(function(done) {
            User = sequelize.define('User', {
              name: Sequelize.STRING,
              bio: Sequelize.TEXT
            })
            User.sync({force: true}).success(done)
          })

          Helpers.async(function(done) {
            User.create({name: 'hallo', bio: 'welt'}).success(function(u) {
              User.all().success(function(users) {
                expect(users.length).toEqual(1)
                u.destroy().success(function() {
                  User.all().success(function(users) {
                    expect(users.length).toEqual(0)
                    done()
                  }).error(function(err) { console.log(err) })
                }).error(function(err) { console.log(err) })
              }).error(function(err) { console.log(err) })
            })
          })
        })

        it('allows sql logging of delete statements', function() {
          Helpers.async(function(done) {
            User = sequelize.define('User', {
              name: Sequelize.STRING,
              bio: Sequelize.TEXT
            })
            User.sync({force: true}).success(done)
          })

          Helpers.async(function(done) {
            User.create({name: 'hallo', bio: 'welt'}).success(function(u) {
              User.all().success(function(users) {
                expect(users.length).toEqual(1)
                u.destroy().on('sql', function(sql) {
                  expect(sql).toBeDefined()
                  expect(sql.toUpperCase().indexOf("DELETE")).toBeGreaterThan(-1)
                  done()
                }).error(function(err) { console.log(err) })
              }).error(function(err) { console.log(err) })
            })
          })
        })

        it('marks the database entry as deleted if dao is paranoid', function() {
          Helpers.async(function(done) {
            User = sequelize.define('User', {
              name: Sequelize.STRING, bio: Sequelize.TEXT
            }, { paranoid:true })
            User.sync({ force: true }).success(done)
          })

          Helpers.async(function(done) {
            User.create({ name: 'asd', bio: 'asd' }).success(function(u) {
              expect(u.deletedAt).toBeNull()
              u.destroy().success(function(u) {
                expect(u.deletedAt).toBeTruthy()
                done()
              })
            })
          })
        })

        it('allows sql logging of update statements', function() {
          Helpers.async(function(done) {
            User = sequelize.define('User', {
              name: Sequelize.STRING, bio: Sequelize.TEXT
            }, { paranoid:true })
            User.sync({ force: true }).success(done)
          })

          Helpers.async(function(done) {
            User.create({ name: 'meg', bio: 'none' }).success(function(u) {
              expect(u).toBeDefined()
              expect(u).not.toBe(null)
              u.destroy().on('sql', function(sql) {
                expect(sql).toBeDefined()
                expect(sql.toUpperCase().indexOf("UPDATE")).toBeGreaterThan(-1)
                done()
              })
            })
          })
        })
      })

      describe('find', function() {
        var users = []

        beforeEach(function() {
          Helpers.Factories.User({name: 'user', bio: 'foobar'}, function(_users) {
            users = _users
          }, 2)
        })

        it("should make aliased attributes available", function() {
          Helpers.async(function(done) {
            User.find({ where: 'id = 1', attributes: ['id', ['name', 'username']] }).success(function(user) {
              expect(user.username).toEqual('user')
              done()
            })
          })
        })

        it('returns a single dao', function() {
          Helpers.async(function(done) {
            User.find(users[0].id).success(function(user) {
              expect(Array.isArray(user)).toBeFalsy()
              expect(user.id).toEqual(users[0].id)
              done()
            })
          })
        })

        it('finds a specific user via where option', function() {
          Helpers.async(function(done) {
            User.find({where: { name: 'user' }}).success(function(user) {
              expect(user.name).toEqual('user')
              done()
            })
          })
        })

        it("doesn't find a user if conditions are not matching", function() {
          Helpers.async(function(done) {
            User.find({ where: { name: 'foo' } }).success(function(user) {
              expect(user).toBeNull()
              done()
            })
          })
        })

        it('allows sql logging', function() {
          Helpers.async(function(done) {
            User.find({ where: { name: 'foo' } })
              .on('sql', function(sql) {
                expect(sql).toBeDefined()
                expect(sql.toUpperCase().indexOf("SELECT")).toBeGreaterThan(-1)
                done()
              })
          })
        })

        it('ignores passed limit option', function() {
          Helpers.async(function(done) {
            User.find({limit: 10}).success(function(user) {
              // it returns an object instead of an array
              expect(Array.isArray(user)).toBeFalsy()
              expect(user.hasOwnProperty('name')).toBeTruthy()
              done()
            })
          })
        })

        it('finds entries via primary keys', function() {
          setup({
            identifier: {type: Sequelize.STRING, primaryKey: true},
            name: Sequelize.STRING
          })
          Helpers.async(function(done) {
            User.create({identifier: 'an identifier', name: 'John'}).success(function(u) {
              expect(u.id).toBeUndefined()

              User.find('an identifier').success(function(u2) {
                expect(u2.identifier).toEqual('an identifier')
                expect(u2.name).toEqual('John')
                done()
              })
            })
          })
        })
      })

      describe('findAll', function() {
        var users = []

        beforeEach(function() {
          Helpers.Factories.User({name: 'user', bio: 'foobar'}, function(_users) {
            users = _users
          }, 2)
        })

        it("finds all entries", function() {
          Helpers.async(function(done) {
            User.findAll().on('success', function(_users) {
              expect(_users.length).toEqual(2)
              done()
            })
          })
        })

        it("finds all users matching the passed conditions", function() {
          Helpers.async(function(done) {
            User.findAll({where: "id != " + users[1].id}).success(function(_users) {
              expect(_users.length).toEqual(1)
              done()
            })
          })
        })

        it("can also handle array notation", function() {
          Helpers.async(function(done){
            User.findAll({where: ['id = ?', users[1].id]}).success(function(_users) {
              expect(_users.length).toEqual(1)
              expect(_users[0].id).toEqual(users[1].id)
              done()
            })
          })
        })

        it("sorts the results via id", function() {
          Helpers.Factories.User({name: 'user', bio: 'foobar'}, function(_users) {
            users = _users
          }, 2)

          Helpers.async(function(done) {
            setTimeout(function() {
              User.create({name: 'user', bio: 'foobar'}).success(function(user) {
                users.push(user)
                done()
              })
            }, 2000)
          })

          Helpers.async(function(done) {
            User.findAll({ order: "id DESC" }).success(function(users) {
              expect(users[0].id).toBeGreaterThan(users[2].id)
              done()
            })
          })
        })

        it("sorts the results via createdAt", function() {
          Helpers.Factories.User({name: 'user', bio: 'foobar'}, function(_users) {
            users = _users
          }, 2)

          Helpers.async(function(done) {
            setTimeout(function() {
              User.create({name: 'user', bio: 'foobar'}).success(function(user) {
                users.push(user)
                done()
              })
            }, 2000)
          })

          Helpers.async(function(done) {
            User.findAll({ order: 'createdAt DESC' }).success(function(users) {
              expect(users[0].id).toBeGreaterThan(users[2].id)
              done()
            })
          })
        })

        it("handles offset and limit", function() {
          setup()

          Helpers.Factories.User({name: 'user', bio: 'foobar'}, null, 10)

          Helpers.async(function(done) {
            User.findAll({ limit: 2, offset: 2 }).success(function(users) {
              expect(users.length).toEqual(2)
              expect(users[0].id).toEqual(3)
              done()
            })
          })
        })
      })

      describe('all', function() {
        beforeEach(function() {
          Helpers.Factories.User({name: 'user', bio: 'foobar'}, null, 2)
        })

        it("should return all users", function() {
          Helpers.async(function(done) {
            User.all().on('success', function(users) {
              done()
              expect(users.length).toEqual(2)
            }).on('failure', function(err) { console.log(err) })
          })
        })
      })

      describe('count', function() {
        it('counts all created objects', function() {
          Helpers.async(function(done) {
            User.create({name: 'user1'}).success(function() {
              User.create({name: 'user2'}).success(done)
            })
          })

          Helpers.async(function(done) {
            User.count().success(function(count) {
              expect(count).toEqual(2)
              done()
            })
          })
        })

        it('allows sql logging', function() {
          Helpers.async(function(done) {
            User.count()
              .on('sql', function(sql) {
                expect(sql).toBeDefined()
                expect(sql.toUpperCase().indexOf("SELECT")).toBeGreaterThan(-1)
                done()
              })
          })
        })

        it('filters object', function() {
          Helpers.async(function(done) {
            User.create({name: 'user1'}).success(function() {
              User.create({name: 'foo'}).success(done)
            })
          })

          Helpers.async(function(done) {
            User.count({where: "name LIKE '%us%'"}).success(function(count) {
              expect(count).toEqual(1)
              done()
            })
          })
        })
      })

      describe('min', function() {
        it("should return the min value", function() {
          for(var i = 2; i < 5; i++) Helpers.Factories.User({ age: i })

          Helpers.async(function(done) {
            User.min('age').on('success', function(min) {
              expect(min).toEqual(2); done()
            })
          })
        })
        it('allows sql logging', function() {
          Helpers.async(function(done) {
            User.min('age')
              .on('sql', function(sql) {
                expect(sql).toBeDefined()
                expect(sql.toUpperCase().indexOf("SELECT")).toBeGreaterThan(-1)
                done()
              })
          })
        })
      })

      describe('max', function() {
        it("should return the max value", function() {
          for(var i = 2; i <= 5; i++) Helpers.Factories.User({ age: i })

          Helpers.async(function(done) {
            User.max('age').on('success', function(max) {
              expect(max).toEqual(5); done()
            })
          })
        })
        it('allows sql logging', function() {
          Helpers.async(function(done) {
            User.max('age')
              .on('sql', function(sql) {
                expect(sql).toBeDefined()
                expect(sql.toUpperCase().indexOf("SELECT")).toBeGreaterThan(-1)
                done()
              })
          })
        })
      })

      describe('equals', function() {
        it("correctly determines equality of objects", function() {
          setup({ name: Sequelize.STRING, bio: Sequelize.TEXT })

          Helpers.async(function(done) {
            User.create({name: 'hallo', bio: 'welt'}).success(function(u) {
              expect(u.equals(u)).toBeTruthy()
              done()
            })
          })
        })

        // sqlite can't handle multiple primary keys
        if(dialect != 'sqlite') {
          it("correctly determines equality with multiple primary keys", function() {
            setup({
              foo: {type: Sequelize.STRING, primaryKey: true},
              bar: {type: Sequelize.STRING, primaryKey: true},
              name: Sequelize.STRING, bio: Sequelize.TEXT
            })

            Helpers.async(function(done) {
               User.create({foo: '1', bar: '2', name: 'hallo', bio: 'welt'}).success(function(u) {
                expect(u.equals(u)).toBeTruthy()
                done()
              }).error(function(err) { console.log(err) })
            })
          })
        }
      })

      describe('equalsOneOf', function() {
        // sqlite can't handle multiple primary keys
        if(dialect != 'sqlite') {
          beforeEach(function() {
            setup({
              foo: {type: Sequelize.STRING, primaryKey: true},
              bar: {type: Sequelize.STRING, primaryKey: true},
              name: Sequelize.STRING, bio: Sequelize.TEXT
            })
          })

          it('determines equality if one is matching', function() {
            Helpers.async(function(done) {
              User.create({foo: '1', bar: '2', name: 'hallo', bio: 'welt'}).success(function(u) {
                expect(u.equalsOneOf([u, {a:1}])).toBeTruthy()
                done()
              })
            })
          })

          it("doesn't determine equality if none is matching", function() {
            Helpers.async(function(done) {
              User.create({foo: '1', bar: '2', name: 'hallo', bio: 'welt'}).success(function(u) {
                expect(u.equalsOneOf([{b:2}, {a:1}])).toBeFalsy()
                done()
              })
            })
          })
        }
      })

      describe('Mixin', function() {
        var DAOFactory = require("../lib/dao-factory")

        it("adds the mixed-in functions to the dao", function() {
          expect(DAOFactory.prototype.hasOne).toBeDefined()
          expect(DAOFactory.prototype.hasMany).toBeDefined()
          expect(DAOFactory.prototype.belongsTo).toBeDefined()
        })
      })

      describe('sync', function() {
        it('works with correct database credentials', function() {
          Helpers.async(function(done) {
            User.sync().success(done)
          })
        })

        it("fails with incorrect database credentials", function() {
          Helpers.async(function(done) {
            var sequelize2 = new Sequelize('foo', 'bar', null, { logging: false })
              , User2      = sequelize2.define('User', { name: Sequelize.STRING, bio: Sequelize.TEXT })

            User2.sync().error(function(err) {
              expect(err.message).toMatch(/.*Access\ denied.*/)
              done()
            })
          })
        })
      })

      describe('drop should work', function() {
        it('correctly succeeds', function() {
          Helpers.async(function(done) {
            User.drop().success(done)
          })
        })
      })
    })
  })
})
