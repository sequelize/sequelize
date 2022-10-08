'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support   = require('../support');

const current   = Support.sequelize;
const { DataTypes } = require('@sequelize/core');
const sinon     = require('sinon');

describe(Support.getTestDialectTeaser('Instance'), () => {
  describe('save', () => {
    it('should disallow saves if no primary key values is present', async () => {
      const Model = current.define('User', {});
      const instance = Model.build({}, { isNewRecord: false });

      await expect(instance.save()).to.be.rejected;
    });

    it('should disallow updates if no primary key values is present', async () => {
      const Model = current.define('User', {});
      const instance = Model.build({}, { isNewRecord: false });

      await expect(instance.update()).to.be.rejected;
    });

    describe('options tests', () => {
      let stub;
      let instance;
      const Model = current.define('User', {
        id: {
          type: DataTypes.BIGINT,
          primaryKey: true,
          autoIncrement: true,
        },
      });

      before(() => {
        stub = sinon.stub(current, 'queryRaw').resolves(
          [{
            _previousDataValues: {},
            dataValues: { id: 1 },
          }, 1],
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
