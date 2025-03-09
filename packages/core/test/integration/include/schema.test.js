'use strict';

const upperFirst = require('lodash/upperFirst');

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes, Op } = require('@sequelize/core');

const dialect = Support.sequelize.dialect;
const promiseProps = require('p-props');

const sortById = function (a, b) {
  return a.id < b.id ? -1 : 1;
};

describe(Support.getTestDialectTeaser('Includes with schemas'), () => {
  if (!dialect.supports.schemas) {
    return;
  }

  describe('findAll', () => {
    beforeEach(async function () {
      this.fixtureA = async function () {
        await this.sequelize.dropSchema('account');
        await this.sequelize.createSchema('account');
        const AccUser = this.sequelize.define('AccUser', {}, { schema: 'account' });
        const Company = this.sequelize.define(
          'Company',
          {
            name: DataTypes.STRING,
          },
          { schema: 'account' },
        );
        const Product = this.sequelize.define(
          'Product',
          {
            title: DataTypes.STRING,
          },
          { schema: 'account' },
        );
        const Tag = this.sequelize.define(
          'Tag',
          {
            name: DataTypes.STRING,
          },
          { schema: 'account' },
        );
        const Price = this.sequelize.define(
          'Price',
          {
            value: DataTypes.FLOAT,
          },
          { schema: 'account' },
        );
        const Customer = this.sequelize.define(
          'Customer',
          {
            name: DataTypes.STRING,
          },
          { schema: 'account' },
        );
        const Group = this.sequelize.define(
          'Group',
          {
            name: DataTypes.STRING,
          },
          { schema: 'account' },
        );
        const GroupMember = this.sequelize.define('GroupMember', {}, { schema: 'account' });
        const Rank = this.sequelize.define(
          'Rank',
          {
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
          },
          { schema: 'account' },
        );

        this.models = {
          AccUser,
          Company,
          Product,
          Tag,
          Price,
          Customer,
          Group,
          GroupMember,
          Rank,
        };

        AccUser.hasMany(Product);
        Product.belongsTo(AccUser);

        Product.belongsToMany(Tag, { through: 'product_tag' });
        Tag.belongsToMany(Product, { through: 'product_tag' });
        Product.belongsTo(Tag, { as: 'Category' });
        Product.belongsTo(Company);

        Product.hasMany(Price);
        Price.belongsTo(Product);

        AccUser.hasMany(GroupMember, { as: 'Memberships' });
        GroupMember.belongsTo(AccUser);
        GroupMember.belongsTo(Rank);
        GroupMember.belongsTo(Group);
        Group.hasMany(GroupMember, { as: 'Memberships' });

        await this.sequelize.sync({ force: true });
        const [groups, companies, ranks, tags] = await Promise.all([
          Group.bulkCreate([
            { name: 'Developers' },
            { name: 'Designers' },
            { name: 'Managers' },
          ]).then(() => Group.findAll()),
          Company.bulkCreate([
            { name: 'Sequelize' },
            { name: 'Coca Cola' },
            { name: 'Bonanza' },
            { name: 'NYSE' },
            { name: 'Coshopr' },
          ]).then(() => Company.findAll()),
          Rank.bulkCreate([
            { name: 'Admin', canInvite: 1, canRemove: 1, canPost: 1 },
            { name: 'Trustee', canInvite: 1, canRemove: 0, canPost: 1 },
            { name: 'Member', canInvite: 1, canRemove: 0, canPost: 0 },
          ]).then(() => Rank.findAll()),
          Tag.bulkCreate([
            { name: 'A' },
            { name: 'B' },
            { name: 'C' },
            { name: 'D' },
            { name: 'E' },
          ]).then(() => Tag.findAll()),
        ]);
        for (const i of [0, 1, 2, 3, 4]) {
          const [user, products] = await Promise.all([
            AccUser.create(),
            Product.bulkCreate([
              { title: 'Chair' },
              { title: 'Desk' },
              { title: 'Bed' },
              { title: 'Pen' },
              { title: 'Monitor' },
            ]).then(() => Product.findAll()),
          ]);
          const groupMembers = [
            { accUserId: user.id, GroupId: groups[0].id, rankId: ranks[0].id },
            { accUserId: user.id, GroupId: groups[1].id, rankId: ranks[2].id },
          ];
          if (i < 3) {
            groupMembers.push({ accUserId: user.id, GroupId: groups[2].id, rankId: ranks[1].id });
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

      await this.sequelize.createSchema('account');
    });

    it('should support an include with multiple different association types', async function () {
      await this.sequelize.dropSchema('account');
      await this.sequelize.createSchema('account');
      const AccUser = this.sequelize.define('AccUser', {}, { schema: 'account' });
      const Product = this.sequelize.define(
        'Product',
        {
          title: DataTypes.STRING,
        },
        { schema: 'account' },
      );
      const Tag = this.sequelize.define(
        'Tag',
        {
          name: DataTypes.STRING,
        },
        { schema: 'account' },
      );
      const Price = this.sequelize.define(
        'Price',
        {
          value: DataTypes.FLOAT,
        },
        { schema: 'account' },
      );
      const Group = this.sequelize.define(
        'Group',
        {
          name: DataTypes.STRING,
        },
        { schema: 'account' },
      );
      const GroupMember = this.sequelize.define('GroupMember', {}, { schema: 'account' });
      const Rank = this.sequelize.define(
        'Rank',
        {
          name: DataTypes.STRING,
          canInvite: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
          },
          canRemove: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
          },
        },
        { schema: 'account' },
      );

      AccUser.hasMany(Product);
      Product.belongsTo(AccUser);

      Product.belongsToMany(Tag, { through: 'product_tag' });
      Tag.belongsToMany(Product, { through: 'product_tag' });
      Product.belongsTo(Tag, { as: 'Category' });

      Product.hasMany(Price);
      Price.belongsTo(Product);

      AccUser.hasMany(GroupMember, { as: 'Memberships' });
      GroupMember.belongsTo(AccUser);
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
          AccUser.create(),
          Product.bulkCreate([{ title: 'Chair' }, { title: 'Desk' }]).then(() => Product.findAll()),
        ]);
        await Promise.all([
          GroupMember.bulkCreate([
            { accUserId: user.id, groupId: groups[0].id, rankId: ranks[0].id },
            { accUserId: user.id, groupId: groups[1].id, rankId: ranks[1].id },
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

        const users = await AccUser.findAll({
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
          order: [[AccUser.getAttributes().id, 'ASC']],
        });

        for (const user of users) {
          expect(user.Memberships).to.be.ok;
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
      const A = this.sequelize.define('a', {}, { schema: 'account' });
      const B = this.sequelize.define('b', {}, { schema: 'account' });
      const C = this.sequelize.define('c', {}, { schema: 'account' });
      const D = this.sequelize.define('d', {}, { schema: 'account' });
      const E = this.sequelize.define('e', {}, { schema: 'account' });
      const F = this.sequelize.define('f', {}, { schema: 'account' });
      const G = this.sequelize.define('g', {}, { schema: 'account' });
      const H = this.sequelize.define('h', {}, { schema: 'account' });

      A.belongsTo(B);
      B.belongsTo(C);
      C.belongsTo(D);
      D.belongsTo(E);
      E.belongsTo(F);
      F.belongsTo(G);
      G.belongsTo(H);

      let b;
      const singles = [B, C, D, E, F, G, H];

      await this.sequelize.sync();
      await A.bulkCreate([{}, {}, {}, {}, {}, {}, {}, {}]);
      let previousInstance;
      for (const model of singles) {
        const instance = await model.create({});
        if (previousInstance) {
          await previousInstance[`set${upperFirst(model.name)}`](instance);
          previousInstance = instance;
          continue;
        }

        previousInstance = b = instance;
      }

      let as = await A.findAll();
      await Promise.all(as.map(a => a.setB(b)));
      as = await A.findAll({
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

    it('should support ordering with only belongsTo includes', async function () {
      const User = this.sequelize.define('SpecialUser', {}, { schema: 'account' });
      const Item = this.sequelize.define('Item', { test: DataTypes.STRING }, { schema: 'account' });
      const Order = this.sequelize.define(
        'Order',
        { position: DataTypes.INTEGER },
        { schema: 'account' },
      );

      User.belongsTo(Item, { as: 'itemA', foreignKey: 'itemA_id' });
      User.belongsTo(Item, { as: 'itemB', foreignKey: 'itemB_id' });
      User.belongsTo(Order);

      await this.sequelize.sync();

      await Promise.all([
        User.bulkCreate([{}, {}, {}]),
        Item.bulkCreate([{ test: 'abc' }, { test: 'def' }, { test: 'ghi' }, { test: 'jkl' }]),
        Order.bulkCreate([{ position: 2 }, { position: 3 }, { position: 1 }]),
      ]);

      const [users, items, orders] = await Promise.all([
        User.findAll(),
        Item.findAll({ order: ['id'] }),
        Order.findAll({ order: ['id'] }),
      ]);

      await Promise.all([
        users[0].setItemA(items[0]),
        users[0].setItemB(items[1]),
        users[0].setOrder(orders[2]),
        users[1].setItemA(items[2]),
        users[1].setItemB(items[3]),
        users[1].setOrder(orders[1]),
        users[2].setItemA(items[0]),
        users[2].setItemB(items[3]),
        users[2].setOrder(orders[0]),
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
      const Product = this.sequelize.define(
        'Product',
        {
          title: DataTypes.STRING,
        },
        { schema: 'account' },
      );
      const Tag = this.sequelize.define(
        'Tag',
        {
          name: DataTypes.STRING,
        },
        { schema: 'account' },
      );
      const ProductTag = this.sequelize.define(
        'ProductTag',
        {
          priority: DataTypes.INTEGER,
        },
        { schema: 'account' },
      );

      Product.belongsToMany(Tag, { through: ProductTag });
      Tag.belongsToMany(Product, { through: ProductTag });

      await this.sequelize.sync({ force: true });

      await Promise.all([
        Product.bulkCreate([{ title: 'Chair' }, { title: 'Desk' }, { title: 'Dress' }]),
        Tag.bulkCreate([{ name: 'A' }, { name: 'B' }, { name: 'C' }]),
      ]);

      const [products0, tags] = await Promise.all([Product.findAll(), Tag.findAll()]);

      await Promise.all([
        products0[0].addTag(tags[0], { through: { priority: 1 } }),
        products0[0].addTag(tags[1], { through: { priority: 2 } }),
        products0[1].addTag(tags[1], { through: { priority: 1 } }),
        products0[2].addTag(tags[0], { through: { priority: 3 } }),
        products0[2].addTag(tags[1], { through: { priority: 1 } }),
        products0[2].addTag(tags[2], { through: { priority: 2 } }),
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
      const User = this.sequelize.define('User', {}, { schema: 'account' });
      const Group = this.sequelize.define('Group', {}, { schema: 'account' });

      User.belongsTo(Group);

      await this.sequelize.sync({ force: true });

      await Promise.all([Group.bulkCreate([{}, {}]), User.bulkCreate([{}, {}, {}])]);

      const [groups, users0] = await Promise.all([Group.findAll(), User.findAll()]);

      await users0[2].setGroup(groups[1]);

      const users = await User.findAll({
        include: [{ model: Group, required: true }],
      });

      expect(users.length).to.equal(1);
      expect(users[0].group).to.be.ok;
    });

    it('should be possible to extend the on clause with a where option on a belongsTo include', async function () {
      const User = this.sequelize.define('User', {}, { schema: 'account' });
      const Group = this.sequelize.define(
        'Group',
        {
          name: DataTypes.STRING,
        },
        { schema: 'account' },
      );

      User.belongsTo(Group);

      await this.sequelize.sync({ force: true });

      await Promise.all([
        Group.bulkCreate([{ name: 'A' }, { name: 'B' }]),
        User.bulkCreate([{}, {}]),
      ]);

      const [groups, users0] = await Promise.all([Group.findAll(), User.findAll()]);

      await Promise.all([users0[0].setGroup(groups[1]), users0[1].setGroup(groups[0])]);

      const users = await User.findAll({
        include: [{ model: Group, where: { name: 'A' } }],
      });

      expect(users.length).to.equal(1);
      expect(users[0].group).to.be.ok;
      expect(users[0].group.name).to.equal('A');
    });

    it('should be possible to extend the on clause with a where option on a belongsTo include', async function () {
      const User = this.sequelize.define('User', {}, { schema: 'account' });
      const Group = this.sequelize.define(
        'Group',
        {
          name: DataTypes.STRING,
        },
        { schema: 'account' },
      );

      User.belongsTo(Group);

      await this.sequelize.sync({ force: true });

      await Promise.all([
        Group.bulkCreate([{ name: 'A' }, { name: 'B' }]),
        User.bulkCreate([{}, {}]),
      ]);

      const [groups, users0] = await Promise.all([Group.findAll(), User.findAll()]);

      await Promise.all([users0[0].setGroup(groups[1]), users0[1].setGroup(groups[0])]);

      const users = await User.findAll({
        include: [{ model: Group, required: true }],
      });

      for (const user of users) {
        expect(user.group).to.be.ok;
      }
    });

    it('should be possible to define a belongsTo include as required with child hasMany with limit', async function () {
      const User = this.sequelize.define('User', {}, { schema: 'account' });
      const Group = this.sequelize.define(
        'Group',
        {
          name: DataTypes.STRING,
        },
        { schema: 'account' },
      );
      const Category = this.sequelize.define(
        'Category',
        {
          category: DataTypes.STRING,
        },
        { schema: 'account' },
      );

      User.belongsTo(Group);
      Group.hasMany(Category);

      await this.sequelize.sync({ force: true });

      await Promise.all([
        Group.bulkCreate([{ name: 'A' }, { name: 'B' }]),
        User.bulkCreate([{}, {}]),
        Category.bulkCreate([{}, {}]),
      ]);

      const [groups, users0, categories] = await Promise.all([
        Group.findAll(),
        User.findAll(),
        Category.findAll(),
      ]);

      const promises = [users0[0].setGroup(groups[1]), users0[1].setGroup(groups[0])];
      for (const group of groups) {
        promises.push(group.setCategories(categories));
      }

      await Promise.all(promises);

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
      const User = this.sequelize.define('User', {}, { schema: 'account' });
      const Group = this.sequelize.define(
        'Group',
        {
          name: DataTypes.STRING,
        },
        { schema: 'account' },
      );
      const Category = this.sequelize.define(
        'Category',
        {
          category: DataTypes.STRING,
        },
        { schema: 'account' },
      );

      User.belongsTo(Group, { as: 'Team' });
      Group.hasMany(Category, { as: 'Tags' });

      await this.sequelize.sync({ force: true });

      await Promise.all([
        Group.bulkCreate([{ name: 'A' }, { name: 'B' }]),
        User.bulkCreate([{}, {}]),
        Category.bulkCreate([{}, {}]),
      ]);

      const [groups, users0, categories] = await Promise.all([
        Group.findAll(),
        User.findAll(),
        Category.findAll(),
      ]);

      const promises = [users0[0].setTeam(groups[1]), users0[1].setTeam(groups[0])];
      for (const group of groups) {
        promises.push(group.setTags(categories));
      }

      await Promise.all(promises);

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
      const User = this.sequelize.define('User', {}, { schema: 'account' });
      const Group = this.sequelize.define(
        'Group',
        {
          name: DataTypes.STRING,
        },
        { schema: 'account' },
      );
      const Category = this.sequelize.define(
        'Category',
        {
          category: DataTypes.STRING,
        },
        { schema: 'account' },
      );

      User.belongsTo(Group);
      Group.hasMany(Category);

      await this.sequelize.sync({ force: true });

      await Promise.all([
        Group.bulkCreate([{ name: 'A' }, { name: 'B' }]),
        User.bulkCreate([{}, {}]),
        Category.bulkCreate([{}, {}]),
      ]);

      const [groups, users0, categories] = await Promise.all([
        Group.findAll(),
        User.findAll(),
        Category.findAll(),
      ]);

      const promises = [users0[0].setGroup(groups[1]), users0[1].setGroup(groups[0])];
      for (const group of groups) {
        promises.push(group.setCategories(categories));
      }

      await Promise.all(promises);

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
      const User = this.sequelize.define('User', {}, { schema: 'account' });
      const Project = this.sequelize.define(
        'Project',
        {
          title: DataTypes.STRING,
        },
        { schema: 'account' },
      );

      User.hasOne(Project, { as: 'LeaderOf' });

      await this.sequelize.sync({ force: true });

      await Promise.all([
        Project.bulkCreate([{ title: 'Alpha' }, { title: 'Beta' }]),
        User.bulkCreate([{}, {}]),
      ]);

      const [projects, users0] = await Promise.all([Project.findAll(), User.findAll()]);

      await Promise.all([users0[1].setLeaderOf(projects[1]), users0[0].setLeaderOf(projects[0])]);

      const users = await User.findAll({
        include: [{ model: Project, as: 'LeaderOf', where: { title: 'Beta' } }],
      });

      expect(users.length).to.equal(1);
      expect(users[0].LeaderOf).to.be.ok;
      expect(users[0].LeaderOf.title).to.equal('Beta');
    });

    it('should be possible to extend the on clause with a where option on a hasMany include with a through model', async function () {
      const Product = this.sequelize.define(
        'Product',
        {
          title: DataTypes.STRING,
        },
        { schema: 'account' },
      );
      const Tag = this.sequelize.define(
        'Tag',
        {
          name: DataTypes.STRING,
        },
        { schema: 'account' },
      );
      const ProductTag = this.sequelize.define(
        'ProductTag',
        {
          priority: DataTypes.INTEGER,
        },
        { schema: 'account' },
      );

      Product.belongsToMany(Tag, { through: ProductTag });
      Tag.belongsToMany(Product, { through: ProductTag });

      await this.sequelize.sync({ force: true });

      await Promise.all([
        Product.bulkCreate([{ title: 'Chair' }, { title: 'Desk' }, { title: 'Dress' }]),
        Tag.bulkCreate([{ name: 'A' }, { name: 'B' }, { name: 'C' }]),
      ]);

      const [products0, tags] = await Promise.all([Product.findAll(), Tag.findAll()]);

      await Promise.all([
        products0[0].addTag(tags[0], { priority: 1 }),
        products0[0].addTag(tags[1], { priority: 2 }),
        products0[1].addTag(tags[1], { priority: 1 }),
        products0[2].addTag(tags[0], { priority: 3 }),
        products0[2].addTag(tags[1], { priority: 1 }),
        products0[2].addTag(tags[2], { priority: 2 }),
      ]);

      const products = await Product.findAll({
        include: [{ model: Tag, where: { name: 'C' } }],
      });

      expect(products.length).to.equal(1);
      expect(products[0].tags.length).to.equal(1);
    });

    it('should be possible to extend the on clause with a where option on nested includes', async function () {
      const User = this.sequelize.define(
        'User',
        {
          name: DataTypes.STRING,
        },
        { schema: 'account' },
      );
      const Product = this.sequelize.define(
        'Product',
        {
          title: DataTypes.STRING,
        },
        { schema: 'account' },
      );
      const Tag = this.sequelize.define(
        'Tag',
        {
          name: DataTypes.STRING,
        },
        { schema: 'account' },
      );
      const Price = this.sequelize.define(
        'Price',
        {
          value: DataTypes.FLOAT,
        },
        { schema: 'account' },
      );
      const Group = this.sequelize.define(
        'Group',
        {
          name: DataTypes.STRING,
        },
        { schema: 'account' },
      );
      const GroupMember = this.sequelize.define('GroupMember', {}, { schema: 'account' });
      const Rank = this.sequelize.define(
        'Rank',
        {
          name: DataTypes.STRING,
          canInvite: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
          },
          canRemove: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
          },
        },
        { schema: 'account' },
      );

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
          User.create({ name: 'FooBarzz' }),
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
      }
    });

    it('should be possible to use limit and a where with a belongsTo include', async function () {
      const User = this.sequelize.define('User', {}, { schema: 'account' });
      const Group = this.sequelize.define(
        'Group',
        {
          name: DataTypes.STRING,
        },
        { schema: 'account' },
      );

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
        results.users[1].setGroup(results.groups[0]),
        results.users[2].setGroup(results.groups[0]),
        results.users[3].setGroup(results.groups[1]),
        results.users[0].setGroup(results.groups[0]),
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
        attributes: ['title'],
        include: [
          { model: this.models.Company, where: { name: 'NYSE' } },
          { model: this.models.Tag, as: 'tags' },
          { model: this.models.Price },
        ],
        limit: 3,
        order: [['id', 'ASC']],
      });

      expect(products.length).to.equal(3);

      for (const product of products) {
        expect(product.company.name).to.equal('NYSE');
        expect(product.tags.length).to.be.ok;
        expect(product.prices.length).to.be.ok;
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

    it('should support including date fields, with the correct timezone', async function () {
      const User = this.sequelize.define(
        'user',
        {
          dateField: DataTypes.DATE,
        },
        { timestamps: false, schema: 'account' },
      );
      const Group = this.sequelize.define(
        'group',
        {
          dateField: DataTypes.DATE,
        },
        { timestamps: false, schema: 'account' },
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
  });

  describe('findOne', () => {
    it('should work with schemas', async function () {
      const UserModel = this.sequelize.define(
        'User',
        {
          Id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
          },
          Name: DataTypes.STRING,
          UserType: DataTypes.INTEGER,
          Email: DataTypes.STRING,
          PasswordHash: DataTypes.STRING,
          Enabled: {
            type: DataTypes.BOOLEAN,
          },
          CreatedDatetime: DataTypes.DATE,
          UpdatedDatetime: DataTypes.DATE,
        },
        {
          schema: 'hero',
          tableName: 'User',
          timestamps: false,
        },
      );

      const UserIdColumn = { type: DataTypes.INTEGER, references: { model: UserModel, key: 'Id' } };

      const ResumeModel = this.sequelize.define(
        'Resume',
        {
          Id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
          },
          UserId: UserIdColumn,
          Name: DataTypes.STRING,
          Contact: DataTypes.STRING,
          School: DataTypes.STRING,
          WorkingAge: DataTypes.STRING,
          Description: DataTypes.STRING,
          PostType: DataTypes.INTEGER,
          RefreshDatetime: DataTypes.DATE,
          CreatedDatetime: DataTypes.DATE,
        },
        {
          schema: 'hero',
          tableName: 'resume',
          timestamps: false,
        },
      );

      UserModel.hasOne(ResumeModel, {
        foreignKey: 'UserId',
        as: 'Resume',
      });

      ResumeModel.belongsTo(UserModel, {
        foreignKey: 'UserId',
      });

      await this.sequelize.createSchema('hero');
      await this.sequelize.sync({ force: true });

      await UserModel.findOne({
        where: {
          Id: 1,
        },
        include: [
          {
            model: ResumeModel,
            as: 'Resume',
          },
        ],
      });
    });
  });
});
