'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');
const { DataTypes } = require('@sequelize/core');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('bulkCreate', () => {
    describe('include', () => {
      it('should bulkCreate data for BelongsTo relations', async function () {
        const Product = this.sequelize.define(
          'Product',
          {
            title: DataTypes.STRING,
          },
          {
            hooks: {
              afterBulkCreate(products) {
                for (const product of products) {
                  product.isIncludeCreatedOnAfterCreate = Boolean(product.user && product.user.id);
                }
              },
            },
          },
        );
        const User = this.sequelize.define(
          'User',
          {
            first_name: DataTypes.STRING,
            last_name: DataTypes.STRING,
          },
          {
            hooks: {
              beforeBulkCreate(users, options) {
                for (const user of users) {
                  user.createOptions = options;
                }
              },
            },
          },
        );

        Product.belongsTo(User);

        await this.sequelize.sync({ force: true });

        const savedProducts = await Product.bulkCreate(
          [
            {
              title: 'Chair',
              user: {
                first_name: 'Mick',
                last_name: 'Broadstone',
              },
            },
            {
              title: 'Table',
              user: {
                first_name: 'John',
                last_name: 'Johnson',
              },
            },
          ],
          {
            include: [
              {
                model: User,
                myOption: 'option',
              },
            ],
          },
        );

        expect(savedProducts[0].isIncludeCreatedOnAfterCreate).to.be.true;
        expect(savedProducts[0].user.createOptions.myOption).to.equal('option');

        expect(savedProducts[1].isIncludeCreatedOnAfterCreate).to.be.true;
        expect(savedProducts[1].user.createOptions.myOption).to.equal('option');

        const persistedProducts = await Promise.all([
          Product.findOne({
            where: { id: savedProducts[0].id },
            include: [User],
          }),
          Product.findOne({
            where: { id: savedProducts[1].id },
            include: [User],
          }),
        ]);

        expect(persistedProducts[0].user).to.be.ok;
        expect(persistedProducts[0].user.first_name).to.equal('Mick');
        expect(persistedProducts[0].user.last_name).to.equal('Broadstone');

        expect(persistedProducts[1].user).to.be.ok;
        expect(persistedProducts[1].user.first_name).to.equal('John');
        expect(persistedProducts[1].user.last_name).to.equal('Johnson');
      });

      it('should bulkCreate data for BelongsTo relations with no nullable FK', async function () {
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

        const savedProducts = await Product.bulkCreate(
          [
            {
              title: 'Chair',
              user: {
                first_name: 'Mick',
              },
            },
            {
              title: 'Table',
              user: {
                first_name: 'John',
              },
            },
          ],
          {
            include: [
              {
                model: User,
              },
            ],
          },
        );

        expect(savedProducts[0]).to.exist;
        expect(savedProducts[0].title).to.equal('Chair');
        expect(savedProducts[0].user).to.exist;
        expect(savedProducts[0].user.first_name).to.equal('Mick');

        expect(savedProducts[1]).to.exist;
        expect(savedProducts[1].title).to.equal('Table');
        expect(savedProducts[1].user).to.exist;
        expect(savedProducts[1].user.first_name).to.equal('John');
      });

      it('should bulkCreate data for BelongsTo relations with alias', async function () {
        const Product = this.sequelize.define('Product', {
          title: DataTypes.STRING,
        });
        const User = this.sequelize.define('User', {
          first_name: DataTypes.STRING,
          last_name: DataTypes.STRING,
        });

        const Creator = Product.belongsTo(User, { as: 'creator' });

        await this.sequelize.sync({ force: true });

        const savedProducts = await Product.bulkCreate(
          [
            {
              title: 'Chair',
              creator: {
                first_name: 'Matt',
                last_name: 'Hansen',
              },
            },
            {
              title: 'Table',
              creator: {
                first_name: 'John',
                last_name: 'Johnson',
              },
            },
          ],
          {
            include: [Creator],
          },
        );

        const persistedProducts = await Promise.all([
          Product.findOne({
            where: { id: savedProducts[0].id },
            include: [Creator],
          }),
          Product.findOne({
            where: { id: savedProducts[1].id },
            include: [Creator],
          }),
        ]);

        expect(persistedProducts[0].creator).to.be.ok;
        expect(persistedProducts[0].creator.first_name).to.equal('Matt');
        expect(persistedProducts[0].creator.last_name).to.equal('Hansen');

        expect(persistedProducts[1].creator).to.be.ok;
        expect(persistedProducts[1].creator.first_name).to.equal('John');
        expect(persistedProducts[1].creator.last_name).to.equal('Johnson');
      });

      it('should bulkCreate data for HasMany relations', async function () {
        const Product = this.sequelize.define(
          'Product',
          {
            title: DataTypes.STRING,
          },
          {
            hooks: {
              afterBulkCreate(products) {
                for (const product of products) {
                  product.areIncludesCreatedOnAfterCreate =
                    product.tags &&
                    product.tags.every(tag => {
                      return Boolean(tag.id);
                    });
                }
              },
            },
          },
        );
        const Tag = this.sequelize.define(
          'Tag',
          {
            name: DataTypes.STRING,
          },
          {
            hooks: {
              afterBulkCreate(tags, options) {
                for (const tag of tags) {
                  tag.createOptions = options;
                }
              },
            },
          },
        );

        Product.hasMany(Tag);

        await this.sequelize.sync({ force: true });

        const savedProducts = await Product.bulkCreate(
          [
            {
              id: 1,
              title: 'Chair',
              tags: [
                { id: 1, name: 'Alpha' },
                { id: 2, name: 'Beta' },
              ],
            },
            {
              id: 2,
              title: 'Table',
              tags: [
                { id: 3, name: 'Gamma' },
                { id: 4, name: 'Delta' },
              ],
            },
          ],
          {
            include: [
              {
                model: Tag,
                myOption: 'option',
              },
            ],
          },
        );

        expect(savedProducts[0].areIncludesCreatedOnAfterCreate).to.be.true;
        expect(savedProducts[0].tags[0].createOptions.myOption).to.equal('option');
        expect(savedProducts[0].tags[1].createOptions.myOption).to.equal('option');

        expect(savedProducts[1].areIncludesCreatedOnAfterCreate).to.be.true;
        expect(savedProducts[1].tags[0].createOptions.myOption).to.equal('option');
        expect(savedProducts[1].tags[1].createOptions.myOption).to.equal('option');

        const persistedProducts = await Promise.all([
          Product.findOne({
            where: { id: savedProducts[0].id },
            include: [Tag],
          }),
          Product.findOne({
            where: { id: savedProducts[1].id },
            include: [Tag],
          }),
        ]);

        expect(persistedProducts[0].tags).to.be.ok;
        expect(persistedProducts[0].tags.length).to.equal(2);

        expect(persistedProducts[1].tags).to.be.ok;
        expect(persistedProducts[1].tags.length).to.equal(2);
      });

      it('should bulkCreate data for HasMany relations with alias', async function () {
        const Product = this.sequelize.define('Product', {
          title: DataTypes.STRING,
        });
        const Tag = this.sequelize.define('Tag', {
          name: DataTypes.STRING,
        });

        const Categories = Product.hasMany(Tag, { as: 'categories' });

        await this.sequelize.sync({ force: true });

        const savedProducts = await Product.bulkCreate(
          [
            {
              id: 1,
              title: 'Chair',
              categories: [
                { id: 1, name: 'Alpha' },
                { id: 2, name: 'Beta' },
              ],
            },
            {
              id: 2,
              title: 'Table',
              categories: [
                { id: 3, name: 'Gamma' },
                { id: 4, name: 'Delta' },
              ],
            },
          ],
          {
            include: [Categories],
          },
        );

        const persistedProducts = await Promise.all([
          Product.findOne({
            where: { id: savedProducts[0].id },
            include: [Categories],
          }),
          Product.findOne({
            where: { id: savedProducts[1].id },
            include: [Categories],
          }),
        ]);

        expect(persistedProducts[0].categories).to.be.ok;
        expect(persistedProducts[0].categories.length).to.equal(2);

        expect(persistedProducts[1].categories).to.be.ok;
        expect(persistedProducts[1].categories.length).to.equal(2);
      });

      it('should bulkCreate data for HasOne relations', async function () {
        const User = this.sequelize.define('User', {
          username: DataTypes.STRING,
        });

        const Task = this.sequelize.define('Task', {
          title: DataTypes.STRING,
        });

        User.hasOne(Task);

        await this.sequelize.sync({ force: true });

        const savedUsers = await User.bulkCreate(
          [
            {
              username: 'Muzzy',
              task: {
                title: 'Eat Clocks',
              },
            },
            {
              username: 'Walker',
              task: {
                title: 'Walk',
              },
            },
          ],
          {
            include: [Task],
          },
        );

        const persistedUsers = await Promise.all([
          User.findOne({
            where: { id: savedUsers[0].id },
            include: [Task],
          }),
          User.findOne({
            where: { id: savedUsers[1].id },
            include: [Task],
          }),
        ]);

        expect(persistedUsers[0].task).to.be.ok;
        expect(persistedUsers[1].task).to.be.ok;
      });

      it('should bulkCreate data for HasOne relations with alias', async function () {
        const User = this.sequelize.define('User', {
          username: DataTypes.STRING,
        });

        const Task = this.sequelize.define('Task', {
          title: DataTypes.STRING,
        });

        const Job = User.hasOne(Task, { as: 'job' });

        await this.sequelize.sync({ force: true });

        const savedUsers = await User.bulkCreate(
          [
            {
              username: 'Muzzy',
              job: {
                title: 'Eat Clocks',
              },
            },
            {
              username: 'Walker',
              job: {
                title: 'Walk',
              },
            },
          ],
          {
            include: [Job],
          },
        );

        const persistedUsers = await Promise.all([
          User.findOne({
            where: { id: savedUsers[0].id },
            include: [Job],
          }),
          User.findOne({
            where: { id: savedUsers[1].id },
            include: [Job],
          }),
        ]);

        expect(persistedUsers[0].job).to.be.ok;
        expect(persistedUsers[1].job).to.be.ok;
      });

      it('should bulkCreate data for BelongsToMany relations', async function () {
        const User = this.sequelize.define(
          'User',
          {
            username: DataTypes.STRING,
          },
          {
            hooks: {
              afterBulkCreate(users) {
                for (const user of users) {
                  user.areIncludesCreatedOnAfterCreate =
                    user.tasks &&
                    user.tasks.every(task => {
                      return Boolean(task.id);
                    });
                }
              },
            },
          },
        );

        const Task = this.sequelize.define(
          'Task',
          {
            title: DataTypes.STRING,
            active: DataTypes.BOOLEAN,
          },
          {
            hooks: {
              afterBulkCreate(tasks, options) {
                for (const task of tasks) {
                  task.createOptions = options;
                }
              },
            },
          },
        );

        User.belongsToMany(Task, { through: 'user_task' });
        Task.belongsToMany(User, { through: 'user_task' });

        await this.sequelize.sync({ force: true });

        const savedUsers = await User.bulkCreate(
          [
            {
              username: 'John',
              tasks: [
                { title: 'Get rich', active: true },
                { title: 'Die trying', active: false },
              ],
            },
            {
              username: 'Jack',
              tasks: [
                { title: 'Prepare sandwich', active: true },
                { title: 'Each sandwich', active: false },
              ],
            },
          ],
          {
            include: [
              {
                model: Task,
                myOption: 'option',
              },
            ],
          },
        );

        expect(savedUsers[0].areIncludesCreatedOnAfterCreate).to.be.true;
        expect(savedUsers[0].tasks[0].createOptions.myOption).to.equal('option');
        expect(savedUsers[0].tasks[1].createOptions.myOption).to.equal('option');

        expect(savedUsers[1].areIncludesCreatedOnAfterCreate).to.be.true;
        expect(savedUsers[1].tasks[0].createOptions.myOption).to.equal('option');
        expect(savedUsers[1].tasks[1].createOptions.myOption).to.equal('option');

        const persistedUsers = await Promise.all([
          User.findOne({
            where: { id: savedUsers[0].id },
            include: [Task],
          }),
          User.findOne({
            where: { id: savedUsers[1].id },
            include: [Task],
          }),
        ]);

        expect(persistedUsers[0].tasks).to.be.ok;
        expect(persistedUsers[0].tasks.length).to.equal(2);

        expect(persistedUsers[1].tasks).to.be.ok;
        expect(persistedUsers[1].tasks.length).to.equal(2);
      });

      it('should bulkCreate data for polymorphic BelongsToMany relations', async function () {
        const Post = this.sequelize.define(
          'Post',
          {
            title: DataTypes.STRING,
          },
          {
            tableName: 'posts',
            underscored: true,
          },
        );

        const Tag = this.sequelize.define(
          'Tag',
          {
            name: DataTypes.STRING,
          },
          {
            tableName: 'tags',
            underscored: true,
          },
        );

        const ItemTag = this.sequelize.define(
          'ItemTag',
          {
            tag_id: {
              type: DataTypes.INTEGER,
              references: {
                tableName: 'tags',
                key: 'id',
              },
            },
            taggable_id: {
              type: DataTypes.INTEGER,
              references: null,
            },
            taggable: {
              type: DataTypes.STRING,
            },
          },
          {
            tableName: 'item_tag',
            underscored: true,
          },
        );

        Post.belongsToMany(Tag, {
          as: 'tags',
          foreignKey: 'taggable_id',
          otherKey: 'tag_id',
          foreignKeyConstraints: false,
          inverse: {
            foreignKeyConstraints: false,
            as: 'posts',
          },
          through: {
            model: ItemTag,
            scope: {
              taggable: 'post',
            },
          },
        });

        await this.sequelize.sync({ force: true });

        const savedPosts = await Post.bulkCreate(
          [
            {
              title: 'Polymorphic Associations',
              tags: [
                {
                  name: 'polymorphic',
                },
                {
                  name: 'associations',
                },
              ],
            },
            {
              title: 'Second Polymorphic Associations',
              tags: [
                {
                  name: 'second polymorphic',
                },
                {
                  name: 'second associations',
                },
              ],
            },
          ],
          {
            include: [
              {
                model: Tag,
                as: 'tags',
                through: {
                  model: ItemTag,
                },
              },
            ],
          },
        );

        // The saved post should include the two tags
        expect(savedPosts[0].tags.length).to.equal(2);
        expect(savedPosts[1].tags.length).to.equal(2);

        // The saved post should be able to retrieve the two tags
        // using the convenience accessor methods
        const savedTagGroups = await Promise.all([
          savedPosts[0].getTags(),
          savedPosts[1].getTags(),
        ]);

        // All nested tags should be returned
        expect(savedTagGroups[0].length).to.equal(2);
        expect(savedTagGroups[1].length).to.equal(2);
        const itemTags = await ItemTag.findAll();
        // Four "through" models should be created
        expect(itemTags.length).to.equal(4);
        // And their polymorphic field should be correctly set to 'post'
        expect(itemTags[0].taggable).to.equal('post');
        expect(itemTags[1].taggable).to.equal('post');

        expect(itemTags[2].taggable).to.equal('post');
        expect(itemTags[3].taggable).to.equal('post');
      });

      it('should bulkCreate data for BelongsToMany relations with alias', async function () {
        const User = this.sequelize.define('User', {
          username: DataTypes.STRING,
        });

        const Task = this.sequelize.define('Task', {
          title: DataTypes.STRING,
          active: DataTypes.BOOLEAN,
        });

        const Jobs = User.belongsToMany(Task, { through: 'user_job', as: 'jobs' });
        Task.belongsToMany(User, { through: 'user_job' });

        await this.sequelize.sync({ force: true });

        const savedUsers = await User.bulkCreate(
          [
            {
              username: 'John',
              jobs: [
                { title: 'Get rich', active: true },
                { title: 'Die trying', active: false },
              ],
            },
            {
              username: 'Jack',
              jobs: [
                { title: 'Prepare sandwich', active: true },
                { title: 'Eat sandwich', active: false },
              ],
            },
          ],
          {
            include: [Jobs],
          },
        );

        const persistedUsers = await Promise.all([
          User.findOne({
            where: { id: savedUsers[0].id },
            include: [Jobs],
          }),
          User.findOne({
            where: { id: savedUsers[1].id },
            include: [Jobs],
          }),
        ]);

        expect(persistedUsers[0].jobs).to.be.ok;
        expect(persistedUsers[0].jobs.length).to.equal(2);

        expect(persistedUsers[1].jobs).to.be.ok;
        expect(persistedUsers[1].jobs.length).to.equal(2);
      });
    });
  });
});
