import * as chai from 'chai';
import Support from '../support.js';
import sinon from 'sinon';
import DataTypes from '../../../lib/data-types.js';
import _ from 'lodash';

const expect = chai.expect;

const current = Support.sequelize;

const Promise = current.Promise;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('method destroy', () => {
    const User = current.define('User', {
      name: DataTypes.STRING,
      secretValue: DataTypes.INTEGER
    });

    before(function () {
      this.stubDelete = sinon.stub(current.getQueryInterface(), 'bulkDelete').callsFake(() => {
        return Promise.resolve([]);
      });
    });

    beforeEach(function () {
      this.deloptions = { where: { secretValue: '1' } };
      this.cloneOptions = _.clone(this.deloptions);
      this.stubDelete.resetHistory();
    });

    afterEach(function () {
      delete this.deloptions;
      delete this.cloneOptions;
    });

    after(function () {
      this.stubDelete.restore();
    });

    it('can detect complexe objects', function () {
      const Where = function () {
        this.secretValue = '1';
      };

      return expect(User.destroy({ where: new Where() })).to.be.rejected;
    });
  });
});
