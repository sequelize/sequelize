'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  expect = chai.expect,
  stub = sinon.stub,
  _ = require('lodash'),
  Support = require('../support'),
  Promise = Support.Sequelize.Promise,
  DataTypes = require('../../../lib/data-types'),
  HasMany = require('../../../lib/associations/has-many'),
  Op = require('../../../lib/operators'),
  current = Support.sequelize;

describe(Support.getTestDialectTeaser('hasMany'), () => {
  it('throws when invalid model is passed', () => {
    const User = current.define('User');

    expect(() => {
      User.hasMany();
    }).to.throw('User.hasMany called with something that\'s not a subclass of Sequelize.Model');
  });

  describe('optimizations using bulk create, destroy and update', () => {
    const User =current.define('User', { username: DataTypes.STRING }),
      Task = current.define('Task', { title: DataTypes.STRING });

    User.hasMany(Task);

    const user = new User({
        id: 42
      }),
      task1 = new Task({
        id: 15
      }),
      task2 = new Task({
        id: 16
      });

    beforeEach(function() {
      this.findAll = stub(Task, 'findAll').resolves([]);
      this.update = stub(Task, 'update').resolves([]);
    });

    afterEach(function() {
      this.findAll.restore();
      this.update.restore();
    });

    it('uses one update statement for addition', function() {
      return user.setTasks([task1, task2]).then(() => {
        expect(this.findAll).to.have.been.calledOnce;
        expect(this.update).to.have.been.calledOnce;
      });
    });

    it('uses one delete from statement', function() {
      this.findAll
        .onFirstCall().resolves([])
        .onSecondCall().resolves([
          { userId: 42, taskId: 15 },
          { userId: 42, taskId: 16 }
        ]);

      return user.setTasks([task1, task2]).then(() => {
        this.update.resetHistory();
        return user.setTasks(null);
      }).then(() => {
        expect(this.findAll).to.have.been.calledTwice;
        expect(this.update).to.have.been.calledOnce;
      });
    });
  });

  describe('mixin', () => {
    const User =current.define('User'),
      Task = current.define('Task');

    it('should mixin association methods', () => {
      const as = Math.random().toString(),
        association = new HasMany(User, Task, { as }),
        obj = {};

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

    it('should not override custom methods', () => {
      const methods = {
        getTasks: 'get',
        countTasks: 'count',
        hasTask: 'has',
        hasTasks: 'has',
        setTasks: 'set',
        addTask: 'add',
        addTasks: 'add',
        removeTask: 'remove',
        removeTasks: 'remove',
        createTask: 'create'
      };

      _.each(methods, (alias, method) => {
        User.prototype[method] = function() {
          const realMethod = this.constructor.associations.task[alias];
          expect(realMethod).to.be.a('function');
          return realMethod;
        };
      });

      User.hasMany(Task, { as: 'task' });

      const user = new User();

      _.each(methods, (alias, method) => {
        expect(user[method]()).to.be.a('function');
      });
    });

    it('should not override attributes', () => {
      const Project = current.define('Project', { hasTasks: DataTypes.BOOLEAN });

      Project.hasMany(Task);

      const company = new Project();

      expect(company.hasTasks).not.to.be.a('function');
    });
  });

  describe('get', () => {
    const User =current.define('User', {}),
      Task = current.define('Task', {}),
      idA = Math.random().toString(),
      idB = Math.random().toString(),
      idC = Math.random().toString(),
      foreignKey = 'user_id';

    it('should fetch associations for a single instance', () => {
      const findAll = stub(Task, 'findAll').resolves([
        new Task({}),
        new Task({})
      ]);

      User.Tasks = User.hasMany(Task, { foreignKey });
      const actual = User.Tasks.get(new User({ id: idA }));

      const where = {
        [foreignKey]: idA
      };

      expect(findAll).to.have.been.calledOnce;
      expect(findAll.firstCall.args[0].where).to.deep.equal(where);

      return actual.then(results => {
        expect(results).to.be.an('array');
        expect(results.length).to.equal(2);
      }).finally(() => {
        findAll.restore();
      });
    });

    it('should fetch associations for multiple source instances', () => {
      const findAll = stub(Task, 'findAll').returns(
        Promise.resolve([
          new Task({
            'user_id': idA
          }),
          new Task({
            'user_id': idA
          }),
          new Task({
            'user_id': idA
          }),
          new Task({
            'user_id': idB
          })
        ]));

      User.Tasks = User.hasMany(Task, { foreignKey });
      const actual = User.Tasks.get([
        new User({ id: idA }),
        new User({ id: idB }),
        new User({ id: idC })
      ]);

      expect(findAll).to.have.been.calledOnce;
      expect(findAll.firstCall.args[0].where).to.have.property(foreignKey);
      expect(findAll.firstCall.args[0].where[foreignKey]).to.have.property(Op.in);
      expect(findAll.firstCall.args[0].where[foreignKey][Op.in]).to.deep.equal([idA, idB, idC]);

      return actual.then(result => {
        expect(result).to.be.an('object');
        expect(Object.keys(result)).to.deep.equal([idA, idB, idC]);

        expect(result[idA].length).to.equal(3);
        expect(result[idB].length).to.equal(1);
        expect(result[idC].length).to.equal(0);
      }).finally(() => {
        findAll.restore();
      });
    });
  });
  describe('association hooks', () => {
    beforeEach(function() {
      this.Projects = this.sequelize.define('Project', { title: DataTypes.STRING });
      this.Tasks = this.sequelize.define('Task', { title: DataTypes.STRING });
    });
    describe('beforeHasManyAssociate', () => {
      it('should trigger', function() {
        const beforeAssociate = sinon.spy();
        this.Projects.beforeAssociate(beforeAssociate);
        this.Projects.hasMany(this.Tasks, { hooks: true });

        const beforeAssociateArgs = beforeAssociate.getCall(0).args;

        expect(beforeAssociate).to.have.been.called;
        expect(beforeAssociateArgs.length).to.equal(2);

        const firstArg = beforeAssociateArgs[0];
        expect(Object.keys(firstArg).join()).to.equal('source,target,type');
        expect(firstArg.source).to.equal(this.Projects);
        expect(firstArg.target).to.equal(this.Tasks);
        expect(firstArg.type.name).to.equal('HasMany');
        expect(beforeAssociateArgs[1].sequelize.constructor.name).to.equal('Sequelize');
      });
      it('should not trigger association hooks', function() {
        const beforeAssociate = sinon.spy();
        this.Projects.beforeAssociate(beforeAssociate);
        this.Projects.hasMany(this.Tasks, { hooks: false });
        expect(beforeAssociate).to.not.have.been.called;
      });
    });
    describe('afterHasManyAssociate', () => {
      it('should trigger', function() {
        const afterAssociate = sinon.spy();
        this.Projects.afterAssociate(afterAssociate);
        this.Projects.hasMany(this.Tasks, { hooks: true });

        const afterAssociateArgs = afterAssociate.getCall(0).args;

        expect(afterAssociate).to.have.been.called;

        const firstArg = afterAssociateArgs[0];

        expect(Object.keys(firstArg).join()).to.equal('source,target,type,association');
        expect(firstArg.source).to.equal(this.Projects);
        expect(firstArg.target).to.equal(this.Tasks);
        expect(firstArg.type.name).to.equal('HasMany');
        expect(firstArg.association.constructor.name).to.equal('HasMany');

        expect(afterAssociateArgs[1].sequelize.constructor.name).to.equal('Sequelize');
      });
      it('should not trigger association hooks', function() {
        const afterAssociate = sinon.spy();
        this.Projects.afterAssociate(afterAssociate);
        this.Projects.hasMany(this.Tasks, { hooks: false });
        expect(afterAssociate).to.not.have.been.called;
      });
    });
  });
});
