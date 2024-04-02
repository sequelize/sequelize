import type { ForeignKey, HasManySetAssociationsMixin, InferAttributes } from '@sequelize/core';
import { DataTypes, Model, Op } from '@sequelize/core';
import { expect } from 'chai';
import each from 'lodash/each';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import { beforeAll2, getTestDialectTeaser, sequelize } from '../../support';

describe(getTestDialectTeaser('hasMany'), () => {
  it('throws when invalid model is passed', () => {
    const User = sequelize.define('User');

    expect(() => {
      // @ts-expect-error -- testing that invalid input results in error
      User.hasMany();
    }).to.throw(
      `User.hasMany was called with undefined as the target model, but it is not a subclass of Sequelize's Model class`,
    );
  });

  it('forbids alias inference in self-associations', () => {
    const User = sequelize.define('User');

    expect(() => {
      User.hasMany(User);
    }).to.throwWithCause(
      'Both options "as" and "inverse.as" must be defined for hasMany self-associations, and their value must be different',
    );
  });

  it('allows self-associations with explicit alias', () => {
    const Category = sequelize.define('Category');

    Category.hasMany(Category, { as: 'childCategories', inverse: { as: 'parentCategory' } });
  });

  it('allows customizing the inverse association name (long form)', () => {
    const User = sequelize.define('User');
    const Task = sequelize.define('Task');

    User.hasMany(Task, { as: 'tasks', inverse: { as: 'user' } });

    expect(Task.associations.user).to.be.ok;
    expect(User.associations.tasks).to.be.ok;
  });

  it('allows customizing the inverse association name (shorthand)', () => {
    const User = sequelize.define('User');
    const Task = sequelize.define('Task');

    User.hasMany(Task, { as: 'tasks', inverse: 'user' });

    expect(Task.associations.user).to.be.ok;
    expect(User.associations.tasks).to.be.ok;
  });

  it('generates a default association name', () => {
    const User = sequelize.define('User', {});
    const Task = sequelize.define('Task', {});

    User.hasMany(Task);

    expect(Object.keys(Task.associations)).to.deep.eq(['user']);
    expect(Object.keys(User.associations)).to.deep.eq(['tasks']);
  });

  describe('optimizations using bulk create, destroy and update', () => {
    const vars = beforeAll2(() => {
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

      return { User, Task, user, task1, task2 };
    });

    let findAll: SinonStub;
    let update: SinonStub;

    beforeEach(() => {
      const { Task } = vars;

      findAll = sinon.stub(Task, 'findAll').resolves([]);
      update = sinon.stub(Task, 'update').resolves([0]);
    });

    afterEach(() => {
      findAll.restore();
      update.restore();
    });

    it('uses one update statement for addition', async () => {
      const { user, task1, task2 } = vars;

      await user.setTasks([task1, task2]);
      expect(findAll).to.have.been.calledOnce;
      expect(update).to.have.been.calledOnce;
    });

    it('uses one delete from statement', async () => {
      const { user, task1, task2 } = vars;

      findAll
        .onFirstCall()
        .resolves([])
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
    const vars = beforeAll2(() => {
      const User = sequelize.define('User');
      const Task = sequelize.define('Task');

      return { User, Task };
    });

    it('should mixin association methods', () => {
      const { User, Task } = vars;

      const as = Math.random().toString();
      const association = User.hasMany(Task, { as });

      // TODO: remove this eslint-disable once we drop support for TypeScript <= 5.3
      // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore -- This only became invalid starting with TS 5.4
      expect(User.prototype[association.accessors.get]).to.be.a('function');
      // TODO: remove this eslint-disable once we drop support for TypeScript <= 5.3
      // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore -- This only became invalid starting with TS 5.4
      expect(User.prototype[association.accessors.set]).to.be.a('function');
      // TODO: remove this eslint-disable once we drop support for TypeScript <= 5.3
      // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore -- This only became invalid starting with TS 5.4
      expect(User.prototype[association.accessors.addMultiple]).to.be.a('function');
      // TODO: remove this eslint-disable once we drop support for TypeScript <= 5.3
      // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore -- This only became invalid starting with TS 5.4
      expect(User.prototype[association.accessors.add]).to.be.a('function');
      // TODO: remove this eslint-disable once we drop support for TypeScript <= 5.3
      // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore -- This only became invalid starting with TS 5.4
      expect(User.prototype[association.accessors.remove]).to.be.a('function');
      // TODO: remove this eslint-disable once we drop support for TypeScript <= 5.3
      // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore -- This only became invalid starting with TS 5.4
      expect(User.prototype[association.accessors.removeMultiple]).to.be.a('function');
      // TODO: remove this eslint-disable once we drop support for TypeScript <= 5.3
      // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore -- This only became invalid starting with TS 5.4
      expect(User.prototype[association.accessors.hasSingle]).to.be.a('function');
      // TODO: remove this eslint-disable once we drop support for TypeScript <= 5.3
      // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore -- This only became invalid starting with TS 5.4
      expect(User.prototype[association.accessors.hasAll]).to.be.a('function');
      // TODO: remove this eslint-disable once we drop support for TypeScript <= 5.3
      // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore -- This only became invalid starting with TS 5.4
      expect(User.prototype[association.accessors.count]).to.be.a('function');
    });

    it('should not override custom methods', () => {
      const { User, Task } = vars;

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
        // TODO: remove this eslint-disable once we drop support for TypeScript <= 5.3
        // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
        // @ts-ignore -- This only became invalid starting with TS 5.4
        User.prototype[method] = originalMethod;
      });

      User.hasMany(Task, { as: 'task' });

      const user = User.build();

      each(methods, (alias, method) => {
        // @ts-expect-error -- dynamic type, not worth typing
        expect(user[method]).to.eq(originalMethod);
      });
    });

    it('should not override attributes', () => {
      const { Task } = vars;

      class Project extends Model<InferAttributes<Project>> {
        declare hasTasks: boolean | null;
      }

      Project.init(
        {
          hasTasks: DataTypes.BOOLEAN,
        },
        { sequelize },
      );

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

      User.init(
        {
          id: {
            type: DataTypes.STRING,
            primaryKey: true,
          },
        },
        { sequelize },
      );
      Task.init({}, { sequelize });

      return { Task, User };
    }

    const idA = Math.random().toString();
    const idB = Math.random().toString();
    const idC = Math.random().toString();
    const foreignKey = 'user_id';

    it('should fetch associations for a single instance', async () => {
      const { Task, User } = getModels();

      const findAll = sinon.stub(Task, 'findAll').resolves([Task.build({}), Task.build({})]);

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
      // @ts-expect-error -- not worth typing for this test
      expect(findAll.firstCall.args[0]?.where[foreignKey]).to.have.property(Op.in);
      // @ts-expect-error -- not worth typing for this test
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
        expect(firstArg.sequelize.constructor.name).to.equal('Sequelize');
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

        expect(Object.keys(firstArg).join(',')).to.equal(
          'source,target,type,association,sequelize',
        );
        expect(firstArg.source).to.equal(Project);
        expect(firstArg.target).to.equal(Task);
        expect(firstArg.type.name).to.equal('HasMany');
        expect(firstArg.association.constructor.name).to.equal('HasMany');
        expect(firstArg.sequelize.constructor.name).to.equal('Sequelize');
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
