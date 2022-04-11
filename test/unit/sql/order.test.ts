import util from 'util';
import type { FindOptions, ModelStatic, Sequelize } from '@sequelize/core';
import { DataTypes, Model, col, literal } from '@sequelize/core';
import { expect } from 'chai';
// eslint-disable-next-line import/order -- TODO: replace with import when support is migrated to TS
import { createTester } from '../../support2';

const Support = require('../../support');

const expectsql = Support.expectsql;
const sequelize: Sequelize = Support.sequelize;
// TODO: Type QueryGenerator
const sql = sequelize.dialect.queryGenerator as any;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

type Options = {
  table?: string,
  model: ModelStatic<any>,
  attributes: FindOptions['attributes'],
  include?: FindOptions['include'],
  order: FindOptions['order'],
};

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('order', () => {
    const testSql = createTester((it, options: Options, expectation: Record<string, string>) => {
      const model = options.model;

      it(util.inspect(options, { depth: 2 }), () => {
        return expectsql(
          sql.selectQuery(
            options.table || model && model.getTableName(),
            options,
            options.model,
          ),
          expectation,
        );
      });
    });

    // models
    const User = sequelize.define('User', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id',
      },
      name: {
        type: DataTypes.STRING,
        field: 'name',
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        field: 'created_at',
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at',
        allowNull: true,
      },
    }, {
      tableName: 'user',
      timestamps: true,
    });

    const Project = sequelize.define('Project', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id',
      },
      name: {
        type: DataTypes.STRING,
        field: 'name',
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        field: 'created_at',
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at',
        allowNull: true,
      },
    }, {
      tableName: 'project',
      timestamps: true,
    });

    const ProjectUser = sequelize.define('ProjectUser', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id',
      },
      userId: {
        type: DataTypes.INTEGER,
        field: 'user_id',
        allowNull: false,
      },
      projectId: {
        type: DataTypes.INTEGER,
        field: 'project_id',
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        field: 'created_at',
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at',
        allowNull: true,
      },
    }, {
      tableName: 'project_user',
      timestamps: true,
    });

    const Task = sequelize.define('Task', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id',
      },
      name: {
        type: DataTypes.STRING,
        field: 'name',
        allowNull: false,
      },
      projectId: {
        type: DataTypes.INTEGER,
        field: 'project_id',
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        field: 'created_at',
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at',
        allowNull: true,
      },
    }, {
      tableName: 'task',
      timestamps: true,
    });

    const Subtask = sequelize.define('Subtask', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id',
      },
      name: {
        type: DataTypes.STRING,
        field: 'name',
        allowNull: false,
      },
      taskId: {
        type: DataTypes.INTEGER,
        field: 'task_id',
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        field: 'created_at',
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at',
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        field: 'metadata',
        allowNull: false,
      },
    }, {
      tableName: 'subtask',
      timestamps: true,
    });

    // Relations
    User.belongsToMany(Project, {
      as: 'ProjectUserProjects',
      through: ProjectUser,
      foreignKey: 'user_id',
      otherKey: 'project_id',
    });

    Project.belongsToMany(User, {
      as: 'ProjectUserUsers',
      through: ProjectUser,
      foreignKey: 'project_id',
      otherKey: 'user_id',
    });

    Project.hasMany(Task, {
      as: 'Tasks',
      foreignKey: 'project_id',
    });

    ProjectUser.belongsTo(User, {
      as: 'User',
      foreignKey: 'user_id',
    });

    ProjectUser.belongsTo(User, {
      as: 'Project',
      foreignKey: 'project_id',
    });

    Task.belongsTo(Project, {
      as: 'Project',
      foreignKey: 'project_id',
    });

    Task.hasMany(Subtask, {
      as: 'Subtasks',
      foreignKey: 'task_id',
    });

    Subtask.belongsTo(Task, {
      as: 'Task',
      foreignKey: 'task_id',
    });

    testSql({
      model: Subtask,
      attributes: ['id', 'name'],
      order: [
        'name',
      ],
    }, {
      default: 'SELECT [id], [name] FROM "subtask" AS "Subtask" ORDER BY [Subtask].[name];',
    });

    testSql({
      model: Subtask,
      attributes: ['id', 'name'],
      order: [
        col('name'),
      ],
    }, {
      default: 'SELECT [id], [name] FROM "subtask" AS "Subtask" ORDER BY [name];',
    });

    testSql({
      model: Subtask,
      attributes: ['id', 'name'],
      order: [
        literal('raw sql'),
      ],
    }, {
      default: 'SELECT [id], [name] FROM "subtask" AS "Subtask" ORDER BY raw sql;',
    });

    testSql({
      model: Subtask,
      attributes: ['id', 'name'],
      order: [
        // these need to be wrapped in another tuple be the sort order
        'name',
        'ASC',
      ],
    }, {
      default: 'SELECT [id], [name] FROM "subtask" AS "Subtask" ORDER BY [Subtask].[name], [Subtask].[ASC];',
    });

    testSql({
      model: Subtask,
      attributes: ['id', 'name'],
      order: [
        ['name', 'ASC'],
      ],
    }, {
      default: 'SELECT [id], [name] FROM "subtask" AS "Subtask" ORDER BY [Subtask].[name] ASC;',
    });

    testSql({
      model: Subtask,
      attributes: ['id', 'name'],
      order: [
        ['name', 'NULLS FIRST'],
      ],
    }, {
      default: 'SELECT [id], [name] FROM "subtask" AS "Subtask" ORDER BY [Subtask].[name] NULLS FIRST;',
    });

    testSql({
      model: Subtask,
      attributes: [
        'id',
        'name',
        'createdAt',
      ],
      // @ts-expect-error -- TODO: type _validateIncludedElements
      include: Model._validateIncludedElements({
        include: [
          {
            association: Subtask.associations.Task,
            required: true,
            attributes: [
              'id',
              'name',
              'createdAt',
            ],
            include: [
              {
                association: Task.associations.Project,
                required: true,
                attributes: [
                  'id',
                  'name',
                  'createdAt',
                ],
              },
            ],
          },
        ],
        model: Subtask,
      }).include,
      order: [
        // order with multiple simple association syntax with direction
        [
          {
            model: Task,
            as: 'Task',
          },
          {
            model: Project,
            as: 'Project',
          },
          'createdAt',
          'ASC',
        ],
        // order with multiple simple association syntax without direction
        [
          {
            model: Task,
            as: 'Task',
          },
          {
            model: Project,
            as: 'Project',
          },
          'createdAt',
        ],

        // order with simple association syntax with direction
        [
          {
            model: Task,
            as: 'Task',
          },
          'createdAt',
          'ASC',
        ],
        // order with simple association syntax without direction
        [
          {
            model: Task,
            as: 'Task',
          },
          'createdAt',
        ],

        // through model object as array with direction
        [Task, Project, 'createdAt', 'ASC'],
        // through model object as array without direction
        [Task, Project, 'createdAt'],

        // model object as array with direction
        [Task, 'createdAt', 'ASC'],
        // model object as array without direction
        [Task, 'createdAt'],

        // through association object as array with direction
        [Subtask.associations.Task, Task.associations.Project, 'createdAt', 'ASC'],
        // through association object as array without direction
        [Subtask.associations.Task, Task.associations.Project, 'createdAt'],

        // association object as array with direction
        [Subtask.associations.Task, 'createdAt', 'ASC'],
        // association object as array without direction
        [Subtask.associations.Task, 'createdAt'],

        // through association name order as array with direction
        ['Task', 'Project', 'createdAt', 'ASC'],
        // through association name as array without direction
        ['Task', 'Project', 'createdAt'],

        // association name as array with direction
        ['Task', 'createdAt', 'ASC'],
        // association name as array without direction
        ['Task', 'createdAt'],

        // main order as array with direction
        ['createdAt', 'ASC'],
        // main order as array without direction
        ['createdAt'],
        // main order as string
        'createdAt',
      ],
    }, {
      default: 'SELECT [Subtask].[id], [Subtask].[name], [Subtask].[createdAt], [Task].[id] AS [Task.id], [Task].[name] AS [Task.name], [Task].[created_at] AS [Task.createdAt], [Task->Project].[id] AS [Task.Project.id], [Task->Project].[name] AS [Task.Project.name], [Task->Project].[created_at] AS [Task.Project.createdAt] FROM [subtask] AS [Subtask] INNER JOIN [task] AS [Task] ON [Subtask].[task_id] = [Task].[id] INNER JOIN [project] AS [Task->Project] ON [Task].[project_id] = [Task->Project].[id] ORDER BY [Task->Project].[created_at] ASC, [Task->Project].[created_at], [Task].[created_at] ASC, [Task].[created_at], [Task->Project].[created_at] ASC, [Task->Project].[created_at], [Task].[created_at] ASC, [Task].[created_at], [Task->Project].[created_at] ASC, [Task->Project].[created_at], [Task].[created_at] ASC, [Task].[created_at], [Task->Project].[created_at] ASC, [Task->Project].[created_at], [Task].[created_at] ASC, [Task].[created_at], [Subtask].[created_at] ASC, [Subtask].[created_at], [Subtask].[created_at];',
      postgres: 'SELECT "Subtask"."id", "Subtask"."name", "Subtask"."createdAt", "Task"."id" AS "Task.id", "Task"."name" AS "Task.name", "Task"."created_at" AS "Task.createdAt", "Task->Project"."id" AS "Task.Project.id", "Task->Project"."name" AS "Task.Project.name", "Task->Project"."created_at" AS "Task.Project.createdAt" FROM "subtask" AS "Subtask" INNER JOIN "task" AS "Task" ON "Subtask"."task_id" = "Task"."id" INNER JOIN "project" AS "Task->Project" ON "Task"."project_id" = "Task->Project"."id" ORDER BY "Task->Project"."created_at" ASC, "Task->Project"."created_at", "Task"."created_at" ASC, "Task"."created_at", "Task->Project"."created_at" ASC, "Task->Project"."created_at", "Task"."created_at" ASC, "Task"."created_at", "Task->Project"."created_at" ASC, "Task->Project"."created_at", "Task"."created_at" ASC, "Task"."created_at", "Task->Project"."created_at" ASC, "Task->Project"."created_at", "Task"."created_at" ASC, "Task"."created_at", "Subtask"."created_at" ASC, "Subtask"."created_at", "Subtask"."created_at";',
    });

    // supports $association.reference$
    testSql({
      model: Subtask,
      attributes: [
        'id',
        'name',
      ],
      // @ts-expect-error -- TODO: type _validateIncludedElements
      include: Model._validateIncludedElements({
        include: [
          {
            association: Subtask.associations.Task,
            required: true,
            attributes: [
              'id',
              'name',
            ],
          },
        ],
        model: Subtask,
      }).include,
      order: [['$Task.name$', 'ASC']],
    }, {
      default: 'SELECT [Subtask].[id], [Subtask].[name], [Task].[id] AS [Task.id], [Task].[name] AS [Task.name] FROM [subtask] AS [Subtask] INNER JOIN [task] AS [Task] ON [Model].[task_id] = [Task].[id] ORDER BY [Task].[name] ASC;',
    });

    testSql({
      model: Subtask,
      attributes: [
        'id',
        'name',
      ],
      // @ts-expect-error -- TODO: type _validateIncludedElements
      include: Model._validateIncludedElements({
        include: [
          {
            association: Subtask.associations.Task,
            required: true,
            attributes: [
              'id',
              'name',
            ],
            include: [
              {
                association: Task.associations.Project,
                required: true,
                attributes: [
                  'id',
                  'name',
                ],
              },
            ],
          },
        ],
        model: Subtask,
      }).include,
      order: [[Subtask.associations.Task, '$Project.metadata$.json.path', 'ASC']],
    }, {
      default: 'SELECT [Subtask].[id], [Subtask].[name], [Task].[id] AS [Task.id], [Task].[name] AS [Task.name] FROM [subtask] AS [Subtask] INNER JOIN [task] AS [Task] ON [Model].[task_id] = [Task].[id] ORDER BY [Task].[name] ASC;',
    });

    // supports json.path
    testSql({
      model: Subtask,
      attributes: [
        'id',
        'metadata',
      ],
      order: [['metadata.json.path', 'ASC']],
    }, {
      postgres: 'SELECT "id", "metadata" FROM "subtask" AS "Subtask" ORDER BY ("Subtask"."metadata"#>>\'{json,path}\') ASC;',
    });

    testSql({
      model: Subtask,
      attributes: ['id', 'name'],
      order: [
        sequelize.random(),
      ],
    }, {
      ibmi: 'SELECT "id", "name" FROM "subtask" AS "Subtask" ORDER BY RAND()',
      mssql: 'SELECT [id], [name] FROM [subtask] AS [Subtask] ORDER BY RAND();',
      db2: 'SELECT "id", "name" FROM "subtask" AS "Subtask" ORDER BY RAND();',
      mariadb: 'SELECT `id`, `name` FROM `subtask` AS `Subtask` ORDER BY RAND();',
      mysql: 'SELECT `id`, `name` FROM `subtask` AS `Subtask` ORDER BY RAND();',
      postgres: 'SELECT "id", "name" FROM "subtask" AS "Subtask" ORDER BY RANDOM();',
      snowflake: 'SELECT "id", "name" FROM "subtask" AS "Subtask" ORDER BY RANDOM();',
      sqlite: 'SELECT `id`, `name` FROM `subtask` AS `Subtask` ORDER BY RANDOM();',
    });

    describe('Invalid', () => {
      it('errors on invalid association', () => {
        return expect(Subtask.findAll({
          order: [
            [Project, 'createdAt', 'ASC'],
          ],
        })).to.eventually.be.rejectedWith(Error, 'Unable to find a valid association for model, \'Project\'');
      });

      it('errors if an association is used after an attribute', () => {
        return expect(Subtask.findAll({
          order: [
            [Subtask.associations.Task, 'createdAt', Task.associations.Project, 'ASC'],
          ],
        })).to.eventually.be.rejectedWith(Error, 'Unknown structure passed to order / group: Project');
      });

      it('errors if an association is used after an $association.attribute$', () => {
        return expect(Subtask.findAll({
          order: [
            ['$Task.createdAt$', Task.associations.Project, 'ASC'],
          ],
        })).to.eventually.be.rejectedWith(Error, 'Unknown structure passed to order / group: Project');
      });

      it('errors when the order is a string', () => {
        return expect(Subtask.findAll({
          order: 'i am a silly string',
        })).to.eventually.be.rejectedWith(Error, 'Order must be type of array or instance of a valid sequelize method.');
      });

      it('errors when the order contains a `{raw: "..."}` object', () => {
        return expect(Subtask.findAll({
          order: [
            // @ts-expect-error
            { raw: 'this should throw an error' },
          ],
        })).to.eventually.be.rejectedWith(Error, 'The `{raw: "..."}` syntax is no longer supported.  Use `sequelize.literal` instead.');
      });

      it('errors when the order contains a `{raw: "..."}` object wrapped in an array', () => {
        return expect(Subtask.findAll({
          order: [
            [
              // @ts-expect-error
              { raw: 'this should throw an error' },
            ],
          ],
        })).to.eventually.be.rejectedWith(Error, 'The `{raw: "..."}` syntax is no longer supported.  Use `sequelize.literal` instead.');
      });
    });
  });
});
