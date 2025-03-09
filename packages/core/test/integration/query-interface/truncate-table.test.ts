import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
} from '@sequelize/core';
import { DataTypes, Model } from '@sequelize/core';
import {
  Attribute,
  AutoIncrement,
  BelongsTo,
  NotNull,
  PrimaryKey,
} from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import { beforeAll2, sequelize, setResetMode } from '../support';

const queryInterface = sequelize.queryInterface;

describe('QueryInterface#truncate', () => {
  setResetMode('truncate');

  const vars = beforeAll2(async () => {
    class Level extends Model<InferAttributes<Level>, InferCreationAttributes<Level>> {
      @Attribute(DataTypes.INTEGER)
      @PrimaryKey
      @AutoIncrement
      declare id: CreationOptional<number>;

      @Attribute(DataTypes.STRING)
      @NotNull
      declare name: string;
    }

    sequelize.addModels([Level]);
    await sequelize.sync({ force: true });

    return { Level };
  });

  describe('Truncate', () => {
    beforeEach(async () => {
      await vars.Level.bulkCreate([{ name: 'level1' }, { name: 'level2' }, { name: 'level3' }]);
    });

    it('should truncate the table', async () => {
      await queryInterface.truncate(vars.Level);
      const count = await vars.Level.count();

      expect(count).to.equal(0);
    });

    if (sequelize.dialect.supports.truncate.restartIdentity) {
      it('should truncate the table with restart identity', async () => {
        await queryInterface.truncate(vars.Level, { restartIdentity: true });
        const count = await vars.Level.count();

        expect(count).to.equal(0);

        await vars.Level.bulkCreate([{ name: 'level1' }, { name: 'level2' }, { name: 'level3' }]);
        const [level1, level2, level3, ...rest] = await vars.Level.findAll();

        expect(rest).to.have.length(0);
        expect(level1.id).to.equal(1);
        expect(level2.id).to.equal(2);
        expect(level3.id).to.equal(3);
      });
    }

    if (sequelize.dialect.supports.truncate.cascade) {
      it('should truncate the table with cascade', async () => {
        class Actor extends Model<InferAttributes<Actor>, InferCreationAttributes<Actor>> {
          @Attribute(DataTypes.INTEGER)
          @PrimaryKey
          @AutoIncrement
          declare id: CreationOptional<number>;

          @Attribute(DataTypes.STRING)
          @NotNull
          declare name: string;

          @Attribute(DataTypes.INTEGER)
          @NotNull
          declare levelId: number;

          @BelongsTo(() => vars.Level, 'levelId')
          declare level: NonAttribute<typeof vars.Level>;
        }

        sequelize.addModels([Actor]);
        await sequelize.sync();

        await Actor.bulkCreate([
          { name: 'actor1', levelId: 1 },
          { name: 'actor2', levelId: 2 },
          { name: 'actor3', levelId: 3 },
        ]);

        await queryInterface.truncate(vars.Level, { cascade: true });
        const levels = await vars.Level.count();
        const actors = await Actor.count();

        expect(levels).to.equal(0);
        expect(actors).to.equal(0);
      });
    }
  });
});
