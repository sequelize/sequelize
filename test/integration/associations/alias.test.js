'use strict';

const  chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  Sequelize = require('../../../index'),
  Promise = Sequelize.Promise;

describe(Support.getTestDialectTeaser('Alias'), () => {
  it('should uppercase the first letter in alias getter, but not in eager loading', function() {
    const  User = this.sequelize.define('user', {}),
      Task = this.sequelize.define('task', {});

    User.hasMany(Task, { as: 'assignments', foreignKey: 'userId' });
    Task.belongsTo(User, { as: 'owner', foreignKey: 'userId' });

    return this.sequelize.sync({ force: true }).then(() => {
      return User.create({ id: 1 });
    }).then(user => {
      expect(user.getAssignments).to.be.ok;

      return Task.create({ id: 1, userId: 1 });
    }).then(task => {
      expect(task.getOwner).to.be.ok;

      return Promise.all([
        User.find({ where: { id: 1 }, include: [{model: Task, as: 'assignments'}] }),
        Task.find({ where: { id: 1 }, include: [{model: User, as: 'owner'}] })
      ]);
    }).spread((user, task) => {
      expect(user.assignments).to.be.ok;
      expect(task.owner).to.be.ok;
    });
  });

  it('shouldnt touch the passed alias', function() {
    const  User = this.sequelize.define('user', {}),
      Task = this.sequelize.define('task', {});

    User.hasMany(Task, { as: 'ASSIGNMENTS', foreignKey: 'userId' });
    Task.belongsTo(User, { as: 'OWNER', foreignKey: 'userId' });

    return this.sequelize.sync({ force: true }).then(() => {
      return User.create({ id: 1 });
    }).then(user => {
      expect(user.getASSIGNMENTS).to.be.ok;

      return Task.create({ id: 1, userId: 1 });
    }).then(task => {
      expect(task.getOWNER).to.be.ok;

      return Promise.all([
        User.find({ where: { id: 1 }, include: [{model: Task, as: 'ASSIGNMENTS'}] }),
        Task.find({ where: { id: 1 }, include: [{model: User, as: 'OWNER'}] })
      ]);
    }).spread((user, task) => {
      expect(user.ASSIGNMENTS).to.be.ok;
      expect(task.OWNER).to.be.ok;
    });
  });

  it('should allow me to pass my own plural and singular forms to hasMany', function() {
    const  User = this.sequelize.define('user', {}),
      Task = this.sequelize.define('task', {});

    User.hasMany(Task, { as: { singular: 'task', plural: 'taskz'} });

    return this.sequelize.sync({ force: true }).then(() => {
      return User.create({ id: 1 });
    }).then(user => {
      expect(user.getTaskz).to.be.ok;
      expect(user.addTask).to.be.ok;
      expect(user.addTaskz).to.be.ok;
    }).then(() => {
      return User.find({ where: { id: 1 }, include: [{model: Task, as: 'taskz'}] });
    }).then(user => {
      expect(user.taskz).to.be.ok;
    });
  });

  it('should allow me to define plural and singular forms on the model', function() {
    const  User = this.sequelize.define('user', {}),
      Task = this.sequelize.define('task', {}, {
        name: {
          singular: 'assignment',
          plural: 'assignments'
        }
      });

    User.hasMany(Task);

    return this.sequelize.sync({ force: true }).then(() => {
      return User.create({ id: 1 });
    }).then(user => {
      expect(user.getAssignments).to.be.ok;
      expect(user.addAssignment).to.be.ok;
      expect(user.addAssignments).to.be.ok;
    }).then(() => {
      return User.find({ where: { id: 1 }, include: [Task] });
    }).then(user => {
      expect(user.assignments).to.be.ok;
    });
  });
});
