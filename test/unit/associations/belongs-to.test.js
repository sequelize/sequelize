'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support   = require(__dirname + '/../support')
  , current   = Support.sequelize;

describe(Support.getTestDialectTeaser('belongsTo'), function() {
  it('should not override custom methods with association mixin', function(){
    const methods = {
      getTask : 'get',
      setTask: 'set',
      createTask: 'create'
    };
    const User = current.define('User');
    const Task = current.define('Task');

    current.Utils._.each(methods, (alias, method) => {
      User.prototype[method] = function () {
        const realMethod = this.constructor.associations.task[alias];
        expect(realMethod).to.be.a('function');
        return realMethod;
      };
    });

    User.belongsTo(Task, { as: 'task' });

    const user = User.build();

    current.Utils._.each(methods, (alias, method) => {
      expect(user[method]()).to.be.a('function');
    });
  });
});
