import * as chai from 'chai';
import sinon from 'sinon';
import Support from '../support.js';
import DataTypes from '../../../lib/data-types.js';

const expect = chai.expect;

const current = Support.sequelize;

describe(Support.getTestDialectTeaser('Instance'), () => {
  describe('get', () => {
    beforeEach(function () {
      this.getSpy = sinon.spy();
      this.User = current.define('User', {
        name: {
          type: DataTypes.STRING,
          get: this.getSpy
        }
      });
    });

    it('invokes getter if raw: false', function () {
      this.User.build().get('name');

      expect(this.getSpy.called, 'this.getSpy should have been called').to.be.true;
    });

    it('does not invoke getter if raw: true', function () {
      expect(this.getSpy.called, 'this.getSpy should not have been called').to.be.false;
    });
  });
});
