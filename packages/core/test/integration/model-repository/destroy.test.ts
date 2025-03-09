import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
} from '@sequelize/core';
import { DataTypes, ManualOnDelete, Model } from '@sequelize/core';
import { Attribute, BelongsTo, NotNull } from '@sequelize/core/decorators-legacy';
import sinon from 'sinon';
import { beforeAll2, expectPerDialect, sequelize, toMatchSql } from '../../support';
import { setResetMode } from '../support';

describe('ModelRepository#_UNSTABLE_destroy', () => {
  setResetMode('destroy');

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
      const user = await User.create({ id: 1 });
      const project = await Project.create({ id: 1, ownerId: user.id });
      await Task.create({ id: 1, projectId: project.id });

      const spy = sinon.spy(sequelize, 'queryRaw');

      await User.modelRepository._UNSTABLE_destroy(user, { manualOnDelete: ManualOnDelete.all });

      const calls = spy.getCalls().map(call => call.args[0]);

      expectPerDialect(() => calls, {
        default: toMatchSql([
          'START TRANSACTION',
          'SELECT [id], [ownerId], [createdAt], [updatedAt] FROM [Projects] AS [Project] WHERE [Project].[ownerId] IN (1);',
          'SELECT [id], [projectId], [createdAt], [updatedAt] FROM [Tasks] AS [Task] WHERE [Task].[projectId] IN (1);',
          'DELETE FROM [Tasks] WHERE [id] = 1',
          'DELETE FROM [Projects] WHERE [id] = 1',
          'DELETE FROM [Users] WHERE [id] = 1',
          'COMMIT',
        ]),
        mssql: toMatchSql([
          // mssql transactions don't go through .queryRaw, they are called on the connection object
          // 'BEGIN TRANSACTION;',
          'SELECT [id], [ownerId], [createdAt], [updatedAt] FROM [Projects] AS [Project] WHERE [Project].[ownerId] IN (1);',
          'SELECT [id], [projectId], [createdAt], [updatedAt] FROM [Tasks] AS [Task] WHERE [Task].[projectId] IN (1);',
          'DELETE FROM [Tasks] WHERE [id] = 1; SELECT @@ROWCOUNT AS AFFECTEDROWS;',
          'DELETE FROM [Projects] WHERE [id] = 1; SELECT @@ROWCOUNT AS AFFECTEDROWS;',
          'DELETE FROM [Users] WHERE [id] = 1; SELECT @@ROWCOUNT AS AFFECTEDROWS;',
          // 'COMMIT TRANSACTION;',
        ]),
        db2: toMatchSql(
          [
            // db2 transactions don't go through .queryRaw, they are called on the connection object
            // 'BEGIN TRANSACTION;',
            'SELECT [id], [ownerId], [createdAt], [updatedAt] FROM [Projects] AS [Project] WHERE [Project].[ownerId] IN (1);',
            'SELECT [id], [projectId], [createdAt], [updatedAt] FROM [Tasks] AS [Task] WHERE [Task].[projectId] IN (1);',
            'DELETE FROM [Tasks] WHERE [id] = 1',
            'DELETE FROM [Projects] WHERE [id] = 1',
            'DELETE FROM [Users] WHERE [id] = 1',
            // 'COMMIT TRANSACTION;',
          ],
          { genericQuotes: true },
        ),
        sqlite3: toMatchSql(
          [
            'BEGIN DEFERRED TRANSACTION',
            'SELECT [id], [ownerId], [createdAt], [updatedAt] FROM [Projects] AS [Project] WHERE [Project].[ownerId] IN (1);',
            'SELECT [id], [projectId], [createdAt], [updatedAt] FROM [Tasks] AS [Task] WHERE [Task].[projectId] IN (1);',
            'DELETE FROM [Tasks] WHERE [id] = 1',
            'DELETE FROM [Projects] WHERE [id] = 1',
            'DELETE FROM [Users] WHERE [id] = 1',
            'COMMIT',
          ],
          { genericQuotes: true },
        ),
      });
    });

    it('does not start a transaction if one is already started', async () => {
      const { User, Project, Task } = vars;

      const user = await User.create({ id: 1 });
      const project = await Project.create({ id: 1, ownerId: user.id });
      await Task.create({ id: 1, projectId: project.id });

      const calls = await sequelize.transaction(async transaction => {
        const spy = sinon.spy(sequelize, 'queryRaw');
        await User.modelRepository._UNSTABLE_destroy(user, {
          manualOnDelete: ManualOnDelete.all,
          transaction,
        });

        return spy.getCalls().map(call => call.args[0]);
      });

      expectPerDialect(() => calls, {
        default: toMatchSql([
          'SELECT [id], [ownerId], [createdAt], [updatedAt] FROM [Projects] AS [Project] WHERE [Project].[ownerId] IN (1);',
          'SELECT [id], [projectId], [createdAt], [updatedAt] FROM [Tasks] AS [Task] WHERE [Task].[projectId] IN (1);',
          'DELETE FROM [Tasks] WHERE [id] = 1',
          'DELETE FROM [Projects] WHERE [id] = 1',
          'DELETE FROM [Users] WHERE [id] = 1',
        ]),
        mssql: toMatchSql([
          'SELECT [id], [ownerId], [createdAt], [updatedAt] FROM [Projects] AS [Project] WHERE [Project].[ownerId] IN (1);',
          'SELECT [id], [projectId], [createdAt], [updatedAt] FROM [Tasks] AS [Task] WHERE [Task].[projectId] IN (1);',
          'DELETE FROM [Tasks] WHERE [id] = 1; SELECT @@ROWCOUNT AS AFFECTEDROWS;',
          'DELETE FROM [Projects] WHERE [id] = 1; SELECT @@ROWCOUNT AS AFFECTEDROWS;',
          'DELETE FROM [Users] WHERE [id] = 1; SELECT @@ROWCOUNT AS AFFECTEDROWS;',
        ]),
      });
    });
  });
});
