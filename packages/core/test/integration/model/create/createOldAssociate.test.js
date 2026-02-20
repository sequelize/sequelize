'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');
const { DataTypes } = require('@sequelize/core');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('create Model, adding existing (old) associates, without include', () => {
    it('creates BelongsTo using an existing instance', async function () {
      const User = this.sequelize.define('User', {
        name: DataTypes.STRING,
      });
      const Product = this.sequelize.define('Product', {
        title: DataTypes.STRING,
      });

      Product.belongsTo(User);

      await this.sequelize.sync({ force: true });

      const user = await User.create({ name: 'Alice' });

      const product = await Product.create({
        title: 'Chair',
        user,
      });

      const result = await Product.findOne({ where: { id: product.id }, include: [User] });

      expect(result.user.name).to.equal('Alice');
    });

    it('creates BelongsTo using a built instance', async function () {
      const User = this.sequelize.define('User', {
        name: DataTypes.STRING,
      });
      const Product = this.sequelize.define('Product', {
        title: DataTypes.STRING,
      });

      Product.belongsTo(User);

      await this.sequelize.sync({ force: true });

      const user = User.build({ name: 'Bob' });

      const product = await Product.create({
        title: 'Desk',
        user,
      });

      const result = await Product.findOne({ where: { id: product.id }, include: [User] });

      expect(result.user.name).to.equal('Bob');
    });

    it('creates BelongsTo with alias using existing instance', async function () {
      const User = this.sequelize.define('User', {
        name: DataTypes.STRING,
      });
      const Product = this.sequelize.define('Product', {
        title: DataTypes.STRING,
      });

      Product.belongsTo(User, { as: 'creator' });

      await this.sequelize.sync({ force: true });

      const creator = await User.create({ name: 'Charlie' });

      const product = await Product.create({
        title: 'Laptop',
        creator,
      });

      const result = await Product.findOne({ where: { id: product.id }, include: ['creator'] });

      expect(result.creator.name).to.equal('Charlie');
    });

    it('creates HasOne using an existing instance', async function () {
      const User = this.sequelize.define('User', {
        name: DataTypes.STRING,
      });
      const Task = this.sequelize.define('Task', {
        title: DataTypes.STRING,
      });

      User.hasOne(Task);

      await this.sequelize.sync({ force: true });

      const task = await Task.create({ title: 'Debug project' });

      const user = await User.create({
        name: 'Dana',
        task,
      });

      const result = await User.findOne({ where: { id: user.id }, include: [Task] });

      expect(result.task.title).to.equal('Debug project');
    });

    it('creates HasMany using existing instances', async function () {
      const Product = this.sequelize.define('Product', {
        title: DataTypes.STRING,
      });
      const Tag = this.sequelize.define('Tag', {
        name: DataTypes.STRING,
      });

      Product.hasMany(Tag);

      await this.sequelize.sync({ force: true });

      const tag1 = await Tag.create({ name: 'Blue' });
      const tag2 = await Tag.create({ name: 'Modern' });

      const product = await Product.create({
        title: 'Sofa',
        tags: [tag1, tag2],
      });

      const tags = await product.getTags();
      expect(tags.length).to.equal(2);
    });

    it('creates BelongsToMany using existing instances', async function () {
      const User = this.sequelize.define('User', {
        name: DataTypes.STRING,
      });
      const Task = this.sequelize.define('Task', {
        title: DataTypes.STRING,
      });

      User.belongsToMany(Task, { through: 'user_task' });
      Task.belongsToMany(User, { through: 'user_task' });

      await this.sequelize.sync({ force: true });

      const task1 = await Task.create({ title: 'Refactor' });
      const task2 = await Task.create({ title: 'Deploy' });

      const user = await User.create({
        name: 'Eve',
        tasks: [task1, task2],
      });

      const tasks = await user.getTasks();
      expect(tasks.length).to.equal(2);
    });

    it('creates BelongsToMany with alias using existing instances', async function () {
      const User = this.sequelize.define('User', {
        name: DataTypes.STRING,
      });
      const Task = this.sequelize.define('Task', {
        title: DataTypes.STRING,
      });

      User.belongsToMany(Task, { through: 'user_job', as: 'jobs' });
      Task.belongsToMany(User, { through: 'user_job' });

      await this.sequelize.sync({ force: true });

      const job1 = await Task.create({ title: 'Cook' });
      const job2 = await Task.create({ title: 'Clean' });

      const user = await User.create({
        name: 'Finn',
        jobs: [job1, job2],
      });

      const jobs = await user.getJobs();
      expect(jobs.length).to.equal(2);
    });
  });
});
