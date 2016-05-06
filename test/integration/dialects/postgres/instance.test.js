'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , expect = chai.expect
  , DataTypes = require(__dirname + '/../../../../lib/data-types');

describe('[POSTGRES]', function() {

  beforeEach(function() {
    this.User = this.sequelize.define('User', {
      username: { type: DataTypes.STRING },
      version: { type: DataTypes.INTEGER, defaultValue: 0 },
    });
    return this.User.sync({ force: true });
  });

  describe('conditions on instance save', function() {
    describe('when ensureAffectedRows is set to false', function() {
      it('should not save if conditions match', function() {
        var self = this;
        return this.User.create({ username: 'Versioned User' }).then(function(user) {
          expect(user.version).to.be.equal(0);
          user.version++;
          return user.save({ where: {version: 10}, ensureAffectedRows: false });
        }).tap(function(user) {
          expect(user.version).to.be.equal(1);
          return self.User.findOne({ where: {username: user.username} }).then(function(u) {
            return expect(u.version).to.be.equal(0);
          });
        });
      });

      it('should save if conditions match', function() {
        var self = this;
        return this.User.create({ username: 'Versioned User'}).then(function(user) {
          expect(user.version).to.be.equal(0);
          user.version++;
          return user.save({ where: {version: 0}, ensureAffectedRows: false });
        }).tap(function(user) {
          expect(user.version).to.be.equal(1);
          return self.User.findOne({ where: {username: user.username} }).then(function(u) {
            return expect(u.version).to.be.equal(1);
          });
        });
      });
    });

    describe('when ensureAffectedRows is set to true or not set', function() {
      it('should not save if conditions match and ensureAffectedRows is true', function() {
        var user;
        var self = this;
        return this.User.create({ username: 'Versioned User' }).then(function(u) {
          user = u;
          expect(u.version).to.be.equal(0);
          u.version++;
          return u.save({ where: {version: 10}, ensureAffectedRows: true });
        }).catch(function(err) {
          expect(err.name).to.be.equal('SequelizeNoAffectedRowsError');
          expect(user.version).to.be.equal(1);
          return self.User.findOne({ where: {username: user.username} }).then(function(u) {
            return expect(u.version).to.be.equal(0);
          });
        });
      });

      it('should not save if conditions match and ensureAffectedRows not set', function() {
        var user;
        var self = this;
        return this.User.create({ username: 'Versioned User' }).then(function(u) {
          user = u;
          expect(u.version).to.be.equal(0);
          u.version++;
          return u.save({ where: {version: 10}, ensureAffectedRows: true });
        }).catch(function(err) {
          expect(err.name).to.be.equal('SequelizeNoAffectedRowsError');
          expect(user.version).to.be.equal(1);
          return self.User.findOne({ where: {username: user.username} }).then(function(u) {
            return expect(u.version).to.be.equal(0);
          });
        });
      });

      it('should save if conditions match and ensureAffectedRows is true', function() {
        var self = this;
        return this.User.create({ username: 'Versioned User'}).then(function(user) {
          expect(user.version).to.be.equal(0);
          user.version++;
          return user.save({ where: {version: 0}, ensureAffectedRows: true });
        }).tap(function(user) {
          expect(user.version).to.be.equal(1);
          return self.User.findOne({ where: {username: user.username} }).then(function(u) {
            return expect(u.version).to.be.equal(1);
          });
        });
      });

      it('should save if conditions match and ensureAffectedRows not set', function() {
        var self = this;
        return this.User.create({ username: 'Versioned User'}).then(function(user) {
          expect(user.version).to.be.equal(0);
          user.version++;
          return user.save({ where: {version: 0} });
        }).tap(function(user) {
          expect(user.version).to.be.equal(1);
          return self.User.findOne({ where: {username: user.username} }).then(function(u) {
            return expect(u.version).to.be.equal(1);
          });
        });
      });
    });
  });

});
