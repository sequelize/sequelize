'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const current = Support.sequelize;
const { DataTypes } = require('@sequelize/core');

describe(Support.getTestDialectTeaser('Instance'), () => {
  describe('equals', () => {
    beforeEach(function () {
      this.User = current.define('EqualsUser', {
        username: DataTypes.STRING,
      });

      this.Project = current.define('EqualsProject', {
        title: DataTypes.STRING,
      });
    });

    it('returns true when comparing the same model instance to itself', function () {
      const user = this.User.build({ id: 1, username: 'alice' });
      expect(user.equals(user)).to.be.true;
    });

    it('returns true when two instances of the same model share the same primary key', function () {
      const user1 = this.User.build({ id: 1, username: 'alice' });
      const user2 = this.User.build({ id: 1, username: 'alice' });
      expect(user1.equals(user2)).to.be.true;
    });

    it('returns false when two instances of the same model have different primary keys', function () {
      const user1 = this.User.build({ id: 1, username: 'alice' });
      const user2 = this.User.build({ id: 2, username: 'alice' });
      expect(user1.equals(user2)).to.be.false;
    });

    it('returns false when comparing instances of different models, even with the same primary key', function () {
      // Regression: this.modelDefinition was incorrectly used for both sides,
      // making the model-type guard always pass (always equal).
      // See: https://github.com/sequelize/sequelize/issues/494
      //      https://github.com/sequelize/sequelize/pull/5605
      const user = this.User.build({ id: 1 });
      const project = this.Project.build({ id: 1 });
      expect(user.equals(project)).to.be.false;
    });

    it('returns false when comparing to a non-Model value', function () {
      const user = this.User.build({ id: 1 });
      expect(user.equals(null)).to.be.false;
      expect(user.equals(undefined)).to.be.false;
      expect(user.equals({ id: 1 })).to.be.false;
    });
  });
});
