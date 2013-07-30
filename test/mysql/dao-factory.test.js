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
