var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , dialect   = Support.getTestDialect()
  , DataTypes = require(__dirname + "/../../lib/data-types")
  , _         = require('lodash')

chai.config.includeStack = true

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] DAO', function() {
    beforeEach(function(done) {
      this.sequelize.options.quoteIdentifiers = true
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        email: {type: DataTypes.ARRAY(DataTypes.TEXT)},
        settings: DataTypes.HSTORE,
        document: {type: DataTypes.HSTORE, defaultValue: '"default"=>"value"'}
      })
      this.User.sync({ force: true }).success(function() {
        done()
      })
    })

    afterEach(function(done) {
      this.sequelize.options.quoteIdentifiers = true
      done()
    })

    it('should be able to search within an array', function(done) {
      this.User.all({where: {email: ['hello', 'world']}}).on('sql', function(sql) {
        expect(sql).to.equal('SELECT * FROM "Users" AS "User" WHERE "User"."email" && ARRAY[\'hello\',\'world\']::TEXT[];')
        done()
      })
    })

    it('should be able to find a record while searching in an array', function(done) {
      var self = this
      this.User.bulkCreate([
        {username: 'bob', email: ['myemail@email.com']},
        {username: 'tony', email: ['wrongemail@email.com']}
      ]).success(function() {
        self.User.all({where: {email: ['myemail@email.com']}}).success(function(user) {
          expect(user).to.be.instanceof(Array)
          expect(user).to.have.length(1)
          expect(user[0].username).to.equal('bob')
          done()
        })
      })
    })

    describe('hstore', function() {
      it('should tell me that a column is hstore and not USER-DEFINED', function(done) {
        this.sequelize.queryInterface.describeTable('Users').success(function(table) {
          expect(table.settings.type).to.equal('HSTORE')
          expect(table.document.type).to.equal('HSTORE')
          done()
        })
      })

      it('should stringify hstore with insert', function(done) {
        this.User.create({
          username: 'bob',
          email: ['myemail@email.com'],
          settings: {mailing: false, push: 'facebook', frequency: 3}
        }).on('sql', function(sql) {
          var expected = 'INSERT INTO "Users" ("id","username","email","settings","document","createdAt","updatedAt") VALUES (DEFAULT,\'bob\',ARRAY[\'myemail@email.com\']::TEXT[],\'"mailing"=>false,"push"=>"facebook","frequency"=>3\',\'"default"=>"value"\''
          expect(sql.indexOf(expected)).to.equal(0)
          done()
        })
      })
    })

    describe('enums', function() {
      it('should be able to ignore enum types that already exist', function(done) {
        var User = this.sequelize.define('UserEnums', {
          mood: DataTypes.ENUM('happy', 'sad', 'meh')
        })

        User.sync({ force: true }).success(function() {
          User.sync().success(function() {
            done()
          })
        })
      })

      it('should be able to create/drop enums multiple times', function(done) {
        var User = this.sequelize.define('UserEnums', {
          mood: DataTypes.ENUM('happy', 'sad', 'meh')
        })

        User.sync({ force: true }).success(function() {
          User.sync({ force: true }).success(function() {
            done()
          })
        })
      })

      it("should be able to create/drop multiple enums multiple times", function(done) {
        var DummyModel = this.sequelize.define('Dummy-pg', {
          username: DataTypes.STRING,
          theEnumOne: {
            type: DataTypes.ENUM,
            values:[
              'one',
              'two',
              'three',
            ]
          },
          theEnumTwo: {
            type: DataTypes.ENUM,
            values:[
              'four',
              'five',
              'six',
            ],
          }
        })

        DummyModel.sync({ force: true }).done(function(err) {
          expect(err).not.to.be.ok
          // now sync one more time:
          DummyModel.sync({force: true}).done(function(err) {
            expect(err).not.to.be.ok
            // sync without dropping
            DummyModel.sync().done(function(err) {
              expect(err).not.to.be.ok
              done();
            })
          })
        })
      })

      it('should be able to add enum types', function(done) {
        var self = this
          , User = this.sequelize.define('UserEnums', {
          mood: DataTypes.ENUM('happy', 'sad', 'meh')
        })

        var _done = _.after(4, function() {
          done()
        })

        User.sync({ force: true }).success(function() {
          User = self.sequelize.define('UserEnums', {
            mood: DataTypes.ENUM('neutral', 'happy', 'sad', 'ecstatic', 'meh', 'joyful')
          })

          User.sync().success(function() {
            expect(User.rawAttributes.mood.values).to.deep.equal(['neutral', 'happy', 'sad', 'ecstatic', 'meh', 'joyful'])
            _done()
          }).on('sql', function(sql) {
            if (sql.indexOf('neutral') > -1) {
              expect(sql).to.equal("ALTER TYPE \"enum_UserEnums_mood\" ADD VALUE 'neutral' BEFORE 'happy'")
              _done()
            }
            else if (sql.indexOf('ecstatic') > -1) {
              expect(sql).to.equal("ALTER TYPE \"enum_UserEnums_mood\" ADD VALUE 'ecstatic' BEFORE 'meh'")
              _done()
            }
            else if (sql.indexOf('joyful') > -1) {
              expect(sql).to.equal("ALTER TYPE \"enum_UserEnums_mood\" ADD VALUE 'joyful' AFTER 'meh'")
              _done()
            }
          })
        })
      })
    })

    describe('integers', function() {
      describe('integer', function() {
        beforeEach(function(done) {
          this.User = this.sequelize.define('User', {
            aNumber: DataTypes.INTEGER
          })

          this.User.sync({ force: true }).success(function() {
            done()
          })
        })

        it('positive', function(done) {
          var User = this.User

          User.create({aNumber: 2147483647}).success(function(user) {
            expect(user.aNumber).to.equal(2147483647)
            User.find({where: {aNumber: 2147483647}}).success(function(_user) {
              expect(_user.aNumber).to.equal(2147483647)
              done()
            })
          })
        })

        it('negative', function(done) {
          var User = this.User

          User.create({aNumber: -2147483647}).success(function(user) {
            expect(user.aNumber).to.equal(-2147483647)
            User.find({where: {aNumber: -2147483647}}).success(function(_user) {
              expect(_user.aNumber).to.equal(-2147483647)
              done()
            })
          })
        })
      })

      describe('bigint', function() {
        beforeEach(function(done) {
          this.User = this.sequelize.define('User', {
            aNumber: DataTypes.BIGINT
          })

          this.User.sync({ force: true }).success(function() {
            done()
          })
        })

        it('positive', function(done) {
          var User = this.User

          User.create({aNumber: '9223372036854775807'}).success(function(user) {
            expect(user.aNumber).to.equal('9223372036854775807')
            User.find({where: {aNumber: '9223372036854775807'}}).success(function(_user) {
              expect(_user.aNumber).to.equal('9223372036854775807')
              done()
            })
          })
        })

        it('negative', function(done) {
          var User = this.User

          User.create({aNumber: '-9223372036854775807'}).success(function(user) {
            expect(user.aNumber).to.equal('-9223372036854775807')
            User.find({where: {aNumber: '-9223372036854775807'}}).success(function(_user) {
              expect(_user.aNumber).to.equal('-9223372036854775807')
              done()
            })
          })
        })
      })
    })

    describe('model', function() {
      it("create handles array correctly", function(done) {
        this.User
          .create({ username: 'user', email: ['foo@bar.com', 'bar@baz.com'] })
          .success(function(oldUser) {
            expect(oldUser.email).to.contain.members(['foo@bar.com', 'bar@baz.com'])
            done()
          })
          .error(function(err) {
            console.log(err)
          })
      })

      it("should save hstore correctly", function(done) {
        var self = this

        this.User
          .create({ username: 'user', email: ['foo@bar.com'], settings: { created: { test: '"value"' }}})
          .success(function(newUser) {
            // Check to see if the default value for an hstore field works
            expect(newUser.document).to.deep.equal({default: 'value'})
            expect(newUser.settings).to.deep.equal({ created: { test: '"value"' }})

            // Check to see if updating an hstore field works
            newUser.updateAttributes({settings: {should: 'update', to: 'this', first: 'place'}}).success(function(oldUser){
              // Postgres always returns keys in alphabetical order (ascending)
              expect(oldUser.settings).to.deep.equal({first: 'place', should: 'update', to: 'this'})
              done()
            })
          })
          .error(console.log)
      })

      it("should read hstore correctly", function(done) {
        var self = this
        var data = { username: 'user', email: ['foo@bar.com'], settings: { created: { test: '"value"' }}}

        this.User
          .create(data)
          .success(function() {
            // Check that the hstore fields are the same when retrieving the user
            self.User.find({ where: { username: 'user' }})
              .success(function(user) {
                expect(user.settings).to.deep.equal(data.settings)

                done()
              })
          })
          .error(console.log)
      })
    })

    describe('[POSTGRES] Unquoted identifiers', function() {
      it("can insert and select", function(done) {
        var self = this
        this.sequelize.options.quoteIdentifiers = false
        this.sequelize.getQueryInterface().QueryGenerator.options.quoteIdentifiers = false

        this.User = this.sequelize.define('Userxs', {
          username: DataTypes.STRING,
          fullName: DataTypes.STRING // Note mixed case
        }, {
          quoteIdentifiers: false
        })

        this.User.sync({ force: true }).success(function() {
          self.User
            .create({ username: 'user', fullName: "John Smith" })
            .success(function(user) {
              // We can insert into a table with non-quoted identifiers
              expect(user.id).to.exist
              expect(user.id).not.to.be.null
              expect(user.username).to.equal('user')
              expect(user.fullName).to.equal('John Smith')

              // We can query by non-quoted identifiers
              self.User.find({
                where: {fullName: "John Smith"}
              })
              .success(function(user2) {
                self.sequelize.options.quoteIndentifiers = true
                self.sequelize.getQueryInterface().QueryGenerator.options.quoteIdentifiers = true
                self.sequelize.options.logging = false
                // We can map values back to non-quoted identifiers
                expect(user2.id).to.equal(user.id)
                expect(user2.username).to.equal('user')
                expect(user2.fullName).to.equal('John Smith')
                done()
              })
            })
        })
      })
    })
  })
}
