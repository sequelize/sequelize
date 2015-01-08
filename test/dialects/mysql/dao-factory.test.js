'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , config = require(__dirname + '/../../config/config');

chai.config.includeStack = true;

if (Support.dialectIsMySQL()) {
  describe('[MYSQL Specific] DAOFactory', function() {
    describe('constructor', function() {
      it('handles extended attributes (unique)', function(done) {
        var User = this.sequelize.define('User' + config.rand(), {
          username: { type: DataTypes.STRING, unique: true }
        }, { timestamps: false });

        expect(this.sequelize.getQueryInterface().QueryGenerator.attributesToSQL(User.attributes)).to.deep.equal({username: 'VARCHAR(255) UNIQUE', id: 'INTEGER NOT NULL auto_increment PRIMARY KEY'});
        done();
      });

      it('handles extended attributes (default)', function(done) {
        var User = this.sequelize.define('User' + config.rand(), {
          username: {type: DataTypes.STRING, defaultValue: 'foo'}
        }, { timestamps: false });
        expect(this.sequelize.getQueryInterface().QueryGenerator.attributesToSQL(User.attributes)).to.deep.equal({username: "VARCHAR(255) DEFAULT 'foo'", id: 'INTEGER NOT NULL auto_increment PRIMARY KEY'});
        done();
      });

      it('handles extended attributes (null)', function(done) {
        var User = this.sequelize.define('User' + config.rand(), {
          username: {type: DataTypes.STRING, allowNull: false}
        }, { timestamps: false });
        expect(this.sequelize.getQueryInterface().QueryGenerator.attributesToSQL(User.attributes)).to.deep.equal({username: 'VARCHAR(255) NOT NULL', id: 'INTEGER NOT NULL auto_increment PRIMARY KEY'});
        done();
      });

      it('handles extended attributes (primaryKey)', function(done) {
        var User = this.sequelize.define('User' + config.rand(), {
          username: {type: DataTypes.STRING, primaryKey: true}
        }, { timestamps: false });
        expect(this.sequelize.getQueryInterface().QueryGenerator.attributesToSQL(User.attributes)).to.deep.equal({username: 'VARCHAR(255) PRIMARY KEY'});
        done();
      });

      it('adds timestamps', function(done) {
        var User1 = this.sequelize.define('User' + config.rand(), {});
        var User2 = this.sequelize.define('User' + config.rand(), {}, { timestamps: true });

        expect(this.sequelize.getQueryInterface().QueryGenerator.attributesToSQL(User1.attributes)).to.deep.equal({id: 'INTEGER NOT NULL auto_increment PRIMARY KEY', updatedAt: 'DATETIME NOT NULL', createdAt: 'DATETIME NOT NULL'});
        expect(this.sequelize.getQueryInterface().QueryGenerator.attributesToSQL(User2.attributes)).to.deep.equal({id: 'INTEGER NOT NULL auto_increment PRIMARY KEY', updatedAt: 'DATETIME NOT NULL', createdAt: 'DATETIME NOT NULL'});
        done();
      });

      it('adds deletedAt if paranoid', function(done) {
        var User = this.sequelize.define('User' + config.rand(), {}, { paranoid: true });
        expect(this.sequelize.getQueryInterface().QueryGenerator.attributesToSQL(User.attributes)).to.deep.equal({id: 'INTEGER NOT NULL auto_increment PRIMARY KEY', deletedAt: 'DATETIME', updatedAt: 'DATETIME NOT NULL', createdAt: 'DATETIME NOT NULL'});
        done();
      });

      it('underscores timestamps if underscored', function(done) {
        var User = this.sequelize.define('User' + config.rand(), {}, { paranoid: true, underscored: true });
        expect(this.sequelize.getQueryInterface().QueryGenerator.attributesToSQL(User.attributes)).to.deep.equal({id: 'INTEGER NOT NULL auto_increment PRIMARY KEY', deleted_at: 'DATETIME', updated_at: 'DATETIME NOT NULL', created_at: 'DATETIME NOT NULL'});
        done();
      });

      it('omits text fields with defaultValues', function(done) {
        var User = this.sequelize.define('User' + config.rand(), {name: {type: DataTypes.TEXT, defaultValue: 'helloworld'}});
        expect(User.attributes.name.type.toString()).to.equal('TEXT');
        done();
      });

      it('omits blobs fields with defaultValues', function(done) {
        var User = this.sequelize.define('User' + config.rand(), {name: {type: DataTypes.STRING.BINARY, defaultValue: 'helloworld'}});
        expect(User.attributes.name.type.toString()).to.equal('VARCHAR(255) BINARY');
        done();
      });
    });

    describe('primaryKeys', function() {
      it('determines the correct primaryKeys', function(done) {
        var User = this.sequelize.define('User' + config.rand(), {
          foo: {type: DataTypes.STRING, primaryKey: true},
          bar: DataTypes.STRING
        });
        expect(this.sequelize.getQueryInterface().QueryGenerator.attributesToSQL(User.primaryKeys)).to.deep.equal({'foo': 'VARCHAR(255) PRIMARY KEY'});
        done();
      });
    });
  });
}
