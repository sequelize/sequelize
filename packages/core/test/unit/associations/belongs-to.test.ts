import type { CreationOptional, ModelStatic, NonAttribute } from '@sequelize/core';
import { DataTypes, Deferrable, Model } from '@sequelize/core';
import { BelongsTo } from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import each from 'lodash/each';
import sinon from 'sinon';
import { getTestDialectTeaser, sequelize } from '../../support';

describe(getTestDialectTeaser('belongsTo'), () => {
  it('throws when invalid model is passed', () => {
    const User = sequelize.define('User');

    expect(() => {
      // @ts-expect-error -- testing that invalid input results in error
      User.belongsTo();
    }).to.throw(
      `User.belongsTo was called with undefined as the target model, but it is not a subclass of Sequelize's Model class`,
    );
  });

  it('warn on invalid options', () => {
    const User = sequelize.define('User', {});
    const Task = sequelize.define('Task', {});

    expect(() => {
      User.belongsTo(Task, { targetKey: 'wowow' });
    }).to.throwWithCause(
      'Unknown attribute "wowow" passed as targetKey, define this attribute on model "Task" first',
    );
  });

  it('should not override custom methods with association mixin', () => {
    const methods = {
      getTask: 'get',
      setTask: 'set',
      createTask: 'create',
    };
    const User = sequelize.define('User');
    const Task = sequelize.define('Task');

    const initialMethod = function wrapper() {};

    each(methods, (alias, method) => {
      // TODO: remove this eslint-disable once we drop support for TypeScript <= 5.3
      // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore -- This only became invalid starting with TS 5.4
      User.prototype[method] = initialMethod;
    });

    User.belongsTo(Task, { as: 'task' });

    const user = User.build();

    each(methods, (alias, method) => {
      // @ts-expect-error -- dynamic type, not worth typing
      expect(user[method]).to.eq(initialMethod);
    });
  });

  it('should throw an error if "foreignKey" and "as" result in a name clash', () => {
    const Person = sequelize.define('person', {});
    const Car = sequelize.define('car', {});

    expect(() => Car.belongsTo(Person, { foreignKey: 'person' })).to.throw(
      "Naming collision between attribute 'person' and association 'person' on model car. To remedy this, change the \"as\" options in your association definition",
    );
  });

  it('should throw an error if an association clashes with the name of an already defined attribute', () => {
    const Person = sequelize.define('person', {});
    const Car = sequelize.define('car', {
      person: DataTypes.INTEGER,
    });

    expect(() => Car.belongsTo(Person, { as: 'person' })).to.throw(
      "Naming collision between attribute 'person' and association 'person' on model car. To remedy this, change the \"as\" options in your association definition",
    );
  });

  it('generates a default association name', () => {
    const User = sequelize.define('User', {});
    const Task = sequelize.define('Task', {});

    Task.belongsTo(User);

    expect(Object.keys(Task.associations)).to.deep.eq(['user']);
    expect(Object.keys(User.associations)).to.deep.eq([]);
  });

  it('should add a nullable foreign key by default', () => {
    const BarUser = sequelize.define('user');

    const BarProject = sequelize.define('project');

    BarProject.belongsTo(BarUser, { foreignKey: 'userId' });

    expect(BarProject.getAttributes().userId.allowNull).to.eq(
      undefined,
      'allowNull should be undefined',
    );
  });

  it('sets the foreign key default onDelete to CASCADE if allowNull: false', async () => {
    const Task = sequelize.define('Task', { title: DataTypes.STRING });
    const User = sequelize.define('User', { username: DataTypes.STRING });

    Task.belongsTo(User, { foreignKey: { allowNull: false } });

    expect(Task.getAttributes().userId.onDelete).to.eq('CASCADE');
  });

  it(`does not overwrite the 'deferrable' option set in Model.init`, () => {
    const A = sequelize.define('A', {
      bId: {
        type: DataTypes.INTEGER,
        references: {
          deferrable: Deferrable.INITIALLY_IMMEDIATE,
        },
      },
    });

    const B = sequelize.define('B');

    A.belongsTo(B);

    expect(A.getAttributes().bId.references?.deferrable).to.equal(Deferrable.INITIALLY_IMMEDIATE);
  });

  // See https://github.com/sequelize/sequelize/issues/15625 for more details
  it('should be possible to define two belongsTo associations with the same target #15625', () => {
    class Post extends Model {
      declare id: CreationOptional<number>;

      @BelongsTo(() => Author, {
        foreignKey: 'authorId',
        targetKey: 'id',
        inverse: { as: 'myBooks', type: 'hasMany' },
      })
      declare author: NonAttribute<Author>;

      declare authorId: number;

      @BelongsTo(() => Author, {
        foreignKey: 'coAuthorId',
        targetKey: 'id',
        inverse: { as: 'notMyBooks', type: 'hasMany' },
      })
      declare coAuthor: NonAttribute<Author>;

      declare coAuthorId: number;
    }

    class Author extends Model {
      declare id: number;
    }

    // This would previously fail because the BelongsTo association would create an hasMany association which would
    // then try to create a redundant belongsTo association
    sequelize.addModels([Post, Author]);
  });

  it(`uses the model's singular name to generate the foreign key name`, () => {
    const Book = sequelize.define(
      'Book',
      {},
      {
        name: {
          singular: 'Singular',
          plural: 'Plural',
        },
      },
    );

    const Log = sequelize.define('Log', {}, {});

    Log.belongsTo(Book);

    expect(Log.getAttributes().pluralId).to.not.exist;
    expect(Log.getAttributes().singularId).to.exist;
  });

  describe('association hooks', () => {
    let Projects: ModelStatic<any>;
    let Tasks: ModelStatic<any>;

    beforeEach(() => {
      Projects = sequelize.define('Project', { title: DataTypes.STRING });
      Tasks = sequelize.define('Task', { title: DataTypes.STRING });
    });

    describe('beforeAssociate', () => {
      it('should trigger', () => {
        const beforeAssociate = sinon.spy();
        Projects.beforeAssociate(beforeAssociate);
        Projects.belongsTo(Tasks, { hooks: true });

        const beforeAssociateArgs = beforeAssociate.getCall(0).args;

        expect(beforeAssociate).to.have.been.called;
        expect(beforeAssociateArgs.length).to.equal(2);

        const firstArg = beforeAssociateArgs[0];
        expect(Object.keys(firstArg).join(',')).to.equal('source,target,type,sequelize');
        expect(firstArg.source).to.equal(Projects);
        expect(firstArg.target).to.equal(Tasks);
        expect(firstArg.type.name).to.equal('BelongsTo');
        expect(firstArg.sequelize.constructor.name).to.equal('Sequelize');
      });
      it('should not trigger association hooks', () => {
        const beforeAssociate = sinon.spy();
        Projects.beforeAssociate(beforeAssociate);
        Projects.belongsTo(Tasks, { hooks: false });
        expect(beforeAssociate).to.not.have.been.called;
      });
    });

    describe('afterAssociate', () => {
      it('should trigger', () => {
        const afterAssociate = sinon.spy();
        Projects.afterAssociate(afterAssociate);
        Projects.belongsTo(Tasks, { hooks: true });

        const afterAssociateArgs = afterAssociate.getCall(0).args;

        expect(afterAssociate).to.have.been.called;
        expect(afterAssociateArgs.length).to.equal(2);

        const firstArg = afterAssociateArgs[0];

        expect(Object.keys(firstArg).join(',')).to.equal(
          'source,target,type,association,sequelize',
        );
        expect(firstArg.source).to.equal(Projects);
        expect(firstArg.target).to.equal(Tasks);
        expect(firstArg.type.name).to.equal('BelongsTo');
        expect(firstArg.association.constructor.name).to.equal('BelongsTo');
        expect(firstArg.sequelize.constructor.name).to.equal('Sequelize');
      });

      it('should not trigger association hooks', () => {
        const afterAssociate = sinon.spy();
        Projects.afterAssociate(afterAssociate);
        Projects.belongsTo(Tasks, { hooks: false });
        expect(afterAssociate).to.not.have.been.called;
      });
    });
  });
});
