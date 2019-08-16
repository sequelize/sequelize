'use strict';

const chai = require('chai'),
  Sequelize = require('../../../../index'),
  expect = chai.expect,
  Support = require('../../support'),
  DataTypes = require('../../../../lib/data-types');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('bulkCreate', () => {
    describe('include', () => {
      it('should bulkCreate data for BelongsTo relations', function() {
        const Product = this.sequelize.define('Product', {
          title: Sequelize.STRING
        }, {
          hooks: {
            afterBulkCreate(products) {
              products.forEach(product => {
                product.isIncludeCreatedOnAfterCreate = !!(product.User && product.User.id);
              });
            }
          }
        });
        const User = this.sequelize.define('User', {
          first_name: Sequelize.STRING,
          last_name: Sequelize.STRING
        }, {
          hooks: {
            beforeBulkCreate(users, options) {
              users.forEach(user => {
                user.createOptions = options;
              });
            }
          }
        });

        Product.belongsTo(User);

        return this.sequelize.sync({ force: true }).then(() => {
          return Product.bulkCreate([{
            title: 'Chair',
            User: {
              first_name: 'Mick',
              last_name: 'Broadstone'
            }
          }, {
            title: 'Table',
            User: {
              first_name: 'John',
              last_name: 'Johnson'
            }
          }], {
            include: [{
              model: User,
              myOption: 'option'
            }]
          }).then(savedProducts => {
            expect(savedProducts[0].isIncludeCreatedOnAfterCreate).to.be.true;
            expect(savedProducts[0].User.createOptions.myOption).to.be.equal('option');

            expect(savedProducts[1].isIncludeCreatedOnAfterCreate).to.be.true;
            expect(savedProducts[1].User.createOptions.myOption).to.be.equal('option');

            return Promise.all([
              Product.findOne({
                where: { id: savedProducts[0].id },
                include: [User]
              }),
              Product.findOne({
                where: { id: savedProducts[1].id },
                include: [User]
              })
            ]).then(persistedProducts => {
              expect(persistedProducts[0].User).to.be.ok;
              expect(persistedProducts[0].User.first_name).to.be.equal('Mick');
              expect(persistedProducts[0].User.last_name).to.be.equal('Broadstone');

              expect(persistedProducts[1].User).to.be.ok;
              expect(persistedProducts[1].User.first_name).to.be.equal('John');
              expect(persistedProducts[1].User.last_name).to.be.equal('Johnson');
            });
          });
        });
      });

      it('should bulkCreate data for BelongsTo relations with no nullable FK', function() {
        const Product = this.sequelize.define('Product', {
          title: Sequelize.STRING
        });
        const User = this.sequelize.define('User', {
          first_name: Sequelize.STRING
        });

        Product.belongsTo(User, {
          foreignKey: {
            allowNull: false
          }
        });

        return this.sequelize.sync({ force: true }).then(() => {
          return Product.bulkCreate([{
            title: 'Chair',
            User: {
              first_name: 'Mick'
            }
          }, {
            title: 'Table',
            User: {
              first_name: 'John'
            }
          }], {
            include: [{
              model: User
            }]
          }).then(savedProducts => {
            expect(savedProducts[0]).to.exist;
            expect(savedProducts[0].title).to.be.equal('Chair');
            expect(savedProducts[0].User).to.exist;
            expect(savedProducts[0].User.first_name).to.be.equal('Mick');

            expect(savedProducts[1]).to.exist;
            expect(savedProducts[1].title).to.be.equal('Table');
            expect(savedProducts[1].User).to.exist;
            expect(savedProducts[1].User.first_name).to.be.equal('John');
          });
        });
      });

      it('should bulkCreate data for BelongsTo relations with alias', function() {
        const Product = this.sequelize.define('Product', {
          title: Sequelize.STRING
        });
        const User = this.sequelize.define('User', {
          first_name: Sequelize.STRING,
          last_name: Sequelize.STRING
        });

        const Creator = Product.belongsTo(User, { as: 'creator' });

        return this.sequelize.sync({ force: true }).then(() => {
          return Product.bulkCreate([{
            title: 'Chair',
            creator: {
              first_name: 'Matt',
              last_name: 'Hansen'
            }
          }, {
            title: 'Table',
            creator: {
              first_name: 'John',
              last_name: 'Johnson'
            }
          }], {
            include: [Creator]
          }).then(savedProducts => {
            return Promise.all([
              Product.findOne({
                where: { id: savedProducts[0].id },
                include: [Creator]
              }),
              Product.findOne({
                where: { id: savedProducts[1].id },
                include: [Creator]
              })
            ]).then(persistedProducts => {
              expect(persistedProducts[0].creator).to.be.ok;
              expect(persistedProducts[0].creator.first_name).to.be.equal('Matt');
              expect(persistedProducts[0].creator.last_name).to.be.equal('Hansen');

              expect(persistedProducts[1].creator).to.be.ok;
              expect(persistedProducts[1].creator.first_name).to.be.equal('John');
              expect(persistedProducts[1].creator.last_name).to.be.equal('Johnson');
            });
          });
        });
      });

      it('should bulkCreate data for HasMany relations', function() {
        const Product = this.sequelize.define('Product', {
          title: Sequelize.STRING
        }, {
          hooks: {
            afterBulkCreate(products) {
              products.forEach(product => {
                product.areIncludesCreatedOnAfterCreate = product.Tags &&
                  product.Tags.every(tag => {
                    return !!tag.id;
                  });
              });
            }
          }
        });
        const Tag = this.sequelize.define('Tag', {
          name: Sequelize.STRING
        }, {
          hooks: {
            afterBulkCreate(tags, options) {
              tags.forEach(tag => tag.createOptions = options);
            }
          }
        });

        Product.hasMany(Tag);

        return this.sequelize.sync({ force: true }).then(() => {
          return Product.bulkCreate([{
            id: 1,
            title: 'Chair',
            Tags: [
              { id: 1, name: 'Alpha' },
              { id: 2, name: 'Beta' }
            ]
          }, {
            id: 2,
            title: 'Table',
            Tags: [
              { id: 3, name: 'Gamma' },
              { id: 4, name: 'Delta' }
            ]
          }], {
            include: [{
              model: Tag,
              myOption: 'option'
            }]
          }).then(savedProducts => {
            expect(savedProducts[0].areIncludesCreatedOnAfterCreate).to.be.true;
            expect(savedProducts[0].Tags[0].createOptions.myOption).to.be.equal('option');
            expect(savedProducts[0].Tags[1].createOptions.myOption).to.be.equal('option');

            expect(savedProducts[1].areIncludesCreatedOnAfterCreate).to.be.true;
            expect(savedProducts[1].Tags[0].createOptions.myOption).to.be.equal('option');
            expect(savedProducts[1].Tags[1].createOptions.myOption).to.be.equal('option');
            return Promise.all([
              Product.findOne({
                where: { id: savedProducts[0].id },
                include: [Tag]
              }),
              Product.findOne({
                where: { id: savedProducts[1].id },
                include: [Tag]
              })
            ]).then(persistedProducts => {
              expect(persistedProducts[0].Tags).to.be.ok;
              expect(persistedProducts[0].Tags.length).to.equal(2);

              expect(persistedProducts[1].Tags).to.be.ok;
              expect(persistedProducts[1].Tags.length).to.equal(2);
            });
          });
        });
      });

      it('should bulkCreate data for HasMany relations with alias', function() {
        const Product = this.sequelize.define('Product', {
          title: Sequelize.STRING
        });
        const Tag = this.sequelize.define('Tag', {
          name: Sequelize.STRING
        });

        const Categories = Product.hasMany(Tag, { as: 'categories' });

        return this.sequelize.sync({ force: true }).then(() => {
          return Product.bulkCreate([{
            id: 1,
            title: 'Chair',
            categories: [
              { id: 1, name: 'Alpha' },
              { id: 2, name: 'Beta' }
            ]
          }, {
            id: 2,
            title: 'Table',
            categories: [
              { id: 3, name: 'Gamma' },
              { id: 4, name: 'Delta' }
            ]
          }], {
            include: [Categories]
          }).then(savedProducts => {
            return Promise.all([
              Product.findOne({
                where: { id: savedProducts[0].id },
                include: [Categories]
              }),
              Product.findOne({
                where: { id: savedProducts[1].id },
                include: [Categories]
              })
            ]).then(persistedProducts => {
              expect(persistedProducts[0].categories).to.be.ok;
              expect(persistedProducts[0].categories.length).to.equal(2);

              expect(persistedProducts[1].categories).to.be.ok;
              expect(persistedProducts[1].categories.length).to.equal(2);
            });
          });
        });
      });

      it('should bulkCreate data for HasOne relations', function() {
        const User = this.sequelize.define('User', {
          username: Sequelize.STRING
        });

        const Task = this.sequelize.define('Task', {
          title: Sequelize.STRING
        });

        User.hasOne(Task);

        return this.sequelize.sync({ force: true }).then(() => {
          return User.bulkCreate([{
            username: 'Muzzy',
            Task: {
              title: 'Eat Clocks'
            }
          }, {
            username: 'Walker',
            Task: {
              title: 'Walk'
            }
          }], {
            include: [Task]
          }).then(savedUsers => {
            return Promise.all([
              User.findOne({
                where: { id: savedUsers[0].id },
                include: [Task]
              }),
              User.findOne({
                where: { id: savedUsers[1].id },
                include: [Task]
              })
            ]).then(persistedUsers => {
              expect(persistedUsers[0].Task).to.be.ok;
              expect(persistedUsers[1].Task).to.be.ok;
            });
          });
        });
      });

      it('should bulkCreate data for HasOne relations with alias', function() {
        const User = this.sequelize.define('User', {
          username: Sequelize.STRING
        });

        const Task = this.sequelize.define('Task', {
          title: Sequelize.STRING
        });

        const Job = User.hasOne(Task, { as: 'job' });


        return this.sequelize.sync({ force: true }).then(() => {
          return User.bulkCreate([{
            username: 'Muzzy',
            job: {
              title: 'Eat Clocks'
            }
          }, {
            username: 'Walker',
            job: {
              title: 'Walk'
            }
          }], {
            include: [Job]
          }).then(savedUsers => {
            return Promise.all([
              User.findOne({
                where: { id: savedUsers[0].id },
                include: [Job]
              }),
              User.findOne({
                where: { id: savedUsers[1].id },
                include: [Job]
              })
            ]).then(persistedUsers => {
              expect(persistedUsers[0].job).to.be.ok;
              expect(persistedUsers[1].job).to.be.ok;
            });
          });
        });
      });

      it('should bulkCreate data for BelongsToMany relations', function() {
        const User = this.sequelize.define('User', {
          username: DataTypes.STRING
        }, {
          hooks: {
            afterBulkCreate(users) {
              users.forEach(user => {
                user.areIncludesCreatedOnAfterCreate = user.Tasks &&
                  user.Tasks.every(task => {
                    return !!task.id;
                  });
              });
            }
          }
        });

        const Task = this.sequelize.define('Task', {
          title: DataTypes.STRING,
          active: DataTypes.BOOLEAN
        }, {
          hooks: {
            afterBulkCreate(tasks, options) {
              tasks.forEach(task => {
                task.createOptions = options;
              });
            }
          }
        });

        User.belongsToMany(Task, { through: 'user_task' });
        Task.belongsToMany(User, { through: 'user_task' });

        return this.sequelize.sync({ force: true }).then(() => {
          return User.bulkCreate([{
            username: 'John',
            Tasks: [
              { title: 'Get rich', active: true },
              { title: 'Die trying', active: false }
            ]
          }, {
            username: 'Jack',
            Tasks: [
              { title: 'Prepare sandwich', active: true },
              { title: 'Each sandwich', active: false }
            ]
          }], {
            include: [{
              model: Task,
              myOption: 'option'
            }]
          }).then(savedUsers => {
            expect(savedUsers[0].areIncludesCreatedOnAfterCreate).to.be.true;
            expect(savedUsers[0].Tasks[0].createOptions.myOption).to.be.equal('option');
            expect(savedUsers[0].Tasks[1].createOptions.myOption).to.be.equal('option');

            expect(savedUsers[1].areIncludesCreatedOnAfterCreate).to.be.true;
            expect(savedUsers[1].Tasks[0].createOptions.myOption).to.be.equal('option');
            expect(savedUsers[1].Tasks[1].createOptions.myOption).to.be.equal('option');
            return Promise.all([
              User.findOne({
                where: { id: savedUsers[0].id },
                include: [Task]
              }),
              User.findOne({
                where: { id: savedUsers[1].id },
                include: [Task]
              })
            ]).then(persistedUsers => {
              expect(persistedUsers[0].Tasks).to.be.ok;
              expect(persistedUsers[0].Tasks.length).to.equal(2);

              expect(persistedUsers[1].Tasks).to.be.ok;
              expect(persistedUsers[1].Tasks.length).to.equal(2);
            });
          });
        });
      });

      it('should bulkCreate data for polymorphic BelongsToMany relations', function() {
        const Post = this.sequelize.define('Post', {
          title: DataTypes.STRING
        }, {
          tableName: 'posts',
          underscored: true
        });

        const Tag = this.sequelize.define('Tag', {
          name: DataTypes.STRING
        }, {
          tableName: 'tags',
          underscored: true
        });

        const ItemTag = this.sequelize.define('ItemTag', {
          tag_id: {
            type: DataTypes.INTEGER,
            references: {
              model: 'tags',
              key: 'id'
            }
          },
          taggable_id: {
            type: DataTypes.INTEGER,
            references: null
          },
          taggable: {
            type: DataTypes.STRING
          }
        }, {
          tableName: 'item_tag',
          underscored: true
        });

        Post.belongsToMany(Tag, {
          as: 'tags',
          foreignKey: 'taggable_id',
          constraints: false,
          through: {
            model: ItemTag,
            scope: {
              taggable: 'post'
            }
          }
        });

        Tag.belongsToMany(Post, {
          as: 'posts',
          foreignKey: 'tag_id',
          constraints: false,
          through: {
            model: ItemTag,
            scope: {
              taggable: 'post'
            }
          }
        });

        return this.sequelize.sync({ force: true }).then(() => {
          return Post.bulkCreate([{
            title: 'Polymorphic Associations',
            tags: [
              {
                name: 'polymorphic'
              },
              {
                name: 'associations'
              }
            ]
          }, {
            title: 'Second Polymorphic Associations',
            tags: [
              {
                name: 'second polymorphic'
              },
              {
                name: 'second associations'
              }
            ]
          }], {
            include: [{
              model: Tag,
              as: 'tags',
              through: {
                model: ItemTag
              }
            }]
          }
          );
        }).then(savedPosts => {
          // The saved post should include the two tags
          expect(savedPosts[0].tags.length).to.equal(2);
          expect(savedPosts[1].tags.length).to.equal(2);
          // The saved post should be able to retrieve the two tags
          // using the convenience accessor methods
          return Promise.all([
            savedPosts[0].getTags(),
            savedPosts[1].getTags()
          ]);
        }).then(savedTagGroups => {
          // All nested tags should be returned
          expect(savedTagGroups[0].length).to.equal(2);
          expect(savedTagGroups[1].length).to.equal(2);
        }).then(() => {
          return ItemTag.findAll();
        }).then(itemTags => {
          // Four "through" models should be created
          expect(itemTags.length).to.equal(4);
          // And their polymorphic field should be correctly set to 'post'
          expect(itemTags[0].taggable).to.equal('post');
          expect(itemTags[1].taggable).to.equal('post');

          expect(itemTags[2].taggable).to.equal('post');
          expect(itemTags[3].taggable).to.equal('post');
        });
      });

      it('should bulkCreate data for BelongsToMany relations with alias', function() {
        const User = this.sequelize.define('User', {
          username: DataTypes.STRING
        });

        const Task = this.sequelize.define('Task', {
          title: DataTypes.STRING,
          active: DataTypes.BOOLEAN
        });

        const Jobs = User.belongsToMany(Task, { through: 'user_job', as: 'jobs' });
        Task.belongsToMany(User, { through: 'user_job' });

        return this.sequelize.sync({ force: true }).then(() => {
          return User.bulkCreate([{
            username: 'John',
            jobs: [
              { title: 'Get rich', active: true },
              { title: 'Die trying', active: false }
            ]
          }, {
            username: 'Jack',
            jobs: [
              { title: 'Prepare sandwich', active: true },
              { title: 'Eat sandwich', active: false }
            ]
          }], {
            include: [Jobs]
          }).then(savedUsers => {
            return Promise.all([
              User.findOne({
                where: { id: savedUsers[0].id },
                include: [Jobs]
              }),
              User.findOne({
                where: { id: savedUsers[1].id },
                include: [Jobs]
              })
            ]).then(persistedUsers => {
              expect(persistedUsers[0].jobs).to.be.ok;
              expect(persistedUsers[0].jobs.length).to.equal(2);

              expect(persistedUsers[1].jobs).to.be.ok;
              expect(persistedUsers[1].jobs.length).to.equal(2);
            });
          });
        });
      });
    });
  });
});
