'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  dialect = Support.getTestDialect(),
  DataTypes = require('../../../../lib/data-types');

if (dialect !== 'mariadb') return;
describe('[MariaDB Specific] DAO', () => {
  beforeEach(function() {
    this.sequelize.options.quoteIdentifiers = true;
    this.User = this.sequelize.define('User', {
      username: DataTypes.STRING,
      email: DataTypes.STRING,
      location: DataTypes.GEOMETRY()
    });
    return this.User.sync({ force: true });
  });

  afterEach(function() {
    this.sequelize.options.quoteIdentifiers = true;
  });

  describe('integers', () => {
    describe('integer', () => {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          aNumber: DataTypes.INTEGER
        });

        return this.User.sync({ force: true });
      });

      it('positive', function() {
        const User = this.User;

        return User.create({ aNumber: 2147483647 }).then(user => {
          expect(user.aNumber).to.equal(2147483647);
          return User.findOne({ where: { aNumber: 2147483647 } }).then(_user => {
            expect(_user.aNumber).to.equal(2147483647);
          });
        });
      });

      it('negative', function() {
        const User = this.User;

        return User.create({ aNumber: -2147483647 }).then(user => {
          expect(user.aNumber).to.equal(-2147483647);
          return User.findOne({ where: { aNumber: -2147483647 } }).then(_user => {
            expect(_user.aNumber).to.equal(-2147483647);
          });
        });
      });
    });

    describe('bigint', () => {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          aNumber: DataTypes.BIGINT
        });

        return this.User.sync({ force: true });
      });

      it('positive', function() {
        const User = this.User;

        return User.create({ aNumber: '9223372036854775807' }).then(user => {
          expect(user.aNumber).to.equal('9223372036854775807');
          return User.findOne({ where: { aNumber: '9223372036854775807' } }).then(
            _user => {
              return expect(_user.aNumber.toString()).to.equal(
                '9223372036854775807');
            });
        });
      });

      it('negative', function() {
        const User = this.User;

        return User.create({ aNumber: '-9223372036854775807' }).then(user => {
          expect(user.aNumber).to.equal('-9223372036854775807');
          return User.findOne(
            { where: { aNumber: '-9223372036854775807' } }).then(_user => {
            return expect(_user.aNumber.toString()).to.equal(
              '-9223372036854775807');
          });
        });
      });
    });
  });

  it('should save geometry correctly', function() {
    const point = { type: 'Point', coordinates: [39.807222, -76.984722] };
    return this.User.create(
      { username: 'user', email: 'foo@bar.com', location: point }).then(
      newUser => {
        expect(newUser.location).to.deep.eql(point);
      });
  });

  it('should update geometry correctly', function() {
    const User = this.User;
    const point1 = { type: 'Point', coordinates: [39.807222, -76.984722] };
    const point2 = { type: 'Point', coordinates: [39.828333, -77.232222] };
    return User.create(
      { username: 'user', email: 'foo@bar.com', location: point1 })
      .then(oldUser => {
        return User.update({ location: point2 },
          { where: { username: oldUser.username } })
          .then(() => {
            return User.findOne({ where: { username: oldUser.username } });
          })
          .then(updatedUser => {
            expect(updatedUser.location).to.deep.eql(point2);
          });
      });
  });

  it('should read geometry correctly', function() {
    const User = this.User;
    const point = { type: 'Point', coordinates: [39.807222, -76.984722] };

    return User.create(
      { username: 'user', email: 'foo@bar.com', location: point }).then(
      user => {
        return User.findOne({ where: { username: user.username } });
      }).then(user => {
      expect(user.location).to.deep.eql(point);
    });
  });

});

