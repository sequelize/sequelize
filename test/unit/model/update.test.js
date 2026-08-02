import * as chai from 'chai';
import Support from '../support.js';
import sinon from 'sinon';
import DataTypes from '../../../lib/data-types.js';
import _ from 'lodash';

const expect = chai.expect;

const current = Support.sequelize;

const Promise = current.Promise;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('method update', () => {
    before(function () {
      this.User = current.define('User', {
        name: DataTypes.STRING,
        secretValue: DataTypes.INTEGER
      });
    });

    beforeEach(function () {
      this.stubUpdate = sinon.stub(current.getQueryInterface(), 'bulkUpdate').returns(Promise.resolve([]));
      this.updates = { name: 'Batman', secretValue: '7' };
      this.cloneUpdates = _.clone(this.updates);
    });

    afterEach(function () {
      this.stubUpdate.restore();
    });

    afterEach(function () {
      delete this.updates;
      delete this.cloneUpdates;
    });

    describe('properly clones input values', () => {
      it('with default options', function () {
        return this.User.update(this.updates, { where: { secretValue: '1' } }).then(() => {
          expect(this.updates).to.be.deep.eql(this.cloneUpdates);
        });
      });

      it('when using fields option', function () {
        return this.User.update(this.updates, { where: { secretValue: '1' }, fields: ['name'] }).then(() => {
          expect(this.updates).to.be.deep.eql(this.cloneUpdates);
        });
      });
    });

    it('can detect complexe objects', function () {
      const Where = function () {
        this.secretValue = '1';
      };

      return expect(this.User.update(this.updates, { where: new Where() })).to.be.rejected;
    });
  });
});
