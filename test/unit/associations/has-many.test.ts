import type { ForeignKey, HasManySetAssociationsMixin, InferAttributes } from '@sequelize/core';
import { DataTypes, Model, Op } from '@sequelize/core';
import { expect } from 'chai';
import each from 'lodash/each';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import { sequelize, getTestDialectTeaser } from '../../support';

describe(getTestDialectTeaser('hasMany'), () => {
  it('throws when invalid model is passed', () => {
    const User = sequelize.define('User');

    expect(() => {
      // @ts-expect-error
      User.hasMany();
    }).to.throw('User.hasMany called with something that\'s not a subclass of Sequelize.Model');
  });

  describe('optimizations using bulk create, destroy and update', () => {
    class User extends Model<InferAttributes<User>> {
      declare setTasks: HasManySetAssociationsMixin<Task, number>;
    }

    class Task extends Model<InferAttributes<Task>> {}

    User.init({ username: DataTypes.STRING }, { sequelize });
    Task.init({ title: DataTypes.STRING }, { sequelize });
    User.hasMany(Task);

    const user = User.build({
      id: 42,
    });
    const task1 = Task.build({
      id: 15,
    });
    const task2 = Task.build({
      id: 16,
    });

    let findAll: SinonStub;
    let update: SinonStub;

    beforeEach(() => {
      findAll = sinon.stub(Task, 'findAll').resolves([]);
      update = sinon.stub(Task, 'update').resolves([0]);
    });

    afterEach(() => {
      findAll.restore();
      update.restore();
    });

    it('uses one update statement for addition', async () => {
      await user.setTasks([task1, task2]);
      expect(findAll).to.have.been.calledOnce;
      expect(update).to.have.been.calledOnce;
    });

    it('uses one delete from statement', async () => {
      findAll
        .onFirstCall().resolves([])
        .onSecondCall()
        .resolves([
          { userId: 42, taskId: 15 },
          { userId: 42, taskId: 16 },
        ]);

      await user.setTasks([task1, task2]);
      update.resetHistory();
      await user.setTasks([]);
      expect(findAll).to.have.been.calledTwice;
      expect(update).to.have.been.calledOnce;
    });
  });

  describe('mixin', () => {
    const User = sequelize.define('User');
    const Task = sequelize.define('Task');

    it('should mixin association methods', () => {
      const as = Math.random().toString();
      const association = User.hasMany(Task, { as });

      expect(User.prototype[association.accessors.get]).to.be.an('function');
      expect(User.prototype[association.accessors.set]).to.be.an('function');
      expect(User.prototype[association.accessors.addMultiple]).to.be.an('function');
      expect(User.prototype[association.accessors.add]).to.be.an('function');
      expect(User.prototype[association.accessors.remove]).to.be.an('function');
      expect(User.prototype[association.accessors.removeMultiple]).to.be.an('function');
      expect(User.prototype[association.accessors.hasSingle]).to.be.an('function');
      expect(User.prototype[association.accessors.hasAll]).to.be.an('function');
      expect(User.prototype[association.accessors.count]).to.be.an('function');
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
        createTask: 'create',
      };

      function originalMethod() {}

      each(methods, (alias, method) => {
        User.prototype[method] = originalMethod;
      });

      User.hasMany(Task, { as: 'task' });

      const user = User.build();

      each(methods, (alias, method) => {
        // @ts-expect-error
        expect(user[method]).to.eq(originalMethod);
      });
    });

    it('should not override attributes', () => {
      class Project extends Model<InferAttributes<Project>> {
        declare hasTasks: boolean | null;
      }

      Project.init({
        hasTasks: DataTypes.BOOLEAN,
      }, { sequelize });

      Project.hasMany(Task);

      const project = Project.build();

      expect(project.hasTasks).not.to.be.a('function');
    });
  });

  describe('get', () => {
    function getModels() {
      class User extends Model<InferAttributes<User>> {}

      class Task extends Model<InferAttributes<Task>> {
        declare user_id: ForeignKey<string | null>;
      }

      User.init({}, { sequelize });
      Task.init({}, { sequelize });

      return { Task, User };
    }

    const idA = Math.random().toString();
    const idB = Math.random().toString();
    const idC = Math.random().toString();
    const foreignKey = 'user_id';

    it('should fetch associations for a single instance', async () => {
      const { Task, User } = getModels();

      const findAll = sinon.stub(Task, 'findAll').resolves([
        Task.build({}),
        Task.build({}),
      ]);

      const UserTasks = User.hasMany(Task, { foreignKey });
      const actual = UserTasks.get(User.build({ id: idA }));

      const where = {
        [foreignKey]: idA,
      };

      expect(findAll).to.have.been.calledOnce;
      expect(findAll.firstCall.args[0]?.where).to.deep.equal(where);

      try {
        const results = await actual;
        expect(results).to.be.an('array');
        expect(results.length).to.equal(2);
      } finally {
        findAll.restore();
      }
    });

    it('should fetch associations for multiple source instances', async () => {
      const { Task, User } = getModels();

      const UserTasks = User.hasMany(Task, { foreignKey });

      const findAll = sinon.stub(Task, 'findAll').returns(
        Promise.resolve([
          Task.build({
            user_id: idA,
          }),
          Task.build({
            user_id: idA,
          }),
          Task.build({
            user_id: idA,
          }),
          Task.build({
            user_id: idB,
          }),
        ]),
      );

      const actual = UserTasks.get([
        User.build({ id: idA }),
        User.build({ id: idB }),
        User.build({ id: idC }),
      ]);

      expect(findAll).to.have.been.calledOnce;
      expect(findAll.firstCall.args[0]?.where).to.have.property(foreignKey);
      // @ts-expect-error
      expect(findAll.firstCall.args[0]?.where[foreignKey]).to.have.property(Op.in);
      // @ts-expect-error
      expect(findAll.firstCall.args[0]?.where[foreignKey][Op.in]).to.deep.equal([idA, idB, idC]);

      try {
        const result = await actual;
        expect(result).to.be.instanceOf(Map);
        expect([...result.keys()]).to.deep.equal([idA, idB, idC]);

        expect(result.get(idA)?.length).to.equal(3);
        expect(result.get(idB)?.length).to.equal(1);
        expect(result.get(idC)?.length).to.equal(0);
      } finally {
        findAll.restore();
      }
    });
  });

  describe('association hooks', () => {
    function getModels() {
      class Project extends Model<InferAttributes<Project>> {
        declare title: string | null;
      }

      class Task extends Model<InferAttributes<Task>> {
        declare user_id: ForeignKey<string | null>;
        declare title: string | null;
      }

      Project.init({ title: DataTypes.STRING }, { sequelize });
      Task.init({ title: DataTypes.STRING }, { sequelize });

      return { Task, Project };
    }

    describe('beforeHasManyAssociate', () => {
      it('should trigger', () => {
        const { Task, Project } = getModels();

        const beforeAssociate = sinon.spy();
        Project.beforeAssociate(beforeAssociate);
        Project.hasMany(Task, { hooks: true });

        const beforeAssociateArgs = beforeAssociate.getCall(0).args;

        expect(beforeAssociate).to.have.been.called;
        expect(beforeAssociateArgs.length).to.equal(2);

        const firstArg = beforeAssociateArgs[0];
        expect(Object.keys(firstArg).join(',')).to.equal('source,target,type,sequelize');
        expect(firstArg.source).to.equal(Project);
        expect(firstArg.target).to.equal(Task);
        expect(firstArg.type.name).to.equal('HasMany');
        expect(beforeAssociateArgs[1].sequelize.constructor.name).to.equal('Sequelize');
      });

      it('should not trigger association hooks', () => {
        const { Task, Project } = getModels();

        const beforeAssociate = sinon.spy();
        Project.beforeAssociate(beforeAssociate);
        Project.hasMany(Task, { hooks: false });
        expect(beforeAssociate).to.not.have.been.called;
      });
    });

    describe('afterHasManyAssociate', () => {
      it('should trigger', () => {
        const { Task, Project } = getModels();

        const afterAssociate = sinon.spy();
        Project.afterAssociate(afterAssociate);
        Project.hasMany(Task, { hooks: true });

        const afterAssociateArgs = afterAssociate.getCall(0).args;

        expect(afterAssociate).to.have.been.called;

        const firstArg = afterAssociateArgs[0];

        expect(Object.keys(firstArg).join(',')).to.equal('source,target,type,association,sequelize');
        expect(firstArg.source).to.equal(Project);
        expect(firstArg.target).to.equal(Task);
        expect(firstArg.type.name).to.equal('HasMany');
        expect(firstArg.association.constructor.name).to.equal('HasMany');

        expect(afterAssociateArgs[1].sequelize.constructor.name).to.equal('Sequelize');
      });
      it('should not trigger association hooks', () => {
        const { Task, Project } = getModels();

        const afterAssociate = sinon.spy();
        Project.afterAssociate(afterAssociate);
        Project.hasMany(Task, { hooks: false });
        expect(afterAssociate).to.not.have.been.called;
      });
    });
  });
});
