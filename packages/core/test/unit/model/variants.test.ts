import { DataTypes, literal } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { beforeEach2, sequelize } from '../../support';

describe('Model.getInitialModel', () => {
  it('always returns the initial model', () => {
    const User = sequelize.define(
      'User',
      {},
      {
        scopes: {
          scope1: {
            where: literal(''),
          },
        },
      },
    );

    expect(User.withSchema('abc').getInitialModel()).to.eq(User);
    expect(User.withSchema('abc').withScope('scope1').getInitialModel()).to.eq(User);
    expect(User.withScope('scope1').getInitialModel()).to.eq(User);
  });
});

describe('Model variant hooks', () => {
  const vars = beforeEach2(() => {
    const defineTimeHook = sinon.spy();

    const User = sequelize.define(
      'User',
      { name: DataTypes.STRING },
      {
        scopes: {
          scope1: {
            where: { name: 'abc' },
          },
        },
        hooks: {
          beforeFind: defineTimeHook,
        },
      },
    );

    return { User, defineTimeHook };
  });

  let selectStub: sinon.SinonStub;
  beforeEach(() => {
    selectStub = sinon.stub(sequelize.queryInterface, 'select').resolves([]);
  });

  afterEach(() => {
    selectStub.restore();
  });

  function getVariants() {
    const { User } = vars;

    return {
      withScope: User.withScope('scope1'),
      withoutScope: User.withoutScope(),
      withSchema: User.withSchema('abc'),
      'withSchema + withScope': User.withSchema('abc').withScope('scope1'),
    };
  }

  it('runs listeners added to the initial model before the variant was created', async () => {
    const { User } = vars;

    const listener = sinon.spy();
    User.hooks.addListener('beforeFind', listener);

    for (const [name, variant] of Object.entries(getVariants())) {
      listener.resetHistory();
      // eslint-disable-next-line no-await-in-loop
      await variant.findAll();
      expect(listener.callCount).to.eq(1, name);
    }
  });

  it('runs listeners added to the initial model after the variant was created', async () => {
    const { User } = vars;

    const variants = getVariants();

    const listener = sinon.spy();
    User.beforeFind(listener);

    for (const [name, variant] of Object.entries(variants)) {
      listener.resetHistory();
      // eslint-disable-next-line no-await-in-loop
      await variant.findAll();
      expect(listener.callCount).to.eq(1, name);
    }
  });

  it('runs hooks defined in the model options once', async () => {
    const { defineTimeHook } = vars;

    for (const [name, variant] of Object.entries(getVariants())) {
      defineTimeHook.resetHistory();
      // eslint-disable-next-line no-await-in-loop
      await variant.findAll();
      expect(defineTimeHook.callCount).to.eq(1, name);
    }
  });

  it('shares listeners added or removed through a variant with the initial model', async () => {
    const { User } = vars;

    const variant = User.withScope('scope1');
    const listener = sinon.spy();
    variant.addHook('beforeFind', 'myListener', listener);

    await User.findAll();
    expect(listener.callCount).to.eq(1);

    User.withoutScope().removeHook('beforeFind', 'myListener');

    await User.findAll();
    await variant.findAll();
    expect(listener.callCount).to.eq(1);
  });

  it('does not run the beforeDefine and afterDefine hooks for variants', async () => {
    const beforeDefine = sinon.spy();
    const pluginListener = sinon.spy();
    const removeBeforeDefine = sequelize.hooks.addListener('beforeDefine', beforeDefine);
    const removeAfterDefine = sequelize.hooks.addListener('afterDefine', model => {
      model.hooks.addListener('beforeFind', pluginListener, 'plugin');
    });

    try {
      const Project = sequelize.define('Project', {}, { scopes: { scope1: {} } });
      const variants = [
        Project.withScope('scope1'),
        Project.withoutScope(),
        Project.withSchema('abc'),
      ];

      expect(beforeDefine.callCount).to.eq(1);

      await variants[0].findAll();
      expect(pluginListener.callCount).to.eq(1);
    } finally {
      removeBeforeDefine();
      removeAfterDefine();
    }
  });

  it('updates the attribute getters & setters of variants when their definition is refreshed', () => {
    const { User } = vars;

    const Project = sequelize.define('Project', {});
    const ScopedUser = User.withScope('scope1');
    Project.hasMany(ScopedUser, { as: 'scopedUsers' });

    expect(ScopedUser.modelDefinition.attributes.has('projectId')).to.eq(true);

    const user = ScopedUser.build({ projectId: 1 });
    // @ts-expect-error -- projectId is not declared on the model type
    expect(user.projectId).to.eq(1);
  });
});
