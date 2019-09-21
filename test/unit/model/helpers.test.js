'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('../support');
const current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('hasAlias', () => {
    beforeEach(function() {
      this.User = current.define('user');
      this.Task = current.define('task');
    });

    it('returns true if a model has an association with the specified alias', function() {
      this.Task.belongsTo(this.User, { as: 'owner' });
      expect(this.Task.hasAlias('owner')).to.equal(true);
    });

    it('returns false if a model does not have an association with the specified alias', function() {
      this.Task.belongsTo(this.User, { as: 'owner' });
      expect(this.Task.hasAlias('notOwner')).to.equal(false);
    });
  });
});
