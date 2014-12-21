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
          });

          User.sync({ force: true }).success(function() {
            User.create({mood: 'happy'}).success(function(user) {
              expect(user).to.exist;
              expect(user.mood).to.equal('HAPPY');
              var u = User.build({mood: 'SAD'});
              u.save().success(function(_user) {
                expect(_user).to.exist;
                expect(_user.mood).to.equal('sad');
                done();
              });
            });
          });
        });

        it('enum data type should be case sensitive if my collation enforces it', function(done) {
          var User = this.sequelize.define('User' + config.rand(), {
            mood: {
              type: DataTypes.ENUM,
              values: ['HAPPY', 'sad', 'WhatEver']
            }
          }, {
            collate: 'latin1_bin'
          });

          User.sync({ force: true }).success(function() {
            User.create({mood: 'happy'}).error(function(err) {
              expect(err).to.be.instanceOf(Error);
              expect(err.get('mood')[0].message).to.equal('Value "happy" for ENUM mood is out of allowed scope. Allowed values: HAPPY, sad, WhatEver');
              var u = User.build({mood: 'SAD'});
              u.save().error(function(err) {
                expect(err).to.be.instanceOf(Error);
                expect(err.get('mood')[0].message).to.equal('Value "SAD" for ENUM mood is out of allowed scope. Allowed values: HAPPY, sad, WhatEver');
                done();
              });
            });
          });
        });
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
