'use strict';

const  chai = require('chai'),
  expect = chai.expect,
  Support = require('../support');

describe(Support.getTestDialectTeaser('Alias'), () => {
  it('should uppercase the first letter in alias getter, but not in eager loading', async function() {
    const User = this.sequelize.define('user', {}),
      Task = this.sequelize.define('task', {});

    User.hasMany(Task, { as: 'assignments', foreignKey: 'userId' });
    Task.belongsTo(User, { as: 'owner', foreignKey: 'userId' });

    await this.sequelize.sync({ force: true });
    const user0 = await User.create({ id: 1 });
    expect(user0.getAssignments).to.be.ok;

    const task0 = await Task.create({ id: 1, userId: 1 });
    expect(task0.getOwner).to.be.ok;

    const [user, task] = await Promise.all([
      User.findOne({ where: { id: 1 }, include: [{ model: Task, as: 'assignments' }] }),
      Task.findOne({ where: { id: 1 }, include: [{ model: User, as: 'owner' }] })
    ]);

    expect(user.assignments).to.be.ok;
    expect(task.owner).to.be.ok;
  });

  it('shouldnt touch the passed alias', async function() {
    const User = this.sequelize.define('user', {}),
      Task = this.sequelize.define('task', {});

    User.hasMany(Task, { as: 'ASSIGNMENTS', foreignKey: 'userId' });
    Task.belongsTo(User, { as: 'OWNER', foreignKey: 'userId' });

    await this.sequelize.sync({ force: true });
    const user0 = await User.create({ id: 1 });
    expect(user0.getASSIGNMENTS).to.be.ok;

    const task0 = await Task.create({ id: 1, userId: 1 });
    expect(task0.getOWNER).to.be.ok;

    const [user, task] = await Promise.all([
      User.findOne({ where: { id: 1 }, include: [{ model: Task, as: 'ASSIGNMENTS' }] }),
      Task.findOne({ where: { id: 1 }, include: [{ model: User, as: 'OWNER' }] })
    ]);

    expect(user.ASSIGNMENTS).to.be.ok;
    expect(task.OWNER).to.be.ok;
  });

  it('should allow me to pass my own plural and singular forms to hasMany', async function() {
    const User = this.sequelize.define('user', {}),
      Task = this.sequelize.define('task', {});

    User.hasMany(Task, { as: { singular: 'task', plural: 'taskz' } });

    await this.sequelize.sync({ force: true });
    const user0 = await User.create({ id: 1 });
    expect(user0.getTaskz).to.be.ok;
    expect(user0.addTask).to.be.ok;
    expect(user0.addTaskz).to.be.ok;
    const user = await User.findOne({ where: { id: 1 }, include: [{ model: Task, as: 'taskz' }] });
    expect(user.taskz).to.be.ok;
  });

  it('should allow me to define plural and singular forms on the model', async function() {
    const User = this.sequelize.define('user', {}),
      Task = this.sequelize.define('task', {}, {
        name: {
          singular: 'assignment',
          plural: 'assignments'
        }
      });

    User.hasMany(Task);

    await this.sequelize.sync({ force: true });
    const user0 = await User.create({ id: 1 });
    expect(user0.getAssignments).to.be.ok;
    expect(user0.addAssignment).to.be.ok;
    expect(user0.addAssignments).to.be.ok;
    const user = await User.findOne({ where: { id: 1 }, include: [Task] });
    expect(user.assignments).to.be.ok;
  });
});
