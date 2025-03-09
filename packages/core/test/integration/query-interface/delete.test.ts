import type { CreationOptional, InferAttributes, InferCreationAttributes } from '@sequelize/core';
import { DataTypes, Model } from '@sequelize/core';
import {
  Attribute,
  AutoIncrement,
  NotNull,
  PrimaryKey,
  Table,
} from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import { beforeAll2, sequelize, setResetMode } from '../support';

const queryInterface = sequelize.queryInterface;

describe('QueryInterface#delete', () => {
  setResetMode('truncate');

  const vars = beforeAll2(async () => {
    @Table({ timestamps: false })
    class Level extends Model<InferAttributes<Level>, InferCreationAttributes<Level>> {
      @Attribute(DataTypes.INTEGER)
      @PrimaryKey
      @AutoIncrement
      declare id: CreationOptional<number>;

      @Attribute(DataTypes.STRING)
      @NotNull
      declare name: string;

      @Attribute(DataTypes.INTEGER)
      @NotNull
      declare value: number;
    }

    sequelize.addModels([Level]);
    await sequelize.sync({ force: true });

    return { Level };
  });

  describe('Delete', () => {
    beforeEach(async () => {
      await vars.Level.bulkCreate([
        { name: 'level1', value: 5 },
        { name: 'level2', value: 10 },
        { name: 'level3', value: 10 },
      ]);
    });

    it('should delete a row', async () => {
      const beforeDelete = await vars.Level.findAll({ raw: true, where: { name: 'level1' } });
      expect(beforeDelete.map(({ name, value }) => ({ name, value }))).to.deep.equal([
        { name: 'level1', value: 5 },
      ]);

      const count = await queryInterface.bulkDelete(vars.Level, { where: { name: 'level1' } });
      expect(count).to.equal(1);

      const afterDelete = await vars.Level.findAll({ raw: true, where: { name: 'level1' } });
      expect(afterDelete).to.deep.equal([]);
    });

    it('should delete multiple rows', async () => {
      const beforeDelete = await vars.Level.findAll({ raw: true });
      expect(beforeDelete.map(({ name, value }) => ({ name, value }))).to.deep.equal([
        { name: 'level1', value: 5 },
        { name: 'level2', value: 10 },
        { name: 'level3', value: 10 },
      ]);

      const count = await queryInterface.bulkDelete(vars.Level, { where: { value: 10 } });
      expect(count).to.equal(2);

      const afterDelete = await vars.Level.findAll({ raw: true });
      expect(afterDelete.map(({ name, value }) => ({ name, value }))).to.deep.equal([
        { name: 'level1', value: 5 },
      ]);
    });

    it('should delete all rows', async () => {
      const beforeDelete = await vars.Level.findAll({ raw: true });
      expect(beforeDelete.map(({ name, value }) => ({ name, value }))).to.deep.equal([
        { name: 'level1', value: 5 },
        { name: 'level2', value: 10 },
        { name: 'level3', value: 10 },
      ]);

      const count = await queryInterface.bulkDelete(vars.Level, { where: {} });
      expect(count).to.equal(3);

      const afterDelete = await vars.Level.findAll({ raw: true });
      expect(afterDelete).to.deep.equal([]);
    });

    it('should limit the number of deleted rows', async () => {
      const beforeDelete = await vars.Level.findAll({ raw: true });
      expect(beforeDelete.map(({ name, value }) => ({ name, value }))).to.deep.equal([
        { name: 'level1', value: 5 },
        { name: 'level2', value: 10 },
        { name: 'level3', value: 10 },
      ]);

      const count = await queryInterface.bulkDelete(vars.Level, { where: {}, limit: 1 });
      expect(count).to.equal(1);

      const afterDelete = await vars.Level.findAll({ raw: true });
      expect(afterDelete.map(({ name, value }) => ({ name, value }))).to.deep.equal([
        { name: 'level2', value: 10 },
        { name: 'level3', value: 10 },
      ]);
    });
  });

  describe('Bulk Delete', () => {
    beforeEach(async () => {
      await vars.Level.bulkCreate([
        { name: 'level1', value: 5 },
        { name: 'level2', value: 10 },
        { name: 'level3', value: 10 },
      ]);
    });

    it('should bulk delete rows', async () => {
      const beforeDelete = await vars.Level.findAll({ raw: true });
      expect(beforeDelete.map(({ name, value }) => ({ name, value }))).to.deep.equal([
        { name: 'level1', value: 5 },
        { name: 'level2', value: 10 },
        { name: 'level3', value: 10 },
      ]);

      const count = await queryInterface.bulkDelete(vars.Level);
      expect(count).to.equal(3);

      const afterDelete = await vars.Level.findAll({ raw: true });
      expect(afterDelete).to.deep.equal([]);
    });
  });
});
