'use strict';

/* jshint -W030 */
var chai = require('chai')
  , sinon = require('sinon')
  , expect = chai.expect
  , stub = sinon.stub
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , current   = Support.sequelize
  , Promise   = current.Promise;

describe(Support.getTestDialectTeaser('belongsToMany'), function() {
   describe('optimizations using bulk create, destroy and update', function() {
    var User = current.define('User', { username: DataTypes.STRING })
      , Task = current.define('Task', { title: DataTypes.STRING })
      , UserTasks = current.define('UserTasks', {});

    User.belongsToMany(Task, { through: UserTasks });
    Task.belongsToMany(User, { through: UserTasks });

    var user = User.build({
      id: 42
    }),
    task1 = Task.build({
      id: 15
    }),
    task2 = Task.build({
      id: 16
    });

    beforeEach(function () {
      this.findAll = stub(UserTasks, 'findAll').returns(Promise.resolve([]));
      this.bulkCreate = stub(UserTasks, 'bulkCreate').returns(Promise.resolve([]));
      this.destroy = stub(UserTasks, 'destroy').returns(Promise.resolve([]));
    });

    afterEach(function () {
      this.findAll.restore();
      this.bulkCreate.restore();
      this.destroy.restore();
    });

    it('uses one insert into statement', function() {
      return user.setTasks([task1, task2]).bind(this).then(function () {
        expect(this.findAll).to.have.been.calledOnce;
        expect(this.bulkCreate).to.have.been.calledOnce;
      });
    });

    it('uses one delete from statement', function() {
      this.findAll
        .onFirstCall().returns(Promise.resolve([]))
        .onSecondCall().returns(Promise.resolve([
          { userId: 42, taskId: 15 },
          { userId: 42, taskId: 16 }
        ]));

      return user.setTasks([task1, task2]).bind(this).then(function () {
        return user.setTasks(null);
      }).then(function () {
        expect(this.findAll).to.have.been.calledTwice;
        expect(this.destroy).to.have.been.calledOnce;
      });
    });
  });
});
