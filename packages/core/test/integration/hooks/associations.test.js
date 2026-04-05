'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes } = require('@sequelize/core');
const sinon = require('sinon');

const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('Hooks'), () => {
  beforeEach(async function () {
    this.User = this.sequelize.define('User', {
      username: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      mood: {
        type: DataTypes.ENUM(['happy', 'sad', 'neutral']),
      },
    });

    this.ParanoidUser = this.sequelize.define(
      'ParanoidUser',
      {
        username: DataTypes.STRING,
        mood: {
          type: DataTypes.ENUM(['happy', 'sad', 'neutral']),
        },
      },
      {
        paranoid: true,
      },
    );

    await this.sequelize.sync({ force: true });
  });

  describe('associations', () => {
    describe('1:1', () => {
      describe('cascade onUpdate', () => {
        beforeEach(async function () {
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING,
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING,
          });

          this.Projects.hasOne(this.Tasks, { foreignKey: { onUpdate: 'cascade' }, hooks: true });

          await this.Projects.sync({ force: true });

          await this.Tasks.sync({ force: true });
        });

        it('on success', async function () {
          let beforeHook = false;
          let afterHook = false;

          this.Tasks.beforeUpdate(async () => {
            beforeHook = true;
          });

          this.Tasks.afterUpdate(async () => {
            afterHook = true;
          });

          const project = await this.Projects.create({ title: 'New Project' });
          const task = await this.Tasks.create({ title: 'New Task' });
          await project.setTask(task);
          await project.update({ id: 2 });
          expect(beforeHook).to.be.true;
          expect(afterHook).to.be.true;
        });

        it('on error', async function () {
          this.Tasks.afterUpdate(async () => {
            throw new Error('Whoops!');
          });

          const project = await this.Projects.create({ title: 'New Project' });
          const task = await this.Tasks.create({ title: 'New Task' });

          try {
            await project.setTask(task);
          } catch (error) {
            expect(error).to.be.instanceOf(Error);
          }
        });
      });

      // this test makes no sense: task was destroyed by the database through CASCADE.
      //  there is no way for Sequelize to call its beforeDestroy/afterDestroy
      // describe('destroy() with cascade onDelete', () => {
      //   beforeEach(async function () {
      //     this.Projects = this.sequelize.define('Project', {
      //       title: DataTypes.STRING,
      //     });
      //
      //     this.Tasks = this.sequelize.define('Task', {
      //       title: DataTypes.STRING,
      //     });
      //
      //     this.Projects.hasOne(this.Tasks, { foreignKey: { onDelete: 'CASCADE' }, hooks: true });
      //
      //     await this.sequelize.sync({ force: true });
      //   });
      //
      //   it('with no errors', async function () {
      //     const beforeProject = sinon.spy();
      //     const afterProject = sinon.spy();
      //     const beforeTask = sinon.spy();
      //     const afterTask = sinon.spy();
      //
      //     this.Projects.beforeCreate(beforeProject);
      //     this.Projects.afterCreate(afterProject);
      //     this.Tasks.beforeDestroy(beforeTask);
      //     this.Tasks.afterDestroy(afterTask);
      //
      //     const project = await this.Projects.create({ title: 'New Project' });
      //     const task = await this.Tasks.create({ title: 'New Task' });
      //     await project.setTask(task);
      //     await project.destroy();
      //     expect(beforeProject).to.have.been.calledOnce;
      //     expect(afterProject).to.have.been.calledOnce;
      //     expect(beforeTask).to.have.been.calledOnce;
      //     expect(afterTask).to.have.been.calledOnce;
      //   });
      //
      //   it('with errors', async function () {
      //     const CustomErrorText = 'Whoops!';
      //     let beforeProject = false;
      //     let afterProject = false;
      //     let beforeTask = false;
      //     let afterTask = false;
      //
      //     this.Projects.beforeCreate(async () => {
      //       beforeProject = true;
      //     });
      //
      //     this.Projects.afterCreate(async () => {
      //       afterProject = true;
      //     });
      //
      //     this.Tasks.beforeDestroy(async () => {
      //       beforeTask = true;
      //       throw new Error(CustomErrorText);
      //     });
      //
      //     this.Tasks.afterDestroy(async () => {
      //       afterTask = true;
      //     });
      //
      //     const project = await this.Projects.create({ title: 'New Project' });
      //     const task = await this.Tasks.create({ title: 'New Task' });
      //     await project.setTask(task);
      //     await expect(project.destroy()).to.eventually.be.rejectedWith(CustomErrorText);
      //     expect(beforeProject).to.be.true;
      //     expect(afterProject).to.be.true;
      //     expect(beforeTask).to.be.true;
      //     expect(afterTask).to.be.false;
      //   });
      // });

      describe('no cascade update', () => {
        beforeEach(async function () {
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING,
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING,
          });

          this.Projects.hasOne(this.Tasks);
          this.Tasks.belongsTo(this.Projects);

          await this.Projects.sync({ force: true });

          await this.Tasks.sync({ force: true });
        });

        it('on success', async function () {
          const beforeHook = sinon.spy();
          const afterHook = sinon.spy();

          this.Tasks.beforeUpdate(beforeHook);
          this.Tasks.afterUpdate(afterHook);

          const project = await this.Projects.create({ title: 'New Project' });
          const task = await this.Tasks.create({ title: 'New Task' });
          await project.setTask(task);
          await project.update({ id: 2 });
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).to.have.been.calledOnce;
        });

        it('on error', async function () {
          this.Tasks.afterUpdate(() => {
            throw new Error('Whoops!');
          });

          const project = await this.Projects.create({ title: 'New Project' });
          const task = await this.Tasks.create({ title: 'New Task' });

          await expect(project.setTask(task)).to.be.rejected;
        });
      });

      describe('no cascade delete', () => {
        beforeEach(async function () {
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING,
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING,
          });

          this.Projects.hasMany(this.Tasks);
          this.Tasks.belongsTo(this.Projects);

          await this.Projects.sync({ force: true });

          await this.Tasks.sync({ force: true });
        });

        describe('#remove', () => {
          it('with no errors', async function () {
            const beforeProject = sinon.spy();
            const afterProject = sinon.spy();
            const beforeTask = sinon.spy();
            const afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeUpdate(beforeTask);
            this.Tasks.afterUpdate(afterTask);

            const project = await this.Projects.create({ title: 'New Project' });
            const task = await this.Tasks.create({ title: 'New Task' });
            await project.addTask(task);
            await project.removeTask(task);
            expect(beforeProject).to.have.been.called;
            expect(afterProject).to.have.been.called;
            expect(beforeTask).not.to.have.been.called;
            expect(afterTask).not.to.have.been.called;
          });

          it('with errors', async function () {
            const beforeProject = sinon.spy();
            const afterProject = sinon.spy();
            const beforeTask = sinon.spy();
            const afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeUpdate(() => {
              beforeTask();
              throw new Error('Whoops!');
            });
            this.Tasks.afterUpdate(afterTask);

            const project = await this.Projects.create({ title: 'New Project' });
            const task = await this.Tasks.create({ title: 'New Task' });

            try {
              await project.addTask(task);
            } catch (error) {
              expect(error).to.be.instanceOf(Error);
              expect(beforeProject).to.have.been.calledOnce;
              expect(afterProject).to.have.been.calledOnce;
              expect(beforeTask).to.have.been.calledOnce;
              expect(afterTask).not.to.have.been.called;
            }
          });
        });
      });
    });

    describe('1:M', () => {
      // this test makes no sense: task was destroyed by the database through CASCADE.
      //  there is no way for Sequelize to call its beforeDestroy/afterDestroy
      // describe('destroy with CASCADE', () => {
      //   beforeEach(async function () {
      //     this.Projects = this.sequelize.define('Project', {
      //       title: DataTypes.STRING,
      //     });
      //
      //     this.Tasks = this.sequelize.define('Task', {
      //       title: DataTypes.STRING,
      //     });
      //
      //     this.Projects.hasMany(this.Tasks, { foreignKey: { onDelete: 'cascade' }, hooks: true });
      //
      //     await this.Projects.sync({ force: true });
      //
      //     await this.Tasks.sync({ force: true });
      //   });
      //
      //   it('with no errors', async function () {
      //     const beforeProject = sinon.spy();
      //     const afterProject = sinon.spy();
      //     const beforeTask = sinon.spy();
      //     const afterTask = sinon.spy();
      //
      //     this.Projects.beforeCreate(beforeProject);
      //     this.Projects.afterCreate(afterProject);
      //     this.Tasks.beforeDestroy(beforeTask);
      //     this.Tasks.afterDestroy(afterTask);
      //
      //     const project = await this.Projects.create({ title: 'New Project' });
      //     const task = await this.Tasks.create({ title: 'New Task' });
      //     await project.addTask(task);
      //     await project.destroy();
      //     expect(beforeProject).to.have.been.calledOnce;
      //     expect(afterProject).to.have.been.calledOnce;
      //     expect(beforeTask).to.have.been.calledOnce;
      //     expect(afterTask).to.have.been.calledOnce;
      //   });
      //
      //   it('with errors', async function () {
      //     let beforeProject = false;
      //     let afterProject = false;
      //     let beforeTask = false;
      //     let afterTask = false;
      //
      //     this.Projects.beforeCreate(async () => {
      //       beforeProject = true;
      //     });
      //
      //     this.Projects.afterCreate(async () => {
      //       afterProject = true;
      //     });
      //
      //     this.Tasks.beforeDestroy(async () => {
      //       beforeTask = true;
      //       throw new Error('Whoops!');
      //     });
      //
      //     this.Tasks.afterDestroy(async () => {
      //       afterTask = true;
      //     });
      //
      //     const project = await this.Projects.create({ title: 'New Project' });
      //     const task = await this.Tasks.create({ title: 'New Task' });
      //     await project.addTask(task);
      //
      //     try {
      //       await project.destroy();
      //     } catch (error) {
      //       expect(error).to.be.instanceOf(Error);
      //       expect(beforeProject).to.be.true;
      //       expect(afterProject).to.be.true;
      //       expect(beforeTask).to.be.true;
      //       expect(afterTask).to.be.false;
      //     }
      //   });
      // });

      describe('no cascade', () => {
        beforeEach(async function () {
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING,
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING,
          });

          this.Projects.hasMany(this.Tasks);
          this.Tasks.belongsTo(this.Projects);

          await this.sequelize.sync({ force: true });
        });

        describe('#remove', () => {
          it('with no errors', async function () {
            const beforeProject = sinon.spy();
            const afterProject = sinon.spy();
            const beforeTask = sinon.spy();
            const afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeUpdate(beforeTask);
            this.Tasks.afterUpdate(afterTask);

            const project = await this.Projects.create({ title: 'New Project' });
            const task = await this.Tasks.create({ title: 'New Task' });
            await project.addTask(task);
            await project.removeTask(task);
            expect(beforeProject).to.have.been.called;
            expect(afterProject).to.have.been.called;
            expect(beforeTask).not.to.have.been.called;
            expect(afterTask).not.to.have.been.called;
          });

          it('with errors', async function () {
            let beforeProject = false;
            let afterProject = false;
            let beforeTask = false;
            let afterTask = false;

            this.Projects.beforeCreate(async () => {
              beforeProject = true;
            });

            this.Projects.afterCreate(async () => {
              afterProject = true;
            });

            this.Tasks.beforeUpdate(async () => {
              beforeTask = true;
              throw new Error('Whoops!');
            });

            this.Tasks.afterUpdate(async () => {
              afterTask = true;
            });

            const project = await this.Projects.create({ title: 'New Project' });
            const task = await this.Tasks.create({ title: 'New Task' });

            try {
              await project.addTask(task);
            } catch (error) {
              expect(error).to.be.instanceOf(Error);
              expect(beforeProject).to.be.true;
              expect(afterProject).to.be.true;
              expect(beforeTask).to.be.true;
              expect(afterTask).to.be.false;
            }
          });
        });
      });
    });

    describe('M:M', () => {
      describe('cascade', () => {
        beforeEach(async function () {
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING,
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING,
          });

          this.Projects.belongsToMany(this.Tasks, {
            foreignKey: { onDelete: 'CASCADE' },
            otherKey: { onDelete: 'CASCADE' },
            through: 'projects_and_tasks',
            hooks: true,
          });

          await this.sequelize.sync({ force: true });
        });

        describe('#remove', () => {
          it('with no errors', async function () {
            const beforeProject = sinon.spy();
            const afterProject = sinon.spy();
            const beforeTask = sinon.spy();
            const afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeDestroy(beforeTask);
            this.Tasks.afterDestroy(afterTask);

            const project = await this.Projects.create({ title: 'New Project' });
            const task = await this.Tasks.create({ title: 'New Task' });
            await project.addTask(task);
            await project.destroy();
            expect(beforeProject).to.have.been.calledOnce;
            expect(afterProject).to.have.been.calledOnce;
            // Since Sequelize does not cascade M:M, these should be false
            expect(beforeTask).not.to.have.been.called;
            expect(afterTask).not.to.have.been.called;
          });

          it('with errors', async function () {
            let beforeProject = false;
            let afterProject = false;
            let beforeTask = false;
            let afterTask = false;

            this.Projects.beforeCreate(async () => {
              beforeProject = true;
            });

            this.Projects.afterCreate(async () => {
              afterProject = true;
            });

            this.Tasks.beforeDestroy(async () => {
              beforeTask = true;
              throw new Error('Whoops!');
            });

            this.Tasks.afterDestroy(async () => {
              afterTask = true;
            });

            const project = await this.Projects.create({ title: 'New Project' });
            const task = await this.Tasks.create({ title: 'New Task' });
            await project.addTask(task);
            await project.destroy();
            expect(beforeProject).to.be.true;
            expect(afterProject).to.be.true;
            expect(beforeTask).to.be.false;
            expect(afterTask).to.be.false;
          });
        });
      });

      describe('no cascade', () => {
        beforeEach(async function () {
          this.Projects = this.sequelize.define('Project', {
            title: DataTypes.STRING,
          });

          this.Tasks = this.sequelize.define('Task', {
            title: DataTypes.STRING,
          });

          this.Projects.belongsToMany(this.Tasks, { hooks: true, through: 'project_tasks' });
          this.Tasks.belongsToMany(this.Projects, { hooks: true, through: 'project_tasks' });

          await this.sequelize.sync({ force: true });
        });

        describe('#remove', () => {
          it('with no errors', async function () {
            const beforeProject = sinon.spy();
            const afterProject = sinon.spy();
            const beforeTask = sinon.spy();
            const afterTask = sinon.spy();

            this.Projects.beforeCreate(beforeProject);
            this.Projects.afterCreate(afterProject);
            this.Tasks.beforeUpdate(beforeTask);
            this.Tasks.afterUpdate(afterTask);

            const project = await this.Projects.create({ title: 'New Project' });
            const task = await this.Tasks.create({ title: 'New Task' });
            await project.addTask(task);
            await project.removeTask(task);
            expect(beforeProject).to.have.been.calledOnce;
            expect(afterProject).to.have.been.calledOnce;
            expect(beforeTask).not.to.have.been.called;
            expect(afterTask).not.to.have.been.called;
          });

          it('with errors', async function () {
            let beforeProject = false;
            let afterProject = false;
            let beforeTask = false;
            let afterTask = false;

            this.Projects.beforeCreate(async () => {
              beforeProject = true;
            });

            this.Projects.afterCreate(async () => {
              afterProject = true;
            });

            this.Tasks.beforeUpdate(async () => {
              beforeTask = true;
              throw new Error('Whoops!');
            });

            this.Tasks.afterUpdate(async () => {
              afterTask = true;
            });

            const project = await this.Projects.create({ title: 'New Project' });
            const task = await this.Tasks.create({ title: 'New Task' });
            await project.addTask(task);
            expect(beforeProject).to.be.true;
            expect(afterProject).to.be.true;
            expect(beforeTask).to.be.false;
            expect(afterTask).to.be.false;
          });
        });
      });
    });

    // NOTE: Reenable when FK constraints create table query is fixed when using hooks
    if (dialect !== 'mssql') {
      // this test makes no sense: task was destroyed by the database through CASCADE.
      //  there is no way for Sequelize to call its beforeDestroy/afterDestroy
      // describe('multiple 1:M', () => {
      //
      //   describe('destroy with onDelete CASCADE', () => {
      //     beforeEach(async function () {
      //       this.Projects = this.sequelize.define('Project', {
      //         title: DataTypes.STRING,
      //       });
      //
      //       this.Tasks = this.sequelize.define('Task', {
      //         title: DataTypes.STRING,
      //       });
      //
      //       this.MiniTasks = this.sequelize.define('MiniTask', {
      //         mini_title: DataTypes.STRING,
      //       });
      //
      //       this.Projects.hasMany(this.Tasks, { foreignKey: { onDelete: 'cascade' }, hooks: true });
      //       this.Projects.hasMany(this.MiniTasks, { foreignKey: { onDelete: 'cascade' }, hooks: true });
      //       this.Tasks.hasMany(this.MiniTasks, { foreignKey: { onDelete: 'cascade' }, hooks: true });
      //
      //       await this.sequelize.sync({ force: true });
      //     });
      //
      //     it('with no errors', async function () {
      //       let beforeProject = false;
      //       let afterProject = false;
      //       let beforeTask = false;
      //       let afterTask = false;
      //       let beforeMiniTask = false;
      //       let afterMiniTask = false;
      //
      //       this.Projects.beforeCreate(async () => {
      //         beforeProject = true;
      //       });
      //
      //       this.Projects.afterCreate(async () => {
      //         afterProject = true;
      //       });
      //
      //       this.Tasks.beforeDestroy(async () => {
      //         beforeTask = true;
      //       });
      //
      //       this.Tasks.afterDestroy(async () => {
      //         afterTask = true;
      //       });
      //
      //       this.MiniTasks.beforeDestroy(async () => {
      //         beforeMiniTask = true;
      //       });
      //
      //       this.MiniTasks.afterDestroy(async () => {
      //         afterMiniTask = true;
      //       });
      //
      //       const [project, minitask] = await Promise.all([
      //         this.Projects.create({ title: 'New Project' }),
      //         this.MiniTasks.create({ mini_title: 'New MiniTask' }),
      //       ]);
      //
      //       await project.addMiniTask(minitask);
      //       await project.destroy();
      //       expect(beforeProject).to.be.true;
      //       expect(afterProject).to.be.true;
      //       expect(beforeTask).to.be.false;
      //       expect(afterTask).to.be.false;
      //       expect(beforeMiniTask).to.be.true;
      //       expect(afterMiniTask).to.be.true;
      //     });
      //
      //     it('with errors', async function () {
      //       let beforeProject = false;
      //       let afterProject = false;
      //       let beforeTask = false;
      //       let afterTask = false;
      //       let beforeMiniTask = false;
      //       let afterMiniTask = false;
      //
      //       this.Projects.beforeCreate(async () => {
      //         beforeProject = true;
      //       });
      //
      //       this.Projects.afterCreate(async () => {
      //         afterProject = true;
      //       });
      //
      //       this.Tasks.beforeDestroy(async () => {
      //         beforeTask = true;
      //       });
      //
      //       this.Tasks.afterDestroy(async () => {
      //         afterTask = true;
      //       });
      //
      //       this.MiniTasks.beforeDestroy(async () => {
      //         beforeMiniTask = true;
      //         throw new Error('Whoops!');
      //       });
      //
      //       this.MiniTasks.afterDestroy(async () => {
      //         afterMiniTask = true;
      //       });
      //
      //       try {
      //         const [project, minitask] = await Promise.all([
      //           this.Projects.create({ title: 'New Project' }),
      //           this.MiniTasks.create({ mini_title: 'New MiniTask' }),
      //         ]);
      //
      //         await project.addMiniTask(minitask);
      //         await project.destroy();
      //       } catch {
      //         expect(beforeProject).to.be.true;
      //         expect(afterProject).to.be.true;
      //         expect(beforeTask).to.be.false;
      //         expect(afterTask).to.be.false;
      //         expect(beforeMiniTask).to.be.true;
      //         expect(afterMiniTask).to.be.false;
      //       }
      //     });
      //   });
      // });
      // this test makes no sense: task was destroyed by the database through CASCADE.
      //  there is no way for Sequelize to call its beforeDestroy/afterDestroy
      // describe('multiple 1:M sequential hooks', () => {
      //   describe('destroy with onDelete CASCADE', () => {
      //     beforeEach(async function () {
      //       this.Projects = this.sequelize.define('Project', {
      //         title: DataTypes.STRING,
      //       });
      //
      //       this.Tasks = this.sequelize.define('Task', {
      //         title: DataTypes.STRING,
      //       });
      //
      //       this.MiniTasks = this.sequelize.define('MiniTask', {
      //         mini_title: DataTypes.STRING,
      //       });
      //
      //       this.Projects.hasMany(this.Tasks, { foreignKey: { onDelete: 'cascade' }, hooks: true });
      //       this.Projects.hasMany(this.MiniTasks, { foreignKey: { onDelete: 'cascade' }, hooks: true });
      //       this.Tasks.hasMany(this.MiniTasks, { foreignKey: { onDelete: 'cascade' }, hooks: true });
      //
      //       await this.sequelize.sync({ force: true });
      //     });
      //
      //     it('with no errors', async function () {
      //       let beforeProject = false;
      //       let afterProject = false;
      //       let beforeTask = false;
      //       let afterTask = false;
      //       let beforeMiniTask = false;
      //       let afterMiniTask = false;
      //
      //       this.Projects.beforeCreate(async () => {
      //         beforeProject = true;
      //       });
      //
      //       this.Projects.afterCreate(async () => {
      //         afterProject = true;
      //       });
      //
      //       this.Tasks.beforeDestroy(async () => {
      //         beforeTask = true;
      //       });
      //
      //       this.Tasks.afterDestroy(async () => {
      //         afterTask = true;
      //       });
      //
      //       this.MiniTasks.beforeDestroy(async () => {
      //         beforeMiniTask = true;
      //       });
      //
      //       this.MiniTasks.afterDestroy(async () => {
      //         afterMiniTask = true;
      //       });
      //
      //       const [project0, task, minitask] = await Promise.all([
      //         this.Projects.create({ title: 'New Project' }),
      //         this.Tasks.create({ title: 'New Task' }),
      //         this.MiniTasks.create({ mini_title: 'New MiniTask' }),
      //       ]);
      //
      //       await Promise.all([
      //         task.addMiniTask(minitask),
      //         project0.addTask(task),
      //       ]);
      //
      //       const project = project0;
      //       await project.destroy();
      //       expect(beforeProject).to.be.true;
      //       expect(afterProject).to.be.true;
      //       expect(beforeTask).to.be.true;
      //       expect(afterTask).to.be.true;
      //       expect(beforeMiniTask).to.be.true;
      //       expect(afterMiniTask).to.be.true;
      //     });
      //
      //     it('with errors', async function () {
      //       let beforeProject = false;
      //       let afterProject = false;
      //       let beforeTask = false;
      //       let afterTask = false;
      //       let beforeMiniTask = false;
      //       let afterMiniTask = false;
      //       const CustomErrorText = 'Whoops!';
      //
      //       this.Projects.beforeCreate(() => {
      //         beforeProject = true;
      //       });
      //
      //       this.Projects.afterCreate(() => {
      //         afterProject = true;
      //       });
      //
      //       this.Tasks.beforeDestroy(() => {
      //         beforeTask = true;
      //         throw new Error(CustomErrorText);
      //       });
      //
      //       this.Tasks.afterDestroy(() => {
      //         afterTask = true;
      //       });
      //
      //       this.MiniTasks.beforeDestroy(() => {
      //         beforeMiniTask = true;
      //       });
      //
      //       this.MiniTasks.afterDestroy(() => {
      //         afterMiniTask = true;
      //       });
      //
      //       const [project0, task, minitask] = await Promise.all([
      //         this.Projects.create({ title: 'New Project' }),
      //         this.Tasks.create({ title: 'New Task' }),
      //         this.MiniTasks.create({ mini_title: 'New MiniTask' }),
      //       ]);
      //
      //       await Promise.all([
      //         task.addMiniTask(minitask),
      //         project0.addTask(task),
      //       ]);
      //
      //       const project = project0;
      //       await expect(project.destroy()).to.eventually.be.rejectedWith(CustomErrorText);
      //       expect(beforeProject).to.be.true;
      //       expect(afterProject).to.be.true;
      //       expect(beforeTask).to.be.true;
      //       expect(afterTask).to.be.false;
      //       expect(beforeMiniTask).to.be.false;
      //       expect(afterMiniTask).to.be.false;
      //     });
      //   });
      // });
    }
  });
});
