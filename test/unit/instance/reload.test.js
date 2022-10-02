'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support   = require('../support');

const current   = Support.sequelize;
const { DataTypes } = require('@sequelize/core');
const sinon     = require('sinon');

describe('Instance', () => {
  describe('reload', () => {
    describe('options tests', () => {
      let stub; let instance;
      const Model = current.define('User', {
        id: {
          type: DataTypes.BIGINT,
          primaryKey: true,
          autoIncrement: true,
        },
        deletedAt: {
          type: DataTypes.DATE,
        },
      }, {
        paranoid: true,
      });

      before(() => {
        stub = sinon.stub(current, 'queryRaw').resolves(
          {
            _previousDataValues: { id: 1 },
            dataValues: { id: 2 },
          },
        );
      });

      after(() => {
        stub.restore();
      });

      it('should allow reloads even if options are not given', () => {
        instance = Model.build({ id: 1 }, { isNewRecord: false });
        expect(() => {
          instance.reload();
        }).to.not.throw();
      });
    });
  });
});
