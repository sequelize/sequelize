/* jshint camelcase: false */
var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + "/../../lib/data-types")
  , dialect   = Support.getTestDialect()
  , config    = require(__dirname + "/../config/config")

chai.Assertion.includeStack = true

if (dialect.match(/^mysql/)) {
  describe("[MYSQL Specific] DAOFactory", function () {
    describe('constructor', function() {
      it("handles extended attributes (unique)", function(done) {
        var User = this.sequelize.define('User' + config.rand(), {
          username: { type: DataTypes.STRING, unique: true }
        }, { timestamps: false })
        expect(User.attributes).to.deep.equal({username:"VARCHAR(255) UNIQUE",id:"INTEGER NOT NULL auto_increment PRIMARY KEY"})
        done()
      })

      it("handles extended attributes (default)", function(done) {
        var User = this.sequelize.define('User' + config.rand(), {
          username: {type: DataTypes.STRING, defaultValue: 'foo'}
        }, { timestamps: false })
        expect(User.attributes).to.deep.equal({username:"VARCHAR(255) DEFAULT 'foo'",id:"INTEGER NOT NULL auto_increment PRIMARY KEY"})
        done()
      })

      it("handles extended attributes (null)", function(done) {
        var User = this.sequelize.define('User' + config.rand(), {
          username: {type: DataTypes.STRING, allowNull: false}
        }, { timestamps: false })
        expect(User.attributes).to.deep.equal({username:"VARCHAR(255) NOT NULL",id:"INTEGER NOT NULL auto_increment PRIMARY KEY"})
        done()
      })

      it("handles extended attributes (comment)", function(done) {
        var User = this.sequelize.define('User' + config.rand(), {
          username: {type: DataTypes.STRING, comment: 'This be\'s a comment'}
        }, { timestamps: false })
        expect(User.attributes).to.deep.equal({username:"VARCHAR(255) COMMENT 'This be\\'s a comment'",id:"INTEGER NOT NULL auto_increment PRIMARY KEY"})
        done()
      })

      it("handles extended attributes (primaryKey)", function(done) {
        var User = this.sequelize.define('User' + config.rand(), {
          username: {type: DataTypes.STRING, primaryKey: true}
        }, { timestamps: false })
        expect(User.attributes).to.deep.equal({username:"VARCHAR(255) PRIMARY KEY"})
        done()
      })

      it("adds timestamps", function(done) {
        var User1 = this.sequelize.define('User' + config.rand(), {})
        var User2 = this.sequelize.define('User' + config.rand(), {}, { timestamps: true })

        expect(User1.attributes).to.deep.equal({id:"INTEGER NOT NULL auto_increment PRIMARY KEY", updatedAt:"DATETIME NOT NULL", createdAt:"DATETIME NOT NULL"})
        expect(User2.attributes).to.deep.equal({id:"INTEGER NOT NULL auto_increment PRIMARY KEY", updatedAt:"DATETIME NOT NULL", createdAt:"DATETIME NOT NULL"})
        done()
      })

      it("adds deletedAt if paranoid", function(done) {
        var User = this.sequelize.define('User' + config.rand(), {}, { paranoid: true })
        expect(User.attributes).to.deep.equal({id:"INTEGER NOT NULL auto_increment PRIMARY KEY", deletedAt:"DATETIME", updatedAt:"DATETIME NOT NULL", createdAt:"DATETIME NOT NULL"})
        done()
      })

      it("underscores timestamps if underscored", function(done) {
        var User = this.sequelize.define('User' + config.rand(), {}, { paranoid: true, underscored: true })
        expect(User.attributes).to.deep.equal({id:"INTEGER NOT NULL auto_increment PRIMARY KEY", deleted_at:"DATETIME", updated_at:"DATETIME NOT NULL", created_at:"DATETIME NOT NULL"})
        done()
      })

      it('omits text fields with defaultValues', function(done) {
        var User = this.sequelize.define('User' + config.rand(), {name: {type: DataTypes.TEXT, defaultValue: 'helloworld'}})
        expect(User.attributes.name).to.equal('TEXT')
        done()
      })

      it('omits blobs fields with defaultValues', function(done) {
        var User = this.sequelize.define('User' + config.rand(), {name: {type: DataTypes.STRING.BINARY, defaultValue: 'helloworld'}})
        expect(User.attributes.name).to.equal('VARCHAR(255) BINARY')
        done()
      })
    })

    describe('validations', function() {
      describe('enums', function() {
        it('enum data type should be case insensitive if my collation allows it', function(done) {
          var User = this.sequelize.define('User' + config.rand(), {
            mood: {
              type: DataTypes.ENUM,
              values: ['HAPPY', 'sad', 'WhatEver']
            }
          }, {
            collate: 'utf8_general_ci'
          })

          User.sync({ force: true }).success(function() {
            User.create({mood: 'happy'}).success(function(user) {
              expect(user).to.exist
              expect(user.mood).to.equal('HAPPY')
              var u = User.build({mood: 'SAD'})
              u.save().success(function(_user) {
                expect(_user).to.exist
                expect(_user.mood).to.equal('sad')
                done()
              })
            })
          })
        })

        it('enum data type should be case sensitive if my collation enforces it', function(done) {
          var User = this.sequelize.define('User' + config.rand(), {
            mood: {
              type: DataTypes.ENUM,
              values: ['HAPPY', 'sad', 'WhatEver']
            }
          }, {
            collate: 'latin1_bin'
          })

          User.sync({ force: true }).success(function() {
            expect(function() {
              User.create({mood: 'happy'})
            }).to.throw(Error, 'Value "happy" for ENUM mood is out of allowed scope. Allowed values: HAPPY, sad, WhatEver')

            expect(function() {
              var u = User.build({mood: 'SAD'})
              u.save()
            }).to.throw(Error, 'Value "SAD" for ENUM mood is out of allowed scope. Allowed values: HAPPY, sad, WhatEver')
            done()
          })
        })
      })
    })

    describe('primaryKeys', function() {
      it("determines the correct primaryKeys", function(done) {
        var User = this.sequelize.define('User' + config.rand(), {
          foo: {type: DataTypes.STRING, primaryKey: true},
          bar: DataTypes.STRING
        })
        expect(User.primaryKeys).to.deep.equal({"foo":"VARCHAR(255) PRIMARY KEY"})
        done()
      })
    })
  })
}
