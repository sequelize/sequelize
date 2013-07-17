/* jshint camelcase: false */
if(typeof require === 'function') {
  const buster  = require("buster")
      , config  = require('../config/config')
      , Helpers = require('../buster-helpers')
      , dialect = Helpers.getTestDialect()
}

buster.spec.expose()
buster.testRunner.timeout = 1000

if (dialect.match(/^mysql/)) {
  describe('[MYSQL] DAOFactory', function() {
    before(function(done) {
      var self = this

      Helpers.initTests({
        dialect: dialect,
        beforeComplete: function(sequelize, DataTypes) {
          self.sequelize = sequelize
          self.User = self.sequelize.define('User', { age: DataTypes.INTEGER, name: DataTypes.STRING, bio: DataTypes.TEXT })
        },
        onComplete: function() {
          self.sequelize.sync({ force: true }).success(done)
        }
      })
    })

    describe('constructor', function() {
      it("handles extended attributes (unique)", function(done) {
        var User = this.sequelize.define('User' + config.rand(), {
          username: { type: Helpers.Sequelize.STRING, unique: true }
        }, { timestamps: false })
        expect(User.attributes).toEqual({username:"VARCHAR(255) UNIQUE",id:"INTEGER NOT NULL auto_increment PRIMARY KEY"})
        done()
      })

      it("handles extended attributes (default)", function(done) {
        var User = this.sequelize.define('User' + config.rand(), {
          username: {type: Helpers.Sequelize.STRING, defaultValue: 'foo'}
        }, { timestamps: false })
        expect(User.attributes).toEqual({username:"VARCHAR(255) DEFAULT 'foo'",id:"INTEGER NOT NULL auto_increment PRIMARY KEY"})
        done()
      })

      it("handles extended attributes (null)", function(done) {
        var User = this.sequelize.define('User' + config.rand(), {
          username: {type: Helpers.Sequelize.STRING, allowNull: false}
        }, { timestamps: false })
        expect(User.attributes).toEqual({username:"VARCHAR(255) NOT NULL",id:"INTEGER NOT NULL auto_increment PRIMARY KEY"})
        done()
      })

      it("handles extended attributes (comment)", function(done) {
        var User = this.sequelize.define('User' + config.rand(), {
          username: {type: Helpers.Sequelize.STRING, comment: 'This be\'s a comment'}
        }, { timestamps: false })
        expect(User.attributes).toEqual({username:"VARCHAR(255) COMMENT 'This be\\'s a comment'",id:"INTEGER NOT NULL auto_increment PRIMARY KEY"})
        done()
      })

      it("handles extended attributes (primaryKey)", function(done) {
        var User = this.sequelize.define('User' + config.rand(), {
          username: {type: Helpers.Sequelize.STRING, primaryKey: true}
        }, { timestamps: false })
        expect(User.attributes).toEqual({username:"VARCHAR(255) PRIMARY KEY"})
        done()
      })

      it("adds timestamps", function(done) {
        var User1 = this.sequelize.define('User' + config.rand(), {})
        var User2 = this.sequelize.define('User' + config.rand(), {}, { timestamps: true })

        expect(User1.attributes).toEqual({id:"INTEGER NOT NULL auto_increment PRIMARY KEY", updatedAt:"DATETIME NOT NULL", createdAt:"DATETIME NOT NULL"})
        expect(User2.attributes).toEqual({id:"INTEGER NOT NULL auto_increment PRIMARY KEY", updatedAt:"DATETIME NOT NULL", createdAt:"DATETIME NOT NULL"})
        done()
      })

      it("adds deletedAt if paranoid", function(done) {
        var User = this.sequelize.define('User' + config.rand(), {}, { paranoid: true })
        expect(User.attributes).toEqual({id:"INTEGER NOT NULL auto_increment PRIMARY KEY", deletedAt:"DATETIME", updatedAt:"DATETIME NOT NULL", createdAt:"DATETIME NOT NULL"})
        done()
      })

      it("underscores timestamps if underscored", function(done) {
        var User = this.sequelize.define('User' + config.rand(), {}, { paranoid: true, underscored: true })
        expect(User.attributes).toEqual({id:"INTEGER NOT NULL auto_increment PRIMARY KEY", deleted_at:"DATETIME", updated_at:"DATETIME NOT NULL", created_at:"DATETIME NOT NULL"})
        done()
      })
    })

    describe('primaryKeys', function() {
      it("determines the correct primaryKeys", function(done) {
        var User = this.sequelize.define('User' + config.rand(), {
          foo: {type: Helpers.Sequelize.STRING, primaryKey: true},
          bar: Helpers.Sequelize.STRING
        })
        expect(User.primaryKeys).toEqual({"foo":"VARCHAR(255) PRIMARY KEY"})
        done()
      })
    })
  })
}
