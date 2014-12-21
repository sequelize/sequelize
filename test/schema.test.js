'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/support')
  , DataTypes = require(__dirname + '/../lib/data-types');

chai.config.includeStack = true;

describe(Support.getTestDialectTeaser('Schema'), function() {
  beforeEach(function() {
    return this.sequelize.createSchema('testschema');
  });

  afterEach(function() {
    return this.sequelize.dropSchema('testschema');
  });

  beforeEach(function() {
    this.User = this.sequelize.define('User', {
      aNumber: { type: DataTypes.INTEGER }
    }, {
      schema: 'testschema'
    });

   return this.User.sync({ force: true });
  });

  it('supports increment', function() {
    return this.User.create({ aNumber: 1 }).then(function(user) {
      return user.increment('aNumber', { by: 3 });
    }).then(function(result) {
      return result.reload();
    }).then(function(user) {
      expect(user).to.be.ok;
      expect(user.aNumber).to.be.equal(4);
    });
  });

  it('supports decrement', function() {
    return this.User.create({ aNumber: 10 }).then(function(user) {
      return user.decrement('aNumber', { by: 3 });
    }).then(function(result) {
      return result.reload();
    }).then(function(user) {
      expect(user).to.be.ok;
      expect(user.aNumber).to.be.equal(7);
    });
  });
});
