'use strict';

const chai = require('chai');
const sinon = require('sinon');
const expect = chai.expect;
const stub = sinon.stub;
const _ = require('lodash');
const Support = require('../support');
const DataTypes = require('sequelize/lib/data-types');
const BelongsTo = require('sequelize/lib/associations/belongs-to');
const HasMany = require('sequelize/lib/associations/has-many');
const HasOne = require('sequelize/lib/associations/has-one');
const current = Support.sequelize;
const AssociationError = require('sequelize/lib/errors').AssociationError;

describe(Support.getTestDialectTeaser('belongsToMany'), () => {
  it('throws when invalid model is passed', () => {
    const User = current.define('User');

    expect(() => {
      User.belongsToMany();
    }).to.throw('User.belongsToMany called with something that\'s not a subclass of Sequelize.Model');
  });

  it('should not inherit scopes from parent to join table', () => {
    const A = current.define('a'),
      B = current.define('b', {}, {
        defaultScope: {
          where: {
            foo: 'bar'
          }
        },
        scopes: {
          baz: {
            where: {
              fooz: 'zab'
            }
          }
        }
      });

    B.belongsToMany(A, { through: 'AB' });

    const AB = current.model('AB');

    expect(AB.options.defaultScope).to.deep.equal({});
    expect(AB.options.scopes).to.deep.equal({});
  });

  it('should not inherit validations from parent to join table', () => {
    const A = current.define('a'),
      B = current.define('b', {}, {
        validate: {
          validateModel() {
            return true;
          }
        }
      });

    B.belongsToMany(A, { through: 'AB' });

    const AB = current.model('AB');

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

    User.belongsToMany(Task, { through: 'UserTasks', as: 'task' });

    const user = User.build();

    _.each(methods, (alias, method) => {
      expect(user[method]()).to.be.a('function');
    });
  });

  describe('proper syntax', () => {
    it('throws an AssociationError if the through option is undefined, true, or null', () => {
      const User = current.define('User', {});
      const Task = current.define('Task', {});

      const errorFunction1 = User.belongsToMany.bind(User, Task, { through: true });
      const errorFunction2 = User.belongsToMany.bind(User, Task, { through: undefined });
      const errorFunction3 = User.belongsToMany.bind(User, Task, { through: null });
      for (const errorFunction of [errorFunction1, errorFunction2, errorFunction3]) {
        expect(errorFunction).to.throw(AssociationError, `${User.name}.belongsToMany(${Task.name}) requires through option, pass either a string or a model`);
      }
    });
    it('throws an AssociationError for a self-association defined without an alias', () => {
      const User = current.define('User', {});

      const errorFunction = User.belongsToMany.bind(User, User, { through: 'jointable' });
      expect(errorFunction).to.throw(AssociationError, '\'as\' must be defined for many-to-many self-associations');
    });
  });

  describe('timestamps', () => {
    it('follows the global timestamps true option', () => {
      const User = current.define('User', {}),
        Task = current.define('Task', {});

      User.belongsToMany(Task, { through: 'user_task1' });

      expect(current.models.user_task1.rawAttributes).to.contain.all.keys(['createdAt', 'updatedAt']);
    });

    it('allows me to override the global timestamps option', () => {
      const User = current.define('User', {}),
        Task = current.define('Task', {});

      User.belongsToMany(Task, { through: 'user_task2', timestamps: false });

      expect(current.models.user_task2.rawAttributes).not.to.contain.all.keys(['createdAt', 'updatedAt']);
    });

    it('follows the global timestamps false option', () => {
      const current = Support.createSequelizeInstance({
        timestamps: false
      });

      const User = current.define('User', {}),
        Task = current.define('Task', {});

      User.belongsToMany(Task, { through: 'user_task3' });

      expect(current.models.user_task3.rawAttributes).not.to.have.all.keys(['createdAt', 'updatedAt']);
    });
  });

  describe('optimizations using bulk create, destroy and update', () => {
    const User = current.define('User', { username: DataTypes.STRING }),
      Task = current.define('Task', { title: DataTypes.STRING }),
      UserTasks = current.define('UserTasks', {});

    User.belongsToMany(Task, { through: UserTasks });
    Task.belongsToMany(User, { through: UserTasks });

    const user = User.build({
        id: 42
      }),
      task1 = Task.build({
        id: 15
      }),
      task2 = Task.build({
        id: 16
      });

    beforeEach(function() {
      this.findAll = stub(UserTasks, 'findAll').resolves([]);
      this.bulkCreate = stub(UserTasks, 'bulkCreate').resolves([]);
      this.destroy = stub(UserTasks, 'destroy').resolves([]);
    });

    afterEach(function() {
      this.findAll.restore();
      this.bulkCreate.restore();
      this.destroy.restore();
    });

    it('uses one insert into statement', async function() {
      await user.setTasks([task1, task2]);
      expect(this.findAll).to.have.been.calledOnce;
      expect(this.bulkCreate).to.have.been.calledOnce;
    });

    it('uses one delete from statement', async function() {
      this.findAll
        .onFirstCall().resolves([])
        .onSecondCall().resolves([
          { userId: 42, taskId: 15 },
          { userId: 42, taskId: 16 }
        ]);

      await user.setTasks([task1, task2]);
      await user.setTasks(null);
      expect(this.findAll).to.have.been.calledTwice;
      expect(this.destroy).to.have.been.calledOnce;
    });
  });

  describe('foreign keys', () => {
    it('should infer otherKey from paired BTM relationship with a through string defined', function() {
      const User = this.sequelize.define('User', {});
      const Place = this.sequelize.define('Place', {});

      const Places = User.belongsToMany(Place, { through: 'user_places', foreignKey: 'user_id' });
      const Users = Place.belongsToMany(User, { through: 'user_places', foreignKey: 'place_id' });

      expect(Places.paired).to.equal(Users);
      expect(Users.paired).to.equal(Places);

      expect(Places.foreignKey).to.equal('user_id');
      expect(Users.foreignKey).to.equal('place_id');

      expect(Places.otherKey).to.equal('place_id');
      expect(Users.otherKey).to.equal('user_id');
    });

    it('should infer otherKey from paired BTM relationship with a through model defined', function() {
      const User = this.sequelize.define('User', {});
      const Place = this.sequelize.define('Place', {});
      const UserPlace = this.sequelize.define('UserPlace', {
        id: {
          primaryKey: true,
          type: DataTypes.INTEGER,
          autoIncrement: true
        }
      }, { timestamps: false });

      const Places = User.belongsToMany(Place, { through: UserPlace, foreignKey: 'user_id' });
      const Users = Place.belongsToMany(User, { through: UserPlace, foreignKey: 'place_id' });

      expect(Places.paired).to.equal(Users);
      expect(Users.paired).to.equal(Places);

      expect(Places.foreignKey).to.equal('user_id');
      expect(Users.foreignKey).to.equal('place_id');

      expect(Places.otherKey).to.equal('place_id');
      expect(Users.otherKey).to.equal('user_id');

      expect(Object.keys(UserPlace.rawAttributes).length).to.equal(3); // Defined primary key and two foreign keys
    });
  });

  describe('source/target keys', () => {
    it('should infer targetKey from paired BTM relationship with a through string defined', function() {
      const User = this.sequelize.define('User', { user_id: DataTypes.UUID });
      const Place = this.sequelize.define('Place', { place_id: DataTypes.UUID });

      const Places = User.belongsToMany(Place, { through: 'user_places', sourceKey: 'user_id' });
      const Users = Place.belongsToMany(User, { through: 'user_places', sourceKey: 'place_id' });

      expect(Places.paired).to.equal(Users);
      expect(Users.paired).to.equal(Places);

      expect(Places.sourceKey).to.equal('user_id');
      expect(Users.sourceKey).to.equal('place_id');

      expect(Places.targetKey).to.equal('place_id');
      expect(Users.targetKey).to.equal('user_id');
    });

    it('should infer targetKey from paired BTM relationship with a through model defined', function() {
      const User = this.sequelize.define('User', { user_id: DataTypes.UUID });
      const Place = this.sequelize.define('Place', { place_id: DataTypes.UUID });
      const UserPlace = this.sequelize.define('UserPlace', {
        id: {
          primaryKey: true,
          type: DataTypes.INTEGER,
          autoIncrement: true
        }
      }, { timestamps: false });

      const Places = User.belongsToMany(Place, { through: UserPlace, sourceKey: 'user_id' });
      const Users = Place.belongsToMany(User, { through: UserPlace, sourceKey: 'place_id' });

      expect(Places.paired).to.equal(Users);
      expect(Users.paired).to.equal(Places);

      expect(Places.sourceKey).to.equal('user_id');
      expect(Users.sourceKey).to.equal('place_id');

      expect(Places.targetKey).to.equal('place_id');
      expect(Users.targetKey).to.equal('user_id');

      expect(Object.keys(UserPlace.rawAttributes).length).to.equal(3); // Defined primary key and two foreign keys
    });
  });

  describe('pseudo associations', () => {
    it('should setup belongsTo relations to source and target from join model with defined foreign/other keys', function() {
      const Product = this.sequelize.define('Product', {
          title: DataTypes.STRING
        }),
        Tag = this.sequelize.define('Tag', {
          name: DataTypes.STRING
        }),
        ProductTag = this.sequelize.define('ProductTag', {
          id: {
            primaryKey: true,
            type: DataTypes.INTEGER,
            autoIncrement: true
          },
          priority: DataTypes.INTEGER
        }, {
          timestamps: false
        });

      Product.Tags = Product.belongsToMany(Tag, { through: ProductTag, foreignKey: 'productId', otherKey: 'tagId' });
      Tag.Products = Tag.belongsToMany(Product, { through: ProductTag, foreignKey: 'tagId', otherKey: 'productId' });

      expect(Product.Tags.toSource).to.be.an.instanceOf(BelongsTo);
      expect(Product.Tags.toTarget).to.be.an.instanceOf(BelongsTo);

      expect(Tag.Products.toSource).to.be.an.instanceOf(BelongsTo);
      expect(Tag.Products.toTarget).to.be.an.instanceOf(BelongsTo);

      expect(Product.Tags.toSource.foreignKey).to.equal(Product.Tags.foreignKey);
      expect(Product.Tags.toTarget.foreignKey).to.equal(Product.Tags.otherKey);

      expect(Tag.Products.toSource.foreignKey).to.equal(Tag.Products.foreignKey);
      expect(Tag.Products.toTarget.foreignKey).to.equal(Tag.Products.otherKey);

      expect(Object.keys(ProductTag.rawAttributes).length).to.equal(4);
      expect(Object.keys(ProductTag.rawAttributes)).to.deep.equal(['id', 'priority', 'productId', 'tagId']);
    });

    it('should setup hasMany relations to source and target from join model with defined foreign/other keys', function() {
      const Product = this.sequelize.define('Product', {
          title: DataTypes.STRING
        }),
        Tag = this.sequelize.define('Tag', {
          name: DataTypes.STRING
        }),
        ProductTag = this.sequelize.define('ProductTag', {
          id: {
            primaryKey: true,
            type: DataTypes.INTEGER,
            autoIncrement: true
          },
          priority: DataTypes.INTEGER
        }, {
          timestamps: false
        });

      Product.Tags = Product.belongsToMany(Tag, { through: ProductTag, foreignKey: 'productId', otherKey: 'tagId' });
      Tag.Products = Tag.belongsToMany(Product, { through: ProductTag, foreignKey: 'tagId', otherKey: 'productId' });

      expect(Product.Tags.manyFromSource).to.be.an.instanceOf(HasMany);
      expect(Product.Tags.manyFromTarget).to.be.an.instanceOf(HasMany);

      expect(Tag.Products.manyFromSource).to.be.an.instanceOf(HasMany);
      expect(Tag.Products.manyFromTarget).to.be.an.instanceOf(HasMany);

      expect(Product.Tags.manyFromSource.foreignKey).to.equal(Product.Tags.foreignKey);
      expect(Product.Tags.manyFromTarget.foreignKey).to.equal(Product.Tags.otherKey);

      expect(Tag.Products.manyFromSource.foreignKey).to.equal(Tag.Products.foreignKey);
      expect(Tag.Products.manyFromTarget.foreignKey).to.equal(Tag.Products.otherKey);

      expect(Object.keys(ProductTag.rawAttributes).length).to.equal(4);
      expect(Object.keys(ProductTag.rawAttributes)).to.deep.equal(['id', 'priority', 'productId', 'tagId']);
    });

    it('should setup hasOne relations to source and target from join model with defined foreign/other keys', function() {
      const Product = this.sequelize.define('Product', {
          title: DataTypes.STRING
        }),
        Tag = this.sequelize.define('Tag', {
          name: DataTypes.STRING
        }),
        ProductTag = this.sequelize.define('ProductTag', {
          id: {
            primaryKey: true,
            type: DataTypes.INTEGER,
            autoIncrement: true
          },
          priority: DataTypes.INTEGER
        }, {
          timestamps: false
        });

      Product.Tags = Product.belongsToMany(Tag, { through: ProductTag, foreignKey: 'productId', otherKey: 'tagId' });
      Tag.Products = Tag.belongsToMany(Product, { through: ProductTag, foreignKey: 'tagId', otherKey: 'productId' });

      expect(Product.Tags.oneFromSource).to.be.an.instanceOf(HasOne);
      expect(Product.Tags.oneFromTarget).to.be.an.instanceOf(HasOne);

      expect(Tag.Products.oneFromSource).to.be.an.instanceOf(HasOne);
      expect(Tag.Products.oneFromTarget).to.be.an.instanceOf(HasOne);

      expect(Product.Tags.oneFromSource.foreignKey).to.equal(Product.Tags.foreignKey);
      expect(Product.Tags.oneFromTarget.foreignKey).to.equal(Product.Tags.otherKey);

      expect(Tag.Products.oneFromSource.foreignKey).to.equal(Tag.Products.foreignKey);
      expect(Tag.Products.oneFromTarget.foreignKey).to.equal(Tag.Products.otherKey);

      expect(Object.keys(ProductTag.rawAttributes).length).to.equal(4);
      expect(Object.keys(ProductTag.rawAttributes)).to.deep.equal(['id', 'priority', 'productId', 'tagId']);
    });

    it('should setup hasOne relations to source and target from join model with defined source keys', function() {
      const Product = this.sequelize.define('Product', {
          title: DataTypes.STRING,
          productSecondaryId: DataTypes.STRING
        }),
        Tag = this.sequelize.define('Tag', {
          name: DataTypes.STRING,
          tagSecondaryId: DataTypes.STRING
        }),
        ProductTag = this.sequelize.define('ProductTag', {
          id: {
            primaryKey: true,
            type: DataTypes.INTEGER,
            autoIncrement: true
          },
          priority: DataTypes.INTEGER
        }, {
          timestamps: false
        });

      Product.Tags = Product.belongsToMany(Tag, { through: ProductTag, sourceKey: 'productSecondaryId' });
      Tag.Products = Tag.belongsToMany(Product, { through: ProductTag, sourceKey: 'tagSecondaryId' });

      expect(Product.Tags.oneFromSource).to.be.an.instanceOf(HasOne);
      expect(Product.Tags.oneFromTarget).to.be.an.instanceOf(HasOne);

      expect(Tag.Products.oneFromSource).to.be.an.instanceOf(HasOne);
      expect(Tag.Products.oneFromTarget).to.be.an.instanceOf(HasOne);

      expect(Tag.Products.oneFromSource.sourceKey).to.equal(Tag.Products.sourceKey);
      expect(Tag.Products.oneFromTarget.sourceKey).to.equal(Tag.Products.targetKey);

      expect(Product.Tags.oneFromSource.sourceKey).to.equal(Product.Tags.sourceKey);
      expect(Product.Tags.oneFromTarget.sourceKey).to.equal(Product.Tags.targetKey);

      expect(Object.keys(ProductTag.rawAttributes).length).to.equal(4);
      expect(Object.keys(ProductTag.rawAttributes)).to.deep.equal(['id', 'priority', 'ProductProductSecondaryId', 'TagTagSecondaryId']);
    });

    it('should setup belongsTo relations to source and target from join model with only foreign keys defined', function() {
      const Product = this.sequelize.define('Product', {
          title: DataTypes.STRING
        }),
        Tag = this.sequelize.define('Tag', {
          name: DataTypes.STRING
        }),
        ProductTag = this.sequelize.define('ProductTag', {
          id: {
            primaryKey: true,
            type: DataTypes.INTEGER,
            autoIncrement: true
          },
          priority: DataTypes.INTEGER
        }, {
          timestamps: false
        });

      Product.Tags = Product.belongsToMany(Tag, { through: ProductTag, foreignKey: 'product_ID' });
      Tag.Products = Tag.belongsToMany(Product, { through: ProductTag, foreignKey: 'tag_ID' });

      expect(Product.Tags.toSource).to.be.ok;
      expect(Product.Tags.toTarget).to.be.ok;

      expect(Tag.Products.toSource).to.be.ok;
      expect(Tag.Products.toTarget).to.be.ok;

      expect(Product.Tags.toSource.foreignKey).to.equal(Product.Tags.foreignKey);
      expect(Product.Tags.toTarget.foreignKey).to.equal(Product.Tags.otherKey);

      expect(Tag.Products.toSource.foreignKey).to.equal(Tag.Products.foreignKey);
      expect(Tag.Products.toTarget.foreignKey).to.equal(Tag.Products.otherKey);

      expect(Object.keys(ProductTag.rawAttributes).length).to.equal(4);
      expect(Object.keys(ProductTag.rawAttributes)).to.deep.equal(['id', 'priority', 'product_ID', 'tag_ID']);
    });

    it('should setup hasOne relations to source and target from join model with only foreign keys defined', function() {
      const Product = this.sequelize.define('Product', {
          title: DataTypes.STRING
        }),
        Tag = this.sequelize.define('Tag', {
          name: DataTypes.STRING
        }),
        ProductTag = this.sequelize.define('ProductTag', {
          id: {
            primaryKey: true,
            type: DataTypes.INTEGER,
            autoIncrement: true
          },
          priority: DataTypes.INTEGER
        }, {
          timestamps: false
        });

      Product.Tags = Product.belongsToMany(Tag, { through: ProductTag, foreignKey: 'product_ID' });
      Tag.Products = Tag.belongsToMany(Product, { through: ProductTag, foreignKey: 'tag_ID' });

      expect(Product.Tags.oneFromSource).to.be.an.instanceOf(HasOne);
      expect(Product.Tags.oneFromTarget).to.be.an.instanceOf(HasOne);

      expect(Tag.Products.oneFromSource).to.be.an.instanceOf(HasOne);
      expect(Tag.Products.oneFromTarget).to.be.an.instanceOf(HasOne);

      expect(Product.Tags.oneFromSource.foreignKey).to.equal(Product.Tags.foreignKey);
      expect(Product.Tags.oneFromTarget.foreignKey).to.equal(Product.Tags.otherKey);

      expect(Tag.Products.oneFromSource.foreignKey).to.equal(Tag.Products.foreignKey);
      expect(Tag.Products.oneFromTarget.foreignKey).to.equal(Tag.Products.otherKey);

      expect(Object.keys(ProductTag.rawAttributes).length).to.equal(4);
      expect(Object.keys(ProductTag.rawAttributes)).to.deep.equal(['id', 'priority', 'product_ID', 'tag_ID']);
    });

    it('should setup belongsTo relations to source and target from join model with no foreign keys defined', function() {
      const Product = this.sequelize.define('Product', {
          title: DataTypes.STRING
        }),
        Tag = this.sequelize.define('Tag', {
          name: DataTypes.STRING
        }),
        ProductTag = this.sequelize.define('ProductTag', {
          id: {
            primaryKey: true,
            type: DataTypes.INTEGER,
            autoIncrement: true
          },
          priority: DataTypes.INTEGER
        }, {
          timestamps: false
        });

      Product.Tags = Product.belongsToMany(Tag, { through: ProductTag });
      Tag.Products = Tag.belongsToMany(Product, { through: ProductTag });

      expect(Product.Tags.toSource).to.be.ok;
      expect(Product.Tags.toTarget).to.be.ok;

      expect(Tag.Products.toSource).to.be.ok;
      expect(Tag.Products.toTarget).to.be.ok;

      expect(Product.Tags.toSource.foreignKey).to.equal(Product.Tags.foreignKey);
      expect(Product.Tags.toTarget.foreignKey).to.equal(Product.Tags.otherKey);

      expect(Tag.Products.toSource.foreignKey).to.equal(Tag.Products.foreignKey);
      expect(Tag.Products.toTarget.foreignKey).to.equal(Tag.Products.otherKey);

      expect(Object.keys(ProductTag.rawAttributes).length).to.equal(4);
      expect(Object.keys(ProductTag.rawAttributes)).to.deep.equal(['id', 'priority', 'ProductId', 'TagId']);
    });
  });

  describe('associations on the join table', () => {
    beforeEach(function() {
      this.User = this.sequelize.define('User', {});
      this.Project = this.sequelize.define('Project', {});
      this.UserProjects = this.sequelize.define('UserProjects', {});

      this.UserProjects.belongsTo(this.User);

      this.User.belongsToMany(this.Project, { through: this.UserProjects });
      this.Project.belongsToMany(this.User, { through: this.UserProjects });

      this.UserProjects.belongsTo(this.Project);
    });

    it('should work for belongsTo associations defined before belongsToMany', function() {
      expect(this.UserProjects.prototype.getUser).to.be.ok;
    });
    it('should work for belongsTo associations defined after belongsToMany', function() {
      expect(this.UserProjects.prototype.getProject).to.be.ok;
    });
  });

  describe('self-associations', () => {
    it('does not pair multiple self associations with different through arguments', () => {
      const User = current.define('user', {}),
        UserFollowers = current.define('userFollowers', {}),
        Invite = current.define('invite', {});

      User.Followers = User.belongsToMany(User, {
        as: 'Followers',
        through: UserFollowers
      });

      User.Invites = User.belongsToMany(User, {
        as: 'Invites',
        foreignKey: 'InviteeId',
        through: Invite
      });

      expect(User.Followers.paired).not.to.be.ok;
      expect(User.Invites.paired).not.to.be.ok;

      expect(User.Followers.otherKey).not.to.equal(User.Invites.foreignKey);
    });

    it('correctly generates a foreign/other key when none are defined', () => {
      const User = current.define('user', {}),
        UserFollowers = current.define('userFollowers', {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
          }
        }, {
          timestamps: false
        });

      User.Followers = User.belongsToMany(User, {
        as: 'Followers',
        through: UserFollowers
      });

      expect(User.Followers.foreignKey).to.be.ok;
      expect(User.Followers.otherKey).to.be.ok;

      expect(Object.keys(UserFollowers.rawAttributes).length).to.equal(3);
    });

    it('works with singular and plural name for self-associations', () => {
      // Models taken from https://github.com/sequelize/sequelize/issues/3796
      const Service = current.define('service', {});

      Service.belongsToMany(Service, { through: 'Supplements', as: 'supplements' });
      Service.belongsToMany(Service, { through: 'Supplements', as: { singular: 'supplemented', plural: 'supplemented' } });


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

    it('work properly when through is a string', function() {
      const User = this.sequelize.define('User', {}),
        Group = this.sequelize.define('Group', {});

      User.belongsToMany(Group, { as: 'MyGroups', through: 'group_user', onUpdate: 'RESTRICT', onDelete: 'SET NULL' });
      Group.belongsToMany(User, { as: 'MyUsers', through: 'group_user', onUpdate: 'SET NULL', onDelete: 'RESTRICT' });

      expect(Group.associations.MyUsers.through.model === User.associations.MyGroups.through.model);
      expect(Group.associations.MyUsers.through.model.rawAttributes.UserId.onUpdate).to.equal('RESTRICT');
      expect(Group.associations.MyUsers.through.model.rawAttributes.UserId.onDelete).to.equal('SET NULL');
      expect(Group.associations.MyUsers.through.model.rawAttributes.GroupId.onUpdate).to.equal('SET NULL');
      expect(Group.associations.MyUsers.through.model.rawAttributes.GroupId.onDelete).to.equal('RESTRICT');
    });

    it('work properly when through is a model', function() {
      const User = this.sequelize.define('User', {}),
        Group = this.sequelize.define('Group', {}),
        UserGroup = this.sequelize.define('GroupUser', {}, { tableName: 'user_groups' });

      User.belongsToMany(Group, { as: 'MyGroups', through: UserGroup, onUpdate: 'RESTRICT', onDelete: 'SET NULL' });
      Group.belongsToMany(User, { as: 'MyUsers', through: UserGroup, onUpdate: 'SET NULL', onDelete: 'RESTRICT' });

      expect(Group.associations.MyUsers.through.model === User.associations.MyGroups.through.model);
      expect(Group.associations.MyUsers.through.model.rawAttributes.UserId.onUpdate).to.equal('RESTRICT');
      expect(Group.associations.MyUsers.through.model.rawAttributes.UserId.onDelete).to.equal('SET NULL');
      expect(Group.associations.MyUsers.through.model.rawAttributes.GroupId.onUpdate).to.equal('SET NULL');
      expect(Group.associations.MyUsers.through.model.rawAttributes.GroupId.onDelete).to.equal('RESTRICT');
    });

    it('generate unique identifier with very long length', function() {
      const User = this.sequelize.define('User', {}, { tableName: 'table_user_with_very_long_name' }),
        Group = this.sequelize.define('Group', {}, { tableName: 'table_group_with_very_long_name' }),
        UserGroup = this.sequelize.define(
          'GroupUser',
          {
            id_user_very_long_field: {
              type: DataTypes.INTEGER(1)
            },
            id_group_very_long_field: {
              type: DataTypes.INTEGER(1)
            }
          },
          { tableName: 'table_user_group_with_very_long_name' }
        );

      User.belongsToMany(Group, { as: 'MyGroups', through: UserGroup, foreignKey: 'id_user_very_long_field' });
      Group.belongsToMany(User, { as: 'MyUsers', through: UserGroup, foreignKey: 'id_group_very_long_field' });

      expect(Group.associations.MyUsers.through.model === User.associations.MyGroups.through.model);
      expect(Group.associations.MyUsers.through.model.rawAttributes.id_user_very_long_field.unique).to.have.lengthOf(92);
      expect(Group.associations.MyUsers.through.model.rawAttributes.id_group_very_long_field.unique).to.have.lengthOf(92);
      expect(Group.associations.MyUsers.through.model.rawAttributes.id_user_very_long_field.unique).to.equal('table_user_group_with_very_long_name_id_group_very_long_field_id_user_very_long_field_unique');
      expect(Group.associations.MyUsers.through.model.rawAttributes.id_group_very_long_field.unique).to.equal('table_user_group_with_very_long_name_id_group_very_long_field_id_user_very_long_field_unique');
    });

    it('generate unique identifier with custom name', function() {
      const User = this.sequelize.define('User', {}, { tableName: 'table_user_with_very_long_name' }),
        Group = this.sequelize.define('Group', {}, { tableName: 'table_group_with_very_long_name' }),
        UserGroup = this.sequelize.define(
          'GroupUser',
          {
            id_user_very_long_field: {
              type: DataTypes.INTEGER(1)
            },
            id_group_very_long_field: {
              type: DataTypes.INTEGER(1)
            }
          },
          { tableName: 'table_user_group_with_very_long_name' }
        );

      User.belongsToMany(Group, {
        as: 'MyGroups',
        through: UserGroup,
        foreignKey: 'id_user_very_long_field',
        uniqueKey: 'custom_user_group_unique'
      });
      Group.belongsToMany(User, {
        as: 'MyUsers',
        through: UserGroup,
        foreignKey: 'id_group_very_long_field',
        uniqueKey: 'custom_user_group_unique'
      });

      expect(Group.associations.MyUsers.through.model === User.associations.MyGroups.through.model);
      expect(Group.associations.MyUsers.through.model.rawAttributes.id_user_very_long_field.unique).to.have.lengthOf(24);
      expect(Group.associations.MyUsers.through.model.rawAttributes.id_group_very_long_field.unique).to.have.lengthOf(24);
      expect(Group.associations.MyUsers.through.model.rawAttributes.id_user_very_long_field.unique).to.equal('custom_user_group_unique');
      expect(Group.associations.MyUsers.through.model.rawAttributes.id_group_very_long_field.unique).to.equal('custom_user_group_unique');
    });
  });
  describe('association hooks', () => {
    beforeEach(function() {
      this.Projects = this.sequelize.define('Project', { title: DataTypes.STRING });
      this.Tasks = this.sequelize.define('Task', { title: DataTypes.STRING });
    });
    describe('beforeBelongsToManyAssociate', () => {
      it('should trigger', function() {
        const beforeAssociate = sinon.spy();
        this.Projects.beforeAssociate(beforeAssociate);
        this.Projects.belongsToMany(this.Tasks, { through: 'projects_and_tasks', hooks: true });

        const beforeAssociateArgs = beforeAssociate.getCall(0).args;

        expect(beforeAssociate).to.have.been.called;
        expect(beforeAssociateArgs.length).to.equal(2);

        const firstArg = beforeAssociateArgs[0];
        expect(Object.keys(firstArg).join()).to.equal('source,target,type');
        expect(firstArg.source).to.equal(this.Projects);
        expect(firstArg.target).to.equal(this.Tasks);
        expect(firstArg.type.name).to.equal('BelongsToMany');

        expect(beforeAssociateArgs[1].sequelize.constructor.name).to.equal('Sequelize');
      });
      it('should not trigger association hooks', function() {
        const beforeAssociate = sinon.spy();
        this.Projects.beforeAssociate(beforeAssociate);
        this.Projects.belongsToMany(this.Tasks, { through: 'projects_and_tasks', hooks: false });
        expect(beforeAssociate).to.not.have.been.called;
      });
    });
    describe('afterBelongsToManyAssociate', () => {
      it('should trigger', function() {
        const afterAssociate = sinon.spy();
        this.Projects.afterAssociate(afterAssociate);
        this.Projects.belongsToMany(this.Tasks, { through: 'projects_and_tasks', hooks: true });

        const afterAssociateArgs = afterAssociate.getCall(0).args;

        expect(afterAssociate).to.have.been.called;
        expect(afterAssociateArgs.length).to.equal(2);

        const firstArg = afterAssociateArgs[0];
        expect(Object.keys(firstArg).join()).to.equal('source,target,type,association');
        expect(firstArg.source).to.equal(this.Projects);
        expect(firstArg.target).to.equal(this.Tasks);
        expect(firstArg.type.name).to.equal('BelongsToMany');
        expect(firstArg.association.constructor.name).to.equal('BelongsToMany');

        expect(afterAssociateArgs[1].sequelize.constructor.name).to.equal('Sequelize');
      });
      it('should not trigger association hooks', function() {
        const afterAssociate = sinon.spy();
        this.Projects.afterAssociate(afterAssociate);
        this.Projects.belongsToMany(this.Tasks, { through: 'projects_and_tasks', hooks: false });
        expect(afterAssociate).to.not.have.been.called;
      });
    });
  });
});
