import { DataTypes, QueryError } from '@sequelize/core';
import { Logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';
import { expect } from 'chai';
import type { SinonSpy, SinonStub } from 'sinon';
import sinon from 'sinon';
import { beforeAll2, sequelize } from '../../support';

// _warnOnInvalidOptions is a private method that is not part of the typings
interface PrivateModelStatic {
  _warnOnInvalidOptions(options: object, validColumnNames?: string[]): void;
}

describe('Model._warnOnInvalidOptions', () => {
  let loggerSpy: SinonSpy;
  beforeEach(() => {
    loggerSpy = sinon.spy(Logger.prototype, 'warn');
  });

  afterEach(() => {
    loggerSpy.restore();
  });

  it('Warns the user if they use a model attribute without a where clause', () => {
    const User = sequelize.define('User', { firstName: 'string' });
    (User as unknown as PrivateModelStatic)._warnOnInvalidOptions({ firstName: 12, order: [] }, [
      'firstName',
    ]);
    const expectedError =
      'Model attributes (firstName) passed into finder method options of model User, but the options.where object is empty. Did you forget to use options.where?';
    expect(loggerSpy.calledWith(expectedError)).to.equal(true);
  });

  it('Does not warn the user if they use a model attribute without a where clause that shares its name with a query option', () => {
    const User = sequelize.define('User', { order: 'string' });
    (User as unknown as PrivateModelStatic)._warnOnInvalidOptions({ order: [] }, ['order']);
    expect(loggerSpy.called).to.equal(false);
  });

  it('Does not warn the user if they use valid query options', () => {
    const User = sequelize.define('User', { order: 'string' });
    (User as unknown as PrivateModelStatic)._warnOnInvalidOptions({
      where: { order: 1 },
      order: [],
    });
    expect(loggerSpy.called).to.equal(false);
  });
});

describe('Model.findAll', () => {
  const vars = beforeAll2(() => {
    const MyModel = sequelize.define(
      'MyModel',
      {
        name: DataTypes.STRING,
      },
      { timestamps: false },
    );

    return { MyModel };
  });

  let stub: SinonStub;
  let _warnOnInvalidOptionsStub: SinonStub;
  before(() => {
    const { MyModel } = vars;

    stub = sinon.stub(sequelize.queryInterface, 'select').resolves([]);
    _warnOnInvalidOptionsStub = sinon.stub(
      MyModel as unknown as PrivateModelStatic,
      '_warnOnInvalidOptions',
    );
  });

  beforeEach(() => {
    stub.resetHistory();
    _warnOnInvalidOptionsStub.resetHistory();
  });

  after(() => {
    stub.restore();
    _warnOnInvalidOptionsStub.restore();
  });

  describe('handles input validation', () => {
    it('calls _warnOnInvalidOptions', async () => {
      const { MyModel } = vars;

      await MyModel.findAll();
      expect(_warnOnInvalidOptionsStub.calledOnce).to.equal(true);
    });

    it('Throws an error when the attributes option is formatted incorrectly', async () => {
      const { MyModel } = vars;

      // @ts-expect-error -- testing that an invalid attributes option is rejected
      await expect(MyModel.findAll({ attributes: 'name' })).to.be.rejectedWith(QueryError);
    });
  });

  describe('attributes include / exclude', () => {
    it('allows me to include additional attributes', async () => {
      const { MyModel } = vars;

      await MyModel.findAll({
        attributes: {
          include: ['foobar'],
        },
      });

      expect(stub.getCall(0).args[2].attributes).to.deep.equal(['id', 'name', 'foobar']);
    });

    it('allows me to exclude attributes', async () => {
      const { MyModel } = vars;

      await MyModel.findAll({
        attributes: {
          exclude: ['name'],
        },
      });

      expect(stub.getCall(0).args[2].attributes).to.deep.equal(['id']);
    });

    it('include takes precendence over exclude', async () => {
      const { MyModel } = vars;

      await MyModel.findAll({
        attributes: {
          exclude: ['name'],
          include: ['name'],
        },
      });

      expect(stub.getCall(0).args[2].attributes).to.deep.equal(['id', 'name']);
    });

    it('works for models without PK #4607', async () => {
      const MyModel = sequelize.define('model', {}, { timestamps: false });
      const Foo = sequelize.define('foo');
      MyModel.hasOne(Foo);

      MyModel.removeAttribute('id');

      await MyModel.findAll({
        attributes: {
          include: ['name'],
        },
        include: [Foo],
      });

      expect(stub.getCall(0).args[2].attributes).to.deep.equal(['name']);
    });
  });
});
