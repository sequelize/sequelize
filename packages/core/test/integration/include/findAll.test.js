'use strict';

const partition = require('lodash/partition');
const upperFirst = require('lodash/upperFirst');

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes, Op } = require('@sequelize/core');
const promiseProps = require('p-props');

function sortById(a, b) {
  return a.id < b.id ? -1 : 1;
}

describe(Support.getTestDialectTeaser('Include'), () => {
  describe('findAll', () => {
    beforeEach(function () {
      this.fixtureA = async function () {
        const User = this.sequelize.define('User', {});
        const Company = this.sequelize.define('Company', {
          name: DataTypes.STRING,
        });
        const Product = this.sequelize.define('Product', {
          title: DataTypes.STRING,
        });
        const Tag = this.sequelize.define('Tag', {
          name: DataTypes.STRING,
        });
        const Price = this.sequelize.define('Price', {
          value: DataTypes.FLOAT,
        });
        const Customer = this.sequelize.define('Customer', {
          name: DataTypes.STRING,
        });
        const Group = this.sequelize.define('Group', {
          name: DataTypes.STRING,
        });
        const GroupMember = this.sequelize.define('GroupMember', {});
        const Rank = this.sequelize.define('Rank', {
          name: DataTypes.STRING,
          canInvite: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
          },
          canRemove: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
          },
          canPost: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
          },
        });

        this.models = {
          User,
          Company,
          Product,
          Tag,
          Price,
          Customer,
          Group,
          GroupMember,
          Rank,
        };

        User.hasMany(Product);
        Product.belongsTo(User);

        Product.belongsToMany(Tag, { through: 'product_tag' });
        Tag.belongsToMany(Product, { through: 'product_tag' });
        Product.belongsTo(Tag, { as: 'Category' });
        Product.belongsTo(Company);

        Product.hasMany(Price);
        Price.belongsTo(Product);

        User.hasMany(GroupMember, { as: 'Memberships' });
        GroupMember.belongsTo(User);
        GroupMember.belongsTo(Rank);
        GroupMember.belongsTo(Group);
        Group.hasMany(GroupMember, { as: 'Memberships' });

        await this.sequelize.sync({ force: true });
        await Group.bulkCreate([
          { name: 'Developers' },
          { name: 'Designers' },
          { name: 'Managers' },
        ]);
        const groups = await Group.findAll();
        await Company.bulkCreate([
          { name: 'Sequelize' },
          { name: 'Coca Cola' },
          { name: 'Bonanza' },
          { name: 'NYSE' },
          { name: 'Coshopr' },
        ]);
        const companies = await Company.findAll();
        await Rank.bulkCreate([
          { name: 'Admin', canInvite: 1, canRemove: 1, canPost: 1 },
          { name: 'Trustee', canInvite: 1, canRemove: 0, canPost: 1 },
          { name: 'Member', canInvite: 1, canRemove: 0, canPost: 0 },
        ]);
        const ranks = await Rank.findAll();
        await Tag.bulkCreate([
          { name: 'A' },
          { name: 'B' },
          { name: 'C' },
          { name: 'D' },
          { name: 'E' },
        ]);
        const tags = await Tag.findAll();
        for (const i of [0, 1, 2, 3, 4]) {
          const user = await User.create();
          await Product.bulkCreate([
            { title: 'Chair' },
            { title: 'Desk' },
            { title: 'Bed' },
            { title: 'Pen' },
            { title: 'Monitor' },
          ]);
          const products = await Product.findAll();
          const groupMembers = [
            { groupId: groups[0].id, rankId: ranks[0].id },
            { groupId: groups[1].id, rankId: ranks[2].id },
          ];
          if (i < 3) {
            groupMembers.push({ groupId: groups[2].id, rankId: ranks[1].id });
          }

          await Promise.all([
            GroupMember.bulkCreate(groupMembers),
            user.setProducts([products[i * 5 + 0], products[i * 5 + 1], products[i * 5 + 3]]),
            products[i * 5 + 0].setTags([tags[0], tags[2]]),
            products[i * 5 + 1].setTags([tags[1]]),
            products[i * 5 + 0].setCategory(tags[1]),
            products[i * 5 + 2].setTags([tags[0]]),
            products[i * 5 + 3].setTags([tags[0]]),
            products[i * 5 + 0].setCompany(companies[4]),
            products[i * 5 + 1].setCompany(companies[3]),
            products[i * 5 + 2].setCompany(companies[2]),
            products[i * 5 + 3].setCompany(companies[1]),
            products[i * 5 + 4].setCompany(companies[0]),
            Price.bulkCreate([
              { productId: products[i * 5 + 0].id, value: 5 },
              { productId: products[i * 5 + 0].id, value: 10 },
              { productId: products[i * 5 + 1].id, value: 5 },
              { productId: products[i * 5 + 1].id, value: 10 },
              { productId: products[i * 5 + 1].id, value: 15 },
              { productId: products[i * 5 + 1].id, value: 20 },
              { productId: products[i * 5 + 2].id, value: 20 },
              { productId: products[i * 5 + 3].id, value: 20 },
            ]),
          ]);
        }
      };
    });

    it('should work on a nested set of relations with a where condition in between relations', async function () {
      const User = this.sequelize.define('User', {});
      const SubscriptionForm = this.sequelize.define('SubscriptionForm', {});
      const Collection = this.sequelize.define('Collection', {});
      const Category = this.sequelize.define('Category', {});
      const SubCategory = this.sequelize.define('SubCategory', {});
      const Capital = this.sequelize.define('Capital', {});

      User.hasOne(SubscriptionForm, { foreignKey: 'boundUser' });
      SubscriptionForm.belongsTo(User, { foreignKey: 'boundUser' });

      SubscriptionForm.hasOne(Collection, { foreignKey: 'boundDesigner' });
      Collection.belongsTo(SubscriptionForm, { foreignKey: 'boundDesigner' });

      SubscriptionForm.belongsTo(Category, { foreignKey: 'boundCategory' });
      Category.hasMany(SubscriptionForm, { foreignKey: 'boundCategory' });

      Capital.hasMany(Category, { foreignKey: 'boundCapital' });
      Category.belongsTo(Capital, { foreignKey: 'boundCapital' });

      Category.hasMany(SubCategory, { foreignKey: 'boundCategory' });
      SubCategory.belongsTo(Category, { foreignKey: 'boundCategory' });

      await this.sequelize.sync({ force: true });

      await User.findOne({
        include: [
          {
            model: SubscriptionForm,
            include: [
              {
                model: Collection,
                where: {
                  id: 13,
                },
              },
              {
                model: Category,
                include: [
                  {
                    model: SubCategory,
                  },
                  {
                    model: Capital,
                    include: [
                      {
                        model: Category,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
    });

    it('should accept nested `where` and `limit` at the same time', async function () {
      const Product = this.sequelize.define('Product', {
        title: DataTypes.STRING,
      });
      const Tag = this.sequelize.define('Tag', {
        name: DataTypes.STRING,
      });
      const ProductTag = this.sequelize.define('ProductTag', {
        priority: DataTypes.INTEGER,
      });
      const Set = this.sequelize.define('Set', {
        title: DataTypes.STRING,
      });

      Set.hasMany(Product, { inverse: 'Set', as: 'Products' });
      Product.belongsToMany(Tag, { through: ProductTag });
      Tag.belongsToMany(Product, { through: ProductTag });

      await this.sequelize.sync({ force: true });

      await Promise.all([
        Set.bulkCreate([{ title: 'office' }]),
        Product.bulkCreate([{ title: 'Chair' }, { title: 'Desk' }, { title: 'Dress' }]),
        Tag.bulkCreate([{ name: 'A' }, { name: 'B' }, { name: 'C' }]),
      ]);

      const [sets, products, tags] = await Promise.all([
        Set.findAll(),
        Product.findAll(),
        Tag.findAll(),
      ]);

      await Promise.all([
        sets[0].addProducts([products[0], products[1]]),
        products[0]
          .addTag(tags[0], { priority: 1 })
          .then(() => {
            return products[0].addTag(tags[1], { priority: 2 });
          })
          .then(() => {
            return products[0].addTag(tags[2], { priority: 1 });
          }),
        products[1]
          .addTag(tags[1], { priority: 2 })
          .then(() => {
            return products[2].addTag(tags[1], { priority: 3 });
          })
          .then(() => {
            return products[2].addTag(tags[2], { priority: 0 });
          }),
      ]);

      await Set.findAll({
        include: [
          {
            model: Product,
            include: [
              {
                model: Tag,
                where: {
                  name: 'A',
                },
              },
            ],
          },
        ],
        limit: 1,
      });
    });

    it('should support an include with multiple different association types', async function () {
      const User = this.sequelize.define('User', {});
      const Product = this.sequelize.define('Product', {
        title: DataTypes.STRING,
      });
      const Tag = this.sequelize.define('Tag', {
        name: DataTypes.STRING,
      });
      const Price = this.sequelize.define('Price', {
        value: DataTypes.FLOAT,
      });
      const Group = this.sequelize.define('Group', {
        name: DataTypes.STRING,
      });
      const GroupMember = this.sequelize.define('GroupMember', {});
      const Rank = this.sequelize.define('Rank', {
        name: DataTypes.STRING,
        canInvite: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
        },
        canRemove: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
        },
      });

      User.hasMany(Product);
      Product.belongsTo(User);

      Product.belongsToMany(Tag, { through: 'product_tag' });
      Tag.belongsToMany(Product, { through: 'product_tag' });
      Product.belongsTo(Tag, { as: 'Category' });

      Product.hasMany(Price);
      Price.belongsTo(Product);

      User.hasMany(GroupMember, { as: 'Memberships' });
      GroupMember.belongsTo(User);
      GroupMember.belongsTo(Rank);
      GroupMember.belongsTo(Group);
      Group.hasMany(GroupMember, { as: 'Memberships' });

      await this.sequelize.sync({ force: true });
      const [groups, ranks, tags] = await Promise.all([
        Group.bulkCreate([{ name: 'Developers' }, { name: 'Designers' }]).then(() =>
          Group.findAll(),
        ),
        Rank.bulkCreate([
          { name: 'Admin', canInvite: 1, canRemove: 1 },
          { name: 'Member', canInvite: 1, canRemove: 0 },
        ]).then(() => Rank.findAll()),
        Tag.bulkCreate([{ name: 'A' }, { name: 'B' }, { name: 'C' }]).then(() => Tag.findAll()),
      ]);
      for (const i of [0, 1, 2, 3, 4]) {
        const [user, products] = await Promise.all([
          User.create(),
          Product.bulkCreate([{ title: 'Chair' }, { title: 'Desk' }]).then(() => Product.findAll()),
        ]);
        await Promise.all([
          GroupMember.bulkCreate([
            { userId: user.id, groupId: groups[0].id, rankId: ranks[0].id },
            { userId: user.id, groupId: groups[1].id, rankId: ranks[1].id },
          ]),
          user.setProducts([products[i * 2 + 0], products[i * 2 + 1]]),
          products[i * 2 + 0].setTags([tags[0], tags[2]]),
          products[i * 2 + 1].setTags([tags[1]]),
          products[i * 2 + 0].setCategory(tags[1]),
          Price.bulkCreate([
            { productId: products[i * 2 + 0].id, value: 5 },
            { productId: products[i * 2 + 0].id, value: 10 },
            { productId: products[i * 2 + 1].id, value: 5 },
            { productId: products[i * 2 + 1].id, value: 10 },
            { productId: products[i * 2 + 1].id, value: 15 },
            { productId: products[i * 2 + 1].id, value: 20 },
          ]),
        ]);
        const users = await User.findAll({
          include: [
            {
              model: GroupMember,
              as: 'Memberships',
              include: [Group, Rank],
            },
            {
              model: Product,
              include: ['tags', { model: Tag, as: 'Category' }, Price],
            },
          ],
          order: [['id', 'ASC']],
        });
        for (const user of users) {
          user.Memberships.sort(sortById);

          expect(user.Memberships.length).to.equal(2);
          expect(user.Memberships[0].group.name).to.equal('Developers');
          expect(user.Memberships[0].rank.canRemove).to.equal(1);
          expect(user.Memberships[1].group.name).to.equal('Designers');
          expect(user.Memberships[1].rank.canRemove).to.equal(0);

          user.products.sort(sortById);
          expect(user.products.length).to.equal(2);
          expect(user.products[0].tags.length).to.equal(2);
          expect(user.products[1].tags.length).to.equal(1);
          expect(user.products[0].Category).to.be.ok;
          expect(user.products[1].Category).not.to.be.ok;

          expect(user.products[0].prices.length).to.equal(2);
          expect(user.products[1].prices.length).to.equal(4);
        }
      }
    });

    it('should support many levels of belongsTo', async function () {
      const A = this.sequelize.define('a', {});
      const B = this.sequelize.define('b', {});
      const C = this.sequelize.define('c', {});
      const D = this.sequelize.define('d', {});
      const E = this.sequelize.define('e', {});
      const F = this.sequelize.define('f', {});
      const G = this.sequelize.define('g', {});
      const H = this.sequelize.define('h', {});

      A.belongsTo(B);
      B.belongsTo(C);
      C.belongsTo(D);
      D.belongsTo(E);
      E.belongsTo(F);
      F.belongsTo(G);
      G.belongsTo(H);

      await this.sequelize.sync({ force: true });

      const [as0, b] = await Promise.all([
        A.bulkCreate([{}, {}, {}, {}, {}, {}, {}, {}]).then(() => {
          return A.findAll();
        }),
        (function (singles) {
          let promise = Promise.resolve();
          let previousInstance;
          let b;

          for (const model of singles) {
            promise = (async () => {
              await promise;
              const instance = await model.create({});
              if (previousInstance) {
                await previousInstance[`set${upperFirst(model.name)}`](instance);
                previousInstance = instance;

                return;
              }

              previousInstance = b = instance;
            })();
          }

          promise = promise.then(() => {
            return b;
          });

          return promise;
        })([B, C, D, E, F, G, H]),
      ]);

      await Promise.all(
        as0.map(a => {
          return a.setB(b);
        }),
      );

      const as = await A.findAll({
        include: [
          {
            model: B,
            include: [
              {
                model: C,
                include: [
                  {
                    model: D,
                    include: [
                      {
                        model: E,
                        include: [
                          {
                            model: F,
                            include: [
                              {
                                model: G,
                                include: [{ model: H }],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      expect(as.length).to.be.ok;

      for (const a of as) {
        expect(a.b.c.d.e.f.g.h).to.be.ok;
      }
    });

    it('should support many levels of belongsTo (with a lower level having a where)', async function () {
      const A = this.sequelize.define('a', {});
      const B = this.sequelize.define('b', {});
      const C = this.sequelize.define('c', {});
      const D = this.sequelize.define('d', {});
      const E = this.sequelize.define('e', {});
      const F = this.sequelize.define('f', {});
      const G = this.sequelize.define('g', {
        name: DataTypes.STRING,
      });
      const H = this.sequelize.define('h', {
        name: DataTypes.STRING,
      });

      A.belongsTo(B);
      B.belongsTo(C);
      C.belongsTo(D);
      D.belongsTo(E);
      E.belongsTo(F);
      F.belongsTo(G);
      G.belongsTo(H);

      await this.sequelize.sync({ force: true });

      const [as0, b] = await Promise.all([
        A.bulkCreate([{}, {}, {}, {}, {}, {}, {}, {}]).then(() => {
          return A.findAll();
        }),
        (function (singles) {
          let promise = Promise.resolve();
          let previousInstance;
          let b;

          for (const model of singles) {
            const values = {};

            if (model.name === 'g') {
              values.name = 'yolo';
            }

            promise = (async () => {
              await promise;
              const instance = await model.create(values);
              if (previousInstance) {
                await previousInstance[`set${upperFirst(model.name)}`](instance);
                previousInstance = instance;

                return;
              }

              previousInstance = b = instance;
            })();
          }

          promise = promise.then(() => {
            return b;
          });

          return promise;
        })([B, C, D, E, F, G, H]),
      ]);

      await Promise.all(
        as0.map(a => {
          return a.setB(b);
        }),
      );

      const as = await A.findAll({
        include: [
          {
            model: B,
            include: [
              {
                model: C,
                include: [
                  {
                    model: D,
                    include: [
                      {
                        model: E,
                        include: [
                          {
                            model: F,
                            include: [
                              {
                                model: G,
                                where: {
                                  name: 'yolo',
                                },
                                include: [{ model: H }],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });

      expect(as.length).to.be.ok;

      for (const a of as) {
        expect(a.b.c.d.e.f.g.h).to.be.ok;
      }
    });

    it('should support ordering with only belongsTo includes', async function () {
      const User = this.sequelize.define('User', {});
      const Item = this.sequelize.define('Item', { test: DataTypes.STRING });
      const Order = this.sequelize.define('Order', { position: DataTypes.INTEGER });

      User.belongsTo(Item, { as: 'itemA', foreignKey: 'itemA_id' });
      User.belongsTo(Item, { as: 'itemB', foreignKey: 'itemB_id' });
      User.belongsTo(Order);

      await this.sequelize.sync();

      const results = await promiseProps({
        users: User.bulkCreate([{}, {}, {}]).then(() => {
          return User.findAll();
        }),
        items: Item.bulkCreate([
          { test: 'abc' },
          { test: 'def' },
          { test: 'ghi' },
          { test: 'jkl' },
        ]).then(() => {
          return Item.findAll({ order: ['id'] });
        }),
        orders: Order.bulkCreate([{ position: 2 }, { position: 3 }, { position: 1 }]).then(() => {
          return Order.findAll({ order: ['id'] });
        }),
      });

      const user1 = results.users[0];
      const user2 = results.users[1];
      const user3 = results.users[2];

      const item1 = results.items[0];
      const item2 = results.items[1];
      const item3 = results.items[2];
      const item4 = results.items[3];

      const order1 = results.orders[0];
      const order2 = results.orders[1];
      const order3 = results.orders[2];

      await Promise.all([
        user1.setItemA(item1),
        user1.setItemB(item2),
        user1.setOrder(order3),
        user2.setItemA(item3),
        user2.setItemB(item4),
        user2.setOrder(order2),
        user3.setItemA(item1),
        user3.setItemB(item4),
        user3.setOrder(order1),
      ]);

      const as = await User.findAll({
        include: [
          { model: Item, as: 'itemA', where: { test: 'abc' } },
          { model: Item, as: 'itemB' },
          Order,
        ],
        order: [[Order, 'position']],
      });

      expect(as.length).to.eql(2);

      expect(as[0].itemA.test).to.eql('abc');
      expect(as[1].itemA.test).to.eql('abc');

      expect(as[0].order.position).to.eql(1);
      expect(as[1].order.position).to.eql(2);
    });

    it('should include attributes from through models', async function () {
      const Product = this.sequelize.define('Product', {
        title: DataTypes.STRING,
      });
      const Tag = this.sequelize.define('Tag', {
        name: DataTypes.STRING,
      });
      const ProductTag = this.sequelize.define('ProductTag', {
        priority: DataTypes.INTEGER,
      });

      Product.belongsToMany(Tag, { through: ProductTag });
      Tag.belongsToMany(Product, { through: ProductTag });

      await this.sequelize.sync({ force: true });

      const results = await promiseProps({
        products: Product.bulkCreate([
          { title: 'Chair' },
          { title: 'Desk' },
          { title: 'Dress' },
        ]).then(() => {
          return Product.findAll();
        }),
        tags: Tag.bulkCreate([{ name: 'A' }, { name: 'B' }, { name: 'C' }]).then(() => {
          return Tag.findAll();
        }),
      });

      await Promise.all([
        results.products[0].addTag(results.tags[0], { through: { priority: 1 } }),
        results.products[0].addTag(results.tags[1], { through: { priority: 2 } }),
        results.products[1].addTag(results.tags[1], { through: { priority: 1 } }),
        results.products[2].addTag(results.tags[0], { through: { priority: 3 } }),
        results.products[2].addTag(results.tags[1], { through: { priority: 1 } }),
        results.products[2].addTag(results.tags[2], { through: { priority: 2 } }),
      ]);

      const products = await Product.findAll({
        include: [{ model: Tag }],
        order: [
          ['id', 'ASC'],
          [Tag, 'id', 'ASC'],
        ],
      });

      expect(products[0].tags[0].ProductTag.priority).to.equal(1);
      expect(products[0].tags[1].ProductTag.priority).to.equal(2);

      expect(products[1].tags[0].ProductTag.priority).to.equal(1);

      expect(products[2].tags[0].ProductTag.priority).to.equal(3);
      expect(products[2].tags[1].ProductTag.priority).to.equal(1);
      expect(products[2].tags[2].ProductTag.priority).to.equal(2);
    });

    it('should support a required belongsTo include', async function () {
      const User = this.sequelize.define('User', {});
      const Group = this.sequelize.define('Group', {});

      User.belongsTo(Group);

      await this.sequelize.sync({ force: true });

      const results = await promiseProps({
        groups: Group.bulkCreate([{}, {}]).then(() => {
          return Group.findAll();
        }),
        users: User.bulkCreate([{}, {}, {}]).then(() => {
          return User.findAll();
        }),
      });

      await results.users[2].setGroup(results.groups[1]);

      const users = await User.findAll({
        include: [{ model: Group, required: true }],
      });

      expect(users.length).to.equal(1);
      expect(users[0].group).to.be.ok;
    });

    it('should be possible to extend the on clause with a where option on a belongsTo include', async function () {
      const User = this.sequelize.define('User', {});
      const Group = this.sequelize.define('Group', {
        name: DataTypes.STRING,
      });

      User.belongsTo(Group);

      await this.sequelize.sync({ force: true });

      const results = await promiseProps({
        groups: Group.bulkCreate([{ name: 'A' }, { name: 'B' }]).then(() => {
          return Group.findAll();
        }),
        users: User.bulkCreate([{}, {}]).then(() => {
          return User.findAll();
        }),
      });

      await Promise.all([
        results.users[0].setGroup(results.groups[1]),
        results.users[1].setGroup(results.groups[0]),
      ]);

      const users = await User.findAll({
        include: [{ model: Group, where: { name: 'A' } }],
      });

      expect(users.length).to.equal(1);
      expect(users[0].group).to.be.ok;
      expect(users[0].group.name).to.equal('A');
    });

    it('should be possible to extend the on clause with a where option on a belongsTo include', async function () {
      const User = this.sequelize.define('User', {});
      const Group = this.sequelize.define('Group', {
        name: DataTypes.STRING,
      });

      User.belongsTo(Group);

      await this.sequelize.sync({ force: true });

      const results = await promiseProps({
        groups: Group.bulkCreate([{ name: 'A' }, { name: 'B' }]).then(() => {
          return Group.findAll();
        }),
        users: User.bulkCreate([{}, {}]).then(() => {
          return User.findAll();
        }),
      });

      await Promise.all([
        results.users[0].setGroup(results.groups[1]),
        results.users[1].setGroup(results.groups[0]),
      ]);

      const users = await User.findAll({
        include: [{ model: Group, required: true }],
      });

      for (const user of users) {
        expect(user.group).to.be.ok;
      }
    });

    it('should be possible to define a belongsTo include as required with child hasMany not required', async function () {
      const Address = this.sequelize.define('Address', { active: DataTypes.BOOLEAN });
      const Street = this.sequelize.define('Street', { active: DataTypes.BOOLEAN });
      const User = this.sequelize.define('User', { username: DataTypes.STRING });

      // Associate
      User.belongsTo(Address, { foreignKey: 'addressId' });
      Address.hasMany(User, { foreignKey: 'addressId' });

      Address.belongsTo(Street, { foreignKey: 'streetId' });
      Street.hasMany(Address, { foreignKey: 'streetId' });

      // Sync
      await this.sequelize.sync({ force: true });

      const street = await Street.create({ active: true });
      const address = await Address.create({ active: true, streetId: street.id });
      await User.create({ username: 'John', addressId: address.id });

      const john = await User.findOne({
        where: { username: 'John' },
        include: [
          {
            model: Address,
            required: true,
            where: {
              active: true,
            },
            include: [
              {
                model: Street,
              },
            ],
          },
        ],
      });

      expect(john.address).to.be.ok;
      expect(john.address.street).to.be.ok;
    });

    it('should be possible to define a belongsTo include as required with child hasMany with limit', async function () {
      const User = this.sequelize.define('User', {});
      const Group = this.sequelize.define('Group', {
        name: DataTypes.STRING,
      });
      const Category = this.sequelize.define('Category', {
        category: DataTypes.STRING,
      });

      User.belongsTo(Group);
      Group.hasMany(Category);

      await this.sequelize.sync({ force: true });

      const results = await promiseProps({
        groups: Group.bulkCreate([{ name: 'A' }, { name: 'B' }]).then(() => {
          return Group.findAll();
        }),
        users: User.bulkCreate([{}, {}]).then(() => {
          return User.findAll();
        }),
        categories: Category.bulkCreate([{}, {}]).then(() => {
          return Category.findAll();
        }),
      });

      await Promise.all([
        results.users[0].setGroup(results.groups[1]),
        results.users[1].setGroup(results.groups[0]),
        Promise.all(
          results.groups.map(group => {
            return group.setCategories(results.categories);
          }),
        ),
      ]);

      const users = await User.findAll({
        include: [
          {
            model: Group,
            required: true,
            include: [{ model: Category }],
          },
        ],
        limit: 1,
      });

      expect(users.length).to.equal(1);
      for (const user of users) {
        expect(user.group).to.be.ok;
        expect(user.group.categories).to.be.ok;
      }
    });

    it('should be possible to define a belongsTo include as required with child hasMany with limit and aliases', async function () {
      const User = this.sequelize.define('User', {});
      const Group = this.sequelize.define('Group', {
        name: DataTypes.STRING,
      });
      const Category = this.sequelize.define('Category', {
        category: DataTypes.STRING,
      });

      User.belongsTo(Group, { as: 'Team' });
      Group.hasMany(Category, { as: 'Tags' });

      await this.sequelize.sync({ force: true });

      const results = await promiseProps({
        groups: Group.bulkCreate([{ name: 'A' }, { name: 'B' }]).then(() => {
          return Group.findAll();
        }),
        users: User.bulkCreate([{}, {}]).then(() => {
          return User.findAll();
        }),
        categories: Category.bulkCreate([{}, {}]).then(() => {
          return Category.findAll();
        }),
      });

      await Promise.all([
        results.users[0].setTeam(results.groups[1]),
        results.users[1].setTeam(results.groups[0]),
        Promise.all(
          results.groups.map(group => {
            return group.setTags(results.categories);
          }),
        ),
      ]);

      const users = await User.findAll({
        include: [
          {
            model: Group,
            required: true,
            as: 'Team',
            include: [{ model: Category, as: 'Tags' }],
          },
        ],
        limit: 1,
      });

      expect(users.length).to.equal(1);
      for (const user of users) {
        expect(user.Team).to.be.ok;
        expect(user.Team.Tags).to.be.ok;
      }
    });

    it('should be possible to define a belongsTo include as required with child hasMany which is not required with limit', async function () {
      const User = this.sequelize.define('User', {});
      const Group = this.sequelize.define('Group', {
        name: DataTypes.STRING,
      });
      const Category = this.sequelize.define('Category', {
        category: DataTypes.STRING,
      });

      User.belongsTo(Group);
      Group.hasMany(Category);

      await this.sequelize.sync({ force: true });

      const results = await promiseProps({
        groups: Group.bulkCreate([{ name: 'A' }, { name: 'B' }]).then(() => {
          return Group.findAll();
        }),
        users: User.bulkCreate([{}, {}]).then(() => {
          return User.findAll();
        }),
        categories: Category.bulkCreate([{}, {}]).then(() => {
          return Category.findAll();
        }),
      });

      await Promise.all([
        results.users[0].setGroup(results.groups[1]),
        results.users[1].setGroup(results.groups[0]),
        Promise.all(
          results.groups.map(group => {
            return group.setCategories(results.categories);
          }),
        ),
      ]);

      const users = await User.findAll({
        include: [
          {
            model: Group,
            required: true,
            include: [{ model: Category, required: false }],
          },
        ],
        limit: 1,
      });

      expect(users.length).to.equal(1);
      for (const user of users) {
        expect(user.group).to.be.ok;
        expect(user.group.categories).to.be.ok;
      }
    });

    it('should be possible to extend the on clause with a where option on a hasOne include', async function () {
      const User = this.sequelize.define('User', {});
      const Project = this.sequelize.define('Project', {
        title: DataTypes.STRING,
      });

      User.hasOne(Project, { as: 'LeaderOf' });

      await this.sequelize.sync({ force: true });

      const results = await promiseProps({
        projects: Project.bulkCreate([{ title: 'Alpha' }, { title: 'Beta' }]).then(() => {
          return Project.findAll();
        }),
        users: User.bulkCreate([{}, {}]).then(() => {
          return User.findAll();
        }),
      });

      await Promise.all([
        results.users[1].setLeaderOf(results.projects[1]),
        results.users[0].setLeaderOf(results.projects[0]),
      ]);

      const users = await User.findAll({
        include: [{ model: Project, as: 'LeaderOf', where: { title: 'Beta' } }],
      });

      expect(users.length).to.equal(1);
      expect(users[0].LeaderOf).to.be.ok;
      expect(users[0].LeaderOf.title).to.equal('Beta');
    });

    it('should be possible to extend the on clause with a where option on a hasMany include with a through model', async function () {
      const Product = this.sequelize.define('Product', {
        title: DataTypes.STRING,
      });
      const Tag = this.sequelize.define('Tag', {
        name: DataTypes.STRING,
      });
      const ProductTag = this.sequelize.define('ProductTag', {
        priority: DataTypes.INTEGER,
      });

      Product.belongsToMany(Tag, { through: ProductTag });
      Tag.belongsToMany(Product, { through: ProductTag });

      await this.sequelize.sync({ force: true });

      const results = await promiseProps({
        products: Product.bulkCreate([
          { title: 'Chair' },
          { title: 'Desk' },
          { title: 'Dress' },
        ]).then(() => {
          return Product.findAll();
        }),
        tags: Tag.bulkCreate([{ name: 'A' }, { name: 'B' }, { name: 'C' }]).then(() => {
          return Tag.findAll();
        }),
      });

      await Promise.all([
        results.products[0].addTag(results.tags[0], { priority: 1 }),
        results.products[0].addTag(results.tags[1], { priority: 2 }),
        results.products[1].addTag(results.tags[1], { priority: 1 }),
        results.products[2].addTag(results.tags[0], { priority: 3 }),
        results.products[2].addTag(results.tags[1], { priority: 1 }),
        results.products[2].addTag(results.tags[2], { priority: 2 }),
      ]);

      const products = await Product.findAll({
        include: [{ model: Tag, where: { name: 'C' } }],
      });

      expect(products.length).to.equal(1);
      expect(products[0].tags.length).to.equal(1);
    });

    it('should be possible to extend the on clause with a where option on nested includes', async function () {
      const User = this.sequelize.define('User', {
        name: DataTypes.STRING,
      });
      const Product = this.sequelize.define('Product', {
        title: DataTypes.STRING,
      });
      const Tag = this.sequelize.define('Tag', {
        name: DataTypes.STRING,
      });
      const Price = this.sequelize.define('Price', {
        value: DataTypes.FLOAT,
      });
      const Group = this.sequelize.define('Group', {
        name: DataTypes.STRING,
      });
      const GroupMember = this.sequelize.define('GroupMember', {});
      const Rank = this.sequelize.define('Rank', {
        name: DataTypes.STRING,
        canInvite: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
        },
        canRemove: {
          type: DataTypes.INTEGER,
          defaultValue: 0,
        },
      });

      User.hasMany(Product);
      Product.belongsTo(User);

      Product.belongsToMany(Tag, { through: 'product_tag' });
      Tag.belongsToMany(Product, { through: 'product_tag' });
      Product.belongsTo(Tag, { as: 'Category' });

      Product.hasMany(Price);
      Price.belongsTo(Product);

      User.hasMany(GroupMember, { as: 'Memberships' });
      GroupMember.belongsTo(User);
      GroupMember.belongsTo(Rank);
      GroupMember.belongsTo(Group);
      Group.hasMany(GroupMember, { as: 'Memberships' });

      await this.sequelize.sync({ force: true });
      const [groups, ranks, tags] = await Promise.all([
        Group.bulkCreate([{ name: 'Developers' }, { name: 'Designers' }]).then(() =>
          Group.findAll(),
        ),
        Rank.bulkCreate([
          { name: 'Admin', canInvite: 1, canRemove: 1 },
          { name: 'Member', canInvite: 1, canRemove: 0 },
        ]).then(() => Rank.findAll()),
        Tag.bulkCreate([{ name: 'A' }, { name: 'B' }, { name: 'C' }]).then(() => Tag.findAll()),
      ]);
      for (const i of [0, 1, 2, 3, 4]) {
        const user = await User.create({ name: 'FooBarzz' });

        await Product.bulkCreate([{ title: 'Chair' }, { title: 'Desk' }]);

        const products = await Product.findAll();
        await Promise.all([
          GroupMember.bulkCreate([
            { userId: user.id, groupId: groups[0].id, rankId: ranks[0].id },
            { userId: user.id, groupId: groups[1].id, rankId: ranks[1].id },
          ]),
          user.setProducts([products[i * 2 + 0], products[i * 2 + 1]]),
          products[i * 2 + 0].setTags([tags[0], tags[2]]),
          products[i * 2 + 1].setTags([tags[1]]),
          products[i * 2 + 0].setCategory(tags[1]),
          Price.bulkCreate([
            { productId: products[i * 2 + 0].id, value: 5 },
            { productId: products[i * 2 + 0].id, value: 10 },
            { productId: products[i * 2 + 1].id, value: 5 },
            { productId: products[i * 2 + 1].id, value: 10 },
            { productId: products[i * 2 + 1].id, value: 15 },
            { productId: products[i * 2 + 1].id, value: 20 },
          ]),
        ]);
      }

      const users = await User.findAll({
        include: [
          {
            model: GroupMember,
            as: 'Memberships',
            include: [Group, { model: Rank, where: { name: 'Admin' } }],
          },
          {
            model: Product,
            include: [
              'tags',
              { model: Tag, as: 'Category' },
              {
                model: Price,
                where: {
                  value: {
                    [Op.gt]: 15,
                  },
                },
              },
            ],
          },
        ],
        order: [['id', 'ASC']],
      });
      for (const user of users) {
        expect(user.Memberships.length).to.equal(1);
        expect(user.Memberships[0].rank.name).to.equal('Admin');
        expect(user.products.length).to.equal(1);
        expect(user.products[0].prices.length).to.equal(1);
      }
    });

    it('should be possible to use limit and a where with a belongsTo include', async function () {
      const User = this.sequelize.define('User', {});
      const Group = this.sequelize.define('Group', {
        name: DataTypes.STRING,
      });

      User.belongsTo(Group);

      await this.sequelize.sync({ force: true });

      const results = await promiseProps({
        groups: Group.bulkCreate([{ name: 'A' }, { name: 'B' }]).then(() => {
          return Group.findAll();
        }),
        users: User.bulkCreate([{}, {}, {}, {}]).then(() => {
          return User.findAll();
        }),
      });

      await Promise.all([
        results.users[0].setGroup(results.groups[0]),
        results.users[1].setGroup(results.groups[0]),
        results.users[2].setGroup(results.groups[0]),
        results.users[3].setGroup(results.groups[1]),
      ]);

      const users = await User.findAll({
        include: [{ model: Group, where: { name: 'A' } }],
        limit: 2,
      });

      expect(users.length).to.equal(2);

      for (const user of users) {
        expect(user.group.name).to.equal('A');
      }
    });

    it('should be possible use limit, attributes and a where on a belongsTo with additional hasMany includes', async function () {
      await this.fixtureA();

      const products = await this.models.Product.findAll({
        attributes: ['id', 'title'],
        include: [
          { model: this.models.Company, where: { name: 'NYSE' } },
          { model: this.models.Tag, as: 'tags' },
          { model: this.models.Price },
        ],
        limit: 3,
        order: [[this.sequelize.col(`${this.models.Product.name}.id`), 'ASC']],
      });

      expect(products.length).to.equal(3);

      for (const product of products) {
        expect(product.company.name).to.equal('NYSE');
        expect(product.tags.length).to.be.ok;
        expect(product.prices.length).to.be.ok;
      }
    });

    it('should be possible to have the primary key in attributes', async function () {
      const Parent = this.sequelize.define('Parent', {});
      const Child1 = this.sequelize.define('Child1', {});

      Parent.hasMany(Child1);
      Child1.belongsTo(Parent);

      await this.sequelize.sync({ force: true });

      const [parent0, child] = await Promise.all([Parent.create(), Child1.create()]);

      await parent0.addChild1(child);
      const parent = parent0;

      await Child1.findOne({
        include: [
          {
            model: Parent,
            attributes: ['id'], // This causes a duplicated entry in the query
            where: {
              id: parent.id,
            },
          },
        ],
      });
    });

    it('should be possible to turn off the attributes for the through table', async function () {
      await this.fixtureA();

      const products = await this.models.Product.findAll({
        attributes: ['title'],
        include: [
          { model: this.models.Tag, as: 'tags', through: { attributes: [] }, required: true },
        ],
      });

      for (const product of products) {
        expect(product.tags.length).to.be.ok;
        for (const tag of product.tags) {
          expect(tag.get().productTags).not.to.be.ok;
        }
      }
    });

    it('should be possible to select on columns inside a through table', async function () {
      await this.fixtureA();

      const products = await this.models.Product.findAll({
        attributes: ['title'],
        include: [
          {
            model: this.models.Tag,
            as: 'tags',
            through: {
              where: {
                productId: 3,
              },
            },
            required: true,
          },
        ],
      });

      expect(products).have.length(1);
    });

    it('should be possible to select on columns inside a through table and a limit', async function () {
      await this.fixtureA();

      const products = await this.models.Product.findAll({
        attributes: ['title'],
        include: [
          {
            model: this.models.Tag,
            as: 'tags',
            through: {
              where: {
                productId: 3,
              },
            },
            required: true,
          },
        ],
        limit: 5,
      });

      expect(products).have.length(1);
    });

    // Test case by @eshell
    it('should be possible not to include the main id in the attributes', async function () {
      const Member = this.sequelize.define('Member', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        email: {
          type: DataTypes.STRING,
          unique: true,
          allowNull: false,
          validate: {
            isEmail: true,
            notNull: true,
            notEmpty: true,
          },
        },
        password: DataTypes.STRING,
      });
      const Album = this.sequelize.define('Album', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        title: {
          type: DataTypes.STRING(25),
          allowNull: false,
        },
      });

      Album.belongsTo(Member);
      Member.hasMany(Album);

      await this.sequelize.sync({ force: true });
      const members = [];
      const albums = [];
      const memberCount = 20;

      for (let i = 1; i <= memberCount; i++) {
        members.push({
          id: i,
          email: `email${i}@lmu.com`,
          password: `testing${i}`,
        });
        albums.push({
          title: `Album${i}`,
          memberId: i,
        });
      }

      await Member.bulkCreate(members);
      await Album.bulkCreate(albums);

      const members0 = await Member.findAll({
        attributes: ['email'],
        include: [
          {
            model: Album,
          },
        ],
      });

      expect(members0.length).to.equal(20);
      for (const member of members0) {
        expect(member.get('id')).not.to.be.ok;
        expect(member.albums.length).to.equal(1);
      }
    });

    it('should be possible to use limit and a where on a hasMany with additional includes', async function () {
      await this.fixtureA();

      const products = await this.models.Product.findAll({
        include: [
          { model: this.models.Company },
          { model: this.models.Tag, as: 'tags' },
          {
            model: this.models.Price,
            where: {
              value: { [Op.gt]: 5 },
            },
          },
        ],
        limit: 6,
        order: [['id', 'ASC']],
      });

      expect(products.length).to.equal(6);

      for (const product of products) {
        expect(product.tags.length).to.be.ok;
        expect(product.prices.length).to.be.ok;

        for (const price of product.prices) {
          expect(price.value).to.be.above(5);
        }
      }
    });

    it('should be possible to use limit and a where on a hasMany with a through model with additional includes', async function () {
      await this.fixtureA();

      const products = await this.models.Product.findAll({
        include: [
          { model: this.models.Company },
          { model: this.models.Tag, as: 'tags', where: { name: ['A', 'B', 'C'] } },
          { model: this.models.Price },
        ],
        limit: 10,
        order: [['id', 'ASC']],
      });

      expect(products.length).to.equal(10);

      for (const product of products) {
        expect(product.tags.length).to.be.ok;
        expect(product.prices.length).to.be.ok;

        for (const tag of product.tags) {
          expect(['A', 'B', 'C']).to.include(tag.name);
        }
      }
    });

    it('should support including date fields, with the correct timeszone', async function () {
      const User = this.sequelize.define(
        'user',
        {
          dateField: DataTypes.DATE,
        },
        { timestamps: false },
      );
      const Group = this.sequelize.define(
        'group',
        {
          dateField: DataTypes.DATE,
        },
        { timestamps: false },
      );

      User.belongsToMany(Group, { through: 'group_user' });
      Group.belongsToMany(User, { through: 'group_user' });

      await this.sequelize.sync();
      const user = await User.create({ dateField: Date.UTC(2014, 1, 20) });
      const group = await Group.create({ dateField: Date.UTC(2014, 1, 20) });
      await user.addGroup(group);

      const users = await User.findAll({
        where: {
          id: user.id,
        },
        include: [Group],
      });

      expect(users[0].dateField.getTime()).to.equal(Date.UTC(2014, 1, 20));
      expect(users[0].groups[0].dateField.getTime()).to.equal(Date.UTC(2014, 1, 20));
    });

    it('should still pull the main record(s) when an included model is not required and has where restrictions without matches', async function () {
      const A = this.sequelize.define('a', { name: DataTypes.STRING(40) });
      const B = this.sequelize.define('b', { name: DataTypes.STRING(40) });

      A.belongsToMany(B, { through: 'a_b' });
      B.belongsToMany(A, { through: 'a_b' });

      await this.sequelize.sync({ force: true });

      await A.create({
        name: 'Foobar',
      });

      const as = await A.findAll({
        where: { name: 'Foobar' },
        include: [{ model: B, where: { name: 'idontexist' }, required: false }],
      });

      expect(as.length).to.equal(1);
      expect(as[0].get('bs')).deep.equal([]);
    });

    it('should work with paranoid, a main record where, an include where, and a limit', async function () {
      const Post = this.sequelize.define(
        'post',
        {
          date: DataTypes.DATE,
          public: DataTypes.BOOLEAN,
        },
        {
          paranoid: true,
        },
      );
      const Category = this.sequelize.define('category', {
        slug: DataTypes.STRING,
      });

      Post.hasMany(Category);
      Category.belongsTo(Post);

      await this.sequelize.sync({ force: true });

      const posts0 = await Promise.all([
        Post.create({ public: true }),
        Post.create({ public: true }),
        Post.create({ public: true }),
        Post.create({ public: true }),
      ]);

      await Promise.all(
        posts0.slice(1, 3).map(post => {
          return post.createCategory({ slug: 'food' });
        }),
      );

      const posts = await Post.findAll({
        limit: 2,
        where: {
          public: true,
        },
        include: [
          {
            model: Category,
            where: {
              slug: 'food',
            },
          },
        ],
      });

      expect(posts.length).to.equal(2);
    });

    it('should work on a nested set of required 1:1 relations', async function () {
      const Person = this.sequelize.define('Person', {
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
      });

      const UserPerson = this.sequelize.define('UserPerson', {
        personId: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },

        rank: {
          type: DataTypes.STRING,
        },
      });

      const User = this.sequelize.define('User', {
        userPersonId: {
          type: DataTypes.INTEGER,
          primaryKey: true,
        },

        login: {
          type: DataTypes.STRING,
          unique: true,
          allowNull: false,
        },
      });

      UserPerson.belongsTo(Person, {
        foreignKey: {
          allowNull: false,
          onDelete: 'CASCADE',
        },
      });
      Person.hasOne(UserPerson, {
        foreignKey: {
          allowNull: false,
          onDelete: 'CASCADE',
        },
      });

      User.belongsTo(UserPerson, {
        foreignKey: {
          name: 'userPersonId',
          allowNull: false,
          onDelete: 'CASCADE',
        },
      });
      UserPerson.hasOne(User, {
        foreignKey: {
          name: 'userPersonId',
          allowNull: false,
          onDelete: 'CASCADE',
        },
      });

      await this.sequelize.sync({ force: true });

      await Person.findAll({
        offset: 0,
        limit: 20,
        attributes: ['id', 'name'],
        include: [
          {
            model: UserPerson,
            required: true,
            attributes: ['rank'],
            include: [
              {
                model: User,
                required: true,
                attributes: ['login'],
              },
            ],
          },
        ],
      });
    });

    it('should work with an empty include.where', async function () {
      const User = this.sequelize.define('User', {});
      const Company = this.sequelize.define('Company', {});
      const Group = this.sequelize.define('Group', {});

      User.belongsTo(Company);
      User.belongsToMany(Group, { through: 'UsersGroups' });
      Group.belongsToMany(User, { through: 'UsersGroups' });

      await this.sequelize.sync({ force: true });

      await User.findAll({
        include: [
          { model: Group, where: {} },
          { model: Company, where: {} },
        ],
      });
    });

    it('should be able to order on the main table and a required belongsTo relation with custom tablenames and limit ', async function () {
      const User = this.sequelize.define(
        'User',
        {
          lastName: DataTypes.STRING,
        },
        { tableName: 'dem_users' },
      );
      const Company = this.sequelize.define(
        'Company',
        {
          rank: DataTypes.INTEGER,
        },
        { tableName: 'dem_companies' },
      );

      User.belongsTo(Company);
      Company.hasMany(User);

      await this.sequelize.sync({ force: true });

      const [albertsen, zenith, hansen, company1, company2] = await Promise.all([
        User.create({ lastName: 'Albertsen' }),
        User.create({ lastName: 'Zenith' }),
        User.create({ lastName: 'Hansen' }),
        Company.create({ rank: 1 }),
        Company.create({ rank: 2 }),
      ]);

      await Promise.all([
        albertsen.setCompany(company1),
        zenith.setCompany(company2),
        hansen.setCompany(company2),
      ]);

      const users = await User.findAll({
        include: [{ model: Company, required: true }],
        order: [
          [Company, 'rank', 'ASC'],
          ['lastName', 'DESC'],
        ],
        limit: 5,
      });

      expect(users[0].lastName).to.equal('Albertsen');
      expect(users[0].company.rank).to.equal(1);

      expect(users[1].lastName).to.equal('Zenith');
      expect(users[1].company.rank).to.equal(2);

      expect(users[2].lastName).to.equal('Hansen');
      expect(users[2].company.rank).to.equal(2);
    });

    it('should ignore include with attributes: [] (used for aggregates)', async function () {
      const Post = this.sequelize.define('Post', {
        title: DataTypes.STRING,
      });
      const Comment = this.sequelize.define('Comment', {
        content: DataTypes.TEXT,
      });

      Post.Comments = Post.hasMany(Comment, { as: 'comments' });

      await this.sequelize.sync({ force: true });

      await Post.create(
        {
          title: Math.random().toString(),
          comments: [
            { content: Math.random().toString() },
            { content: Math.random().toString() },
            { content: Math.random().toString() },
          ],
        },
        {
          include: [Post.Comments],
        },
      );

      const posts = await Post.findAll({
        attributes: [
          [this.sequelize.fn('COUNT', this.sequelize.col('comments.id')), 'commentCount'],
        ],
        include: [{ association: Post.Comments, attributes: [] }],
        group: ['Post.id'],
      });

      expect(posts.length).to.equal(1);

      const post = posts[0];

      expect(post.get('comments')).not.to.be.ok;
      expect(Number.parseInt(post.get('commentCount'), 10)).to.equal(3);
    });

    it('should ignore include with attributes: [] and through: { attributes: [] } (used for aggregates)', async function () {
      const User = this.sequelize.define('User', {
        name: DataTypes.STRING,
      });
      const Project = this.sequelize.define('Project', {
        title: DataTypes.STRING,
      });

      User.belongsToMany(Project, { as: 'projects', through: 'UserProject' });
      Project.belongsToMany(User, { as: 'users', through: 'UserProject' });

      await this.sequelize.sync({ force: true });

      await User.create(
        {
          name: Math.random().toString(),
          projects: [
            { title: Math.random().toString() },
            { title: Math.random().toString() },
            { title: Math.random().toString() },
          ],
        },
        {
          include: [User.associations.projects],
        },
      );

      const users = await User.findAll({
        attributes: [
          [this.sequelize.fn('COUNT', this.sequelize.col('projects.id')), 'projectsCount'],
        ],
        include: {
          association: User.associations.projects,
          attributes: [],
          through: { attributes: [] },
        },
        group: ['User.id'],
      });

      expect(users.length).to.equal(1);

      const user = users[0];

      expect(user.projects).not.to.be.ok;
      expect(Number.parseInt(user.get('projectsCount'), 10)).to.equal(3);
    });

    it('should not add primary key when including and aggregating with raw: true', async function () {
      const Post = this.sequelize.define('Post', {
        title: DataTypes.STRING,
      });
      const Comment = this.sequelize.define('Comment', {
        content: DataTypes.TEXT,
      });

      Post.Comments = Post.hasMany(Comment, { as: 'comments' });

      await this.sequelize.sync({ force: true });

      await Post.create(
        {
          title: Math.random().toString(),
          comments: [
            { content: Math.random().toString() },
            { content: Math.random().toString() },
            { content: Math.random().toString() },
          ],
        },
        {
          include: [Post.Comments],
        },
      );

      const posts = await Post.findAll({
        attributes: [],
        include: [
          {
            association: Post.Comments,
            attributes: [
              [this.sequelize.fn('COUNT', this.sequelize.col('comments.id')), 'commentCount'],
            ],
          },
        ],
        raw: true,
      });

      expect(posts.length).to.equal(1);

      const post = posts[0];
      expect(post.id).not.to.be.ok;
      expect(Number.parseInt(post['comments.commentCount'], 10)).to.equal(3);
    });

    it('should return posts with nested include with inner join with a m:n association', async function () {
      const User = this.sequelize.define('User', {
        username: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
      });

      const Entity = this.sequelize.define('Entity', {
        entity_id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        creator: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        votes: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
      });

      const Post = this.sequelize.define('Post', {
        post_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true,
        },
      });

      const TaggableSentient = this.sequelize.define('TaggableSentient', {
        nametag: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
      });

      Entity.belongsTo(User, { foreignKey: 'creator', targetKey: 'username' });
      Post.belongsTo(Entity, { foreignKey: 'post_id', targetKey: 'entity_id' });

      Entity.belongsToMany(TaggableSentient, {
        as: 'tags',
        through: { model: 'EntityTag', unique: false },
        foreignKey: 'entity_id',
        otherKey: 'tag_name',
      });

      await this.sequelize.sync({ force: true });
      await User.create({ username: 'bob' });
      await TaggableSentient.create({ nametag: 'bob' });
      const entity = await Entity.create({ creator: 'bob' });

      await Promise.all([Post.create({ post_id: entity.entity_id }), entity.addTags('bob')]);

      const posts = await Post.findAll({
        include: [
          {
            model: Entity,
            required: true,
            include: [
              {
                model: User,
                required: true,
              },
              {
                model: TaggableSentient,
                as: 'tags',
                required: true,
                through: {
                  where: {
                    tag_name: ['bob'],
                  },
                },
              },
            ],
          },
        ],
        limit: 5,
        offset: 0,
      });

      expect(posts.length).to.equal(1);
      expect(posts[0].entity.creator).to.equal('bob');
      expect(posts[0].entity.tags.length).to.equal(1);
      expect(posts[0].entity.tags[0].EntityTag.tag_name).to.equal('bob');
      expect(posts[0].entity.tags[0].EntityTag.entity_id).to.equal(posts[0].post_id);
    });

    it('should be able to generate a correct request with inner and outer join', async function () {
      const Customer = this.sequelize.define('customer', {
        name: DataTypes.STRING,
      });

      const ShippingAddress = this.sequelize.define('shippingAddress', {
        address: DataTypes.STRING,
        verified: DataTypes.BOOLEAN,
      });

      const Order = this.sequelize.define('purchaseOrder', {
        description: DataTypes.TEXT,
      });

      const Shipment = this.sequelize.define('shipment', {
        trackingNumber: DataTypes.STRING,
      });

      Customer.hasMany(ShippingAddress);
      ShippingAddress.belongsTo(Customer);

      Customer.hasMany(Order);
      Order.belongsTo(Customer);

      Shipment.belongsTo(Order);
      Order.hasOne(Shipment);

      await this.sequelize.sync({ force: true });

      await Shipment.findOne({
        include: [
          {
            model: Order,
            required: true,
            include: [
              {
                model: Customer,
                include: [
                  {
                    model: ShippingAddress,
                    where: { verified: true },
                  },
                ],
              },
            ],
          },
        ],
      });
    });

    it('should be able to generate a correct request for entity with 1:n and m:1 associations and limit', async function () {
      await this.fixtureA();

      const products = await this.models.Product.findAll({
        attributes: ['title'],
        include: [{ model: this.models.User }, { model: this.models.Price }],
        limit: 10,
      });

      expect(products).to.be.an('array');
      expect(products).to.be.lengthOf(10);
      for (const product of products) {
        expect(product.title).to.be.a('string');
        // checking that internally added fields used to handle 'BelongsTo' associations are not leaked to result
        expect(product.userId).to.equal(undefined);
        // checking that included models are on their places
        expect(product.user).to.satisfy(User => User === null || User instanceof this.models.User);
        expect(product.prices).to.be.an('array');
      }
    });

    it('should allow through model to be paranoid', async function () {
      const User = this.sequelize.define('User', { name: DataTypes.STRING }, { timestamps: false });
      const Customer = this.sequelize.define(
        'Customer',
        { name: DataTypes.STRING },
        { timestamps: false },
      );
      const UserCustomer = this.sequelize.define(
        'UserCustomer',
        {},
        { paranoid: true, createdAt: false, updatedAt: false },
      );

      User.belongsToMany(Customer, {
        through: UserCustomer,
        as: 'customers',
        inverse: { as: 'users' },
      });

      await this.sequelize.sync({ force: true });

      const [user, customer1, customer2] = await Promise.all([
        User.create({ name: 'User 1' }),
        Customer.create({ name: 'Customer 1' }),
        Customer.create({ name: 'Customer 2' }),
      ]);

      await user.setCustomers([customer1]);
      await user.setCustomers([customer2]);
      const users = await User.findAll({ include: Customer });

      expect(users).to.be.an('array');
      expect(users).to.be.lengthOf(1);
      const customers = users[0].customers;

      expect(customers).to.be.an('array');
      expect(customers).to.be.lengthOf(1);

      expect(customers[0].UserCustomer.deletedAt).not.to.exist;

      const userCustomers = await UserCustomer.findAll({
        paranoid: false,
      });

      expect(userCustomers).to.be.an('array');
      expect(userCustomers).to.be.lengthOf(2);

      const [nonDeletedUserCustomers, deletedUserCustomers] = partition(
        userCustomers,
        userCustomer => !userCustomer.deletedAt,
      );

      expect(nonDeletedUserCustomers).to.be.lengthOf(1);
      expect(deletedUserCustomers).to.be.lengthOf(1);
    });
  });
});
