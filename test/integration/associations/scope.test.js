'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , Sequelize = require('../../../index')
  , Promise = Sequelize.Promise;

describe(Support.getTestDialectTeaser('associations'), function() {
  describe('scope', function() {
    beforeEach(function() {
      this.Post = this.sequelize.define('post', {});
      this.Image = this.sequelize.define('image', {});
      this.Question = this.sequelize.define('question', {});
      this.Comment = this.sequelize.define('comment', {
        title: Sequelize.STRING,
        commentable: Sequelize.STRING,
        commentable_id: Sequelize.INTEGER
      }, {
        instanceMethods: {
          getItem: function() {
            return this['get' + this.get('commentable').substr(0, 1).toUpperCase() + this.get('commentable').substr(1)]();
          }
        }
      });

      this.Post.hasMany(this.Comment, {
        foreignKey: 'commentable_id',
        scope: {
          commentable: 'post'
        }
      });
      this.Comment.belongsTo(this.Post, {
        foreignKey: 'commentable_id',
        as: 'post'
      });

      this.Image.hasMany(this.Comment, {
        foreignKey: 'commentable_id',
        scope: {
          commentable: 'image'
        }
      });
      this.Comment.belongsTo(this.Image, {
        foreignKey: 'commentable_id',
        as: 'image'
      });

      this.Question.hasMany(this.Comment, {
        foreignKey: 'commentable_id',
        scope: {
          commentable: 'question'
        }
      });
      this.Comment.belongsTo(this.Question, {
        foreignKey: 'commentable_id',
        as: 'question'
      });
    });

    describe('1:M', function() {
      it('should create, find and include associations with scope values', function() {
        var self = this;
        return this.sequelize.sync({force: true}).then(function() {
          return Promise.join(
            self.Post.create(),
            self.Image.create(),
            self.Question.create(),
            self.Comment.create({
              title: 'I am a image comment'
            }),
            self.Comment.create({
              title: 'I am a question comment'
            })
          );
        }).bind(this).spread(function(post, image, question, commentA, commentB) {
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
        }).then(function() {
          return self.Comment.findAll();
        }).then(function(comments) {
          comments.forEach(function(comment) {
            expect(comment.get('commentable')).to.be.ok;
          });
          expect(comments.map(function(comment) {
            return comment.get('commentable');
          }).sort()).to.deep.equal(['image', 'post', 'question']);
        }).then(function() {
          return Promise.join(
            this.post.getComments(),
            this.image.getComments(),
            this.question.getComments()
          );
        }).spread(function(postComments, imageComments, questionComments) {
          expect(postComments.length).to.equal(1);
          expect(postComments[0].get('title')).to.equal('I am a post comment');
          expect(imageComments.length).to.equal(1);
          expect(imageComments[0].get('title')).to.equal('I am a image comment');
          expect(questionComments.length).to.equal(1);
          expect(questionComments[0].get('title')).to.equal('I am a question comment');

          return [postComments[0], imageComments[0], questionComments[0]];
        }).spread(function(postComment, imageComment, questionComment) {
          return Promise.join(
            postComment.getItem(),
            imageComment.getItem(),
            questionComment.getItem()
          );
        }).spread(function(post, image, question) {
          expect(post.Model).to.equal(self.Post);
          expect(image.Model).to.equal(self.Image);
          expect(question.Model).to.equal(self.Question);
        }).then(function() {
          return Promise.join(
            self.Post.find({
              include: [self.Comment]
            }),
            self.Image.find({
              include: [self.Comment]
            }),
            self.Question.find({
              include: [self.Comment]
            })
          );
        }).spread(function(post, image, question) {
          expect(post.comments.length).to.equal(1);
          expect(post.comments[0].get('title')).to.equal('I am a post comment');
          expect(image.comments.length).to.equal(1);
          expect(image.comments[0].get('title')).to.equal('I am a image comment');
          expect(question.comments.length).to.equal(1);
          expect(question.comments[0].get('title')).to.equal('I am a question comment');
        });
      });
    });

    if (Support.getTestDialect() !== 'sqlite') {
      describe('N:M', function() {
        describe('on the target', function() {
          beforeEach(function() {
            this.Post = this.sequelize.define('post', {});
            this.Tag = this.sequelize.define('tag', {
              type: DataTypes.STRING
            });
            this.PostTag = this.sequelize.define('post_tag');

            this.Tag.hasMany(this.Post, {through: this.PostTag});
            this.Post.hasMany(this.Tag, {as: 'categories', through: this.PostTag, scope: { type: 'category' }});
            this.Post.hasMany(this.Tag, {as: 'tags', through: this.PostTag, scope: { type: 'tag' }});
          });

          it('should create, find and include associations with scope values', function() {
            var self = this;
            return Promise.join(
              self.Post.sync({force: true}),
              self.Tag.sync({force: true})
            ).bind(this).then(function() {
              return self.PostTag.sync({force: true});
            }).then(function() {
              return Promise.join(
                self.Post.create(),
                self.Post.create(),
                self.Post.create(),
                self.Tag.create({type: 'category'}),
                self.Tag.create({type: 'category'}),
                self.Tag.create({type: 'tag'}),
                self.Tag.create({type: 'tag'})
              );
            }).spread(function(postA, postB, postC, categoryA, categoryB, tagA, tagB) {
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
            }).then(function() {
              return Promise.join(
                this.postA.getCategories(),
                this.postA.getTags(),
                this.postB.getCategories(),
                this.postB.getTags(),
                this.postC.getCategories(),
                this.postC.getTags()
              );
            }).spread(function(postACategories, postATags, postBCategories, postBTags, postCCategories, postCTags) {
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
            }).then(function() {
              return Promise.join(
                self.Post.find({
                  where: {
                    id: self.postA.get('id')
                  },
                  include: [
                    {model: self.Tag, as: 'tags'},
                    {model: self.Tag, as: 'categories'}
                  ]
                }),
                self.Post.find({
                  where: {
                    id: self.postB.get('id')
                  },
                  include: [
                    {model: self.Tag, as: 'tags'},
                    {model: self.Tag, as: 'categories'}
                  ]
                }),
                self.Post.find({
                  where: {
                    id: self.postC.get('id')
                  },
                  include: [
                    {model: self.Tag, as: 'tags'},
                    {model: self.Tag, as: 'categories'}
                  ]
                })
              );
            }).spread(function(postA, postB, postC) {
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

        describe('on the through model', function() {
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

            this.Post.hasMany(this.Tag, {
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
            this.Tag.hasMany(this.Post, {
              through: {
                model: this.ItemTag,
                unique: false
              },
              foreignKey: 'tag_id'
            });

            this.Image.hasMany(this.Tag, {
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
            this.Tag.hasMany(this.Image, {
              through: {
                model: this.ItemTag,
                unique: false
              },
              foreignKey: 'tag_id'
            });

            this.Question.hasMany(this.Tag, {
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
            this.Tag.hasMany(this.Question, {
              through: {
                model: this.ItemTag,
                unique: false
              },
              foreignKey: 'tag_id'
            });
          });

          it('should create, find and include associations with scope values', function() {
            var self = this;
            return Promise.join(
              this.Post.sync({force: true}),
              this.Image.sync({force: true}),
              this.Question.sync({force: true}),
              this.Tag.sync({force: true})
            ).bind(this).then(function() {
              return this.ItemTag.sync({force: true});
            }).then(function() {
              return Promise.join(
                this.Post.create(),
                this.Image.create(),
                this.Question.create(),
                this.Tag.create({name: 'tagA'}),
                this.Tag.create({name: 'tagB'}),
                this.Tag.create({name: 'tagC'})
              );
            }).spread(function(post, image, question, tagA, tagB, tagC) {
              this.post = post;
              this.image = image;
              this.question = question;
              return Promise.join(
                post.setTags([tagA]).then(function() {
                  return Promise.join(
                    post.createTag({name: 'postTag'}),
                    post.addTag(tagB)
                  );
                }),
                image.setTags([tagB]).then(function() {
                  return Promise.join(
                    image.createTag({name: 'imageTag'}),
                    image.addTag(tagC)
                  );
                }),
                question.setTags([tagC]).then(function() {
                  return Promise.join(
                    question.createTag({name: 'questionTag'}),
                    question.addTag(tagA)
                  );
                })
              );
            }).then(function() {
              return Promise.join(
                this.post.getTags(),
                this.image.getTags(),
                this.question.getTags()
              ).spread(function(postTags, imageTags, questionTags) {
                expect(postTags.length).to.equal(3);
                expect(imageTags.length).to.equal(3);
                expect(questionTags.length).to.equal(3);

                expect(postTags.map(function(tag) {
                  return tag.name;
                }).sort()).to.deep.equal(['postTag', 'tagA', 'tagB']);

                expect(imageTags.map(function(tag) {
                  return tag.name;
                }).sort()).to.deep.equal(['imageTag', 'tagB', 'tagC']);

                expect(questionTags.map(function(tag) {
                  return tag.name;
                }).sort()).to.deep.equal(['questionTag', 'tagA', 'tagC']);
              }).then(function () {
                return Promise.join(
                  self.Post.find({
                    where: {},
                    include: [self.Tag]
                  }),
                  self.Image.find({
                    where: {},
                    include: [self.Tag]
                  }),
                  self.Question.find({
                    where: {},
                    include: [self.Tag]
                  })
                ).spread(function (post, image, question) {
                  expect(post.tags.length).to.equal(3);
                  expect(image.tags.length).to.equal(3);
                  expect(question.tags.length).to.equal(3);

                  expect(post.tags.map(function(tag) {
                    return tag.name;
                  }).sort()).to.deep.equal(['postTag', 'tagA', 'tagB']);

                  expect(image.tags.map(function(tag) {
                    return tag.name;
                  }).sort()).to.deep.equal(['imageTag', 'tagB', 'tagC']);

                  expect(question.tags.map(function(tag) {
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
