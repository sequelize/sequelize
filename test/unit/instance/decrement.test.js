import * as chai from 'chai';
import Support from '../support.js';
import sinon from 'sinon';

const expect = chai.expect;

const current = Support.sequelize;
const Sequelize = Support.Sequelize;

describe(Support.getTestDialectTeaser('Instance'), () => {
  describe('decrement', () => {
    describe('options tests', () => {
      let stub, instance;
      const Model = current.define('User', {
        id: {
          type: Sequelize.BIGINT,
          primaryKey: true,
          autoIncrement: true
        }
      });

      before(() => {
        stub = sinon.stub(current, 'query').returns(
          Promise.resolve({
            _previousDataValues: { id: 3 },
            dataValues: { id: 1 }
          })
        );
      });

      after(() => {
        stub.restore();
      });

      it('should allow decrements even if options are not given', () => {
        instance = Model.build({ id: 3 }, { isNewRecord: false });
        expect(() => {
          instance.decrement(['id']);
        }).to.not.throw();
      });
    });
  });
});
