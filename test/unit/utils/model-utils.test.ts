import { expect } from 'chai';
import { isModelStatic, isSameInitialModel, Model } from '@sequelize/core';
import { sequelize } from '../../support';

describe('isModelStatic', () => {
  it('returns true for model subclasses', () => {
    const MyModel = sequelize.define('myModel', {});

    expect(isModelStatic(MyModel)).to.be.true;
  });

  it('returns false for model instances', () => {
    const MyModel = sequelize.define('myModel', {});

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
    const MyModel = sequelize.define('myModel', {}, {
      scopes: {
        scope1: {
          where: { id: 1 },
        },
      },
    });

    expect(
      isSameInitialModel(MyModel.withSchema('abc'), MyModel.withScope('scope1')),
    ).to.be.true;
  });

  it('returns false if the models are different', () => {
    const MyModel1 = sequelize.define('myModel1', {});

    const MyModel2 = sequelize.define('myModel2', {});

    expect(
      isSameInitialModel(MyModel1, MyModel2),
    ).to.be.false;
  });
});
