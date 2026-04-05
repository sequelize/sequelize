import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
} from '@sequelize/core';
import { DataTypes, Model } from '@sequelize/core';
import { Attribute, BelongsTo, NotNull } from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import { sequelize, setResetMode } from '../support';

describe('Sequelize#destroyAll', () => {
  setResetMode('drop');

  it('deletes rows in the right order to avoid foreign key constraint violations', async () => {
    class A extends Model<InferAttributes<A>, InferCreationAttributes<A>> {
      declare id: CreationOptional<number>;

      @Attribute(DataTypes.INTEGER)
      @NotNull
      declare bId: number;

      @BelongsTo(() => B, {
        foreignKey: {
          name: 'bId',
          onDelete: 'NO ACTION',
        },
      })
      declare b?: NonAttribute<B>;
    }

    class B extends Model<InferAttributes<B>, InferCreationAttributes<B>> {
      declare id: CreationOptional<number>;

      @Attribute(DataTypes.INTEGER)
      @NotNull
      declare cId: number;

      @BelongsTo(() => C, {
        foreignKey: {
          name: 'cId',
          onDelete: 'NO ACTION',
        },
      })
      declare c?: NonAttribute<C>;
    }

    class C extends Model<InferAttributes<C>, InferCreationAttributes<C>> {
      declare id: CreationOptional<number>;
    }

    sequelize.addModels([A, C, B]);

    await sequelize.sync();

    const c = await C.create();
    const b = await B.create({ cId: c.id });
    await A.create({ bId: b.id });

    // drop both tables
    await sequelize.destroyAll();

    expect(await A.count()).to.eq(0);
    expect(await B.count()).to.eq(0);
    expect(await C.count()).to.eq(0);
  });
});
