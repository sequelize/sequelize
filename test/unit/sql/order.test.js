'use strict';

/* jshint -W110 */
var Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , Model = require(__dirname + '/../../../lib/model')
  , util = require('util')
  , expectsql = Support.expectsql
  , current   = Support.sequelize
  , sql       = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

suite(Support.getTestDialectTeaser('SQL'), function() {
  suite('order', function () {
    var testsql = function (options, expectation) {
      var model = options.model;

      test(util.inspect(options, {depth: 2}), function () {
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

    (function() {
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
        table: Subtask.getTableName(),
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

          // through association order with internal connector as array with direction
          ['Task->Project.createdAt', 'ASC'],
          // through association order with internal connector as array without direction
          ['Task->Project.createdAt'],
          // through association order with internal connector as string
          'Task->Project.createdAt',

          // through association order with external connector as array with direction
          ['Task.Project.createdAt', 'ASC'],
          // through association order with external connector as array without direction
          ['Task.Project.createdAt'],
          // through association order with external connector as string
          'Task.Project.createdAt',

          // association order as array with direction
          ['Task.createdAt', 'ASC'],
          // association order as array without direction
          ['Task.createdAt'],
          // association order as string
          'Task.createdAt',

          // main order with model name as array with direction
          ['Subtask.createdAt', 'ASC'],
          // main order with model name as array without direction
          ['Subtask.createdAt'],
          // main order with model name as string
          'Subtask.createdAt',

          // main order as array with direction
          ['createdAt', 'ASC'],
          // main order as array without direction
          ['createdAt'],
          // main order as string
          'createdAt'
        ]
      }, {
        default: 'SELECT [Subtask].[id], [Subtask].[name], [Subtask].[createdAt], [Task].[id] AS [Task.id], [Task].[name] AS [Task.name], [Task].[created_at] AS [Task.createdAt], [Task->Project].[id] AS [Task.Project.id], [Task->Project].[name] AS [Task.Project.name], [Task->Project].[created_at] AS [Task.Project.createdAt] FROM [subtask] AS [Subtask] INNER JOIN [task] AS [Task] ON [Subtask].[task_id] = [Task].[id] INNER JOIN [project] AS [Task->Project] ON [Task].[project_id] = [Task->Project].[id] ORDER BY [Task->Project].[created_at] ASC, [Task->Project].[created_at], [Task].[created_at] ASC, [Task].[created_at], [Task->Project].[created_at] ASC, [Task->Project].[created_at], [Task->Project].[created_at], [Task->Project].[created_at] ASC, [Task->Project].[created_at], [Task->Project].[created_at], [Task].[created_at] ASC, [Task].[created_at], [Task].[created_at], [Subtask].[created_at] ASC, [Subtask].[created_at], [Subtask].[created_at], [Subtask].[created_at] ASC, [Subtask].[created_at], [Subtask].[created_at];',
        postgres: 'SELECT "Subtask"."id", "Subtask"."name", "Subtask"."createdAt", "Task"."id" AS "Task.id", "Task"."name" AS "Task.name", "Task"."created_at" AS "Task.createdAt", "Task->Project"."id" AS "Task.Project.id", "Task->Project"."name" AS "Task.Project.name", "Task->Project"."created_at" AS "Task.Project.createdAt" FROM "subtask" AS "Subtask" INNER JOIN "task" AS "Task" ON "Subtask"."task_id" = "Task"."id" INNER JOIN "project" AS "Task->Project" ON "Task"."project_id" = "Task->Project"."id" ORDER BY "Task->Project"."created_at" ASC, "Task->Project"."created_at", "Task"."created_at" ASC, "Task"."created_at", "Task->Project"."created_at" ASC, "Task->Project"."created_at", "Task->Project"."created_at", "Task->Project"."created_at" ASC, "Task->Project"."created_at", "Task->Project"."created_at", "Task"."created_at" ASC, "Task"."created_at", "Task"."created_at", "Subtask"."created_at" ASC, "Subtask"."created_at", "Subtask"."created_at", "Subtask"."created_at" ASC, "Subtask"."created_at", "Subtask"."created_at";'
      });
    }());
  });
});
