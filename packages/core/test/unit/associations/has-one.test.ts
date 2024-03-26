import type { ModelStatic } from '@sequelize/core';
import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import each from 'lodash/each';
import assert from 'node:assert';
import sinon from 'sinon';
import { getTestDialectTeaser, sequelize } from '../../support';

describe(getTestDialectTeaser('hasOne'), () => {
  it('throws when invalid model is passed', () => {
    const User = sequelize.define('User');

    expect(() => {
      // @ts-expect-error -- testing that invalid input results in error
      User.hasOne();
    }).to.throw(
      `User.hasOne was called with undefined as the target model, but it is not a subclass of Sequelize's Model class`,
    );
  });

  it('warn on invalid options', () => {
    const User = sequelize.define('User', {});
    const Task = sequelize.define('Task', {});

    expect(() => {
      User.hasOne(Task, { sourceKey: 'wowow' });
    }).to.throwWithCause(
      'Unknown attribute "wowow" passed as sourceKey, define this attribute on model "User" first',
    );
  });

  it('forbids alias inference in self-associations', () => {
    const User = sequelize.define('User');

    expect(() => {
      User.hasOne(User);
    }).to.throwWithCause(
      'Both options "as" and "inverse.as" must be defined for hasOne self-associations, and their value must be different',
    );
  });

  it('allows self-associations with explicit alias', () => {
    const User = sequelize.define('User');

    // this would make more sense as a belongsTo(User, { as: 'mother', inverse: { type: 'many', as: 'children' } })
    User.hasOne(User, { as: 'mother', inverse: { as: 'child' } });
  });

  it('allows customizing the inverse association name (long form)', () => {
    const User = sequelize.define('User');
    const Task = sequelize.define('Task');

    User.hasMany(Task, { as: 'task', inverse: { as: 'user' } });

    expect(Task.associations.user).to.be.ok;
    expect(User.associations.task).to.be.ok;
  });

  it('allows customizing the inverse association name (shorthand)', () => {
    const User = sequelize.define('User');
    const Task = sequelize.define('Task');

    User.hasMany(Task, { as: 'task', inverse: 'user' });

    expect(Task.associations.user).to.be.ok;
    expect(User.associations.task).to.be.ok;
  });

  it('generates a default association name', () => {
    const User = sequelize.define('User', {});
    const Task = sequelize.define('Task', {});

    User.hasOne(Task);

    expect(Object.keys(Task.associations)).to.deep.eq(['user']);
    expect(Object.keys(User.associations)).to.deep.eq(['task']);
  });

  it('does not use `as` option to generate foreign key name', () => {
    // See HasOne.inferForeignKey for explanations as to why "as" is not used when inferring the foreign key.
    const User = sequelize.define('User', { username: DataTypes.STRING });
    const Task = sequelize.define('Task', { title: DataTypes.STRING });

    const association1 = User.hasOne(Task);
    expect(association1.foreignKey).to.equal('userId');
    expect(Task.getAttributes().userId).not.to.be.empty;

    const association2 = User.hasOne(Task, { as: 'Shabda' });
    expect(association2.foreignKey).to.equal('userId');
    expect(Task.getAttributes().userId).not.to.be.empty;
  });

  it('should not override custom methods with association mixin', () => {
    const methods = {
      getTask: 'get',
      setTask: 'set',
      createTask: 'create',
    };
    const User = sequelize.define('User');
    const Task = sequelize.define('Task');

    function originalFunction() {}

    each(methods, (alias, method) => {
      // TODO: remove this eslint-disable once we drop support for TypeScript <= 5.3
      // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore -- This only became invalid starting with TS 5.4
      User.prototype[method] = originalFunction;
    });

    User.hasOne(Task, { as: 'task' });

    const user = User.build();

    each(methods, (alias, method) => {
      // @ts-expect-error -- dynamic type, not worth typing
      expect(user[method]).to.eq(originalFunction);
    });
  });

  describe('allows the user to provide an attribute definition object as foreignKey', () => {
    it(`works with a column that hasn't been defined before`, () => {
      const User = sequelize.define('user', {});
      const Profile = sequelize.define('project', {});

      User.hasOne(Profile, {
        foreignKey: {
          allowNull: false,
          name: 'uid',
        },
      });

      expect(Profile.getAttributes().uid).to.be.ok;

      const model = Profile.getAttributes().uid.references?.table;
      assert(typeof model === 'object');

      expect(model).to.deep.equal(User.table);

      expect(Profile.getAttributes().uid.references?.key).to.equal('id');
      expect(Profile.getAttributes().uid.allowNull).to.be.false;
    });

    it('works when taking a column directly from the object', () => {
      const User = sequelize.define('user', {
        uid: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
      });
      const Profile = sequelize.define('project', {
        user_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
      });

      User.hasOne(Profile, { foreignKey: Profile.getAttributes().user_id });

      expect(Profile.getAttributes().user_id).to.be.ok;
      const targetTable = Profile.getAttributes().user_id.references?.table;
      assert(typeof targetTable === 'object');

      expect(targetTable).to.deep.equal(User.table);
      expect(Profile.getAttributes().user_id.references?.key).to.equal('uid');
      expect(Profile.getAttributes().user_id.allowNull).to.be.false;
    });

    it('works when merging with an existing definition', () => {
      const User = sequelize.define('user', {
        uid: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },
      });
      const Project = sequelize.define('project', {
        userUid: {
          type: DataTypes.INTEGER,
          defaultValue: 42,
        },
      });

      User.hasOne(Project, { foreignKey: { allowNull: false } });

      expect(Project.getAttributes().userUid).to.be.ok;
      expect(Project.getAttributes().userUid.allowNull).to.be.false;
      const targetTable = Project.getAttributes().userUid.references?.table;
      assert(typeof targetTable === 'object');

      expect(targetTable).to.deep.equal(User.table);
      expect(Project.getAttributes().userUid.references?.key).to.equal('uid');
      expect(Project.getAttributes().userUid.defaultValue).to.equal(42);
    });
  });

  it('sets the foreign key default onDelete to CASCADE if allowNull: false', async () => {
    const Task = sequelize.define('Task', { title: DataTypes.STRING });
    const User = sequelize.define('User', { username: DataTypes.STRING });

    User.hasOne(Task, { foreignKey: { allowNull: false } });

    expect(Task.getAttributes().userId.onDelete).to.eq('CASCADE');
  });

  it('should throw an error if an association clashes with the name of an already define attribute', () => {
    const User = sequelize.define('user', {
      attribute: DataTypes.STRING,
    });
    const Attribute = sequelize.define('attribute', {});

    expect(User.hasOne.bind(User, Attribute)).to.throw(
      "Naming collision between attribute 'attribute' and association 'attribute' on model user. To remedy this, change the \"as\" options in your association definition",
    );
  });

  describe('Model.associations', () => {
    it('should store all associations when associating to the same table multiple times', () => {
      const User = sequelize.define('User', {});
      const Group = sequelize.define('Group', {});

      Group.hasOne(User);
      Group.hasOne(User, {
        foreignKey: 'primaryGroupId',
        as: 'primaryUsers',
        inverse: { as: 'primaryGroup' },
      });
      Group.hasOne(User, {
        foreignKey: 'secondaryGroupId',
        as: 'secondaryUsers',
        inverse: { as: 'secondaryGroup' },
      });

      expect(Object.keys(Group.associations)).to.deep.equal([
        'user',
        'primaryUsers',
        'secondaryUsers',
      ]);
    });
  });

  describe('association hooks', () => {
    let Projects: ModelStatic<any>;
    let Tasks: ModelStatic<any>;

    beforeEach(() => {
      Projects = sequelize.define('Project', { title: DataTypes.STRING });
      Tasks = sequelize.define('Task', { title: DataTypes.STRING });
    });

    describe('beforeHasOneAssociate', () => {
      it('should trigger', () => {
        const beforeAssociate = sinon.spy();
        Projects.beforeAssociate(beforeAssociate);
        Projects.hasOne(Tasks, { hooks: true });

        const beforeAssociateArgs = beforeAssociate.getCall(0).args;

        expect(beforeAssociate).to.have.been.called;
        expect(beforeAssociateArgs.length).to.equal(2);

        const firstArg = beforeAssociateArgs[0];
        expect(Object.keys(firstArg).join(',')).to.equal('source,target,type,sequelize');
        expect(firstArg.source).to.equal(Projects);
        expect(firstArg.target).to.equal(Tasks);
        expect(firstArg.type.name).to.equal('HasOne');
        expect(firstArg.sequelize.constructor.name).to.equal('Sequelize');
      });
      it('should not trigger association hooks', () => {
        const beforeAssociate = sinon.spy();
        Projects.beforeAssociate(beforeAssociate);
        Projects.hasOne(Tasks, { hooks: false });
        expect(beforeAssociate).to.not.have.been.called;
      });
    });
    describe('afterHasOneAssociate', () => {
      it('should trigger', () => {
        const afterAssociate = sinon.spy();
        Projects.afterAssociate(afterAssociate);
        Projects.hasOne(Tasks, { hooks: true });

        const afterAssociateArgs = afterAssociate.getCall(0).args;

        expect(afterAssociate).to.have.been.called;
        expect(afterAssociateArgs.length).to.equal(2);

        const firstArg = afterAssociateArgs[0];

        expect(Object.keys(firstArg).join(',')).to.equal(
          'source,target,type,association,sequelize',
        );
        expect(firstArg.source).to.equal(Projects);
        expect(firstArg.target).to.equal(Tasks);
        expect(firstArg.type.name).to.equal('HasOne');
        expect(firstArg.association.constructor.name).to.equal('HasOne');
        expect(firstArg.sequelize.constructor.name).to.equal('Sequelize');
      });
      it('should not trigger association hooks', () => {
        const afterAssociate = sinon.spy();
        Projects.afterAssociate(afterAssociate);
        Projects.hasOne(Tasks, { hooks: false });
        expect(afterAssociate).to.not.have.been.called;
      });
    });
  });
});
