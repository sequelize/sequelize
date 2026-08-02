import * as chai from 'chai';
import Support from '../support.js';
import sinon from 'sinon';

const expect = chai.expect;

const current = Support.sequelize;
const Sequelize = Support.Sequelize;

describe(Support.getTestDialectTeaser('Instance'), () => {
  describe('save', () => {
    it('should disallow saves if no primary key values is present', () => {
      const Model = current.define('User', {}),
        instance = Model.build({}, { isNewRecord: false });

      return expect(instance.save()).to.be.rejected;
    });

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
          Promise.resolve([
            {
              _previousDataValues: {},
              dataValues: { id: 1 }
            },
            1
          ])
        );
      });

      after(() => {
        stub.restore();
      });

      it('should allow saves even if options are not given', () => {
        instance = Model.build({});
        expect(() => {
          instance.save();
        }).to.not.throw();
      });
    });
  });
});
