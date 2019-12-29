'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  sinon = require('sinon'),
  dialect = Support.getTestDialect(),
  Promise = require('bluebird');

describe(Support.getTestDialectTeaser('Hooks'), () => {
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


  describe('associations', () => {
    describe('1:1', () => {
      describe('cascade onUpdate', () => {
        beforeEach(function() {
          const self = this;

          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasOne(this.Tasks, {onUpdate: 'cascade', hooks: true});
          this.Tasks.belongsTo(this.Projects);

          return this.Projects.sync({ force: true }).then(() => {
            return self.Tasks.sync({ force: true });
          });
        });

        it('on success', function() {
          const self = this;
          let beforeHook = false,
            afterHook = false;

          this.Tasks.beforeUpdate(() => {
            beforeHook = true;
            return Promise.resolve();
          });

          this.Tasks.afterUpdate(() => {
            afterHook = true;
            return Promise.resolve();
          });

          return this.Projects.create({title: 'New Project'}).then(project => {
            return self.Tasks.create({title: 'New Task'}).then(task => {
              return project.setTask(task).then(() => {
                return project.updateAttributes({id: 2}).then(() => {
                  expect(beforeHook).to.be.true;
                  expect(afterHook).to.be.true;
                });
              });
            });
          });
        });

        it('on error', function() {
          const self = this;

          this.Tasks.afterUpdate(() => {
            return Promise.reject(new Error('Whoops!'));
          });

          return this.Projects.create({title: 'New Project'}).then(project => {
            return self.Tasks.create({title: 'New Task'}).then(task => {
              return project.setTask(task).catch(err => {
                expect(err).to.be.instanceOf(Error);
              });
            });
          });
        });
      });

      describe('cascade onDelete', () => {
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

        describe('#remove', () => {
          it('with no errors', function() {
            const self = this,
              beforeProject = sinon.spy(),
              afterProject = sinon.spy(),
              beforeTask = sinon.spy(),
              afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeDestroy(beforeTask);
            this.Tasks.afterDestroy(afterTask);

            return this.Projects.create({title: 'New Project'}).then(project => {
              return self.Tasks.create({title: 'New Task'}).then(task => {
                return project.setTask(task).then(() => {
                  return project.destroy().then(() => {
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
            const self = this,
              CustomErrorText = 'Whoops!';
            let beforeProject = false,
              afterProject = false,
              beforeTask = false,
              afterTask = false;

            this.Projects.beforeCreate(() => {
              beforeProject = true;
              return Promise.resolve();
            });

            this.Projects.afterCreate(() => {
              afterProject = true;
              return Promise.resolve();
            });

            this.Tasks.beforeDestroy(() => {
              beforeTask = true;
              return Promise.reject(new Error(CustomErrorText));
            });

            this.Tasks.afterDestroy(() => {
              afterTask = true;
              return Promise.resolve();
            });

            return this.Projects.create({title: 'New Project'}).then(project => {
              return self.Tasks.create({title: 'New Task'}).then(task => {
                return project.setTask(task).then(() => {
                  return expect(project.destroy()).to.eventually.be.rejectedWith(CustomErrorText).then(() => {
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

      describe('no cascade update', () => {
        beforeEach(function() {
          const self = this;

          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasOne(this.Tasks);
          this.Tasks.belongsTo(this.Projects);

          return this.Projects.sync({ force: true }).then(() => {
            return self.Tasks.sync({ force: true });
          });
        });

        it('on success', function() {
          const self = this,
            beforeHook = sinon.spy(),
            afterHook = sinon.spy();

          this.Tasks.beforeUpdate(beforeHook);
          this.Tasks.afterUpdate(afterHook);

          return this.Projects.create({title: 'New Project'}).then(project => {
            return self.Tasks.create({title: 'New Task'}).then(task => {
              return project.setTask(task).then(() => {
                return project.updateAttributes({id: 2}).then(() => {
                  expect(beforeHook).to.have.been.calledOnce;
                  expect(afterHook).to.have.been.calledOnce;
                });
              });
            });
          });
        });

        it('on error', function() {
          const self = this;

          this.Tasks.afterUpdate(() => {
            throw new Error('Whoops!');
          });

          return this.Projects.create({title: 'New Project'}).then(project => {
            return self.Tasks.create({title: 'New Task'}).then(task => {
              return expect(project.setTask(task)).to.be.rejected;
            });
          });
        });
      });

      describe('no cascade delete', () => {
        beforeEach(function() {
          const self = this;

          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasMany(this.Tasks);
          this.Tasks.belongsTo(this.Projects);

          return this.Projects.sync({ force: true }).then(() => {
            return self.Tasks.sync({ force: true });
          });
        });

        describe('#remove', () => {
          it('with no errors', function() {
            const self = this,
              beforeProject = sinon.spy(),
              afterProject = sinon.spy(),
              beforeTask = sinon.spy(),
              afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeUpdate(beforeTask);
            this.Tasks.afterUpdate(afterTask);

            return this.Projects.create({title: 'New Project'}).then(project => {
              return self.Tasks.create({title: 'New Task'}).then(task => {
                return project.addTask(task).then(() => {
                  return project.removeTask(task).then(() => {
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
            const self = this,
              beforeProject = sinon.spy(),
              afterProject = sinon.spy(),
              beforeTask = sinon.spy(),
              afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeUpdate(() => {
              beforeTask();
              throw new Error('Whoops!');
            });
            this.Tasks.afterUpdate(afterTask);

            return this.Projects.create({title: 'New Project'}).then(project => {
              return self.Tasks.create({title: 'New Task'}).then(task => {
                return project.addTask(task).catch(err => {
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

    describe('1:M', () => {
      describe('cascade', () => {
        beforeEach(function() {
          const self = this;
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING
          });

          this.Projects.hasMany(this.Tasks, {onDelete: 'cascade', hooks: true});
          this.Tasks.belongsTo(this.Projects, {hooks: true});

          return this.Projects.sync({ force: true }).then(() => {
            return self.Tasks.sync({ force: true });
          });
        });

        describe('#remove', () => {
          it('with no errors', function() {
            const self = this,
              beforeProject = sinon.spy(),
              afterProject = sinon.spy(),
              beforeTask = sinon.spy(),
              afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeDestroy(beforeTask);
            this.Tasks.afterDestroy(afterTask);

            return this.Projects.create({title: 'New Project'}).then(project => {
              return self.Tasks.create({title: 'New Task'}).then(task => {
                return project.addTask(task).then(() => {
                  return project.destroy().then(() => {
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
            const self = this;
            let beforeProject = false,
              afterProject = false,
              beforeTask = false,
              afterTask = false;

            this.Projects.beforeCreate(() => {
              beforeProject = true;
              return Promise.resolve();
            });

            this.Projects.afterCreate(() => {
              afterProject = true;
              return Promise.resolve();
            });

            this.Tasks.beforeDestroy(() => {
              beforeTask = true;
              return Promise.reject(new Error('Whoops!'));
            });

            this.Tasks.afterDestroy(() => {
              afterTask = true;
              return Promise.resolve();
            });

            return this.Projects.create({title: 'New Project'}).then(project => {
              return self.Tasks.create({title: 'New Task'}).then(task => {
                return project.addTask(task).then(() => {
                  return project.destroy().catch(err => {
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

      describe('no cascade', () => {
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

        describe('#remove', () => {
          it('with no errors', function() {
            const self = this,
              beforeProject = sinon.spy(),
              afterProject = sinon.spy(),
              beforeTask = sinon.spy(),
              afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeUpdate(beforeTask);
            this.Tasks.afterUpdate(afterTask);

            return this.Projects.create({title: 'New Project'}).then(project => {
              return self.Tasks.create({title: 'New Task'}).then(task => {
                return project.addTask(task).then(() => {
                  return project.removeTask(task).then(() => {
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
            const self = this;
            let beforeProject = false,
              afterProject = false,
              beforeTask = false,
              afterTask = false;

            this.Projects.beforeCreate(() => {
              beforeProject = true;
              return Promise.resolve();
            });

            this.Projects.afterCreate(() => {
              afterProject = true;
              return Promise.resolve();
            });

            this.Tasks.beforeUpdate(() => {
              beforeTask = true;
              return Promise.reject(new Error('Whoops!'));
            });

            this.Tasks.afterUpdate(() => {
              afterTask = true;
              return Promise.resolve();
            });

            return this.Projects.create({title: 'New Project'}).then(project => {
              return self.Tasks.create({title: 'New Task'}).then(task => {
                return project.addTask(task).catch(err => {
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

    describe('M:M', () => {
      describe('cascade', () => {
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

        describe('#remove', () => {
          it('with no errors', function() {
            const self = this,
              beforeProject = sinon.spy(),
              afterProject = sinon.spy(),
              beforeTask = sinon.spy(),
              afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeDestroy(beforeTask);
            this.Tasks.afterDestroy(afterTask);

            return this.Projects.create({title: 'New Project'}).then(project => {
              return self.Tasks.create({title: 'New Task'}).then(task => {
                return project.addTask(task).then(() => {
                  return project.destroy().then(() => {
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
            const self = this;
            let beforeProject = false,
              afterProject = false,
              beforeTask = false,
              afterTask = false;

            this.Projects.beforeCreate(() => {
              beforeProject = true;
              return Promise.resolve();
            });

            this.Projects.afterCreate(() => {
              afterProject = true;
              return Promise.resolve();
            });

            this.Tasks.beforeDestroy(() => {
              beforeTask = true;
              return Promise.reject(new Error('Whoops!'));
            });

            this.Tasks.afterDestroy(() => {
              afterTask = true;
              return Promise.resolve();
            });

            return this.Projects.create({title: 'New Project'}).then(project => {
              return self.Tasks.create({title: 'New Task'}).then(task => {
                return project.addTask(task).then(() => {
                  return project.destroy().then(() => {
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

      describe('no cascade', () => {
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

        describe('#remove', () => {
          it('with no errors', function() {
            const self = this,
              beforeProject = sinon.spy(),
              afterProject = sinon.spy(),
              beforeTask = sinon.spy(),
              afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeUpdate(beforeTask);
            this.Tasks.afterUpdate(afterTask);

            return this.Projects.create({title: 'New Project'}).then(project => {
              return self.Tasks.create({title: 'New Task'}).then(task => {
                return project.addTask(task).then(() => {
                  return project.removeTask(task).then(() => {
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
            const self = this;
            let beforeProject = false,
              afterProject = false,
              beforeTask = false,
              afterTask = false;

            this.Projects.beforeCreate(() => {
              beforeProject = true;
              return Promise.resolve();
            });

            this.Projects.afterCreate(() => {
              afterProject = true;
              return Promise.resolve();
            });

            this.Tasks.beforeUpdate(() => {
              beforeTask = true;
              return Promise.reject(new Error('Whoops!'));
            });

            this.Tasks.afterUpdate(() => {
              afterTask = true;
              return Promise.resolve();
            });

            return this.Projects.create({title: 'New Project'}).then(project => {
              return self.Tasks.create({title: 'New Task'}).then(task => {
                return project.addTask(task).then(() => {
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
      describe('multiple 1:M', () => {

        describe('cascade', () => {
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

          describe('#remove', () => {
            it('with no errors', function() {
              let beforeProject = false,
                afterProject = false,
                beforeTask = false,
                afterTask = false,
                beforeMiniTask = false,
                afterMiniTask = false;

              this.Projects.beforeCreate(() => {
                beforeProject = true;
                return Promise.resolve();
              });

              this.Projects.afterCreate(() => {
                afterProject = true;
                return Promise.resolve();
              });

              this.Tasks.beforeDestroy(() => {
                beforeTask = true;
                return Promise.resolve();
              });

              this.Tasks.afterDestroy(() => {
                afterTask = true;
                return Promise.resolve();
              });

              this.MiniTasks.beforeDestroy(() => {
                beforeMiniTask = true;
                return Promise.resolve();
              });

              this.MiniTasks.afterDestroy(() => {
                afterMiniTask = true;
                return Promise.resolve();
              });

              return this.sequelize.Promise.all([
                this.Projects.create({title: 'New Project'}),
                this.MiniTasks.create({mini_title: 'New MiniTask'})
              ]).bind(this).spread((project, minitask) => {
                return project.addMiniTask(minitask);
              }).then(project => {
                return project.destroy();
              }).then(() => {
                expect(beforeProject).to.be.true;
                expect(afterProject).to.be.true;
                expect(beforeTask).to.be.false;
                expect(afterTask).to.be.false;
                expect(beforeMiniTask).to.be.true;
                expect(afterMiniTask).to.be.true;
              });

            });

            it('with errors', function() {
              let beforeProject = false,
                afterProject = false,
                beforeTask = false,
                afterTask = false,
                beforeMiniTask = false,
                afterMiniTask = false;

              this.Projects.beforeCreate(() => {
                beforeProject = true;
                return Promise.resolve();
              });

              this.Projects.afterCreate(() => {
                afterProject = true;
                return Promise.resolve();
              });

              this.Tasks.beforeDestroy(() => {
                beforeTask = true;
                return Promise.resolve();
              });

              this.Tasks.afterDestroy(() => {
                afterTask = true;
                return Promise.resolve();
              });

              this.MiniTasks.beforeDestroy(() => {
                beforeMiniTask = true;
                return Promise.reject(new Error('Whoops!'));
              });

              this.MiniTasks.afterDestroy(() => {
                afterMiniTask = true;
                return Promise.resolve();
              });

              return this.sequelize.Promise.all([
                this.Projects.create({title: 'New Project'}),
                this.MiniTasks.create({mini_title: 'New MiniTask'})
              ]).bind(this).spread((project, minitask) => {
                return project.addMiniTask(minitask);
              }).then(project => {
                return project.destroy();
              }).catch(() => {
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

      describe('multiple 1:M sequential hooks', () => {
        describe('cascade', () => {
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

          describe('#remove', () => {
            it('with no errors', function() {
              let beforeProject = false,
                afterProject = false,
                beforeTask = false,
                afterTask = false,
                beforeMiniTask = false,
                afterMiniTask = false;

              this.Projects.beforeCreate(() => {
                beforeProject = true;
                return Promise.resolve();
              });

              this.Projects.afterCreate(() => {
                afterProject = true;
                return Promise.resolve();
              });

              this.Tasks.beforeDestroy(() => {
                beforeTask = true;
                return Promise.resolve();
              });

              this.Tasks.afterDestroy(() => {
                afterTask = true;
                return Promise.resolve();
              });

              this.MiniTasks.beforeDestroy(() => {
                beforeMiniTask = true;
                return Promise.resolve();
              });

              this.MiniTasks.afterDestroy(() => {
                afterMiniTask = true;
                return Promise.resolve();
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
              }).then(project => {
                return project.destroy();
              }).then(() => {
                expect(beforeProject).to.be.true;
                expect(afterProject).to.be.true;
                expect(beforeTask).to.be.true;
                expect(afterTask).to.be.true;
                expect(beforeMiniTask).to.be.true;
                expect(afterMiniTask).to.be.true;
              });
            });

            it('with errors', function() {
              let beforeProject = false,
                afterProject = false,
                beforeTask = false,
                afterTask = false,
                beforeMiniTask = false,
                afterMiniTask = false;
              const CustomErrorText = 'Whoops!';

              this.Projects.beforeCreate(() => {
                beforeProject = true;
              });

              this.Projects.afterCreate(() => {
                afterProject = true;
              });

              this.Tasks.beforeDestroy(() => {
                beforeTask = true;
                throw new Error(CustomErrorText);
              });

              this.Tasks.afterDestroy(() => {
                afterTask = true;
              });

              this.MiniTasks.beforeDestroy(() => {
                beforeMiniTask = true;
              });

              this.MiniTasks.afterDestroy(() => {
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
              }).then(project => {
                return expect(project.destroy()).to.eventually.be.rejectedWith(CustomErrorText).then(() => {
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
