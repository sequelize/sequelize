'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  dialect = Support.getTestDialect(),
  DataTypes = require('sequelize/lib/data-types');

if (dialect !== 'mariadb') return;
describe('[MariaDB Specific] DAO', () => {
  beforeEach(async function() {
    this.sequelize.options.quoteIdentifiers = true;
    this.User = this.sequelize.define('User', {
      username: DataTypes.STRING,
      email: DataTypes.STRING,
      location: DataTypes.GEOMETRY()
    });
    await this.User.sync({ force: true });
  });

  afterEach(function() {
    this.sequelize.options.quoteIdentifiers = true;
  });

  describe('integers', () => {
    describe('integer', () => {
      beforeEach(async function() {
        this.User = this.sequelize.define('User', {
          aNumber: DataTypes.INTEGER
        });

        await this.User.sync({ force: true });
      });

      it('positive', async function() {
        const User = this.User;

        const user = await User.create({ aNumber: 2147483647 });
        expect(user.aNumber).to.equal(2147483647);
        const _user = await User.findOne({ where: { aNumber: 2147483647 } });
        expect(_user.aNumber).to.equal(2147483647);
      });

      it('negative', async function() {
        const User = this.User;

        const user = await User.create({ aNumber: -2147483647 });
        expect(user.aNumber).to.equal(-2147483647);
        const _user = await User.findOne({ where: { aNumber: -2147483647 } });
        expect(_user.aNumber).to.equal(-2147483647);
      });
    });

    describe('bigint', () => {
      beforeEach(async function() {
        this.User = this.sequelize.define('User', {
          aNumber: DataTypes.BIGINT
        });

        await this.User.sync({ force: true });
      });

      it('positive', async function() {
        const User = this.User;

        const user = await User.create({ aNumber: '9223372036854775807' });
        expect(user.aNumber).to.equal('9223372036854775807');
        const _user = await User.findOne({ where: { aNumber: '9223372036854775807' } });

        await expect(_user.aNumber.toString()).to.equal('9223372036854775807');
      });

      it('negative', async function() {
        const User = this.User;

        const user = await User.create({ aNumber: '-9223372036854775807' });
        expect(user.aNumber).to.equal('-9223372036854775807');

        const _user = await User.findOne(
          { where: { aNumber: '-9223372036854775807' } });

        await expect(_user.aNumber.toString()).to.equal('-9223372036854775807');
      });
    });
  });

  it('should save geometry correctly', async function() {
    const point = { type: 'Point', coordinates: [39.807222, -76.984722] };

    const newUser = await this.User.create(
      { username: 'user', email: 'foo@bar.com', location: point });

    expect(newUser.location).to.deep.eql(point);
  });

  it('should update geometry correctly', async function() {
    const User = this.User;
    const point1 = { type: 'Point', coordinates: [39.807222, -76.984722] };
    const point2 = { type: 'Point', coordinates: [39.828333, -77.232222] };

    const oldUser = await User.create(
      { username: 'user', email: 'foo@bar.com', location: point1 });

    await User.update({ location: point2 },
      { where: { username: oldUser.username } });

    const updatedUser = await User.findOne({ where: { username: oldUser.username } });
    expect(updatedUser.location).to.deep.eql(point2);
  });

  it('should read geometry correctly', async function() {
    const User = this.User;
    const point = { type: 'Point', coordinates: [39.807222, -76.984722] };

    const user0 = await User.create(
      { username: 'user', email: 'foo@bar.com', location: point });

    const user = await User.findOne({ where: { username: user0.username } });
    expect(user.location).to.deep.eql(point);
  });

});

