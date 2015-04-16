'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , Sequelize = require('../../../index')
  , Promise = Sequelize.Promise;

chai.config.includeStack = true;

describe(Support.getTestDialectTeaser('CounterCache'), function() {
  it('adds an integer column', function() {
    var User = this.sequelize.define('User', {})
      , Group = this.sequelize.define('Group', {});

    User.hasMany(Group, { counterCache: true });

    expect(Object.keys(User.attributes)).to.contain('countGroups');
    expect(User.attributes.countGroups.type instanceof DataTypes.INTEGER).to.be.ok;
  });

  it('supports `as`', function() {
    var User = this.sequelize.define('User', {})
      , Group = this.sequelize.define('Group', {});

    User.hasMany(Group, { counterCache: { as: 'countDemGroups' } });

    expect(Object.keys(User.attributes)).to.contain('countDemGroups');
  });

  it('inits at 0', function() {
    var User = this.sequelize.define('User', {})
      , Group = this.sequelize.define('Group', {});

    User.hasMany(Group, { counterCache: true });

    return this.sequelize.sync({ force: true }).then(function() {
      return User.create();
    }).then(function(user) {
      expect(user.countGroups).to.equal(0);
    });
  });

  describe('hooks', function() {
    var User, Group;

    beforeEach(function() {
      User = this.sequelize.define('User', {});
      Group = this.sequelize.define('Group', {});

      User.hasMany(Group, { counterCache: true });

      return this.sequelize.sync({ force: true });
    });

    it('increments', function() {
      return User.create().then(function(user) {
        expect(user.countGroups).to.equal(0);

        return user.createGroup().return (user);
      }).then(function(user) {
        return User.find(user.id);
      }).then(function(user) {
        expect(user.countGroups).to.equal(1);
      });
    });

    it('decrements', function() {
      var user;

      return User.create().then(function(tmpUser) {
        user = tmpUser;
        return user.createGroup();
      }).then(function(group) {
        return group.destroy();
      }).then(function() {
        return user.reload();
      }).then(function() {
        expect(user.countGroups).to.equal(0);
      });
    });

    it('works on update', function() {
      var user, otherUser;

      return User.create().then(function(tmpUser) {
        otherUser = tmpUser;

        return User.create();
      }).then(function(tmpUser) {
        user = tmpUser;
        return user.createGroup();
      }).tap(function() {
        return user.reload();
      }).tap(function() {
        expect(user.countGroups).to.equal(1);
      }).then(function(group) {
        group.UserId = otherUser.id;
        return group.save();
      }).then(function() {
        return Promise.all([user.reload(), otherUser.reload()]);
      }).then(function() {
        expect(user.countGroups).to.equal(0);
        expect(otherUser.countGroups).to.equal(1);
      });
    });
  });
});
