import type { ModelStatic } from '@sequelize/core';
import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import each from 'lodash/each';
import sinon from 'sinon';
import { sequelize, getTestDialectTeaser } from '../../support';

describe(getTestDialectTeaser('hasOne'), () => {
  it('throws when invalid model is passed', () => {
    const User = sequelize.define('User');

    expect(() => {
      // @ts-expect-error
      User.hasOne();
    }).to.throw('User.hasOne called with something that\'s not a subclass of Sequelize.Model');
  });

  it('warn on invalid options', () => {
    const User = sequelize.define('User', {});
    const Task = sequelize.define('Task', {});

    expect(() => {
      User.hasOne(Task, { sourceKey: 'wowow' });
    }).to.throwWithCause('Unknown attribute "wowow" passed as sourceKey, define this attribute on model "User" first');
  });

  it('does not use `as` option to generate foreign key name', () => {
    // See HasOne.inferForeignKey for explanations as to why "as" is not used when inferring the foreign key.
    const User = sequelize.define('User', { username: DataTypes.STRING });
    const Task = sequelize.define('Task', { title: DataTypes.STRING });

    const association1 = User.hasOne(Task);
    expect(association1.foreignKey).to.equal('UserId');
    expect(Task.rawAttributes.UserId).not.to.be.empty;

    const association2 = User.hasOne(Task, { as: 'Shabda' });
    expect(association2.foreignKey).to.equal('UserId');
    expect(Task.rawAttributes.UserId).not.to.be.empty;
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
      User.prototype[method] = originalFunction;
    });

    User.hasOne(Task, { as: 'task' });

    const user = User.build();

    each(methods, (alias, method) => {
      // @ts-expect-error
      expect(user[method]).to.eq(originalFunction);
    });
  });

  describe('allows the user to provide an attribute definition object as foreignKey', () => {
    it('works with a column that hasn\'t been defined before', () => {
      const User = sequelize.define('user', {});
      const Profile = sequelize.define('project', {});

      User.hasOne(Profile, {
        foreignKey: {
          allowNull: false,
          name: 'uid',
        },
      });

      expect(Profile.rawAttributes.uid).to.be.ok;
      expect(Profile.rawAttributes.uid.references?.model).to.equal(User.getTableName());
      expect(Profile.rawAttributes.uid.references?.key).to.equal('id');
      expect(Profile.rawAttributes.uid.allowNull).to.be.false;
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

      User.hasOne(Profile, { foreignKey: Profile.rawAttributes.user_id });

      expect(Profile.rawAttributes.user_id).to.be.ok;
      expect(Profile.rawAttributes.user_id.references?.model).to.equal(User.getTableName());
      expect(Profile.rawAttributes.user_id.references?.key).to.equal('uid');
      expect(Profile.rawAttributes.user_id.allowNull).to.be.false;
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

      expect(Project.rawAttributes.userUid).to.be.ok;
      expect(Project.rawAttributes.userUid.allowNull).to.be.false;
      expect(Project.rawAttributes.userUid.references?.model).to.equal(User.getTableName());
      expect(Project.rawAttributes.userUid.references?.key).to.equal('uid');
      expect(Project.rawAttributes.userUid.defaultValue).to.equal(42);
    });
  });

  it('should throw an error if an association clashes with the name of an already define attribute', () => {
    const User = sequelize.define('user', {
      attribute: DataTypes.STRING,
    });
    const Attribute = sequelize.define('attribute', {});

    expect(User.hasOne.bind(User, Attribute)).to
      .throw('Naming collision between attribute \'attribute\' and association \'attribute\' on model user. To remedy this, change the "as" options in your association definition');
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

        expect(beforeAssociateArgs[1].sequelize.constructor.name).to.equal('Sequelize');
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

        expect(Object.keys(firstArg).join(',')).to.equal('source,target,type,association,sequelize');
        expect(firstArg.source).to.equal(Projects);
        expect(firstArg.target).to.equal(Tasks);
        expect(firstArg.type.name).to.equal('HasOne');
        expect(firstArg.association.constructor.name).to.equal('HasOne');

        expect(afterAssociateArgs[1].sequelize.constructor.name).to.equal('Sequelize');
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
