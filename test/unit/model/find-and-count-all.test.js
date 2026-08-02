import * as chai from 'chai';
import Support from '../support.js';
import sinon from 'sinon';
import DataTypes from '../../../lib/data-types.js';

const expect = chai.expect;

const current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('findAndCount', () => {
    describe('should handle promise rejection', () => {
      before(function () {
        this.stub = sinon.stub();
        this.unhandledListener = () => this.stub();
        process.on('unhandledRejection', this.unhandledListener);

        this.User = current.define('User', {
          username: DataTypes.STRING,
          age: DataTypes.INTEGER
        });

        this.findAll = sinon.stub(this.User, 'findAll').callsFake(() => {
          return Promise.reject(new Error());
        });

        this.count = sinon.stub(this.User, 'count').callsFake(() => {
          return Promise.reject(new Error());
        });
      });

      after(function () {
        process.removeListener('unhandledRejection', this.unhandledListener);
        this.findAll.resetBehavior();
        this.count.resetBehavior();
      });

      it('with errors in count and findAll both', function () {
        return this.User.findAndCount({})
          .then(() => {
            throw new Error();
          })
          .catch(() => {
            expect(this.stub.callCount).to.eql(0);
          });
      });
    });
  });
});
