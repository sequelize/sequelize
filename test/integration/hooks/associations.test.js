'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , sinon = require('sinon')
  , dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('Hooks'), function() {
  beforeEach(function() {
    this.User = this.sequelize.define('User', {
      username: {
        type: DataTypes.STRING,
        allowNull: false
      },
      mood: {
        type: DataTypes.ENUM,
        values: ['happy', 'sad', 'neutral']
      }
    });

    this.ParanoidUser = this.sequelize.define('ParanoidUser', {
      username: DataTypes.STRING,
      mood: {
        type: DataTypes.ENUM,
        values: ['happy', 'sad', 'neutral']
      }
    }, {
      paranoid: true
    });

    return this.sequelize.sync({ force: true });
  });


  describe('associations', function() {
    describe('1:1', function() {
      describe('cascade onUpdate', function() {
        beforeEach(function() {
          var self = this;

          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasOne(this.Tasks, {onUpdate: 'cascade', hooks: true});
          this.Tasks.belongsTo(this.Projects);

          return this.Projects.sync({ force: true }).then(function() {
            return self.Tasks.sync({ force: true });
          });
        });

        it('on success', function() {
          var self = this
          , beforeHook = false
          , afterHook = false;

          this.Tasks.beforeUpdate(function(task, options, fn) {
            beforeHook = true;
            fn();
          });

          this.Tasks.afterUpdate(function(task, options, fn) {
            afterHook = true;
            fn();
          });

          return this.Projects.create({title: 'New Project'}).then(function(project) {
            return self.Tasks.create({title: 'New Task'}).then(function(task) {
              return project.setTask(task).then(function() {
                return project.updateAttributes({id: 2}).then(function() {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });
        });

        it('on error', function() {
          var self = this;

          this.Tasks.afterUpdate(function(task, options, fn) {
            fn(new Error('Whoops!'));
          });

          return this.Projects.create({title: 'New Project'}).then(function(project) {
            return self.Tasks.create({title: 'New Task'}).then(function(task) {
              return project.setTask(task).catch(function(err) {
                expect(err).to.be.instanceOf(Error);
              });
            });
          });
        });
      });

      describe('cascade onDelete', function() {
        beforeEach(function() {
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasOne(this.Tasks, {onDelete: 'CASCADE', hooks: true});
          this.Tasks.belongsTo(this.Projects);

          return this.sequelize.sync({ force: true });
        });

        describe('#remove', function() {
          it('with no errors', function() {
            var self = this
            , beforeProject = sinon.spy()
            , afterProject = sinon.spy()
            , beforeTask = sinon.spy()
            , afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeDestroy(beforeTask);
            this.Tasks.afterDestroy(afterTask);

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.setTask(task).then(function() {
                  return project.destroy().then(function() {
                    expect(beforeProject).to.have.been.calledOnce;
                    expect(afterProject).to.have.been.calledOnce;
                    expect(beforeTask).to.have.been.calledOnce;
                    expect(afterTask).to.have.been.calledOnce;
                  });
                });
              });
            });
          });

          it('with errors', function() {
            var self = this
            , beforeProject = false
            , afterProject = false
            , beforeTask = false
            , afterTask = false
            , CustomErrorText = 'Whoops!';

            this.Projects.beforeCreate(function(project, options, fn) {
              beforeProject = true;
              fn();
            });

            this.Projects.afterCreate(function(project, options, fn) {
              afterProject = true;
              fn();
            });

            this.Tasks.beforeDestroy(function(task, options, fn) {
              beforeTask = true;
              fn(new Error(CustomErrorText));
            });

            this.Tasks.afterDestroy(function(task, options, fn) {
              afterTask = true;
              fn();
            });

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.setTask(task).then(function() {
                  return expect(project.destroy()).to.eventually.be.rejectedWith(CustomErrorText).then(function () {
                    expect(beforeProject).to.be.true;
                    expect(afterProject).to.be.true;
                    expect(beforeTask).to.be.true;
                    expect(afterTask).to.be.false;
                  });
                });
              });
            });
          });
        });
      });

      describe('no cascade update', function() {
        beforeEach(function() {
          var self = this;

          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasOne(this.Tasks);
          this.Tasks.belongsTo(this.Projects);

          return this.Projects.sync({ force: true }).then(function() {
            return self.Tasks.sync({ force: true });
          });
        });

        it('on success', function() {
          var self = this
          , beforeHook = sinon.spy()
          , afterHook = sinon.spy();

          this.Tasks.beforeUpdate(beforeHook);
          this.Tasks.afterUpdate(afterHook);

          return this.Projects.create({title: 'New Project'}).then(function(project) {
            return self.Tasks.create({title: 'New Task'}).then(function(task) {
              return project.setTask(task).then(function() {
                return project.updateAttributes({id: 2}).then(function() {
                  expect(beforeHook).to.have.been.calledOnce;
                  expect(afterHook).to.have.been.calledOnce;
                });
              });
            });
          });
        });

        it('on error', function() {
          var self = this;

          this.Tasks.afterUpdate(function(task, options) {
            throw new Error('Whoops!');
          });

          return this.Projects.create({title: 'New Project'}).then(function(project) {
            return self.Tasks.create({title: 'New Task'}).then(function(task) {
              return expect(project.setTask(task)).to.be.rejected;
            });
          });
        });
      });

      describe('no cascade delete', function() {
        beforeEach(function() {
          var self = this;

          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasMany(this.Tasks);
          this.Tasks.belongsTo(this.Projects);

          return this.Projects.sync({ force: true }).then(function() {
            return self.Tasks.sync({ force: true });
          });
        });

        describe('#remove', function() {
          it('with no errors', function() {
            var self = this
            , beforeProject = sinon.spy()
            , afterProject = sinon.spy()
            , beforeTask = sinon.spy()
            , afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeUpdate(beforeTask);
            this.Tasks.afterUpdate(afterTask);

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).then(function() {
                  return project.removeTask(task).then(function() {
                    expect(beforeProject).to.have.been.called;
                    expect(afterProject).to.have.been.called;
                    expect(beforeTask).not.to.have.been.called;
                    expect(afterTask).not.to.have.been.called;
                  });
                });
              });
            });
          });

          it('with errors', function() {
            var self = this
            , beforeProject = sinon.spy()
            , afterProject = sinon.spy()
            , beforeTask = sinon.spy()
            , afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeUpdate(function(task, options) {
              beforeTask();
              throw new Error('Whoops!');
            });
            this.Tasks.afterUpdate(afterTask);

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeProject).to.have.been.calledOnce;
                  expect(afterProject).to.have.been.calledOnce;
                  expect(beforeTask).to.have.been.calledOnce;
                  expect(afterTask).not.to.have.been.called;
                });
              });
            });
          });
        });
      });
    });

    describe('1:M', function() {
      describe('cascade', function() {
        beforeEach(function() {
          var self = this;
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasMany(this.Tasks, {onDelete: 'cascade', hooks: true});
          this.Tasks.belongsTo(this.Projects, {hooks: true});

          return this.Projects.sync({ force: true }).then(function() {
            return self.Tasks.sync({ force: true });
          });
        });

        describe('#remove', function() {
          it('with no errors', function() {
            var self = this
            , beforeProject = sinon.spy()
            , afterProject = sinon.spy()
            , beforeTask = sinon.spy()
            , afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeDestroy(beforeTask);
            this.Tasks.afterDestroy(afterTask);

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).then(function() {
                  return project.destroy().then(function() {
                    expect(beforeProject).to.have.been.calledOnce;
                    expect(afterProject).to.have.been.calledOnce;
                    expect(beforeTask).to.have.been.calledOnce;
                    expect(afterTask).to.have.been.calledOnce;
                  });
                });
              });
            });
          });

          it('with errors', function() {
            var self = this
            , beforeProject = false
            , afterProject = false
            , beforeTask = false
            , afterTask = false;

            this.Projects.beforeCreate(function(project, options, fn) {
              beforeProject = true;
              fn();
            });

            this.Projects.afterCreate(function(project, options, fn) {
              afterProject = true;
              fn();
            });

            this.Tasks.beforeDestroy(function(task, options, fn) {
              beforeTask = true;
              fn(new Error('Whoops!'));
            });

            this.Tasks.afterDestroy(function(task, options, fn) {
              afterTask = true;
              fn();
            });

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).then(function() {
                  return project.destroy().catch(function(err) {
                    expect(err).to.be.instanceOf(Error);
                    expect(beforeProject).to.be.true;
                    expect(afterProject).to.be.true;
                    expect(beforeTask).to.be.true;
                    expect(afterTask).to.be.false;
                  });
                });
              });
            });
          });
        });
      });

      describe('no cascade', function() {
        beforeEach(function() {
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasMany(this.Tasks);
          this.Tasks.belongsTo(this.Projects);

          return this.sequelize.sync({ force: true });
        });

        describe('#remove', function() {
          it('with no errors', function() {
            var self = this
            , beforeProject = sinon.spy()
            , afterProject = sinon.spy()
            , beforeTask = sinon.spy()
            , afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeUpdate(beforeTask);
            this.Tasks.afterUpdate(afterTask);

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).then(function() {
                  return project.removeTask(task).then(function() {
                    expect(beforeProject).to.have.been.called;
                    expect(afterProject).to.have.been.called;
                    expect(beforeTask).not.to.have.been.called;
                    expect(afterTask).not.to.have.been.called;
                  });
                });
              });
            });
          });

          it('with errors', function() {
            var self = this
            , beforeProject = false
            , afterProject = false
            , beforeTask = false
            , afterTask = false;

            this.Projects.beforeCreate(function(project, options, fn) {
              beforeProject = true;
              fn();
            });

            this.Projects.afterCreate(function(project, options, fn) {
              afterProject = true;
              fn();
            });

            this.Tasks.beforeUpdate(function(task, options, fn) {
              beforeTask = true;
              fn(new Error('Whoops!'));
            });

            this.Tasks.afterUpdate(function(task, options, fn) {
              afterTask = true;
              fn();
            });

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).catch(function(err) {
                  expect(err).to.be.instanceOf(Error);
                  expect(beforeProject).to.be.true;
                  expect(afterProject).to.be.true;
                  expect(beforeTask).to.be.true;
                  expect(afterTask).to.be.false;
                });
              });
            });
          });
        });
      });
    });

    describe('M:M', function() {
      describe('cascade', function() {
        beforeEach(function() {
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.belongsToMany(this.Tasks, {cascade: 'onDelete', through: 'projects_and_tasks', hooks: true});
          this.Tasks.belongsToMany(this.Projects, {cascade: 'onDelete', through: 'projects_and_tasks', hooks: true});

          return this.sequelize.sync({ force: true });
        });

        describe('#remove', function() {
          it('with no errors', function() {
            var self = this
            , beforeProject = sinon.spy()
            , afterProject = sinon.spy()
            , beforeTask = sinon.spy()
            , afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeDestroy(beforeTask);
            this.Tasks.afterDestroy(afterTask);

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).then(function() {
                  return project.destroy().then(function() {
                    expect(beforeProject).to.have.been.calledOnce;
                    expect(afterProject).to.have.been.calledOnce;
                    // Since Sequelize does not cascade M:M, these should be false
                    expect(beforeTask).not.to.have.been.called;
                    expect(afterTask).not.to.have.been.called;
                  });
                });
              });
            });
          });

          it('with errors', function() {
            var self = this
            , beforeProject = false
            , afterProject = false
            , beforeTask = false
            , afterTask = false;

            this.Projects.beforeCreate(function(project, options, fn) {
              beforeProject = true;
              fn();
            });

            this.Projects.afterCreate(function(project, options, fn) {
              afterProject = true;
              fn();
            });

            this.Tasks.beforeDestroy(function(task, options, fn) {
              beforeTask = true;
              fn(new Error('Whoops!'));
            });

            this.Tasks.afterDestroy(function(task, options, fn) {
              afterTask = true;
              fn();
            });

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).then(function() {
                  return project.destroy().then(function() {
                    expect(beforeProject).to.be.true;
                    expect(afterProject).to.be.true;
                    expect(beforeTask).to.be.false;
                    expect(afterTask).to.be.false;
                  });
                });
              });
            });
          });
        });
      });

      describe('no cascade', function() {
        beforeEach(function() {
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.belongsToMany(this.Tasks, {hooks: true, through: 'project_tasks'});
          this.Tasks.belongsToMany(this.Projects, {hooks: true, through: 'project_tasks'});

          return this.sequelize.sync({ force: true });
        });

        describe('#remove', function() {
          it('with no errors', function() {
            var self = this
            , beforeProject = sinon.spy()
            , afterProject = sinon.spy()
            , beforeTask = sinon.spy()
            , afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeUpdate(beforeTask);
            this.Tasks.afterUpdate(afterTask);

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).then(function() {
                  return project.removeTask(task).then(function() {
                    expect(beforeProject).to.have.been.calledOnce;
                    expect(afterProject).to.have.been.calledOnce;
                    expect(beforeTask).not.to.have.been.called;
                    expect(afterTask).not.to.have.been.called;
                  });
                });
              });
            });
          });

          it('with errors', function() {
            var self = this
            , beforeProject = false
            , afterProject = false
            , beforeTask = false
            , afterTask = false;

            this.Projects.beforeCreate(function(project, options, fn) {
              beforeProject = true;
              fn();
            });

            this.Projects.afterCreate(function(project, options, fn) {
              afterProject = true;
              fn();
            });

            this.Tasks.beforeUpdate(function(task, options, fn) {
              beforeTask = true;
              fn(new Error('Whoops!'));
            });

            this.Tasks.afterUpdate(function(task, options, fn) {
              afterTask = true;
              fn();
            });

            return this.Projects.create({title: 'New Project'}).then(function(project) {
              return self.Tasks.create({title: 'New Task'}).then(function(task) {
                return project.addTask(task).then(function() {
                  expect(beforeProject).to.be.true;
                  expect(afterProject).to.be.true;
                  expect(beforeTask).to.be.false;
                  expect(afterTask).to.be.false;
                });
              });
            });
          });
        });
      });
    });

    // NOTE: Reenable when FK constraints create table query is fixed when using hooks
    if (dialect !== 'mssql') {
      describe('multiple 1:M', function () {

        describe('cascade', function() {
          beforeEach(function() {
            this.Projects = this.sequelize.define('Project', {
              title: DataTypes.STRING
            });

            this.Tasks = this.sequelize.define('Task', {
              title: DataTypes.STRING
            });

            this.MiniTasks = this.sequelize.define('MiniTask', {
              mini_title: DataTypes.STRING
            });

            this.Projects.hasMany(this.Tasks, {onDelete: 'cascade', hooks: true});
            this.Projects.hasMany(this.MiniTasks, {onDelete: 'cascade', hooks: true});

            this.Tasks.belongsTo(this.Projects, {hooks: true});
            this.Tasks.hasMany(this.MiniTasks, {onDelete: 'cascade', hooks: true});

            this.MiniTasks.belongsTo(this.Projects, {hooks: true});
            this.MiniTasks.belongsTo(this.Tasks, {hooks: true});

            return this.sequelize.sync({force: true});
          });

          describe('#remove', function() {
            it('with no errors', function() {
              var beforeProject = false
              , afterProject = false
              , beforeTask = false
              , afterTask = false
              , beforeMiniTask = false
              , afterMiniTask = false;

              this.Projects.beforeCreate(function(project, options, fn) {
                beforeProject = true;
                fn();
              });

              this.Projects.afterCreate(function(project, options, fn) {
                afterProject = true;
                fn();
              });

              this.Tasks.beforeDestroy(function(task, options, fn) {
                beforeTask = true;
                fn();
              });

              this.Tasks.afterDestroy(function(task, options, fn) {
                afterTask = true;
                fn();
              });

              this.MiniTasks.beforeDestroy(function(minitask, options, fn) {
                beforeMiniTask = true;
                fn();
              });

              this.MiniTasks.afterDestroy(function(minitask, options, fn) {
                afterMiniTask = true;
                fn();
              });

              return this.sequelize.Promise.all([
                this.Projects.create({title: 'New Project'}),
                this.MiniTasks.create({mini_title: 'New MiniTask'})
              ]).bind(this).spread(function(project, minitask) {
                return project.addMiniTask(minitask);
              }).then(function(project) {
                return project.destroy();
              }).then(function() {
                expect(beforeProject).to.be.true;
                expect(afterProject).to.be.true;
                expect(beforeTask).to.be.false;
                expect(afterTask).to.be.false;
                expect(beforeMiniTask).to.be.true;
                expect(afterMiniTask).to.be.true;
              });

            });

            it('with errors', function() {
              var beforeProject = false
              , afterProject = false
              , beforeTask = false
              , afterTask = false
              , beforeMiniTask = false
              , afterMiniTask = false;

              this.Projects.beforeCreate(function(project, options, fn) {
                beforeProject = true;
                fn();
              });

              this.Projects.afterCreate(function(project, options, fn) {
                afterProject = true;
                fn();
              });

              this.Tasks.beforeDestroy(function(task, options, fn) {
                beforeTask = true;
                fn();
              });

              this.Tasks.afterDestroy(function(task, options, fn) {
                afterTask = true;
                fn();
              });

              this.MiniTasks.beforeDestroy(function(minitask, options, fn) {
                beforeMiniTask = true;
                fn(new Error('Whoops!'));
              });

              this.MiniTasks.afterDestroy(function(minitask, options, fn) {
                afterMiniTask = true;
                fn();
              });

              return this.sequelize.Promise.all([
                this.Projects.create({title: 'New Project'}),
                this.MiniTasks.create({mini_title: 'New MiniTask'})
              ]).bind(this).spread(function(project, minitask) {
                return project.addMiniTask(minitask);
              }).then(function(project) {
                return project.destroy();
              }).catch(function() {
                expect(beforeProject).to.be.true;
                expect(afterProject).to.be.true;
                expect(beforeTask).to.be.false;
                expect(afterTask).to.be.false;
                expect(beforeMiniTask).to.be.true;
                expect(afterMiniTask).to.be.false;
              });
            });
          });
        });
      });

      describe('multiple 1:M sequential hooks', function () {
        describe('cascade', function() {
          beforeEach(function() {
            this.Projects = this.sequelize.define('Project', {
              title: DataTypes.STRING
            });

            this.Tasks = this.sequelize.define('Task', {
              title: DataTypes.STRING
            });

            this.MiniTasks = this.sequelize.define('MiniTask', {
              mini_title: DataTypes.STRING
            });

            this.Projects.hasMany(this.Tasks, {onDelete: 'cascade', hooks: true});
            this.Projects.hasMany(this.MiniTasks, {onDelete: 'cascade', hooks: true});

            this.Tasks.belongsTo(this.Projects, {hooks: true});
            this.Tasks.hasMany(this.MiniTasks, {onDelete: 'cascade', hooks: true});

            this.MiniTasks.belongsTo(this.Projects, {hooks: true});
            this.MiniTasks.belongsTo(this.Tasks, {hooks: true});

            return this.sequelize.sync({force: true});
          });

          describe('#remove', function() {
            it('with no errors', function() {
              var beforeProject = false
              , afterProject = false
              , beforeTask = false
              , afterTask = false
              , beforeMiniTask = false
              , afterMiniTask = false;

              this.Projects.beforeCreate(function(project, options, fn) {
                beforeProject = true;
                fn();
              });

              this.Projects.afterCreate(function(project, options, fn) {
                afterProject = true;
                fn();
              });

              this.Tasks.beforeDestroy(function(task, options, fn) {
                beforeTask = true;
                fn();
              });

              this.Tasks.afterDestroy(function(task, options, fn) {
                afterTask = true;
                fn();
              });

              this.MiniTasks.beforeDestroy(function(minitask, options, fn) {
                beforeMiniTask = true;
                fn();
              });

              this.MiniTasks.afterDestroy(function(minitask, options, fn) {
                afterMiniTask = true;
                fn();
              });

              return this.sequelize.Promise.all([
                this.Projects.create({title: 'New Project'}),
                this.Tasks.create({title: 'New Task'}),
                this.MiniTasks.create({mini_title: 'New MiniTask'})
              ]).bind(this).spread(function(project, task, minitask) {
                return this.sequelize.Promise.all([
                  task.addMiniTask(minitask),
                  project.addTask(task)
                ]).return(project);
              }).then(function(project) {
                return project.destroy();
              }).then(function() {
                expect(beforeProject).to.be.true;
                expect(afterProject).to.be.true;
                expect(beforeTask).to.be.true;
                expect(afterTask).to.be.true;
                expect(beforeMiniTask).to.be.true;
                expect(afterMiniTask).to.be.true;
              });
            });

            it('with errors', function() {
              var beforeProject = false
              , afterProject = false
              , beforeTask = false
              , afterTask = false
              , beforeMiniTask = false
              , afterMiniTask = false
              , CustomErrorText = 'Whoops!';

              this.Projects.beforeCreate(function() {
                beforeProject = true;
              });

              this.Projects.afterCreate(function() {
                afterProject = true;
              });

              this.Tasks.beforeDestroy(function() {
                beforeTask = true;
                throw new Error(CustomErrorText);
              });

              this.Tasks.afterDestroy(function() {
                afterTask = true;
              });

              this.MiniTasks.beforeDestroy(function() {
                beforeMiniTask = true;
              });

              this.MiniTasks.afterDestroy(function() {
                afterMiniTask = true;
              });

              return this.sequelize.Promise.all([
                this.Projects.create({title: 'New Project'}),
                this.Tasks.create({title: 'New Task'}),
                this.MiniTasks.create({mini_title: 'New MiniTask'})
              ]).bind(this).spread(function(project, task, minitask) {
                return this.sequelize.Promise.all([
                  task.addMiniTask(minitask),
                  project.addTask(task)
                ]).return(project);
              }).then(function(project) {
                return expect(project.destroy()).to.eventually.be.rejectedWith(CustomErrorText).then(function () {
                  expect(beforeProject).to.be.true;
                  expect(afterProject).to.be.true;
                  expect(beforeTask).to.be.true;
                  expect(afterTask).to.be.false;
                  expect(beforeMiniTask).to.be.false;
                  expect(afterMiniTask).to.be.false;
                });
              });
            });
          });
        });
      });
    }

  });

});
