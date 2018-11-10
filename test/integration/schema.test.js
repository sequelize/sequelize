'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/support'),
  DataTypes = require(__dirname + '/../../lib/data-types');

describe(Support.getTestDialectTeaser('Schema'), () => {
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
    return this.User.create({ aNumber: 1 }).then(user => {
      return user.increment('aNumber', { by: 3 });
    }).then(result => {
      return result.reload();
    }).then(user => {
      expect(user).to.be.ok;
      expect(user.aNumber).to.be.equal(4);
    });
  });

  it('supports decrement', function() {
    return this.User.create({ aNumber: 10 }).then(user => {
      return user.decrement('aNumber', { by: 3 });
    }).then(result => {
      return result.reload();
    }).then(user => {
      expect(user).to.be.ok;
      expect(user.aNumber).to.be.equal(7);
    });
  });
});
