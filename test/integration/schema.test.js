'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('./support'),
  DataTypes = require('sequelize/lib/data-types');

describe(Support.getTestDialectTeaser('Schema'), () => {
  beforeEach(async function() {
    await this.sequelize.createSchema('testschema');
  });

  afterEach(async function() {
    await this.sequelize.dropSchema('testschema');
  });

  beforeEach(async function() {
    this.User = this.sequelize.define('User', {
      aNumber: { type: DataTypes.INTEGER }
    }, {
      schema: 'testschema'
    });

    await this.User.sync({ force: true });
  });

  it('supports increment', async function() {
    const user0 = await this.User.create({ aNumber: 1 });
    const result = await user0.increment('aNumber', { by: 3 });
    const user = await result.reload();
    expect(user).to.be.ok;
    expect(user.aNumber).to.be.equal(4);
  });

  it('supports decrement', async function() {
    const user0 = await this.User.create({ aNumber: 10 });
    const result = await user0.decrement('aNumber', { by: 3 });
    const user = await result.reload();
    expect(user).to.be.ok;
    expect(user.aNumber).to.be.equal(7);
  });
});
