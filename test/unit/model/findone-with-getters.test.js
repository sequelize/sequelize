'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('../support');
const current = Support.sequelize;
const sinon = require('sinon');
const DataTypes = require('../../../lib/data-types');
const { Logger } = require('../../../lib/utils/logger');
const sequelizeErrors = require('../../../lib/errors');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('method findAll with getters', () => {
    const Model = current.define('model', {
      name: DataTypes.STRING,
      age: {
        type: DataTypes.INTEGER,
        get() {
          const rawValue = this.getDataValue('age');
          return rawValue + 1;
        }
      }
    }, { timestamps: false });

    before(function() {
      this.stub = sinon.stub(current.getQueryInterface(), 'select').callsFake(() => Model.build({
        name: 'test',
        age: 33
      }));
      this.warnOnInvalidOptionsStub = sinon.stub(Model, 'warnOnInvalidOptions');
    });

    beforeEach(function() {
      this.stub.resetHistory();
      this.warnOnInvalidOptionsStub.resetHistory();
    });

    after(function() {
      this.stub.restore();
      this.warnOnInvalidOptionsStub.restore();
    });

    describe('attributes sort', () => {
      it('show return the correct sort', async function() {
        const data = await Model.findAll();

        expect(Object.keys(JSON.parse(JSON.stringify(data)))).to.deep.equal([
          'id',
          'name',
          'age'
        ]);
      });

    });
  });
});
