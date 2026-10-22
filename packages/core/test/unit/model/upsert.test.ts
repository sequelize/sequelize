import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import { beforeAll2, sequelize } from '../../support';

describe('Model.upsert', () => {
  if (!sequelize.dialect.supports.upserts) {
    return;
  }

  const vars = beforeAll2(() => {
    const User = sequelize.define('User', {
      name: DataTypes.STRING,
      virtualValue: {
        type: DataTypes.VIRTUAL,
        set(val) {
          this.set('value', val);
        },
        get() {
          return this.get('value');
        },
      },
      value: DataTypes.STRING,
      secretValue: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        field: 'created_at',
      },
    });

    const UserNoTime = sequelize.define(
      'UserNoTime',
      {
        name: DataTypes.STRING,
      },
      {
        timestamps: false,
      },
    );

    return { User, UserNoTime };
  });

  let query: SinonStub;
  let stub: SinonStub;
  beforeEach(() => {
    query = sinon.stub(sequelize, 'queryRaw').resolves();
    stub = sinon.stub(sequelize.queryInterface, 'upsert').resolves([vars.User.build(), true]);
  });

  afterEach(() => {
    query.restore();
    stub.restore();
  });

  it('skip validations for missing fields', async () => {
    await expect(
      vars.User.upsert({
        name: 'Grumpy Cat',
      }),
    ).to.be.fulfilled;
  });

  it('creates new record with correct field names', async () => {
    await vars.User.upsert({
      name: 'Young Cat',
      virtualValue: '999',
    });

    expect(Object.keys(stub.getCall(0).args[1])).to.deep.equal([
      'name',
      'value',
      'created_at',
      'updatedAt',
    ]);
  });

  it('creates new record with timestamps disabled', async () => {
    await vars.UserNoTime.upsert({
      name: 'Young Cat',
    });

    expect(Object.keys(stub.getCall(0).args[1])).to.deep.equal(['name']);
  });

  it('updates all changed fields by default', async () => {
    await vars.User.upsert({
      name: 'Old Cat',
      virtualValue: '111',
    });

    expect(Object.keys(stub.getCall(0).args[2])).to.deep.equal(['name', 'value', 'updatedAt']);
  });

  it('uses beforeUpsert changes in insert and update values', async () => {
    const unhook = vars.User.hooks.addListener('beforeUpsert', attributes => {
      const values = attributes as unknown as Record<string, unknown>;
      values.name = 'Hooked Cat';
      values.virtualValue = '222';
    });

    try {
      await vars.User.upsert({ name: 'Old Cat', secretValue: 1 });
    } finally {
      unhook();
    }

    const [, insertValues, updateValues] = stub.getCall(0).args;
    expect(insertValues.name).to.equal('Hooked Cat');
    expect(insertValues.value).to.equal('222');
    expect(updateValues.name).to.equal('Hooked Cat');
    expect(updateValues.value).to.equal('222');
  });

  it('does not add beforeUpsert changes to explicitly configured update fields', async () => {
    const unhook = vars.User.hooks.addListener('beforeUpsert', attributes => {
      const values = attributes as unknown as Record<string, unknown>;
      values.name = 'Hooked Cat';
      values.virtualValue = '222';
    });

    try {
      await vars.User.upsert({ name: 'Old Cat', secretValue: 1 }, { fields: ['secretValue'] });
    } finally {
      unhook();
    }

    const [, insertValues, updateValues] = stub.getCall(0).args;
    expect(insertValues.name).to.equal('Hooked Cat');
    expect(insertValues.value).to.equal('222');
    expect(updateValues).not.to.have.property('name');
    expect(updateValues).not.to.have.property('value');
    expect(updateValues.secretValue).to.equal(1);
  });

  it('preserves primary key set on options.instance in beforeUpsert', async () => {
    const Item = sequelize.define('Item', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      name: DataTypes.STRING,
    });
    stub.resolves([Item.build(), true]);
    const unhook = Item.hooks.addListener('beforeUpsert', (_values, options) => {
      const internalOptions = options as typeof options & { instance: typeof Item.prototype };
      internalOptions.instance.set('id', 42);
    });

    try {
      await Item.upsert({ name: 'Whiskers' });
    } finally {
      unhook();
    }

    const [, insertValues, updateValues] = stub.getCall(0).args;
    expect(insertValues.id).to.equal(42);
    expect(updateValues.id).to.equal(42);
  });

  it('validates before beforeUpsert, so the hook does not receive invalid values', async () => {
    const hook = sinon.spy();
    const unhook = vars.User.hooks.addListener('beforeUpsert', hook);

    try {
      await expect(vars.User.upsert({ name: 'Old Cat', secretValue: 'not a number' })).to.be
        .rejected;
    } finally {
      unhook();
    }

    expect(hook).not.to.have.been.called;
    expect(stub).not.to.have.been.called;
  });

  it('validates again when beforeUpsert changes values', async () => {
    const unhook = vars.User.hooks.addListener('beforeUpsert', attributes => {
      const values = attributes as unknown as Record<string, unknown>;
      values.secretValue = 'not a number';
    });

    try {
      await expect(vars.User.upsert({ name: 'Old Cat', secretValue: 1 })).to.be.rejected;
    } finally {
      unhook();
    }

    expect(stub).not.to.have.been.called;
  });

  it('validates once when beforeUpsert changes nothing', async () => {
    const validate = sinon.spy(vars.User.prototype, 'validate');
    const unhook = vars.User.hooks.addListener('beforeUpsert', () => {});

    try {
      await vars.User.upsert({ name: 'Old Cat', secretValue: 1 });
    } finally {
      unhook();
      validate.restore();
    }

    expect(validate).to.have.been.calledOnce;
  });

  it('keeps the changes beforeUpsert makes to options.fields', async () => {
    const unhook = vars.User.hooks.addListener('beforeUpsert', (attributes, options) => {
      const values = attributes as unknown as Record<string, unknown>;
      values.name = 'Hooked Cat';
      values.virtualValue = '222';
      options.fields = ['name'];
    });

    try {
      await vars.User.upsert({ name: 'Old Cat', secretValue: 1 });
    } finally {
      unhook();
    }

    const [, insertValues, updateValues] = stub.getCall(0).args;
    expect(insertValues.name).to.equal('Hooked Cat');
    expect(insertValues.value).to.equal('222');
    expect(updateValues.name).to.equal('Hooked Cat');
    expect(updateValues).not.to.have.property('value');
    expect(updateValues).not.to.have.property('secretValue');
  });

  it('removes properties deleted in beforeUpsert from insert and update values', async () => {
    const unhook = vars.User.hooks.addListener('beforeUpsert', attributes => {
      const values = attributes as unknown as Record<string, unknown>;
      delete values.name;
    });

    try {
      await vars.User.upsert({ name: 'Old Cat', secretValue: 1 });
    } finally {
      unhook();
    }

    const [, insertValues, updateValues] = stub.getCall(0).args;
    expect(insertValues).not.to.have.property('name');
    expect(updateValues).not.to.have.property('name');
  });
});
