import type {
  BelongsToGetAssociationMixin,
  BelongsToManyAssociation,
  BelongsToManySetAssociationsMixin,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  ModelStatic,
} from '@sequelize/core';
import {
  AssociationError,
  BelongsToAssociation,
  DataTypes,
  HasManyAssociation,
  HasOneAssociation,
  Model,
} from '@sequelize/core';
import { expect } from 'chai';
import each from 'lodash/each';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import {
  beforeEach2,
  createSequelizeInstance,
  getTestDialectTeaser,
  resetSequelizeInstance,
  sequelize,
} from '../../support';

describe(getTestDialectTeaser('belongsToMany'), () => {
  beforeEach(() => {
    resetSequelizeInstance();
  });

  it('throws when invalid model is passed', () => {
    const User = sequelize.define('User');

    expect(() => {
      // @ts-expect-error -- testing that invalid input results in error
      User.belongsToMany();
    }).to.throw(
      `User.belongsToMany was called with undefined as the target model, but it is not a subclass of Sequelize's Model class`,
    );
  });

  it('creates the join table when through is a string', async () => {
    const User = sequelize.define('User');
    const Group = sequelize.define('Group');

    User.belongsToMany(Group, { as: 'MyGroups', through: 'GroupUser' });
    Group.belongsToMany(User, { as: 'MyUsers', through: 'GroupUser' });

    expect(sequelize.models.getOrThrow('GroupUser')).to.exist;
  });

  it('should not inherit scopes from parent to join table', () => {
    const A = sequelize.define('a');
    const B = sequelize.define(
      'b',
      {},
      {
        defaultScope: {
          where: {
            foo: 'bar',
          },
        },
        scopes: {
          baz: {
            where: {
              fooz: 'zab',
            },
          },
        },
      },
    );

    B.belongsToMany(A, { through: 'AB' });

    const AB = sequelize.models.getOrThrow('AB');

    expect(AB.options.defaultScope).to.deep.equal({});
    expect(AB.options.scopes).to.deep.equal({});
  });

  it('should not inherit validations from parent to join table', () => {
    const A = sequelize.define('a');
    const B = sequelize.define(
      'b',
      {},
      {
        validate: {
          validateModel() {
            return true;
          },
        },
      },
    );

    B.belongsToMany(A, { through: 'AB' });

    const AB = sequelize.models.getOrThrow('AB');

    expect(AB.options.validate).to.deep.equal({});
  });

  it('should not override custom methods with association mixin', () => {
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
    const User = sequelize.define('User');
    const Task = sequelize.define('Task');

    function originalMethod() {}

    each(methods, (alias, method) => {
      // TODO: remove this eslint-disable once we drop support for TypeScript <= 5.3
      // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore -- This only became invalid starting with TS 5.4
      User.prototype[method] = originalMethod;
    });

    User.belongsToMany(Task, { through: 'UserTasks', as: 'task' });

    const user = User.build();

    each(methods, (alias, method) => {
      // @ts-expect-error -- dynamic type, not worth typing
      expect(user[method]).to.eq(originalMethod);
    });
  });

  it('allows customizing the inverse association name (long form)', () => {
    const User = sequelize.define('User');
    const Task = sequelize.define('Task');

    User.belongsToMany(Task, { through: 'UserTask', as: 'tasks', inverse: { as: 'users' } });

    expect(Task.associations.users).to.be.ok;
    expect(User.associations.tasks).to.be.ok;
  });

  it('allows customizing the inverse association name (shorthand)', () => {
    const User = sequelize.define('User');
    const Task = sequelize.define('Task');

    User.belongsToMany(Task, { through: 'UserTask', as: 'tasks', inverse: 'users' });

    expect(Task.associations.users).to.be.ok;
    expect(User.associations.tasks).to.be.ok;
  });

  it('allows defining two associations with the same through, but with a different scope on the through table', () => {
    const User = sequelize.define('User');
    const Post = sequelize.define('Post', { editing: DataTypes.BOOLEAN });

    User.belongsToMany(Post, { through: 'UserPost' });
    Post.belongsToMany(User, { through: 'UserPost' });

    User.belongsToMany(Post, {
      as: 'editingPosts',
      inverse: {
        as: 'editingUsers',
      },
      through: {
        model: 'UserPost',
        scope: {
          editing: true,
        },
      },
    });
  });

  it('allows defining two associations with the same inverse association', () => {
    const User = sequelize.define('User');
    const Post = sequelize.define('Post');

    const Association1 = Post.belongsToMany(User, {
      through: { model: 'UserPost' },
      as: 'categories',
      scope: { type: 'category' },
    });

    const Association2 = Post.belongsToMany(User, {
      through: { model: 'UserPost' },
      as: 'tags',
      scope: { type: 'tag' },
    });

    // This means Association1.pairedWith.pairedWith is not always Association1
    // This may be an issue
    expect(Association1.pairedWith).to.eq(Association2.pairedWith);
  });

  it('lets you customize the name of the intermediate associations', () => {
    const User = sequelize.define('User');
    const Group = sequelize.define('Group');
    const GroupUser = sequelize.define('GroupUser');

    User.belongsToMany(Group, {
      through: GroupUser,
      as: 'groups',
      throughAssociations: {
        toSource: 'toSource',
        toTarget: 'toTarget',
        fromSource: 'fromSources',
        fromTarget: 'fromTargets',
      },
      inverse: {
        as: 'members',
      },
    });

    expect(Object.keys(User.associations).sort()).to.deep.eq([
      'fromSource',
      'fromSources',
      'groups',
    ]);
    expect(Object.keys(Group.associations).sort()).to.deep.eq([
      'fromTarget',
      'fromTargets',
      'members',
    ]);
    expect(Object.keys(GroupUser.associations).sort()).to.deep.eq(['toSource', 'toTarget']);
  });

  it('errors when trying to define similar associations with incompatible inverse associations', () => {
    const User = sequelize.define('User');
    const Post = sequelize.define('Post');

    Post.belongsToMany(User, {
      through: { model: 'UserPost' },
      as: 'categories',
      scope: { type: 'category' },
    });

    expect(() => {
      Post.belongsToMany(User, {
        through: { model: 'UserPost' },
        as: 'tags',
        scope: { type: 'tag' },
        otherKey: {
          onUpdate: 'NO ACTION',
        },
      });
    }).to.throw('Defining BelongsToMany association "tags" from Post to User failed');
  });

  it('errors when trying to define the same association', () => {
    const User = sequelize.define('User');
    const Post = sequelize.define('Post');

    Post.belongsToMany(User, {
      through: { model: 'UserPost' },
    });

    expect(() => {
      Post.belongsToMany(User, { through: { model: 'UserPost' } });
    }).to.throw(
      'You have defined two associations with the same name "users" on the model "Post". Use another alias using the "as" parameter',
    );
  });

  it('generates a default association name', () => {
    const User = sequelize.define('User', {});
    const Task = sequelize.define('Task', {});

    User.belongsToMany(Task, { through: 'UserTask' });

    expect(Object.keys(Task.associations)).to.deep.eq(['users', 'usersTasks', 'userTask']);
    expect(Object.keys(User.associations)).to.deep.eq(['tasks', 'tasksUsers', 'taskUser']);
  });

  describe('proper syntax', () => {
    it('throws an AssociationError if the through option is undefined, true, or null', () => {
      const User = sequelize.define('User', {});
      const Task = sequelize.define('Task', {});

      // @ts-expect-error -- we're testing that these do throw
      const errorFunction1 = () => User.belongsToMany(Task, { through: true });
      // @ts-expect-error -- see above
      const errorFunction2 = () => User.belongsToMany(Task, { through: undefined });
      // @ts-expect-error -- see above
      const errorFunction3 = () => User.belongsToMany(Task, { through: null });
      for (const errorFunction of [errorFunction1, errorFunction2, errorFunction3]) {
        expect(errorFunction).to.throwWithCause(
          AssociationError,
          `${User.name}.belongsToMany(${Task.name}) requires a through model, set the "through", or "through.model" options to either a string or a model`,
        );
      }
    });

    it('throws an AssociationError for a self-association defined without an alias', () => {
      const User = sequelize.define('User', {});

      const errorFunction = User.belongsToMany.bind(User, User, { through: 'jointable' });
      expect(errorFunction).to.throwWithCause(
        AssociationError,
        'Both options "as" and "inverse.as" must be defined for belongsToMany self-associations, and their value must be different.',
      );
    });
  });

  describe('timestamps', () => {
    it('follows the global timestamps true option', () => {
      const User = sequelize.define('User', {});
      const Task = sequelize.define('Task', {});

      User.belongsToMany(Task, { through: 'user_task1' });

      expect(sequelize.models.getOrThrow('user_task1').getAttributes()).to.contain.all.keys([
        'createdAt',
        'updatedAt',
      ]);
    });

    it('allows me to override the global timestamps option', () => {
      const User = sequelize.define('User', {});
      const Task = sequelize.define('Task', {});

      User.belongsToMany(Task, { through: { model: 'user_task2', timestamps: false } });

      expect(sequelize.models.getOrThrow('user_task2').getAttributes()).not.to.contain.any.keys([
        'createdAt',
        'updatedAt',
      ]);
    });

    it('follows the global timestamps false option', () => {
      const sequelize2 = createSequelizeInstance({
        define: {
          timestamps: false,
        },
      });

      const User = sequelize2.define('User', {});
      const Task = sequelize2.define('Task', {});

      User.belongsToMany(Task, { through: 'user_task3' });

      expect(sequelize2.models.getOrThrow('user_task3').getAttributes()).not.to.contain.any.keys([
        'createdAt',
        'updatedAt',
      ]);
    });
  });

  describe('optimizations using bulk create, destroy and update', () => {
    function getEntities() {
      class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
        declare id: CreationOptional<number>;
        declare username: string | null;

        declare setTasks: BelongsToManySetAssociationsMixin<Task, number>;
      }

      User.init(
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          username: DataTypes.STRING,
        },
        { sequelize },
      );

      class Task extends Model<InferAttributes<Task>> {
        declare id: CreationOptional<number>;
        declare title: string | null;
      }

      Task.init(
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          title: DataTypes.STRING,
        },
        { sequelize },
      );

      const UserTasks = sequelize.define('UserTasks', {});

      User.belongsToMany(Task, { through: UserTasks });
      Task.belongsToMany(User, { through: UserTasks });

      const user = User.build({
        id: 42,
      });
      const task1 = Task.build({
        id: 15,
      });
      const task2 = Task.build({
        id: 16,
      });

      sinon.stub(UserTasks, 'findAll').resolves([]);
      sinon.stub(UserTasks, 'bulkCreate').resolves([]);
      sinon.stub(UserTasks, 'destroy').resolves(0);

      return { user, task1, task2, UserTasks };
    }

    afterEach(() => {
      sinon.restore();
    });

    it('uses one insert into statement', async () => {
      const { user, task1, task2, UserTasks } = getEntities();
      await user.setTasks([task1, task2]);

      expect(UserTasks.findAll).to.have.been.calledOnce;
      expect(UserTasks.bulkCreate).to.have.been.calledOnce;
    });

    it('uses one delete from statement', async () => {
      const { user, task1, task2, UserTasks } = getEntities();

      (UserTasks.findAll as SinonStub)
        .onFirstCall()
        .resolves([])
        .onSecondCall()
        .resolves([
          { userId: 42, taskId: 15 },
          { userId: 42, taskId: 16 },
        ]);

      await user.setTasks([task1, task2]);
      await user.setTasks([]);
      expect(UserTasks.findAll).to.have.been.calledTwice;
      expect(UserTasks.destroy).to.have.been.calledOnce;
    });
  });

  describe('foreign keys', () => {
    it('should infer otherKey from paired BTM relationship with a through string defined', () => {
      const User = sequelize.define('User', {});
      const Place = sequelize.define('Place', {});

      const Places = User.belongsToMany(Place, {
        through: 'user_places',
        foreignKey: 'user_id',
        otherKey: 'place_id',
      });
      const Users = Place.getAssociation('users') as BelongsToManyAssociation;

      expect(Places.pairedWith).to.equal(Users);
      expect(Users.pairedWith).to.equal(Places);

      expect(Places.foreignKey).to.equal('user_id');
      expect(Users.foreignKey).to.equal('place_id');

      expect(Places.otherKey).to.equal('place_id');
      expect(Users.otherKey).to.equal('user_id');
    });

    it('should infer otherKey from paired BTM relationship with a through model defined', () => {
      const User = sequelize.define('User', {});
      const Place = sequelize.define('Place', {});
      const UserPlace = sequelize.define(
        'UserPlace',
        {
          id: {
            primaryKey: true,
            type: DataTypes.INTEGER,
            autoIncrement: true,
          },
        },
        { timestamps: false },
      );

      const Places = User.belongsToMany(Place, {
        through: UserPlace,
        foreignKey: 'user_id',
        otherKey: 'place_id',
      });
      const Users = Place.getAssociation('users') as BelongsToManyAssociation;

      expect(Places.pairedWith).to.equal(Users);
      expect(Users.pairedWith).to.equal(Places);

      expect(Places.foreignKey).to.equal('user_id');
      expect(Users.foreignKey).to.equal('place_id');

      expect(Places.otherKey).to.equal('place_id');
      expect(Users.otherKey).to.equal('user_id');

      expect(Object.keys(UserPlace.getAttributes()).length).to.equal(3); // Defined primary key and two foreign keys
    });

    it('should infer foreign keys (camelCase)', () => {
      const Person = sequelize.define('Person');
      const PersonChildren = sequelize.define('PersonChildren');
      const Children = Person.belongsToMany(Person, {
        as: 'Children',
        through: PersonChildren,
        inverse: { as: 'Parents' },
      });

      expect(Children.foreignKey).to.equal('parentId');
      expect(Children.otherKey).to.equal('childId');
      expect(PersonChildren.getAttributes()[Children.foreignKey]).to.be.ok;
      expect(PersonChildren.getAttributes()[Children.otherKey]).to.be.ok;
    });

    it('should infer foreign keys (snake_case)', () => {
      const Person = sequelize.define('Person', {}, { underscored: true });
      const PersonChildren = sequelize.define('PersonChildren', {}, { underscored: true });
      const Children = Person.belongsToMany(Person, {
        as: 'Children',
        through: PersonChildren,
        inverse: { as: 'Parents' },
      });

      expect(Children.foreignKey).to.equal('parentId');
      expect(Children.otherKey).to.equal('childId');
      expect(PersonChildren.getAttributes()[Children.foreignKey]).to.be.ok;
      expect(PersonChildren.getAttributes()[Children.otherKey]).to.be.ok;
      expect(PersonChildren.getAttributes()[Children.foreignKey].columnName).to.equal('parent_id');
      expect(PersonChildren.getAttributes()[Children.otherKey].columnName).to.equal('child_id');
    });

    it('should create non-null foreign keys by default', () => {
      const A = sequelize.define('A');
      const B = sequelize.define('B');

      const association = A.belongsToMany(B, { through: 'AB' });

      const attributes = association.throughModel.getAttributes();
      expect(attributes.aId.allowNull).to.be.false;
      expect(attributes.bId.allowNull).to.be.false;
    });

    it('allows creating nullable FKs', () => {
      const A = sequelize.define('A');
      const B = sequelize.define('B');

      const association = A.belongsToMany(B, {
        through: 'AB',
        foreignKey: { allowNull: true },
        otherKey: { allowNull: true },
      });

      const attributes = association.throughModel.getAttributes();
      expect(attributes.aId.allowNull).to.be.true;
      expect(attributes.bId.allowNull).to.be.true;
    });

    it('should add FKs with onDelete=cascade by default', () => {
      const A = sequelize.define('A');
      const B = sequelize.define('B');

      const association = A.belongsToMany(B, { through: 'AB', foreignKey: {} });

      const attributes = association.throughModel.getAttributes();
      expect(attributes.aId.onDelete).to.eq('CASCADE');
      expect(attributes.bId.onDelete).to.eq('CASCADE');
    });
  });

  describe('source/target keys', () => {
    it('should infer targetKey from paired BTM relationship with a through string defined', () => {
      const User = sequelize.define('User', { user_id: DataTypes.UUID });
      const Place = sequelize.define('Place', { place_id: DataTypes.UUID });

      const Places = User.belongsToMany(Place, {
        through: 'user_places',
        sourceKey: 'user_id',
        targetKey: 'place_id',
      });
      const Users = Place.getAssociation('users') as BelongsToManyAssociation;

      expect(Places.pairedWith).to.equal(Users);
      expect(Users.pairedWith).to.equal(Places);

      expect(Places.sourceKey).to.equal('user_id');
      expect(Users.sourceKey).to.equal('place_id');

      expect(Places.targetKey).to.equal('place_id');
      expect(Users.targetKey).to.equal('user_id');
    });

    it('should infer targetKey from paired BTM relationship with a through model defined', () => {
      const User = sequelize.define('User', { user_id: DataTypes.UUID });
      const Place = sequelize.define('Place', { place_id: DataTypes.UUID });
      const UserPlace = sequelize.define(
        'UserPlace',
        {
          id: {
            primaryKey: true,
            type: DataTypes.INTEGER,
            autoIncrement: true,
          },
        },
        { timestamps: false },
      );

      const Places = User.belongsToMany(Place, {
        through: UserPlace,
        sourceKey: 'user_id',
        targetKey: 'place_id',
      });
      const Users = Place.getAssociation('users') as BelongsToManyAssociation;

      expect(Places.pairedWith).to.equal(Users);
      expect(Users.pairedWith).to.equal(Places);

      expect(Places.sourceKey).to.equal('user_id');
      expect(Users.sourceKey).to.equal('place_id', 'Users.sourceKey is invalid');

      expect(Places.targetKey).to.equal('place_id');
      expect(Users.targetKey).to.equal('user_id', 'Users.targetKey is invalid');

      expect(Object.keys(UserPlace.getAttributes()).length).to.equal(3); // Defined primary key and two foreign keys
    });
  });

  describe('pseudo associations', () => {
    it('should setup belongsTo relations to source and target from join model with defined foreign/other keys', () => {
      const Product = sequelize.define('Product', {
        title: DataTypes.STRING,
      });
      const Tag = sequelize.define('Tag', {
        name: DataTypes.STRING,
      });
      const ProductTag = sequelize.define(
        'ProductTag',
        {
          id: {
            primaryKey: true,
            type: DataTypes.INTEGER,
            autoIncrement: true,
          },
          priority: DataTypes.INTEGER,
        },
        {
          timestamps: false,
        },
      );

      const ProductTags = Product.belongsToMany(Tag, {
        through: ProductTag,
        foreignKey: 'productId',
        otherKey: 'tagId',
      });
      const TagProducts = Tag.belongsToMany(Product, {
        through: ProductTag,
        foreignKey: 'tagId',
        otherKey: 'productId',
      });

      expect(ProductTags.fromThroughToSource).to.be.an.instanceOf(BelongsToAssociation);
      expect(ProductTags.fromThroughToTarget).to.be.an.instanceOf(BelongsToAssociation);

      expect(TagProducts.fromThroughToSource).to.be.an.instanceOf(BelongsToAssociation);
      expect(TagProducts.fromThroughToTarget).to.be.an.instanceOf(BelongsToAssociation);

      expect(ProductTags.fromThroughToSource.foreignKey).to.equal(ProductTags.foreignKey);
      expect(ProductTags.fromThroughToTarget.foreignKey).to.equal(ProductTags.otherKey);

      expect(TagProducts.fromThroughToSource.foreignKey).to.equal(TagProducts.foreignKey);
      expect(TagProducts.fromThroughToTarget.foreignKey).to.equal(TagProducts.otherKey);

      expect(Object.keys(ProductTag.getAttributes()).length).to.equal(4);
      expect(Object.keys(ProductTag.getAttributes()).sort()).to.deep.equal(
        ['id', 'priority', 'productId', 'tagId'].sort(),
      );
    });

    it('should setup hasMany relations to source and target from join model with defined foreign/other keys', () => {
      const Product = sequelize.define('Product', {
        title: DataTypes.STRING,
      });
      const Tag = sequelize.define('Tag', {
        name: DataTypes.STRING,
      });
      const ProductTag = sequelize.define(
        'ProductTag',
        {
          id: {
            primaryKey: true,
            type: DataTypes.INTEGER,
            autoIncrement: true,
          },
          priority: DataTypes.INTEGER,
        },
        {
          timestamps: false,
        },
      );

      const ProductTags = Product.belongsToMany(Tag, {
        through: ProductTag,
        foreignKey: 'productId',
        otherKey: 'tagId',
      });
      const TagProducts = Tag.belongsToMany(Product, {
        through: ProductTag,
        foreignKey: 'tagId',
        otherKey: 'productId',
      });

      expect(ProductTags.fromSourceToThrough).to.be.an.instanceOf(HasManyAssociation);
      expect(ProductTags.fromTargetToThrough).to.be.an.instanceOf(HasManyAssociation);

      expect(TagProducts.fromSourceToThrough).to.be.an.instanceOf(HasManyAssociation);
      expect(TagProducts.fromTargetToThrough).to.be.an.instanceOf(HasManyAssociation);

      expect(ProductTags.fromSourceToThrough.foreignKey).to.equal(ProductTags.foreignKey);
      expect(ProductTags.fromTargetToThrough.foreignKey).to.equal(ProductTags.otherKey);

      expect(TagProducts.fromSourceToThrough.foreignKey).to.equal(TagProducts.foreignKey);
      expect(TagProducts.fromTargetToThrough.foreignKey).to.equal(TagProducts.otherKey);

      expect(Object.keys(ProductTag.getAttributes()).length).to.equal(4);
      expect(Object.keys(ProductTag.getAttributes()).sort()).to.deep.equal(
        ['id', 'priority', 'tagId', 'productId'].sort(),
      );
    });

    it('should setup hasOne relations to source and target from join model with defined foreign/other keys', () => {
      const Product = sequelize.define('Product', {
        title: DataTypes.STRING,
      });
      const Tag = sequelize.define('Tag', {
        name: DataTypes.STRING,
      });
      const ProductTag = sequelize.define(
        'ProductTag',
        {
          id: {
            primaryKey: true,
            type: DataTypes.INTEGER,
            autoIncrement: true,
          },
          priority: DataTypes.INTEGER,
        },
        {
          timestamps: false,
        },
      );

      const ProductTags = Product.belongsToMany(Tag, {
        through: ProductTag,
        foreignKey: 'productId',
        otherKey: 'tagId',
      });
      const TagProducts = Tag.belongsToMany(Product, {
        through: ProductTag,
        foreignKey: 'tagId',
        otherKey: 'productId',
      });

      expect(ProductTags.fromSourceToThroughOne).to.be.an.instanceOf(HasOneAssociation);
      expect(ProductTags.fromTargetToThroughOne).to.be.an.instanceOf(HasOneAssociation);

      expect(TagProducts.fromSourceToThroughOne).to.be.an.instanceOf(HasOneAssociation);
      expect(TagProducts.fromTargetToThroughOne).to.be.an.instanceOf(HasOneAssociation);

      expect(ProductTags.fromSourceToThroughOne.foreignKey).to.equal(ProductTags.foreignKey);
      expect(ProductTags.fromTargetToThroughOne.foreignKey).to.equal(ProductTags.otherKey);

      expect(TagProducts.fromSourceToThroughOne.foreignKey).to.equal(TagProducts.foreignKey);
      expect(TagProducts.fromTargetToThroughOne.foreignKey).to.equal(TagProducts.otherKey);

      expect(Object.keys(ProductTag.getAttributes()).length).to.equal(4);
      expect(Object.keys(ProductTag.getAttributes()).sort()).to.deep.equal(
        ['id', 'priority', 'productId', 'tagId'].sort(),
      );
    });

    it('should setup hasOne relations to source and target from join model with defined source keys', () => {
      const Product = sequelize.define('Product', {
        title: DataTypes.STRING,
        productSecondaryId: DataTypes.STRING,
      });
      const Tag = sequelize.define('Tag', {
        name: DataTypes.STRING,
        tagSecondaryId: DataTypes.STRING,
      });
      const ProductTag = sequelize.define(
        'ProductTag',
        {
          id: {
            primaryKey: true,
            type: DataTypes.INTEGER,
            autoIncrement: true,
          },
          priority: DataTypes.INTEGER,
        },
        {
          timestamps: false,
        },
      );

      const ProductTags = Product.belongsToMany(Tag, {
        through: ProductTag,
        sourceKey: 'productSecondaryId',
        targetKey: 'tagSecondaryId',
      });
      const TagProducts = Tag.getAssociation('products') as BelongsToManyAssociation;

      expect(ProductTags.foreignKey).to.equal(
        'productProductSecondaryId',
        'generated foreign key for source name (product) + source key (productSecondaryId) should result in productProductSecondaryId',
      );
      expect(TagProducts.foreignKey).to.equal('tagTagSecondaryId');

      expect(ProductTags.fromSourceToThroughOne).to.be.an.instanceOf(HasOneAssociation);
      expect(ProductTags.fromTargetToThroughOne).to.be.an.instanceOf(HasOneAssociation);

      expect(TagProducts.fromSourceToThroughOne).to.be.an.instanceOf(HasOneAssociation);
      expect(TagProducts.fromTargetToThroughOne).to.be.an.instanceOf(HasOneAssociation);

      expect(TagProducts.fromSourceToThroughOne.sourceKey).to.equal(TagProducts.sourceKey);
      expect(TagProducts.fromTargetToThroughOne.sourceKey).to.equal(TagProducts.targetKey);

      expect(ProductTags.fromSourceToThroughOne.sourceKey).to.equal(ProductTags.sourceKey);
      expect(ProductTags.fromTargetToThroughOne.sourceKey).to.equal(ProductTags.targetKey);

      expect(Object.keys(ProductTag.getAttributes()).length).to.equal(4);
      expect(Object.keys(ProductTag.getAttributes()).sort()).to.deep.equal(
        ['id', 'priority', 'productProductSecondaryId', 'tagTagSecondaryId'].sort(),
      );
    });

    it('should setup belongsTo relations to source and target from join model with only foreign keys defined', () => {
      const Product = sequelize.define('Product', {
        title: DataTypes.STRING,
      });
      const Tag = sequelize.define('Tag', {
        name: DataTypes.STRING,
      });
      const ProductTag = sequelize.define(
        'ProductTag',
        {
          id: {
            primaryKey: true,
            type: DataTypes.INTEGER,
            autoIncrement: true,
          },
          priority: DataTypes.INTEGER,
        },
        {
          timestamps: false,
        },
      );

      const ProductTags = Product.belongsToMany(Tag, {
        through: ProductTag,
        foreignKey: 'product_ID',
        otherKey: 'tag_ID',
      });
      const TagProducts = Tag.getAssociation('products') as BelongsToManyAssociation;

      expect(ProductTags.fromThroughToSource).to.be.ok;
      expect(ProductTags.fromThroughToTarget).to.be.ok;

      expect(TagProducts.fromThroughToSource).to.be.ok;
      expect(TagProducts.fromThroughToTarget).to.be.ok;

      expect(ProductTags.fromThroughToSource.foreignKey).to.equal(ProductTags.foreignKey);
      expect(ProductTags.fromThroughToTarget.foreignKey).to.equal(ProductTags.otherKey);

      expect(TagProducts.fromThroughToSource.foreignKey).to.equal(TagProducts.foreignKey);
      expect(TagProducts.fromThroughToTarget.foreignKey).to.equal(TagProducts.otherKey);

      expect(Object.keys(ProductTag.getAttributes()).length).to.equal(4);
      expect(Object.keys(ProductTag.getAttributes()).sort()).to.deep.equal(
        ['id', 'priority', 'product_ID', 'tag_ID'].sort(),
      );
    });

    it('should setup hasOne relations to source and target from join model with only foreign keys defined', () => {
      const Product = sequelize.define('Product', {
        title: DataTypes.STRING,
      });
      const Tag = sequelize.define('Tag', {
        name: DataTypes.STRING,
      });
      const ProductTag = sequelize.define(
        'ProductTag',
        {
          id: {
            primaryKey: true,
            type: DataTypes.INTEGER,
            autoIncrement: true,
          },
          priority: DataTypes.INTEGER,
        },
        {
          timestamps: false,
        },
      );

      const ProductTags = Product.belongsToMany(Tag, {
        through: ProductTag,
        foreignKey: 'product_ID',
        otherKey: 'tag_ID',
      });
      const TagProducts = Tag.getAssociation('products') as BelongsToManyAssociation;

      expect(ProductTags.fromSourceToThroughOne).to.be.an.instanceOf(HasOneAssociation);
      expect(ProductTags.fromTargetToThroughOne).to.be.an.instanceOf(HasOneAssociation);

      expect(TagProducts.fromSourceToThroughOne).to.be.an.instanceOf(HasOneAssociation);
      expect(TagProducts.fromTargetToThroughOne).to.be.an.instanceOf(HasOneAssociation);

      expect(ProductTags.fromSourceToThroughOne.foreignKey).to.equal(ProductTags.foreignKey);
      expect(ProductTags.fromTargetToThroughOne.foreignKey).to.equal(ProductTags.otherKey);

      expect(TagProducts.fromSourceToThroughOne.foreignKey).to.equal(TagProducts.foreignKey);
      expect(TagProducts.fromTargetToThroughOne.foreignKey).to.equal(TagProducts.otherKey);

      expect(Object.keys(ProductTag.getAttributes()).length).to.equal(4);
      expect(Object.keys(ProductTag.getAttributes()).sort()).to.deep.equal(
        ['id', 'priority', 'product_ID', 'tag_ID'].sort(),
      );
    });

    it('should setup belongsTo relations to source and target from join model with no foreign keys defined', () => {
      const Product = sequelize.define('Product', {
        title: DataTypes.STRING,
      });
      const Tag = sequelize.define('Tag', {
        name: DataTypes.STRING,
      });
      const ProductTag = sequelize.define(
        'ProductTag',
        {
          id: {
            primaryKey: true,
            type: DataTypes.INTEGER,
            autoIncrement: true,
          },
          priority: DataTypes.INTEGER,
        },
        {
          timestamps: false,
        },
      );

      const ProductTags = Product.belongsToMany(Tag, { through: ProductTag });
      const TagProducts = Tag.belongsToMany(Product, { through: ProductTag });

      expect(ProductTags.fromThroughToSource).to.be.ok;
      expect(ProductTags.fromThroughToTarget).to.be.ok;

      expect(TagProducts.fromThroughToSource).to.be.ok;
      expect(TagProducts.fromThroughToTarget).to.be.ok;

      expect(ProductTags.fromThroughToSource.foreignKey).to.equal(ProductTags.foreignKey);
      expect(ProductTags.fromThroughToTarget.foreignKey).to.equal(ProductTags.otherKey);

      expect(TagProducts.fromThroughToSource.foreignKey).to.equal(TagProducts.foreignKey);
      expect(TagProducts.fromThroughToTarget.foreignKey).to.equal(TagProducts.otherKey);

      expect(Object.keys(ProductTag.getAttributes()).length).to.equal(4);
      expect(Object.keys(ProductTag.getAttributes()).sort()).to.deep.equal(
        ['id', 'priority', 'productId', 'tagId'].sort(),
      );
    });
  });

  describe('associations on the join table', () => {
    const vars = beforeEach2(() => {
      class User extends Model {}

      class Project extends Model {}

      class UserProject extends Model {
        declare getUser: BelongsToGetAssociationMixin<User>;
        declare getProject: BelongsToGetAssociationMixin<Project>;
      }

      sequelize.addModels([User, Project, UserProject]);

      User.belongsToMany(Project, { through: UserProject });
      Project.belongsToMany(User, { through: UserProject });

      return { User, Project, UserProject };
    });

    it('should work for belongsTo associations defined before belongsToMany', () => {
      expect(vars.UserProject.prototype.getUser).to.be.ok;
    });

    it('should work for belongsTo associations defined after belongsToMany', () => {
      expect(vars.UserProject.prototype.getProject).to.be.ok;
    });
  });

  describe('self-associations', () => {
    it('does not pair multiple self associations with different through arguments', () => {
      const User = sequelize.define('user', {});
      const UserFollower = sequelize.define('userFollowers', {});
      const Invite = sequelize.define('invite', {});

      const UserFollowers = User.belongsToMany(User, {
        as: 'Followers',
        inverse: {
          as: 'Followings',
        },
        through: UserFollower,
      });

      const UserInvites = User.belongsToMany(User, {
        as: 'Invites',
        inverse: {
          as: 'Inviters',
        },
        foreignKey: 'InviteeId',
        through: Invite,
      });

      expect(UserFollowers.pairedWith).not.to.eq(UserInvites);
      expect(UserInvites.pairedWith).not.to.be.eq(UserFollowers);

      expect(UserFollowers.otherKey).not.to.equal(UserInvites.foreignKey);
    });

    it('correctly generates a foreign/other key when none are defined', () => {
      const User = sequelize.define('user', {});
      const UserFollower = sequelize.define(
        'userFollowers',
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
        },
        {
          timestamps: false,
        },
      );

      const UserFollowers = User.belongsToMany(User, {
        as: 'Followers',
        inverse: {
          as: 'Followings',
        },
        through: UserFollower,
      });

      expect(UserFollowers.foreignKey).to.eq('followingId');
      expect(UserFollowers.otherKey).to.eq('followerId');

      expect(Object.keys(UserFollower.getAttributes()).length).to.equal(3);
    });

    it('works with singular and plural name for self-associations', () => {
      // Models taken from https://github.com/sequelize/sequelize/issues/3796
      const Service = sequelize.define('service', {});

      Service.belongsToMany(Service, {
        through: 'Supplements',
        as: 'supplements',
        inverse: {
          as: { singular: 'supplemented', plural: 'supplemented' },
        },
      });

      expect(Service.prototype).to.have.ownProperty('getSupplements').to.be.a('function');

      expect(Service.prototype).to.have.ownProperty('addSupplement').to.be.a('function');
      expect(Service.prototype).to.have.ownProperty('addSupplements').to.be.a('function');

      expect(Service.prototype).to.have.ownProperty('getSupplemented').to.be.a('function');
      expect(Service.prototype).not.to.have.ownProperty('getSupplementeds').to.be.a('function');

      expect(Service.prototype).to.have.ownProperty('addSupplemented').to.be.a('function');
      expect(Service.prototype).not.to.have.ownProperty('addSupplementeds').to.be.a('function');
    });
  });

  describe('constraints', () => {
    it('work properly when through is a string', () => {
      const User = sequelize.define('User', {});
      const Group = sequelize.define('Group', {});

      User.belongsToMany(Group, {
        as: 'MyGroups',
        through: 'group_user',
        foreignKey: {
          onUpdate: 'RESTRICT',
          onDelete: 'SET NULL',
        },
        otherKey: {
          onUpdate: 'SET NULL',
          onDelete: 'RESTRICT',
        },
        inverse: {
          as: 'MyUsers',
        },
      });

      const MyUsers = Group.associations.MyUsers as BelongsToManyAssociation;
      const MyGroups = User.associations.MyGroups as BelongsToManyAssociation;
      const throughModel = MyUsers.through.model;

      expect(Object.keys(throughModel.getAttributes()).sort()).to.deep.equal(
        ['userId', 'groupId', 'createdAt', 'updatedAt'].sort(),
      );

      expect(throughModel === MyGroups.through.model);
      expect(throughModel.getAttributes().userId.onUpdate).to.equal('RESTRICT');
      expect(throughModel.getAttributes().userId.onDelete).to.equal('SET NULL');
      expect(throughModel.getAttributes().groupId.onUpdate).to.equal('SET NULL');
      expect(throughModel.getAttributes().groupId.onDelete).to.equal('RESTRICT');
    });

    it('work properly when through is a model', () => {
      const User = sequelize.define('User', {});
      const Group = sequelize.define('Group', {});
      const UserGroup = sequelize.define('GroupUser', {}, { tableName: 'user_groups' });

      User.belongsToMany(Group, {
        as: 'MyGroups',
        through: UserGroup,
        foreignKey: {
          onUpdate: 'RESTRICT',
          onDelete: 'SET NULL',
        },
        otherKey: {
          onUpdate: 'SET NULL',
          onDelete: 'RESTRICT',
        },
        inverse: {
          as: 'MyUsers',
        },
      });

      const MyUsers = Group.associations.MyUsers as BelongsToManyAssociation;
      const MyGroups = User.associations.MyGroups as BelongsToManyAssociation;

      expect(MyUsers.through.model === MyGroups.through.model);

      const Through = MyUsers.through.model;

      expect(Object.keys(Through.getAttributes()).sort()).to.deep.equal(
        ['userId', 'groupId', 'createdAt', 'updatedAt'].sort(),
      );

      expect(Through.getAttributes().userId.onUpdate).to.equal(
        'RESTRICT',
        'UserId.onUpdate should have been RESTRICT',
      );
      expect(Through.getAttributes().userId.onDelete).to.equal(
        'SET NULL',
        'UserId.onDelete should have been SET NULL',
      );
      expect(Through.getAttributes().groupId.onUpdate).to.equal(
        'SET NULL',
        'GroupId.OnUpdate should have been SET NULL',
      );
      expect(Through.getAttributes().groupId.onDelete).to.equal(
        'RESTRICT',
        'GroupId.onDelete should have been RESTRICT',
      );
    });

    it('makes the foreign keys primary keys', () => {
      const User = sequelize.define('User', {});
      const Group = sequelize.define('Group', {});

      const association = User.belongsToMany(Group, {
        as: 'MyGroups',
        through: 'GroupUser',
        inverse: {
          as: 'MyUsers',
        },
      });

      const Through = association.throughModel;

      expect(Object.keys(Through.getAttributes()).sort()).to.deep.equal(
        ['createdAt', 'updatedAt', 'groupId', 'userId'].sort(),
      );
      expect(Through.getAttributes().userId.primaryKey).to.be.true;
      expect(Through.getAttributes().groupId.primaryKey).to.be.true;
      // @ts-expect-error -- this property does not exist after normalization
      expect(Through.getAttributes().userId.unique).to.be.undefined;
      // @ts-expect-error -- this property does not exist after normalization
      expect(Through.getAttributes().groupId.unique).to.be.undefined;
    });

    it('generates unique identifier with very long length', () => {
      const User = sequelize.define('User', {}, { tableName: 'table_user_with_very_long_name' });
      const Group = sequelize.define('Group', {}, { tableName: 'table_group_with_very_long_name' });
      const UserGroup = sequelize.define(
        'GroupUser',
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
          },
          id_user_very_long_field: {
            type: DataTypes.INTEGER(1),
          },
          id_group_very_long_field: {
            type: DataTypes.INTEGER(1),
          },
        },
        { tableName: 'table_user_group_with_very_long_name' },
      );

      User.belongsToMany(Group, {
        as: 'MyGroups',
        through: UserGroup,
        foreignKey: 'id_user_very_long_field',
        otherKey: 'id_group_very_long_field',
        inverse: {
          as: 'MyUsers',
        },
      });

      const MyUsers = Group.associations.MyUsers as BelongsToManyAssociation;
      const MyGroups = User.associations.MyGroups as BelongsToManyAssociation;

      const Through = MyUsers.through.model;
      expect(Through === MyGroups.through.model);

      expect(Object.keys(Through.getAttributes()).sort()).to.deep.equal(
        [
          'id',
          'createdAt',
          'updatedAt',
          'id_user_very_long_field',
          'id_group_very_long_field',
        ].sort(),
      );

      expect(Through.getIndexes()).to.deep.equal([
        {
          name: 'table_user_group_with_very_long_name_id_group_very_long_field_id_user_very_long_field_unique',
          unique: true,
          fields: ['id_user_very_long_field', 'id_group_very_long_field'],
          column: 'id_user_very_long_field',
        },
      ]);

      // @ts-expect-error -- this property does not exist after normalization
      expect(Through.getAttributes().id_user_very_long_field.unique).to.be.undefined;
      // @ts-expect-error -- this property does not exist after normalization
      expect(Through.getAttributes().id_group_very_long_field.unique).to.be.undefined;
    });

    it('generates unique identifier with custom name', () => {
      const User = sequelize.define('User', {}, { tableName: 'table_user_with_very_long_name' });
      const Group = sequelize.define('Group', {}, { tableName: 'table_group_with_very_long_name' });
      const UserGroup = sequelize.define(
        'GroupUser',
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
          },
          id_user_very_long_field: {
            type: DataTypes.INTEGER(1),
          },
          id_group_very_long_field: {
            type: DataTypes.INTEGER(1),
          },
        },
        { tableName: 'table_user_group_with_very_long_name' },
      );

      User.belongsToMany(Group, {
        as: 'MyGroups',
        through: {
          model: UserGroup,
          unique: 'custom_user_group_unique',
        },
        foreignKey: 'id_user_very_long_field',
        otherKey: 'id_group_very_long_field',
        inverse: {
          as: 'MyUsers',
        },
      });

      const MyUsers = Group.associations.MyUsers as BelongsToManyAssociation;
      const MyGroups = User.associations.MyGroups as BelongsToManyAssociation;

      expect(MyUsers.through.model === UserGroup);
      expect(MyGroups.through.model === UserGroup);

      expect(UserGroup.getIndexes()).to.deep.equal([
        {
          name: 'custom_user_group_unique',
          unique: true,
          fields: ['id_user_very_long_field', 'id_group_very_long_field'],
          column: 'id_user_very_long_field',
        },
      ]);

      // @ts-expect-error -- this property does not exist after normalization
      expect(UserGroup.getAttributes().id_user_very_long_field.unique).to.be.undefined;
      // @ts-expect-error -- this property does not exist after normalization
      expect(UserGroup.getAttributes().id_group_very_long_field.unique).to.be.undefined;
    });
  });

  describe('association hooks', () => {
    let Project: ModelStatic<any>;
    let Task: ModelStatic<any>;

    beforeEach(() => {
      Project = sequelize.define('Project', { title: DataTypes.STRING });
      Task = sequelize.define('Task', { title: DataTypes.STRING });
    });
    describe('beforeBelongsToManyAssociate', () => {
      it('should trigger', () => {
        const beforeAssociate = sinon.spy();
        Project.beforeAssociate(beforeAssociate);
        Project.belongsToMany(Task, { through: 'projects_and_tasks', hooks: true });

        const beforeAssociateArgs = beforeAssociate.getCall(0).args;

        expect(beforeAssociate).to.have.been.called;
        expect(beforeAssociateArgs.length).to.equal(2);

        const firstArg = beforeAssociateArgs[0];
        expect(Object.keys(firstArg).join(',')).to.equal('source,target,type,sequelize');
        expect(firstArg.source).to.equal(Project);
        expect(firstArg.target).to.equal(Task);
        expect(firstArg.type.name).to.equal('BelongsToMany');
        expect(firstArg.sequelize.constructor.name).to.equal('Sequelize');
      });
      it('should not trigger association hooks', () => {
        const beforeAssociate = sinon.spy();
        Project.beforeAssociate(beforeAssociate);
        Project.belongsToMany(Task, { through: 'projects_and_tasks', hooks: false });
        expect(beforeAssociate).to.not.have.been.called;
      });
    });

    describe('afterBelongsToManyAssociate', () => {
      it('should trigger', () => {
        const afterAssociate = sinon.spy();
        Project.afterAssociate(afterAssociate);
        Project.belongsToMany(Task, { through: 'projects_and_tasks', hooks: true });

        const afterAssociateArgs = afterAssociate.getCalls()[afterAssociate.callCount - 1].args;

        expect(afterAssociate).to.have.been.called;
        expect(afterAssociateArgs.length).to.equal(2);

        const firstArg = afterAssociateArgs[0];
        expect(Object.keys(firstArg).join(',')).to.equal(
          'source,target,type,association,sequelize',
        );
        expect(firstArg.source).to.equal(Project);
        expect(firstArg.target).to.equal(Task);
        expect(firstArg.type.name).to.equal('BelongsToMany');
        expect(firstArg.association.constructor.name).to.equal('BelongsToMany');
        expect(firstArg.sequelize.constructor.name).to.equal('Sequelize');
      });

      it('should not trigger association hooks', () => {
        const afterAssociate = sinon.spy();
        Project.afterAssociate(afterAssociate);
        Project.belongsToMany(Task, { through: 'projects_and_tasks', hooks: false });
        expect(afterAssociate).to.not.have.been.called;
      });
    });
  });
});
