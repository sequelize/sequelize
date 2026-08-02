import * as chai from 'chai';
import Support from '../support.js';
import sinon from 'sinon';

const expect = chai.expect;

const current = Support.sequelize;
const Sequelize = Support.Sequelize;

describe(Support.getTestDialectTeaser('Instance'), () => {
  describe('restore', () => {
    describe('options tests', () => {
      let stub, instance;
      const Model = current.define(
        'User',
        {
          id: {
            type: Sequelize.BIGINT,
            primaryKey: true,
            autoIncrement: true
          },
          deletedAt: {
            type: Sequelize.DATE
          }
        },
        {
          paranoid: true
        }
      );

      before(() => {
        stub = sinon.stub(current, 'query').returns(
          Promise.resolve([
            {
              _previousDataValues: { id: 1 },
              dataValues: { id: 2 }
            },
            1
          ])
        );
      });

      after(() => {
        stub.restore();
      });

      it('should allow restores even if options are not given', () => {
        instance = Model.build({ id: 1 }, { isNewRecord: false });
        expect(() => {
          instance.restore();
        }).to.not.throw();
      });
    });
  });
});
