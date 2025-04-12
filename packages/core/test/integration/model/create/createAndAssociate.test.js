'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');
const { DataTypes } = require('@sequelize/core');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('create (no include)', () => {
    it('creates BelongsTo data without include', async function () {
      const Product = this.sequelize.define('Product', {
        title: DataTypes.STRING,
      }, {
        hooks: {
          afterCreate(product) {
            product.isIncludeCreatedOnAfterCreate = Boolean(product.user && product.user.id);
          },
        },
      });

      const User = this.sequelize.define('User', {
        first_name: DataTypes.STRING,
        last_name: DataTypes.STRING,
      }, {
        hooks: {
          beforeCreate(user, options) {
            user.createOptions = options;
          },
        },
      });

      Product.belongsTo(User);

      await this.sequelize.sync({ force: true });

      const savedProduct = await Product.create({
        title: 'Chair',
        user: {
          first_name: 'Mick',
          last_name: 'Broadstone',
        },
      });

      expect(savedProduct.id).to.be.a('number');
      expect(savedProduct.isIncludeCreatedOnAfterCreate).to.be.true;
      expect(savedProduct.user.createOptions.parentRecord).to.equal(savedProduct);
    });

    it('creates BelongsTo with non-nullable FK', async function () {
      const Product = this.sequelize.define('Product', {
        title: DataTypes.STRING,
      });

      const User = this.sequelize.define('User', {
        first_name: DataTypes.STRING,
      });

      Product.belongsTo(User, {
        foreignKey: {
          allowNull: false,
        },
      });

      await this.sequelize.sync({ force: true });

      const savedProduct = await Product.create({
        title: 'Chair',
        user: {
          first_name: 'Mick',
        },
      });

      expect(savedProduct.user.first_name).to.equal('Mick');
    });

    it('creates BelongsTo with alias', async function () {
      const Product = this.sequelize.define('Product', {
        title: DataTypes.STRING,
      });

      const User = this.sequelize.define('User', {
        first_name: DataTypes.STRING,
        last_name: DataTypes.STRING,
      });

      Product.belongsTo(User, { as: 'creator' });

      await this.sequelize.sync({ force: true });

      const savedProduct = await Product.create({
        title: 'Chair',
        creator: {
          first_name: 'Matt',
          last_name: 'Hansen',
        },
      });

      const persistedProduct = await Product.findOne({
        where: { id: savedProduct.id },
        include: ['creator'],
      });

      expect(persistedProduct.creator.first_name).to.equal('Matt');
    });

    it('creates HasMany data', async function () {
      const Product = this.sequelize.define('Product', {
        title: DataTypes.STRING,
      }, {
        hooks: {
          afterCreate(product) {
            product.areIncludesCreatedOnAfterCreate = product.tags.every(tag => tag.id);
          },
        },
      });

      const Tag = this.sequelize.define('Tag', {
        name: DataTypes.STRING,
      });

      Product.hasMany(Tag);

      await this.sequelize.sync({ force: true });

      const savedProduct = await Product.create({
        title: 'Chair',
        tags: [{ name: 'Alpha' }, { name: 'Beta' }],
      });

      expect(savedProduct.areIncludesCreatedOnAfterCreate).to.be.true;
    });

    it('creates HasMany with alias', async function () {
      const Product = this.sequelize.define('Product', {
        title: DataTypes.STRING,
      });

      const Tag = this.sequelize.define('Tag', {
        name: DataTypes.STRING,
      });

      Product.hasMany(Tag, { as: 'categories' });

      await this.sequelize.sync({ force: true });

      const savedProduct = await Product.create({
        title: 'Chair',
        categories: [{ name: 'Alpha' }, { name: 'Beta' }],
      });

      const persistedProduct = await Product.findOne({
        where: { id: savedProduct.id },
        include: ['categories'],
      });

      expect(persistedProduct.categories.length).to.equal(2);
    });

    it('creates HasOne data', async function () {
      const User = this.sequelize.define('User', {
        username: DataTypes.STRING,
      });

      const Task = this.sequelize.define('Task', {
        title: DataTypes.STRING,
      });

      User.hasOne(Task);

      await this.sequelize.sync({ force: true });

      const savedUser = await User.create({
        username: 'Muzzy',
        task: {
          title: 'Eat Clocks',
        },
      });

      const persistedUser = await User.findOne({
        where: { id: savedUser.id },
        include: [Task],
      });

      expect(persistedUser.task.title).to.equal('Eat Clocks');
    });

    it('creates HasOne with alias', async function () {
      const User = this.sequelize.define('User', {
        username: DataTypes.STRING,
      });

      const Task = this.sequelize.define('Task', {
        title: DataTypes.STRING,
      });

      User.hasOne(Task, { as: 'job' });

      await this.sequelize.sync({ force: true });

      const savedUser = await User.create({
        username: 'Muzzy',
        job: {
          title: 'Eat Clocks',
        },
      });

      const persistedUser = await User.findOne({
        where: { id: savedUser.id },
        include: ['job'],
      });

      expect(persistedUser.job.title).to.equal('Eat Clocks');
    });

    it('creates BelongsToMany data', async function () {
      const User = this.sequelize.define('User', {
        username: DataTypes.STRING,
      });

      const Task = this.sequelize.define('Task', {
        title: DataTypes.STRING,
        active: DataTypes.BOOLEAN,
      });

      User.belongsToMany(Task, { through: 'user_task' });
      Task.belongsToMany(User, { through: 'user_task' });

      await this.sequelize.sync({ force: true });

      const savedUser = await User.create({
        username: 'John',
        tasks: [
          { title: 'Get rich', active: true },
          { title: 'Die trying', active: false },
        ],
      });

      const tasks = await savedUser.getTasks();
      expect(tasks.length).to.equal(2);
    });

    it('creates BelongsToMany polymorphic', async function () {
      const Post = this.sequelize.define('Post', {
        title: DataTypes.STRING,
      }, {
        tableName: 'posts',
        underscored: true,
      });

      const Tag = this.sequelize.define('Tag', {
        name: DataTypes.STRING,
      }, {
        tableName: 'tags',
        underscored: true,
      });

      const ItemTag = this.sequelize.define('ItemTag', {
        tag_id: DataTypes.INTEGER,
        taggable_id: DataTypes.INTEGER,
        taggable: DataTypes.STRING,
      }, {
        tableName: 'item_tag',
        underscored: true,
      });

      Post.belongsToMany(Tag, {
        as: 'tags',
        foreignKey: 'taggable_id',
        otherKey: 'tag_id',
        foreignKeyConstraints: false,
        inverse: {
          as: 'posts',
          foreignKeyConstraints: false,
        },
        through: {
          model: ItemTag,
          scope: {
            taggable: 'post',
          },
        },
      });

      await this.sequelize.sync({ force: true });

      const savedPost = await Post.create({
        title: 'Polymorphic Associations',
        tags: [{ name: 'polymorphic' }, { name: 'associations' }],
      });

      const tags = await savedPost.getTags();
      expect(tags.length).to.equal(2);
    });

    it('creates BelongsToMany with alias', async function () {
      const User = this.sequelize.define('User', {
        username: DataTypes.STRING,
      });

      const Task = this.sequelize.define('Task', {
        title: DataTypes.STRING,
        active: DataTypes.BOOLEAN,
      });

      User.belongsToMany(Task, { through: 'user_job', as: 'jobs' });
      Task.belongsToMany(User, { through: 'user_job' });

      await this.sequelize.sync({ force: true });

      const savedUser = await User.create({
        username: 'John',
        jobs: [
          { title: 'Get rich', active: true },
          { title: 'Die trying', active: false },
        ],
      });

      const jobs = await savedUser.getJobs();
      expect(jobs.length).to.equal(2);
    });
  });
});
