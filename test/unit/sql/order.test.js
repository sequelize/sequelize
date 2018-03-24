'use strict';

const util = require('util');
const chai = require('chai');
const expect = chai.expect;
const Support   = require(__dirname + '/../support');
const DataTypes = require(__dirname + '/../../../lib/data-types');
const Model = require(__dirname + '/../../../lib/model');
const expectsql = Support.expectsql;
const current = Support.sequelize;
const sql = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('order', () => {
    const testsql = (options, expectation) => {
      const model = options.model;

      it(util.inspect(options, {depth: 2}), () => {
        return expectsql(
          sql.selectQuery(
            options.table || model && model.getTableName(),
            options,
            options.model
          ),
          expectation
        );
      });
    };

    // models
    const User = Support.sequelize.define('User', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id'
      },
      name: {
        type: DataTypes.STRING,
        field: 'name',
        allowNull: false
      },
      createdAt: {
        type: DataTypes.DATE,
        field: 'created_at',
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at',
        allowNull: true
      }
    }, {
      tableName: 'user',
      timestamps: true
    });

    const Project = Support.sequelize.define('Project', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id'
      },
      name: {
        type: DataTypes.STRING,
        field: 'name',
        allowNull: false
      },
      createdAt: {
        type: DataTypes.DATE,
        field: 'created_at',
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at',
        allowNull: true
      }
    }, {
      tableName: 'project',
      timestamps: true
    });

    const ProjectUser = Support.sequelize.define('ProjectUser', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id'
      },
      userId: {
        type: DataTypes.INTEGER,
        field: 'user_id',
        allowNull: false
      },
      projectId: {
        type: DataTypes.INTEGER,
        field: 'project_id',
        allowNull: false
      },
      createdAt: {
        type: DataTypes.DATE,
        field: 'created_at',
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at',
        allowNull: true
      }
    }, {
      tableName: 'project_user',
      timestamps: true
    });

    const Task = Support.sequelize.define('Task', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id'
      },
      name: {
        type: DataTypes.STRING,
        field: 'name',
        allowNull: false
      },
      projectId: {
        type: DataTypes.INTEGER,
        field: 'project_id',
        allowNull: false
      },
      createdAt: {
        type: DataTypes.DATE,
        field: 'created_at',
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at',
        allowNull: true
      }
    }, {
      tableName: 'task',
      timestamps: true
    });

    const Subtask = Support.sequelize.define('Subtask', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id'
      },
      name: {
        type: DataTypes.STRING,
        field: 'name',
        allowNull: false
      },
      taskId: {
        type: DataTypes.INTEGER,
        field: 'task_id',
        allowNull: false
      },
      createdAt: {
        type: DataTypes.DATE,
        field: 'created_at',
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: 'updated_at',
        allowNull: true
      }
    }, {
      tableName: 'subtask',
      timestamps: true
    });

    // Relations
    User.belongsToMany(Project, {
      as: 'ProjectUserProjects',
      through: ProjectUser,
      foreignKey: 'user_id',
      otherKey: 'project_id'
    });

    Project.belongsToMany(User, {
      as: 'ProjectUserUsers',
      through: ProjectUser,
      foreignKey: 'project_id',
      otherKey: 'user_id'
    });

    Project.hasMany(Task, {
      as: 'Tasks',
      foreignKey: 'project_id'
    });

    ProjectUser.belongsTo(User, {
      as: 'User',
      foreignKey: 'user_id'
    });

    ProjectUser.belongsTo(User, {
      as: 'Project',
      foreignKey: 'project_id'
    });

    Task.belongsTo(Project, {
      as: 'Project',
      foreignKey: 'project_id'
    });

    Task.hasMany(Subtask, {
      as: 'Subtasks',
      foreignKey: 'task_id'
    });

    Subtask.belongsTo(Task, {
      as: 'Task',
      foreignKey: 'task_id'
    });

    testsql({
      model: Subtask,
      attributes: [
        'id',
        'name',
        'createdAt'
      ],
      include: Model._validateIncludedElements({
        include: [
          {
            association: Subtask.associations.Task,
            required: true,
            attributes: [
              'id',
              'name',
              'createdAt'
            ],
            include: [
              {
                association: Task.associations.Project,
                required: true,
                attributes: [
                  'id',
                  'name',
                  'createdAt'
                ]
              }
            ]
          }
        ],
        model: Subtask
      }).include,
      order: [
        // order with multiple simple association syntax with direction
        [
          {
            model: Task,
            as: 'Task'
          },
          {
            model: Project,
            as: 'Project'
          },
          'createdAt',
          'ASC'
        ],
        // order with multiple simple association syntax without direction
        [
          {
            model: Task,
            as: 'Task'
          },
          {
            model: Project,
            as: 'Project'
          },
          'createdAt'
        ],

        // order with simple association syntax with direction
        [
          {
            model: Task,
            as: 'Task'
          },
          'createdAt',
          'ASC'
        ],
        // order with simple association syntax without direction
        [
          {
            model: Task,
            as: 'Task'
          },
          'createdAt'
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
        'createdAt'
      ]
    }, {
      default: 'SELECT [Subtask].[id], [Subtask].[name], [Subtask].[createdAt], [Task].[id] AS [Task.id], [Task].[name] AS [Task.name], [Task].[created_at] AS [Task.createdAt], [Task->Project].[id] AS [Task.Project.id], [Task->Project].[name] AS [Task.Project.name], [Task->Project].[created_at] AS [Task.Project.createdAt] FROM [subtask] AS [Subtask] INNER JOIN [task] AS [Task] ON [Subtask].[task_id] = [Task].[id] INNER JOIN [project] AS [Task->Project] ON [Task].[project_id] = [Task->Project].[id] ORDER BY [Task->Project].[created_at] ASC, [Task->Project].[created_at], [Task].[created_at] ASC, [Task].[created_at], [Task->Project].[created_at] ASC, [Task->Project].[created_at], [Task].[created_at] ASC, [Task].[created_at], [Task->Project].[created_at] ASC, [Task->Project].[created_at], [Task].[created_at] ASC, [Task].[created_at], [Task->Project].[created_at] ASC, [Task->Project].[created_at], [Task].[created_at] ASC, [Task].[created_at], [Subtask].[created_at] ASC, [Subtask].[created_at], [Subtask].[created_at];',
      postgres: 'SELECT "Subtask"."id", "Subtask"."name", "Subtask"."createdAt", "Task"."id" AS "Task.id", "Task"."name" AS "Task.name", "Task"."created_at" AS "Task.createdAt", "Task->Project"."id" AS "Task.Project.id", "Task->Project"."name" AS "Task.Project.name", "Task->Project"."created_at" AS "Task.Project.createdAt" FROM "subtask" AS "Subtask" INNER JOIN "task" AS "Task" ON "Subtask"."task_id" = "Task"."id" INNER JOIN "project" AS "Task->Project" ON "Task"."project_id" = "Task->Project"."id" ORDER BY "Task->Project"."created_at" ASC, "Task->Project"."created_at", "Task"."created_at" ASC, "Task"."created_at", "Task->Project"."created_at" ASC, "Task->Project"."created_at", "Task"."created_at" ASC, "Task"."created_at", "Task->Project"."created_at" ASC, "Task->Project"."created_at", "Task"."created_at" ASC, "Task"."created_at", "Task->Project"."created_at" ASC, "Task->Project"."created_at", "Task"."created_at" ASC, "Task"."created_at", "Subtask"."created_at" ASC, "Subtask"."created_at", "Subtask"."created_at";'
    });

    testsql({
      model: Subtask,
      attributes: ['id', 'name'],
      order: [
        Support.sequelize.random()
      ]
    }, {
      mssql: 'SELECT [id], [name] FROM [subtask] AS [Subtask] ORDER BY RAND();',
      mysql: 'SELECT `id`, `name` FROM `subtask` AS `Subtask` ORDER BY RAND();',
      postgres: 'SELECT "id", "name" FROM "subtask" AS "Subtask" ORDER BY RANDOM();',
      sqlite: 'SELECT `id`, `name` FROM `subtask` AS `Subtask` ORDER BY RANDOM();'
    });
  
    describe('Invalid', () => {
      it('Error on invalid association', () => {
        return expect(Subtask.findAll({
          order: [
            [Project, 'createdAt', 'ASC']
          ]
        })).to.eventually.be.rejectedWith(Error, 'Unable to find a valid association for model, \'Project\'');
      });

      it('Error on invalid structure', () => {
        return expect(Subtask.findAll({
          order: [
            [Subtask.associations.Task, 'createdAt', Task.associations.Project, 'ASC']
          ]
        })).to.eventually.be.rejectedWith(Error, 'Unknown structure passed to order / group: Project');
      });

      it('Error when the order is a string', () => {
        return expect(Subtask.findAll({
          order: 'i am a silly string'
        })).to.eventually.be.rejectedWith(Error, 'Order must be type of array or instance of a valid sequelize method.');
      });

      it('Error when the order contains a `{raw: "..."}` object', () => {
        return expect(Subtask.findAll({
          order: [
            {
              raw: 'this should throw an error'
            }
          ]
        })).to.eventually.be.rejectedWith(Error, 'The `{raw: "..."}` syntax is no longer supported.  Use `sequelize.literal` instead.');
      });

      it('Error when the order contains a `{raw: "..."}` object wrapped in an array', () => {
        return expect(Subtask.findAll({
          order: [
            [
              {
                raw: 'this should throw an error'
              }
            ]
          ]
        })).to.eventually.be.rejectedWith(Error, 'The `{raw: "..."}` syntax is no longer supported.  Use `sequelize.literal` instead.');
      });
    });
  });
});
