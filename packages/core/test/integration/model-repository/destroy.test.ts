import sinon from 'sinon';
import type { CreationOptional, InferAttributes, InferCreationAttributes, NonAttribute } from '@sequelize/core';
import { DataTypes, Model } from '@sequelize/core';
import { Attribute, BelongsTo, NotNull } from '@sequelize/core/decorators-legacy';
import { ManualOnDelete } from '../../../src/index.js';
import { beforeAll2, expectPerDialect, sequelize } from '../../support';
import { setResetMode } from '../support';

describe('ModelRepository#destroy', () => {
  setResetMode('truncate');

  const vars = beforeAll2(async () => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare id: CreationOptional<number>;
    }

    class Project extends Model<InferAttributes<Project>, InferCreationAttributes<Project>> {
      declare id: CreationOptional<number>;

      @NotNull
      @Attribute(DataTypes.INTEGER)
      declare ownerId: number;

      @BelongsTo(() => User, 'ownerId')
      declare owner: NonAttribute<User>;
    }

    class Task extends Model<InferAttributes<Task>, InferCreationAttributes<Task>> {
      declare id: CreationOptional<number>;

      @NotNull
      @Attribute(DataTypes.INTEGER)
      declare projectId: number;

      @BelongsTo(() => Project, 'projectId')
      declare project: NonAttribute<Project>;
    }

    sequelize.addModels([User, Project, Task]);

    await sequelize.sync({ force: true });

    return { User, Project, Task };
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('with "manualOnDelete" = "all"', () => {
    it('cascade deletes in JavaScript', async () => {
      const { User, Project, Task } = vars;
      const user = await User.create();
      const project = await Project.create({ ownerId: user.id });
      await Task.create({ projectId: project.id });

      const spy = sinon.spy(sequelize, 'queryRaw');

      await User.modelRepository._UNSTABLE_destroy(user, { manualOnDelete: ManualOnDelete.all });

      const calls = spy.getCalls().map(call => call.args[0]);

      expectPerDialect(() => calls, {
        postgres: [
          'START TRANSACTION;',
          'SELECT "id", "ownerId", "createdAt", "updatedAt" FROM "Projects" AS "Project" WHERE "Project"."ownerId" IN (1);',
          'SELECT "id", "projectId", "createdAt", "updatedAt" FROM "Tasks" AS "Task" WHERE "Task"."projectId" IN (1);',
          'DELETE FROM "Tasks" WHERE "id" = 1',
          'DELETE FROM "Projects" WHERE "id" = 1',
          'DELETE FROM "Users" WHERE "id" = 1',
          'COMMIT;',
        ],
      });
    });

    it('does not start a transaction if one is already started', async () => {
      const { User, Project, Task } = vars;

      const user = await User.create();
      const project = await Project.create({ ownerId: user.id });
      await Task.create({ projectId: project.id });

      const calls = await sequelize.transaction(async transaction => {
        const spy = sinon.spy(sequelize, 'queryRaw');
        await User.modelRepository._UNSTABLE_destroy(user, {
          manualOnDelete: ManualOnDelete.all,
          transaction,
        });

        return spy.getCalls().map(call => call.args[0]);
      });

      expectPerDialect(() => calls, {
        postgres: [
          'SELECT "id", "ownerId", "createdAt", "updatedAt" FROM "Projects" AS "Project" WHERE "Project"."ownerId" IN (1);',
          'SELECT "id", "projectId", "createdAt", "updatedAt" FROM "Tasks" AS "Task" WHERE "Task"."projectId" IN (1);',
          'DELETE FROM "Tasks" WHERE "id" = 1',
          'DELETE FROM "Projects" WHERE "id" = 1',
          'DELETE FROM "Users" WHERE "id" = 1',
        ],
      });
    });
  });
});
