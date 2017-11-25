'use strict';

const chai = require('chai'),
  expect = chai.expect,
  _         = require('lodash'),
  Support   = require(__dirname + '/../support'),
  current   = Support.sequelize;

describe(Support.getTestDialectTeaser('belongsTo'), () => {
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
