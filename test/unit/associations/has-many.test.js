'use strict';

/* jshint -W030 */
var chai = require('chai')
  , sinon = require('sinon')
  , expect = chai.expect
  , stub = sinon.stub
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , HasMany   = require(__dirname + '/../../../lib/associations/has-many')
  , current   = Support.sequelize
  , Promise   = current.Promise;

describe(Support.getTestDialectTeaser('hasMany'), function() {
  describe('optimizations using bulk create, destroy and update', function() {
    var User = current.define('User', { username: DataTypes.STRING })
      , Task = current.define('Task', { title: DataTypes.STRING });

    User.hasMany(Task);

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
      this.findAll = stub(Task, 'findAll').returns(Promise.resolve([]));
      this.update = stub(Task, 'update').returns(Promise.resolve([]));
    });

    afterEach(function () {
      this.findAll.restore();
      this.update.restore();
    });

    it('uses one update statement for addition', function() {
      return user.setTasks([task1, task2]).bind(this).  then(function() {
        expect(this.findAll).to.have.been.calledOnce;
        expect(this.update).to.have.been.calledOnce;
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
        this.update.reset();
        return user.setTasks(null);
      }).then(function () {
        expect(this.findAll).to.have.been.calledTwice;
        expect(this.update).to.have.been.calledOnce;
      });
    });
  });

  describe('mixin', function () {
    var User = current.define('User')
      , Task = current.define('Task');

    it('should mixin association methods', function () {
      var as = Math.random().toString()
        , association = new HasMany(User, Task, {as: as})
        , obj = {};

      association.mixin(obj);

      expect(obj[association.accessors.get]).to.be.an('function');
      expect(obj[association.accessors.set]).to.be.an('function');
      expect(obj[association.accessors.addMultiple]).to.be.an('function');
      expect(obj[association.accessors.add]).to.be.an('function');
      expect(obj[association.accessors.remove]).to.be.an('function');
      expect(obj[association.accessors.removeMultiple]).to.be.an('function');
      expect(obj[association.accessors.hasSingle]).to.be.an('function');
      expect(obj[association.accessors.hasAll]).to.be.an('function');
      expect(obj[association.accessors.count]).to.be.an('function');
    });
  });
});
