'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('../../../lib/data-types'),
  Sequelize = require('../../../index'),
  Promise = Sequelize.Promise,
  Op = Sequelize.Op;

describe(Support.getTestDialectTeaser('associations'), () => {
  describe('scope', () => {
    beforeEach(function() {
      this.Post = this.sequelize.define('post', {});
      this.Image = this.sequelize.define('image', {});
      this.Question = this.sequelize.define('question', {});
      this.Comment = this.sequelize.define('comment', {
        title: Sequelize.STRING,
        type: Sequelize.STRING,
        commentable: Sequelize.STRING,
        commentable_id: Sequelize.INTEGER,
        isMain: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        }
      });

      this.Comment.prototype.getItem = function() {
        return this[`get${this.get('commentable').substr(0, 1).toUpperCase()}${this.get('commentable').substr(1)}`]();
      };

      this.Post.addScope('withComments', {
        include: [this.Comment]
      });
      this.Post.addScope('withMainComment', {
        include: [{
          model: this.Comment,
          as: 'mainComment'
        }]
      });
      this.Post.hasMany(this.Comment, {
        foreignKey: 'commentable_id',
        scope: {
          commentable: 'post'
        },
        constraints: false
      });
      this.Post.hasMany(this.Comment, {
        foreignKey: 'commentable_id',
        as: 'coloredComments',
        scope: {
          commentable: 'post',
          type: { [Op.in]: ['blue', 'green'] }
        },
        constraints: false
      });
      this.Post.hasOne(this.Comment, {
        foreignKey: 'commentable_id',
        as: 'mainComment',
        scope: {
          commentable: 'post',
          isMain: true
        },
        constraints: false
      });
      this.Comment.belongsTo(this.Post, {
        foreignKey: 'commentable_id',
        as: 'post',
        constraints: false
      });

      this.Image.hasMany(this.Comment, {
        foreignKey: 'commentable_id',
        scope: {
          commentable: 'image'
        },
        constraints: false
      });
      this.Comment.belongsTo(this.Image, {
        foreignKey: 'commentable_id',
        as: 'image',
        constraints: false
      });

      this.Question.hasMany(this.Comment, {
        foreignKey: 'commentable_id',
        scope: {
          commentable: 'question'
        },
        constraints: false
      });
      this.Comment.belongsTo(this.Question, {
        foreignKey: 'commentable_id',
        as: 'question',
        constraints: false
      });
    });

    describe('1:1', () => {
      it('should create, find and include associations with scope values', function() {
        return this.sequelize.sync({ force: true }).then(() => {
          return Promise.join(
            this.Post.create(),
            this.Comment.create({
              title: 'I am a comment'
            }),
            this.Comment.create({
              title: 'I am a main comment',
              isMain: true
            })
          );
        }).then(([post]) => {
          this.post = post;
          return post.createComment({
            title: 'I am a post comment'
          });
        }).then(comment => {
          expect(comment.get('commentable')).to.equal('post');
          expect(comment.get('isMain')).to.be.false;
          return this.Post.scope('withMainComment').findByPk(this.post.get('id'));
        }).then(post => {
          expect(post.mainComment).to.be.null;
          return post.createMainComment({
            title: 'I am a main post comment'
          });
        }).then(mainComment => {
          this.mainComment = mainComment;
          expect(mainComment.get('commentable')).to.equal('post');
          expect(mainComment.get('isMain')).to.be.true;
          return this.Post.scope('withMainComment').findByPk(this.post.id);
        }).then(post => {
          expect(post.mainComment.get('id')).to.equal(this.mainComment.get('id'));
          return post.getMainComment();
        }).then(mainComment => {
          expect(mainComment.get('commentable')).to.equal('post');
          expect(mainComment.get('isMain')).to.be.true;
          return this.Comment.create({
            title: 'I am a future main comment'
          });
        }).then(comment => {
          return this.post.setMainComment(comment);
        }).then(() => {
          return this.post.getMainComment();
        }).then(mainComment => {
          expect(mainComment.get('commentable')).to.equal('post');
          expect(mainComment.get('isMain')).to.be.true;
          expect(mainComment.get('title')).to.equal('I am a future main comment');
        });
      });
      it('should create included association with scope values', function() {
        return this.sequelize.sync({ force: true }).then(() => {
          return this.Post.create({
            mainComment: {
              title: 'I am a main comment created with a post'
            }
          }, {
            include: [{ model: this.Comment, as: 'mainComment' }]
          });
        }).then(post => {
          expect(post.mainComment.get('commentable')).to.equal('post');
          expect(post.mainComment.get('isMain')).to.be.true;
          return this.Post.scope('withMainComment').findByPk(post.id);
        }).then(post => {
          expect(post.mainComment.get('commentable')).to.equal('post');
          expect(post.mainComment.get('isMain')).to.be.true;
        });
      });
    });

    describe('1:M', () => {
      it('should create, find and include associations with scope values', function() {
        return this.sequelize.sync({ force: true }).then(() => {
          return Promise.join(
            this.Post.create(),
            this.Image.create(),
            this.Question.create(),
            this.Comment.create({
              title: 'I am a image comment'
            }),
            this.Comment.create({
              title: 'I am a question comment'
            })
          );
        }).then(([post, image, question, commentA, commentB]) => {
          this.post = post;
          this.image = image;
          this.question = question;
          return Promise.join(
            post.createComment({
              title: 'I am a post comment'
            }),
            image.addComment(commentA),
            question.setComments([commentB])
          );
        }).then(() => {
          return this.Comment.findAll();
        }).then(comments => {
          comments.forEach(comment => {
            expect(comment.get('commentable')).to.be.ok;
          });
          expect(comments.map(comment => {
            return comment.get('commentable');
          }).sort()).to.deep.equal(['image', 'post', 'question']);
        }).then(() => {
          return Promise.join(
            this.post.getComments(),
            this.image.getComments(),
            this.question.getComments()
          );
        }).then(([postComments, imageComments, questionComments]) => {
          expect(postComments.length).to.equal(1);
          expect(postComments[0].get('title')).to.equal('I am a post comment');
          expect(imageComments.length).to.equal(1);
          expect(imageComments[0].get('title')).to.equal('I am a image comment');
          expect(questionComments.length).to.equal(1);
          expect(questionComments[0].get('title')).to.equal('I am a question comment');

          return [postComments[0], imageComments[0], questionComments[0]];
        }).then(([postComment, imageComment, questionComment]) => {
          return Promise.join(
            postComment.getItem(),
            imageComment.getItem(),
            questionComment.getItem()
          );
        }).then(([post, image, question]) => {
          expect(post).to.be.instanceof(this.Post);
          expect(image).to.be.instanceof(this.Image);
          expect(question).to.be.instanceof(this.Question);
        }).then(() => {
          return Promise.join(
            this.Post.findOne({
              include: [this.Comment]
            }),
            this.Image.findOne({
              include: [this.Comment]
            }),
            this.Question.findOne({
              include: [this.Comment]
            })
          );
        }).then(([post, image, question]) => {
          expect(post.comments.length).to.equal(1);
          expect(post.comments[0].get('title')).to.equal('I am a post comment');
          expect(image.comments.length).to.equal(1);
          expect(image.comments[0].get('title')).to.equal('I am a image comment');
          expect(question.comments.length).to.equal(1);
          expect(question.comments[0].get('title')).to.equal('I am a question comment');
        });
      });
      it('should make the same query if called multiple time (#4470)', function() {
        const logs = [];
        const logging = function(log) {
          //removing 'executing(<uuid> || 'default'}) :' from logs
          logs.push(log.substring(log.indexOf(':') + 1));
        };

        return this.sequelize.sync({ force: true }).then(() => {
          return this.Post.create();
        }).then(post => {
          return post.createComment({
            title: 'I am a post comment'
          });
        }).then(() => {
          return this.Post.scope('withComments').findAll({
            logging
          });
        }).then(() => {
          return this.Post.scope('withComments').findAll({
            logging
          });
        }).then(() => {
          expect(logs[0]).to.equal(logs[1]);
        });
      });
      it('should created included association with scope values', function() {
        return this.sequelize.sync({ force: true }).then(() => {
          return this.Post.create({
            comments: [{
              title: 'I am a comment created with a post'
            }, {
              title: 'I am a second comment created with a post'
            }]
          }, {
            include: [{ model: this.Comment, as: 'comments' }]
          });
        }).then(post => {
          this.post = post;
          return post.comments;
        }).each(comment => {
          expect(comment.get('commentable')).to.equal('post');
        }).then(() => {
          return this.Post.scope('withComments').findByPk(this.post.id);
        }).then(post => {
          return post.getComments();
        }).each(comment => {
          expect(comment.get('commentable')).to.equal('post');
        });
      });
      it('should include associations with operator scope values', function() {
        return this.sequelize.sync({ force: true }).then(() => {
          return Promise.join(
            this.Post.create(),
            this.Comment.create({
              title: 'I am a blue comment',
              type: 'blue'
            }),
            this.Comment.create({
              title: 'I am a red comment',
              type: 'red'
            }),
            this.Comment.create({
              title: 'I am a green comment',
              type: 'green'
            })
          );
        }).then(([post, commentA, commentB, commentC]) => {
          this.post = post;
          return post.addComments([commentA, commentB, commentC]);
        }).then(() => {
          return this.Post.findByPk(this.post.id, {
            include: [{
              model: this.Comment,
              as: 'coloredComments'
            }]
          });
        }).then(post => {
          expect(post.coloredComments.length).to.equal(2);
          for (const comment of post.coloredComments) {
            expect(comment.type).to.match(/blue|green/);
          }
        });
      });
    });

    if (Support.getTestDialect() !== 'sqlite') {
      describe('N:M', () => {
        describe('on the target', () => {
          beforeEach(function() {
            this.Post = this.sequelize.define('post', {});
            this.Tag = this.sequelize.define('tag', {
              type: DataTypes.STRING
            });
            this.PostTag = this.sequelize.define('post_tag');

            this.Tag.belongsToMany(this.Post, { through: this.PostTag });
            this.Post.belongsToMany(this.Tag, { as: 'categories', through: this.PostTag, scope: { type: 'category' } });
            this.Post.belongsToMany(this.Tag, { as: 'tags', through: this.PostTag, scope: { type: 'tag' } });
          });

          it('should create, find and include associations with scope values', function() {
            return Promise.join(
              this.Post.sync({ force: true }),
              this.Tag.sync({ force: true })
            ).then(() => {
              return this.PostTag.sync({ force: true });
            }).then(() => {
              return Promise.join(
                this.Post.create(),
                this.Post.create(),
                this.Post.create(),
                this.Tag.create({ type: 'category' }),
                this.Tag.create({ type: 'category' }),
                this.Tag.create({ type: 'tag' }),
                this.Tag.create({ type: 'tag' })
              );
            }).then(([postA, postB, postC, categoryA, categoryB, tagA, tagB]) => {
              this.postA = postA;
              this.postB = postB;
              this.postC = postC;

              return Promise.join(
                postA.addCategory(categoryA),
                postB.setCategories([categoryB]),
                postC.createCategory(),
                postA.createTag(),
                postB.addTag(tagA),
                postC.setTags([tagB])
              );
            }).then(() => {
              return Promise.join(
                this.postA.getCategories(),
                this.postA.getTags(),
                this.postB.getCategories(),
                this.postB.getTags(),
                this.postC.getCategories(),
                this.postC.getTags()
              );
            }).then(([postACategories, postATags, postBCategories, postBTags, postCCategories, postCTags]) => {
              expect(postACategories.length).to.equal(1);
              expect(postATags.length).to.equal(1);
              expect(postBCategories.length).to.equal(1);
              expect(postBTags.length).to.equal(1);
              expect(postCCategories.length).to.equal(1);
              expect(postCTags.length).to.equal(1);

              expect(postACategories[0].get('type')).to.equal('category');
              expect(postATags[0].get('type')).to.equal('tag');
              expect(postBCategories[0].get('type')).to.equal('category');
              expect(postBTags[0].get('type')).to.equal('tag');
              expect(postCCategories[0].get('type')).to.equal('category');
              expect(postCTags[0].get('type')).to.equal('tag');
            }).then(() => {
              return Promise.join(
                this.Post.findOne({
                  where: {
                    id: this.postA.get('id')
                  },
                  include: [
                    { model: this.Tag, as: 'tags' },
                    { model: this.Tag, as: 'categories' }
                  ]
                }),
                this.Post.findOne({
                  where: {
                    id: this.postB.get('id')
                  },
                  include: [
                    { model: this.Tag, as: 'tags' },
                    { model: this.Tag, as: 'categories' }
                  ]
                }),
                this.Post.findOne({
                  where: {
                    id: this.postC.get('id')
                  },
                  include: [
                    { model: this.Tag, as: 'tags' },
                    { model: this.Tag, as: 'categories' }
                  ]
                })
              );
            }).then(([postA, postB, postC]) => {
              expect(postA.get('categories').length).to.equal(1);
              expect(postA.get('tags').length).to.equal(1);
              expect(postB.get('categories').length).to.equal(1);
              expect(postB.get('tags').length).to.equal(1);
              expect(postC.get('categories').length).to.equal(1);
              expect(postC.get('tags').length).to.equal(1);

              expect(postA.get('categories')[0].get('type')).to.equal('category');
              expect(postA.get('tags')[0].get('type')).to.equal('tag');
              expect(postB.get('categories')[0].get('type')).to.equal('category');
              expect(postB.get('tags')[0].get('type')).to.equal('tag');
              expect(postC.get('categories')[0].get('type')).to.equal('category');
              expect(postC.get('tags')[0].get('type')).to.equal('tag');
            });
          });
        });

        describe('on the through model', () => {
          beforeEach(function() {
            this.Post = this.sequelize.define('post', {});
            this.Image = this.sequelize.define('image', {});
            this.Question = this.sequelize.define('question', {});

            this.ItemTag = this.sequelize.define('item_tag', {
              id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
              },
              tag_id: {
                type: DataTypes.INTEGER,
                unique: 'item_tag_taggable'
              },
              taggable: {
                type: DataTypes.STRING,
                unique: 'item_tag_taggable'
              },
              taggable_id: {
                type: DataTypes.INTEGER,
                unique: 'item_tag_taggable',
                references: null
              }
            });
            this.Tag = this.sequelize.define('tag', {
              name: DataTypes.STRING
            });

            this.Post.belongsToMany(this.Tag, {
              through: {
                model: this.ItemTag,
                unique: false,
                scope: {
                  taggable: 'post'
                }
              },
              foreignKey: 'taggable_id',
              constraints: false
            });
            this.Tag.belongsToMany(this.Post, {
              through: {
                model: this.ItemTag,
                unique: false
              },
              foreignKey: 'tag_id'
            });

            this.Image.belongsToMany(this.Tag, {
              through: {
                model: this.ItemTag,
                unique: false,
                scope: {
                  taggable: 'image'
                }
              },
              foreignKey: 'taggable_id',
              constraints: false
            });
            this.Tag.belongsToMany(this.Image, {
              through: {
                model: this.ItemTag,
                unique: false
              },
              foreignKey: 'tag_id'
            });

            this.Question.belongsToMany(this.Tag, {
              through: {
                model: this.ItemTag,
                unique: false,
                scope: {
                  taggable: 'question'
                }
              },
              foreignKey: 'taggable_id',
              constraints: false
            });
            this.Tag.belongsToMany(this.Question, {
              through: {
                model: this.ItemTag,
                unique: false
              },
              foreignKey: 'tag_id'
            });
          });

          it('should create, find and include associations with scope values', function() {
            return Promise.join(
              this.Post.sync({ force: true }),
              this.Image.sync({ force: true }),
              this.Question.sync({ force: true }),
              this.Tag.sync({ force: true })
            ).then(() => {
              return this.ItemTag.sync({ force: true });
            }).then(() => {
              return Promise.join(
                this.Post.create(),
                this.Image.create(),
                this.Question.create(),
                this.Tag.create({ name: 'tagA' }),
                this.Tag.create({ name: 'tagB' }),
                this.Tag.create({ name: 'tagC' })
              );
            }).then(([post, image, question, tagA, tagB, tagC]) => {
              this.post = post;
              this.image = image;
              this.question = question;
              return Promise.join(
                post.setTags([tagA]).then(() => {
                  return Promise.join(
                    post.createTag({ name: 'postTag' }),
                    post.addTag(tagB)
                  );
                }),
                image.setTags([tagB]).then(() => {
                  return Promise.join(
                    image.createTag({ name: 'imageTag' }),
                    image.addTag(tagC)
                  );
                }),
                question.setTags([tagC]).then(() => {
                  return Promise.join(
                    question.createTag({ name: 'questionTag' }),
                    question.addTag(tagA)
                  );
                })
              );
            }).then(() => {
              return Promise.join(
                this.post.getTags(),
                this.image.getTags(),
                this.question.getTags()
              ).then(([postTags, imageTags, questionTags]) => {
                expect(postTags.length).to.equal(3);
                expect(imageTags.length).to.equal(3);
                expect(questionTags.length).to.equal(3);

                expect(postTags.map(tag => {
                  return tag.name;
                }).sort()).to.deep.equal(['postTag', 'tagA', 'tagB']);

                expect(imageTags.map(tag => {
                  return tag.name;
                }).sort()).to.deep.equal(['imageTag', 'tagB', 'tagC']);

                expect(questionTags.map(tag => {
                  return tag.name;
                }).sort()).to.deep.equal(['questionTag', 'tagA', 'tagC']);
              }).then(() => {
                return Promise.join(
                  this.Post.findOne({
                    where: {},
                    include: [this.Tag]
                  }),
                  this.Image.findOne({
                    where: {},
                    include: [this.Tag]
                  }),
                  this.Question.findOne({
                    where: {},
                    include: [this.Tag]
                  })
                ).then(([post, image, question]) => {
                  expect(post.tags.length).to.equal(3);
                  expect(image.tags.length).to.equal(3);
                  expect(question.tags.length).to.equal(3);

                  expect(post.tags.map(tag => {
                    return tag.name;
                  }).sort()).to.deep.equal(['postTag', 'tagA', 'tagB']);

                  expect(image.tags.map(tag => {
                    return tag.name;
                  }).sort()).to.deep.equal(['imageTag', 'tagB', 'tagC']);

                  expect(question.tags.map(tag => {
                    return tag.name;
                  }).sort()).to.deep.equal(['questionTag', 'tagA', 'tagC']);
                });
              });
            });
          });
        });
      });
    }
  });
});
