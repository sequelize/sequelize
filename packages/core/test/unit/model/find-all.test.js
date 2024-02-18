'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const current = Support.sequelize;
const sinon = require('sinon');
const { DataTypes, QueryError } = require('@sequelize/core');
const { Logger } = require('@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js');
const { beforeAll2 } = require('../../support');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('_warnOnInvalidOptions', () => {
    beforeEach(function () {
      this.loggerSpy = sinon.spy(Logger.prototype, 'warn');
    });

    afterEach(function () {
      this.loggerSpy.restore();
    });

    it('Warns the user if they use a model attribute without a where clause', function () {
      const User = current.define('User', { firstName: 'string' });
      User._warnOnInvalidOptions({ firstName: 12, order: [] }, ['firstName']);
      const expectedError =
        'Model attributes (firstName) passed into finder method options of model User, but the options.where object is empty. Did you forget to use options.where?';
      expect(this.loggerSpy.calledWith(expectedError)).to.equal(true);
    });

    it('Does not warn the user if they use a model attribute without a where clause that shares its name with a query option', function () {
      const User = current.define('User', { order: 'string' });
      User._warnOnInvalidOptions({ order: [] }, ['order']);
      expect(this.loggerSpy.called).to.equal(false);
    });

    it('Does not warn the user if they use valid query options', function () {
      const User = current.define('User', { order: 'string' });
      User._warnOnInvalidOptions({ where: { order: 1 }, order: [] });
      expect(this.loggerSpy.called).to.equal(false);
    });
  });

  describe('method findAll', () => {
    const vars = beforeAll2(() => {
      const MyModel = current.define(
        'MyModel',
        {
          name: DataTypes.STRING,
        },
        { timestamps: false },
      );

      return { MyModel };
    });

    before(function () {
      const { MyModel } = vars;

      this.stub = sinon.stub(current.queryInterface, 'select').callsFake(() => MyModel.build({}));
      this._warnOnInvalidOptionsStub = sinon.stub(MyModel, '_warnOnInvalidOptions');
    });

    beforeEach(function () {
      this.stub.resetHistory();
      this._warnOnInvalidOptionsStub.resetHistory();
    });

    after(function () {
      this.stub.restore();
      this._warnOnInvalidOptionsStub.restore();
    });

    describe('handles input validation', () => {
      it('calls _warnOnInvalidOptions', function () {
        const { MyModel } = vars;

        MyModel.findAll();
        expect(this._warnOnInvalidOptionsStub.calledOnce).to.equal(true);
      });

      it('Throws an error when the attributes option is formatted incorrectly', async () => {
        const { MyModel } = vars;

        await expect(MyModel.findAll({ attributes: 'name' })).to.be.rejectedWith(QueryError);
      });
    });

    describe('attributes include / exclude', () => {
      it('allows me to include additional attributes', async function () {
        const { MyModel } = vars;

        await MyModel.findAll({
          attributes: {
            include: ['foobar'],
          },
        });

        expect(this.stub.getCall(0).args[2].attributes).to.deep.equal(['id', 'name', 'foobar']);
      });

      it('allows me to exclude attributes', async function () {
        const { MyModel } = vars;

        await MyModel.findAll({
          attributes: {
            exclude: ['name'],
          },
        });

        expect(this.stub.getCall(0).args[2].attributes).to.deep.equal(['id']);
      });

      it('include takes precendence over exclude', async function () {
        const { MyModel } = vars;

        await MyModel.findAll({
          attributes: {
            exclude: ['name'],
            include: ['name'],
          },
        });

        expect(this.stub.getCall(0).args[2].attributes).to.deep.equal(['id', 'name']);
      });

      it('works for models without PK #4607', async function () {
        const MyModel = current.define('model', {}, { timestamps: false });
        const Foo = current.define('foo');
        MyModel.hasOne(Foo);

        MyModel.removeAttribute('id');

        await MyModel.findAll({
          attributes: {
            include: ['name'],
          },
          include: [Foo],
        });

        expect(this.stub.getCall(0).args[2].attributes).to.deep.equal(['name']);
      });
    });
  });
});
