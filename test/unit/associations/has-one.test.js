'use strict';

const chai  = require('chai'),
  expect    = chai.expect,
  sinon = require('sinon'),
  _         = require('lodash'),
  Support   = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
  current   = Support.sequelize;

describe(Support.getTestDialectTeaser('hasOne'), () => {
  it('throws when invalid model is passed', () => {
    const User = current.define('User');

    expect(() => {
      User.hasOne();
    }).to.throw('User.hasOne called with something that\'s not a subclass of Sequelize.Model');
  });

  it('warn on invalid options', () => {
    const User = current.define('User', {});
    const Task = current.define('Task', {});

    expect(() => {
      User.hasOne(Task, { sourceKey: 'wowow' });
    }).to.throw('Unknown attribute "wowow" passed as sourceKey, define this attribute on model "User" first');
  });

  it('properly use the `as` key to generate foreign key name', () => {
    const User = current.define('User', { username: DataTypes.STRING }),
      Task = current.define('Task', { title: DataTypes.STRING });

    User.hasOne(Task);
    expect(Task.rawAttributes.UserId).not.to.be.empty;

    User.hasOne(Task, { as: 'Shabda' });
    expect(Task.rawAttributes.ShabdaId).not.to.be.empty;
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

    User.hasOne(Task, { as: 'task' });

    const user = User.build();

    _.each(methods, (alias, method) => {
      expect(user[method]()).to.be.a('function');
    });
  });
  describe('association hooks', () => {
    beforeEach(function() {
      this.Projects = this.sequelize.define('Project', { title: DataTypes.STRING });
      this.Tasks = this.sequelize.define('Task', { title: DataTypes.STRING });
    });
    describe('beforeHasOneAssociate', () => {
      it('should trigger', function() {
        const beforeAssociate = sinon.spy();
        this.Projects.beforeAssociate(beforeAssociate);
        this.Projects.hasOne(this.Tasks, { hooks: true });

        const beforeAssociateArgs = beforeAssociate.getCall(0).args;

        expect(beforeAssociate).to.have.been.called;
        expect(beforeAssociateArgs.length).to.equal(2);

        const firstArg = beforeAssociateArgs[0];
        expect(Object.keys(firstArg).join()).to.equal('source,target,type');
        expect(firstArg.source).to.equal(this.Projects);
        expect(firstArg.target).to.equal(this.Tasks);
        expect(firstArg.type.name).to.equal('HasOne');

        expect(beforeAssociateArgs[1].sequelize.constructor.name).to.equal('Sequelize');
      });
      it('should not trigger association hooks', function() {
        const beforeAssociate = sinon.spy();
        this.Projects.beforeAssociate(beforeAssociate);
        this.Projects.hasOne(this.Tasks, { hooks: false });
        expect(beforeAssociate).to.not.have.been.called;
      });
    });
    describe('afterHasOneAssociate', () => {
      it('should trigger', function() {
        const afterAssociate = sinon.spy();
        this.Projects.afterAssociate(afterAssociate);
        this.Projects.hasOne(this.Tasks, { hooks: true });

        const afterAssociateArgs = afterAssociate.getCall(0).args;

        expect(afterAssociate).to.have.been.called;
        expect(afterAssociateArgs.length).to.equal(2);

        const firstArg = afterAssociateArgs[0];

        expect(Object.keys(firstArg).join()).to.equal('source,target,type,association');
        expect(firstArg.source).to.equal(this.Projects);
        expect(firstArg.target).to.equal(this.Tasks);
        expect(firstArg.type.name).to.equal('HasOne');
        expect(firstArg.association.constructor.name).to.equal('HasOne');

        expect(afterAssociateArgs[1].sequelize.constructor.name).to.equal('Sequelize');
      });
      it('should not trigger association hooks', function() {
        const afterAssociate = sinon.spy();
        this.Projects.afterAssociate(afterAssociate);
        this.Projects.hasOne(this.Tasks, { hooks: false });
        expect(afterAssociate).to.not.have.been.called;
      });
    });
  });
});
