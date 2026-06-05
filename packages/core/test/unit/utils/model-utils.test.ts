import Module from 'node:module';
import { Model, isModelStatic, isSameInitialModel } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { sequelize } from '../../support';

describe('isModelStatic', () => {
  it('returns true for model subclasses', () => {
    const MyModel = sequelize.define('MyModel', {});

    expect(isModelStatic(MyModel)).to.be.true;
  });

  it('does not re-require the Model class on every call (caches it)', () => {
    const MyModel = sequelize.define('MyModelCacheCheck', {});

    // Prime the cache: the very first call is allowed to require('../model').
    isModelStatic(MyModel);

    // Every require() goes through Module._load, including cache hits, so spying on it lets us
    // assert that no further resolution of the Model module happens once the class is cached.
    const loadSpy = sinon.spy(Module as unknown as { _load(...args: any[]): unknown }, '_load');

    try {
      for (let i = 0; i < 50; i++) {
        isModelStatic(MyModel);
      }
    } finally {
      loadSpy.restore();
    }

    const modelModuleLoads = loadSpy
      .getCalls()
      .filter(call => String(call.args[0]).endsWith('/model') || call.args[0] === '../model');

    expect(modelModuleLoads).to.have.length(0);
  });

  it('returns false for model instances', () => {
    const MyModel = sequelize.define('MyModel', {});

    expect(isModelStatic(MyModel.build())).to.be.false;
  });

  it('returns false for the Model class', () => {
    expect(isModelStatic(Model)).to.be.false;
  });

  it('returns false for the anything else', () => {
    expect(isModelStatic(Date)).to.be.false;
  });
});

describe('isSameInitialModel', () => {
  it('returns true if both models have the same initial model', () => {
    const MyModel = sequelize.define(
      'MyModel',
      {},
      {
        scopes: {
          scope1: {
            where: { id: 1 },
          },
        },
      },
    );

    expect(isSameInitialModel(MyModel.withSchema('abc'), MyModel.withScope('scope1'))).to.be.true;
  });

  it('returns false if the models are different', () => {
    const MyModel1 = sequelize.define('MyModel1', {});

    const MyModel2 = sequelize.define('MyModel2', {});

    expect(isSameInitialModel(MyModel1, MyModel2)).to.be.false;
  });
});
