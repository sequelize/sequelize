import { expect } from 'chai';
import sinon from 'sinon';
import type { Model } from '@sequelize/core';
import { DataTypes } from '@sequelize/core';
import { getTestDialectTeaser, sequelize } from '../support';

describe(getTestDialectTeaser('Cascade Destroy'), async () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should delete associations manually, if explicit set', async () => {
    const onDestroySpy = sinon.spy();

    const Child = sequelize.define<{ id: number } & Model>('Child', {
      parentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    }, {
      timestamps: false, hooks: {
        afterDestroy: () => {
          onDestroySpy();
        },
      },
    });

    const Parent = sequelize.define<{ id: number } & Model>('Parent', {}, { timestamps: false });

    Parent.hasMany(Child, {
      foreignKey: {
        name: 'parentId',
        onDelete: 'CASCADE',
      },
      inverse: 'parent',
      hooks: true,
    });

    await sequelize.sync({ force: true });

    const parent = await Parent.create({});
    await Child.bulkCreate([{ parentId: parent.id }, { parentId: parent.id }]);

    await parent.destroy();

    const childCount = await Child.count();
    expect(childCount).to.eq(0);

    expect(onDestroySpy.callCount).to.eq(2);
  });

  it('should not delete associations manually, if hooks is false', async () => {
    const onDestroySpy = sinon.spy();

    const Child = sequelize.define<{ id: number } & Model>('Child', {
      parentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    }, {
      timestamps: false, hooks: {
        afterDestroy: () => {
          onDestroySpy();
        },
      },
    });

    const Parent = sequelize.define<{ id: number } & Model>('Parent', {}, { timestamps: false });

    Parent.hasMany(Child, {
      foreignKey: {
        name: 'parentId',
        onDelete: 'CASCADE',
      },
      inverse: 'parent',
    });

    await sequelize.sync({ force: true });

    const parent = await Parent.create({});
    await Child.bulkCreate([{ parentId: parent.id }, { parentId: parent.id }]);

    await parent.destroy();

    const childCount = await Child.count();
    expect(childCount).to.eq(0);

    expect(onDestroySpy.callCount).to.eq(0);
  });
});
