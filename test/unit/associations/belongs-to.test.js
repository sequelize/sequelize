'use strict';

const chai = require('chai'),
  expect = chai.expect,
  _         = require('lodash'),
  Support   = require(__dirname + '/../support'),
  current   = Support.sequelize;

describe(Support.getTestDialectTeaser('belongsTo'), () => {
  it('throws when invalid model is passed', () => {
    const User = current.define('User');

    expect(() => {
      User.belongsTo();
    }).to.throw('User.belongsTo called with something that\'s not a subclass of Sequelize.Model');
  });

  it('warn on invalid options', () => {
    const User = current.define('User', {});
    const Task = current.define('Task', {});

    expect(() => {
      User.belongsTo(Task, { targetKey: 'wowow' });
    }).to.throw('Unknown attribute "wowow" passed as targetKey, define this attribute on model "Task" first');
  });

  it('should not override custom methods with association mixin', () => {
    const methods = {
      getTask: 'get',
      setTask: 'set',
      createTask: 'create'
    };
    const User = current.define('User');
    const Task = current.define('Task');

    _.each(methods, (alias, method) => {
      User.prototype[method] = function() {
        const realMethod = this.constructor.associations.task[alias];
        expect(realMethod).to.be.a('function');
        return realMethod;
      };
    });

    User.belongsTo(Task, { as: 'task' });

    const user = User.build();

    _.each(methods, (alias, method) => {
      expect(user[method]()).to.be.a('function');
    });
  });
});
