'use strict';

const { expect } = require('chai');
const Support = require('../../support');
const { DataTypes } = require('@sequelize/core');

const dialect = Support.getTestDialect();

describe('[MariaDB Specific] DAO', () => {
  if (dialect !== 'mariadb') {
    return;
  }

  beforeEach(async function () {
    this.User = this.sequelize.define('User', {
      username: DataTypes.STRING,
      email: DataTypes.STRING,
      location: DataTypes.GEOMETRY(),
    });

    await this.User.sync({ force: true });
  });

  describe('integers', () => {
    describe('integer', () => {
      beforeEach(async function () {
        this.User = this.sequelize.define('User', {
          aNumber: DataTypes.INTEGER,
        });

        await this.User.sync({ force: true });
      });

      it('positive', async function () {
        const User = this.User;

        const user = await User.create({ aNumber: 2_147_483_647 });
        expect(user.aNumber).to.equal(2_147_483_647);
        const _user = await User.findOne({ where: { aNumber: 2_147_483_647 } });
        expect(_user.aNumber).to.equal(2_147_483_647);
      });

      it('negative', async function () {
        const User = this.User;

        const user = await User.create({ aNumber: -2_147_483_647 });
        expect(user.aNumber).to.equal(-2_147_483_647);
        const _user = await User.findOne({ where: { aNumber: -2_147_483_647 } });
        expect(_user.aNumber).to.equal(-2_147_483_647);
      });
    });

    describe('bigint', () => {
      beforeEach(async function () {
        this.User = this.sequelize.define('User', {
          aNumber: DataTypes.BIGINT,
        });

        await this.User.sync({ force: true });
      });

      it('positive', async function () {
        const User = this.User;

        const user = await User.create({ aNumber: '9223372036854775807' });
        expect(user.aNumber).to.equal('9223372036854775807');
        const _user = await User.findOne({ where: { aNumber: '9223372036854775807' } });

        await expect(_user.aNumber.toString()).to.equal('9223372036854775807');
      });

      it('negative', async function () {
        const User = this.User;

        const user = await User.create({ aNumber: '-9223372036854775807' });
        expect(user.aNumber).to.equal('-9223372036854775807');

        const _user = await User.findOne({ where: { aNumber: '-9223372036854775807' } });

        await expect(_user.aNumber.toString()).to.equal('-9223372036854775807');
      });
    });
  });

  it('should save geometry correctly', async function () {
    const point = { type: 'Point', coordinates: [39.807_222, -76.984_722] };

    const newUser = await this.User.create({
      username: 'user',
      email: 'foo@bar.com',
      location: point,
    });

    expect(newUser.location).to.deep.eql(point);
  });

  it('should update geometry correctly', async function () {
    const User = this.User;
    const point1 = { type: 'Point', coordinates: [39.807_222, -76.984_722] };
    const point2 = { type: 'Point', coordinates: [39.828_333, -77.232_222] };

    const oldUser = await User.create({
      username: 'user',
      email: 'foo@bar.com',
      location: point1,
    });

    await User.update({ location: point2 }, { where: { username: oldUser.username } });

    const updatedUser = await User.findOne({ where: { username: oldUser.username } });
    expect(updatedUser.location).to.deep.eql(point2);
  });

  it('should read geometry correctly', async function () {
    const User = this.User;
    const point = { type: 'Point', coordinates: [39.807_222, -76.984_722] };

    const user0 = await User.create({ username: 'user', email: 'foo@bar.com', location: point });

    const user = await User.findOne({ where: { username: user0.username } });
    expect(user.location).to.deep.eql(point);
  });
});
