'use strict';

const chai = require('chai'),
  Sequelize = require('../../../../index'),
  expect = chai.expect,
  Support = require(__dirname + '/../../support'),
  DataTypes = require(__dirname + '/../../../../lib/data-types');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('create', () => {
    describe('include', () => {
      it('should create data for BelongsTo relations', function() {
        const Product = this.sequelize.define('Product', {
          title: Sequelize.STRING
        }, {
          hooks: {
            afterCreate(product) {
              product.isIncludeCreatedOnAfterCreate = !!(product.User && product.User.id);
            }
          }
        });
        const User = this.sequelize.define('User', {
          first_name: Sequelize.STRING,
          last_name: Sequelize.STRING
        }, {
          hooks: {
            beforeCreate(user, options) {
              user.createOptions = options;
            }
          }
        });

        Product.belongsTo(User);

        return this.sequelize.sync({ force: true }).then(() => {
          return Product.create({
            title: 'Chair',
            User: {
              first_name: 'Mick',
              last_name: 'Broadstone'
            }
          }, {
            include: [{
              model: User,
              myOption: 'option'
            }]
          }).then(savedProduct => {
            expect(savedProduct.isIncludeCreatedOnAfterCreate).to.be.true;
            expect(savedProduct.User.createOptions.myOption).to.be.equal('option');
            expect(savedProduct.User.createOptions.parentRecord).to.be.equal(savedProduct);
            return Product.findOne({
              where: { id: savedProduct.id },
              include: [User]
            }).then(persistedProduct => {
              expect(persistedProduct.User).to.be.ok;
              expect(persistedProduct.User.first_name).to.be.equal('Mick');
              expect(persistedProduct.User.last_name).to.be.equal('Broadstone');
            });
          });
        });
      });

      it('should create data for BelongsTo relations with alias', function() {
        const Product = this.sequelize.define('Product', {
          title: Sequelize.STRING
        });
        const User = this.sequelize.define('User', {
          first_name: Sequelize.STRING,
          last_name: Sequelize.STRING
        });

        const Creator = Product.belongsTo(User, {as: 'creator'});

        return this.sequelize.sync({ force: true }).then(() => {
          return Product.create({
            title: 'Chair',
            creator: {
              first_name: 'Matt',
              last_name: 'Hansen'
            }
          }, {
            include: [Creator]
          }).then(savedProduct => {
            return Product.findOne({
              where: { id: savedProduct.id },
              include: [Creator]
            }).then(persistedProduct => {
              expect(persistedProduct.creator).to.be.ok;
              expect(persistedProduct.creator.first_name).to.be.equal('Matt');
              expect(persistedProduct.creator.last_name).to.be.equal('Hansen');
            });
          });
        });
      });

      it('should create data for HasMany relations', function() {
        const Product = this.sequelize.define('Product', {
          title: Sequelize.STRING
        }, {
          hooks: {
            afterCreate(product) {
              product.areIncludesCreatedOnAfterCreate = product.Tags &&
                product.Tags.every(tag => {
                  return !!tag.id;
                });
            }
          }
        });
        const Tag = this.sequelize.define('Tag', {
          name: Sequelize.STRING
        }, {
          hooks: {
            afterCreate(tag, options) {
              tag.createOptions = options;
            }
          }
        });

        Product.hasMany(Tag);

        return this.sequelize.sync({ force: true }).then(() => {
          return Product.create({
            id: 1,
            title: 'Chair',
            Tags: [
              {id: 1, name: 'Alpha'},
              {id: 2, name: 'Beta'}
            ]
          }, {
            include: [{
              model: Tag,
              myOption: 'option'
            }]
          }).then(savedProduct => {
            expect(savedProduct.areIncludesCreatedOnAfterCreate).to.be.true;
            expect(savedProduct.Tags[0].createOptions.myOption).to.be.equal('option');
            expect(savedProduct.Tags[0].createOptions.parentRecord).to.be.equal(savedProduct);
            expect(savedProduct.Tags[1].createOptions.myOption).to.be.equal('option');
            expect(savedProduct.Tags[1].createOptions.parentRecord).to.be.equal(savedProduct);
            return Product.find({
              where: { id: savedProduct.id },
              include: [Tag]
            }).then(persistedProduct => {
              expect(persistedProduct.Tags).to.be.ok;
              expect(persistedProduct.Tags.length).to.equal(2);
            });
          });
        });
      });

      it('should create data for HasMany relations with alias', function() {
        const Product = this.sequelize.define('Product', {
          title: Sequelize.STRING
        });
        const Tag = this.sequelize.define('Tag', {
          name: Sequelize.STRING
        });

        const Categories = Product.hasMany(Tag, {as: 'categories'});

        return this.sequelize.sync({ force: true }).then(() => {
          return Product.create({
            id: 1,
            title: 'Chair',
            categories: [
              {id: 1, name: 'Alpha'},
              {id: 2, name: 'Beta'}
            ]
          }, {
            include: [Categories]
          }).then(savedProduct => {
            return Product.find({
              where: { id: savedProduct.id },
              include: [Categories]
            }).then(persistedProduct => {
              expect(persistedProduct.categories).to.be.ok;
              expect(persistedProduct.categories.length).to.equal(2);
            });
          });
        });
      });

      it('should create data for HasOne relations', function() {
        const User = this.sequelize.define('User', {
          username: Sequelize.STRING
        });

        const Task = this.sequelize.define('Task', {
          title: Sequelize.STRING
        });

        User.hasOne(Task);

        return this.sequelize.sync({ force: true }).then(() => {
          return User.create({
            username: 'Muzzy',
            Task: {
              title: 'Eat Clocks'
            }
          }, {
            include: [Task]
          }).then(savedUser => {
            return User.find({
              where: { id: savedUser.id },
              include: [Task]
            }).then(persistedUser => {
              expect(persistedUser.Task).to.be.ok;
            });
          });
        });
      });

      it('should create data for HasOne relations with alias', function() {
        const User = this.sequelize.define('User', {
          username: Sequelize.STRING
        });

        const Task = this.sequelize.define('Task', {
          title: Sequelize.STRING
        });

        const Job = User.hasOne(Task, {as: 'job'});


        return this.sequelize.sync({ force: true }).then(() => {
          return User.create({
            username: 'Muzzy',
            job: {
              title: 'Eat Clocks'
            }
          }, {
            include: [Job]
          }).then(savedUser => {
            return User.find({
              where: { id: savedUser.id },
              include: [Job]
            }).then(persistedUser => {
              expect(persistedUser.job).to.be.ok;
            });
          });
        });
      });

      it('should create data for BelongsToMany relations', function() {
        const User = this.sequelize.define('User', {
          username: DataTypes.STRING
        }, {
          hooks: {
            afterCreate(user) {
              user.areIncludesCreatedOnAfterCreate = user.Tasks &&
                user.Tasks.every(task => {
                  return !!task.id;
                });
            }
          }
        });

        const Task = this.sequelize.define('Task', {
          title: DataTypes.STRING,
          active: DataTypes.BOOLEAN
        }, {
          hooks: {
            afterCreate(task, options) {
              task.createOptions = options;
            }
          }
        });

        User.belongsToMany(Task, {through: 'user_task'});
        Task.belongsToMany(User, {through: 'user_task'});

        return this.sequelize.sync({ force: true }).then(() => {
          return User.create({
            username: 'John',
            Tasks: [
              { title: 'Get rich', active: true },
              { title: 'Die trying', active: false }
            ]
          }, {
            include: [{
              model: Task,
              myOption: 'option'
            }]
          }).then(savedUser => {
            expect(savedUser.areIncludesCreatedOnAfterCreate).to.be.true;
            expect(savedUser.Tasks[0].createOptions.myOption).to.be.equal('option');
            expect(savedUser.Tasks[0].createOptions.parentRecord).to.be.equal(savedUser);
            expect(savedUser.Tasks[1].createOptions.myOption).to.be.equal('option');
            expect(savedUser.Tasks[1].createOptions.parentRecord).to.be.equal(savedUser);
            return User.find({
              where: { id: savedUser.id },
              include: [Task]
            }).then(persistedUser => {
              expect(persistedUser.Tasks).to.be.ok;
              expect(persistedUser.Tasks.length).to.equal(2);
            });
          });
        });
      });

      it('should create data for polymorphic BelongsToMany relations', function() {
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
          return Post.create({
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
            include: [{
              model: Tag,
              as: 'tags',
              through: {
                model: ItemTag
              }
            }]
          }
          );
        }).then(savedPost => {
          // The saved post should include the two tags
          expect(savedPost.tags.length).to.equal(2);
          // The saved post should be able to retrieve the two tags
          // using the convenience accessor methods
          return savedPost.getTags();
        }).then(savedTags => {
          // All nested tags should be returned
          expect(savedTags.length).to.equal(2);
        }).then(() => {
          return ItemTag.findAll();
        }).then(itemTags => {
          // Two "through" models should be created
          expect(itemTags.length).to.equal(2);
          // And their polymorphic field should be correctly set to 'post'
          expect(itemTags[0].taggable).to.equal('post');
          expect(itemTags[1].taggable).to.equal('post');
        });
      });

      it('should create data for BelongsToMany relations with alias', function() {
        const User = this.sequelize.define('User', {
          username: DataTypes.STRING
        });

        const Task = this.sequelize.define('Task', {
          title: DataTypes.STRING,
          active: DataTypes.BOOLEAN
        });

        const Jobs = User.belongsToMany(Task, {through: 'user_job', as: 'jobs'});
        Task.belongsToMany(User, {through: 'user_job'});

        return this.sequelize.sync({ force: true }).then(() => {
          return User.create({
            username: 'John',
            jobs: [
              { title: 'Get rich', active: true },
              { title: 'Die trying', active: false }
            ]
          }, {
            include: [Jobs]
          }).then(savedUser => {
            return User.find({
              where: { id: savedUser.id },
              include: [Jobs]
            }).then(persistedUser => {
              expect(persistedUser.jobs).to.be.ok;
              expect(persistedUser.jobs.length).to.equal(2);
            });
          });
        });
      });
    });
  });
});
