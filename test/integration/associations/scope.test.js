'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
  Sequelize = require('sequelize'),
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
          field: 'is_main',
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
      it('should create, find and include associations with scope values', async function() {
        await this.sequelize.sync({ force: true });

        const [post1] = await Promise.all([this.Post.create(), this.Comment.create({
          title: 'I am a comment'
        }), this.Comment.create({
          title: 'I am a main comment',
          isMain: true
        })]);

        this.post = post1;

        const comment0 = await post1.createComment({
          title: 'I am a post comment'
        });

        expect(comment0.get('commentable')).to.equal('post');
        expect(comment0.get('isMain')).to.be.false;
        const post0 = await this.Post.scope('withMainComment').findByPk(this.post.get('id'));
        expect(post0.mainComment).to.be.null;

        const mainComment1 = await post0.createMainComment({
          title: 'I am a main post comment'
        });

        this.mainComment = mainComment1;
        expect(mainComment1.get('commentable')).to.equal('post');
        expect(mainComment1.get('isMain')).to.be.true;
        const post = await this.Post.scope('withMainComment').findByPk(this.post.id);
        expect(post.mainComment.get('id')).to.equal(this.mainComment.get('id'));
        const mainComment0 = await post.getMainComment();
        expect(mainComment0.get('commentable')).to.equal('post');
        expect(mainComment0.get('isMain')).to.be.true;

        const comment = await this.Comment.create({
          title: 'I am a future main comment'
        });

        await this.post.setMainComment(comment);
        const mainComment = await this.post.getMainComment();
        expect(mainComment.get('commentable')).to.equal('post');
        expect(mainComment.get('isMain')).to.be.true;
        expect(mainComment.get('title')).to.equal('I am a future main comment');
      });
      it('should create included association with scope values', async function() {
        await this.sequelize.sync({ force: true });

        const post0 = await this.Post.create({
          mainComment: {
            title: 'I am a main comment created with a post'
          }
        }, {
          include: [{ model: this.Comment, as: 'mainComment' }]
        });

        expect(post0.mainComment.get('commentable')).to.equal('post');
        expect(post0.mainComment.get('isMain')).to.be.true;
        const post = await this.Post.scope('withMainComment').findByPk(post0.id);
        expect(post.mainComment.get('commentable')).to.equal('post');
        expect(post.mainComment.get('isMain')).to.be.true;
      });
    });

    describe('1:M', () => {
      it('should create, find and include associations with scope values', async function() {
        await this.sequelize.sync({ force: true });

        const [post1, image1, question1, commentA, commentB] = await Promise.all([
          this.Post.create(),
          this.Image.create(),
          this.Question.create(),
          this.Comment.create({
            title: 'I am a image comment'
          }),
          this.Comment.create({
            title: 'I am a question comment'
          })
        ]);

        this.post = post1;
        this.image = image1;
        this.question = question1;

        await Promise.all([post1.createComment({
          title: 'I am a post comment'
        }), image1.addComment(commentA), question1.setComments([commentB])]);

        const comments = await this.Comment.findAll();
        comments.forEach(comment => {
          expect(comment.get('commentable')).to.be.ok;
        });
        expect(comments.map(comment => {
          return comment.get('commentable');
        }).sort()).to.deep.equal(['image', 'post', 'question']);

        const [postComments, imageComments, questionComments] = await Promise.all([
          this.post.getComments(),
          this.image.getComments(),
          this.question.getComments()
        ]);

        expect(postComments.length).to.equal(1);
        expect(postComments[0].get('title')).to.equal('I am a post comment');
        expect(imageComments.length).to.equal(1);
        expect(imageComments[0].get('title')).to.equal('I am a image comment');
        expect(questionComments.length).to.equal(1);
        expect(questionComments[0].get('title')).to.equal('I am a question comment');

        const [postComment, imageComment, questionComment] = [postComments[0], imageComments[0], questionComments[0]];
        const [post0, image0, question0] = await Promise.all([postComment.getItem(), imageComment.getItem(), questionComment.getItem()]);
        expect(post0).to.be.instanceof(this.Post);
        expect(image0).to.be.instanceof(this.Image);
        expect(question0).to.be.instanceof(this.Question);

        const [post, image, question] = await Promise.all([this.Post.findOne({
          include: [this.Comment]
        }), this.Image.findOne({
          include: [this.Comment]
        }), this.Question.findOne({
          include: [this.Comment]
        })]);

        expect(post.comments.length).to.equal(1);
        expect(post.comments[0].get('title')).to.equal('I am a post comment');
        expect(image.comments.length).to.equal(1);
        expect(image.comments[0].get('title')).to.equal('I am a image comment');
        expect(question.comments.length).to.equal(1);
        expect(question.comments[0].get('title')).to.equal('I am a question comment');
      });
      it('should make the same query if called multiple time (#4470)', async function() {
        const logs = [];
        const logging = function(log) {
          //removing 'executing(<uuid> || 'default'}) :' from logs
          logs.push(log.substring(log.indexOf(':') + 1));
        };

        await this.sequelize.sync({ force: true });
        const post = await this.Post.create();

        await post.createComment({
          title: 'I am a post comment'
        });

        await this.Post.scope('withComments').findAll({
          logging
        });

        await this.Post.scope('withComments').findAll({
          logging
        });

        expect(logs[0]).to.equal(logs[1]);
      });
      it('should created included association with scope values', async function() {
        await this.sequelize.sync({ force: true });
        let post = await this.Post.create({
          comments: [{
            title: 'I am a comment created with a post'
          }, {
            title: 'I am a second comment created with a post'
          }]
        }, {
          include: [{ model: this.Comment, as: 'comments' }]
        });
        this.post = post;
        for (const comment of  post.comments) {
          expect(comment.get('commentable')).to.equal('post');
        }
        post = await this.Post.scope('withComments').findByPk(this.post.id);
        for (const comment of  post.comments) {
          expect(comment.get('commentable')).to.equal('post');
        }
      });
      it('should include associations with operator scope values', async function() {
        await this.sequelize.sync({ force: true });

        const [post0, commentA, commentB, commentC] = await Promise.all([this.Post.create(), this.Comment.create({
          title: 'I am a blue comment',
          type: 'blue'
        }), this.Comment.create({
          title: 'I am a red comment',
          type: 'red'
        }), this.Comment.create({
          title: 'I am a green comment',
          type: 'green'
        })]);

        this.post = post0;
        await post0.addComments([commentA, commentB, commentC]);

        const post = await this.Post.findByPk(this.post.id, {
          include: [{
            model: this.Comment,
            as: 'coloredComments'
          }]
        });

        expect(post.coloredComments.length).to.equal(2);
        for (const comment of post.coloredComments) {
          expect(comment.type).to.match(/blue|green/);
        }
      });
      it('should not mutate scope when running SELECT query (#12868)', async function() {
        await this.sequelize.sync({ force: true });
        await this.Post.findOne({ where: {}, include: [{ association: this.Post.associations.mainComment, attributes: ['id'], required: true, where: {} }] });
        expect(this.Post.associations.mainComment.scope.isMain).to.equal(true);
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

          it('[Flaky] should create, find and include associations with scope values', async function() {
            await Promise.all([this.Post.sync({ force: true }), this.Tag.sync({ force: true })]);
            await this.PostTag.sync({ force: true });

            const [postA0, postB0, postC0, categoryA, categoryB, tagA, tagB] = await Promise.all([
              this.Post.create(),
              this.Post.create(),
              this.Post.create(),
              this.Tag.create({ type: 'category' }),
              this.Tag.create({ type: 'category' }),
              this.Tag.create({ type: 'tag' }),
              this.Tag.create({ type: 'tag' })
            ]);

            this.postA = postA0;
            this.postB = postB0;
            this.postC = postC0;

            await Promise.all([
              postA0.addCategory(categoryA),
              postA0.createTag(),
              postB0.setCategories([categoryB]),
              postB0.addTag(tagA),
              postC0.createCategory(),
              postC0.setTags([tagB])
            ]);

            const [postACategories, postBCategories, postCCategories, postATags, postBTags, postCTags] = await Promise.all([
              this.postA.getCategories(),
              this.postB.getCategories(),
              this.postC.getCategories(),
              this.postA.getTags(),
              this.postB.getTags(),
              this.postC.getTags()
            ]);

            // Flaky test: randomly one of the value on B will be 0 sometimes, for
            // now no solution. Not reproducible at local or cloud with logging enabled
            expect([
              postACategories.length,
              postATags.length,
              postBCategories.length,
              postBTags.length,
              postCCategories.length,
              postCTags.length
            ]).to.eql([1, 1, 1, 1, 1, 1]);

            expect([
              postACategories[0].get('type'),
              postATags[0].get('type'),
              postBCategories[0].get('type'),
              postBTags[0].get('type'),
              postCCategories[0].get('type'),
              postCTags[0].get('type')
            ]).to.eql(['category', 'tag', 'category', 'tag', 'category', 'tag']);

            const [postA, postB, postC] = await Promise.all([this.Post.findOne({
              where: {
                id: this.postA.get('id')
              },
              include: [
                { model: this.Tag, as: 'tags' },
                { model: this.Tag, as: 'categories' }
              ]
            }), this.Post.findOne({
              where: {
                id: this.postB.get('id')
              },
              include: [
                { model: this.Tag, as: 'tags' },
                { model: this.Tag, as: 'categories' }
              ]
            }), this.Post.findOne({
              where: {
                id: this.postC.get('id')
              },
              include: [
                { model: this.Tag, as: 'tags' },
                { model: this.Tag, as: 'categories' }
              ]
            })]);

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

          it('should create, find and include associations with scope values', async function() {
            await Promise.all([
              this.Post.sync({ force: true }),
              this.Image.sync({ force: true }),
              this.Question.sync({ force: true }),
              this.Tag.sync({ force: true })
            ]);

            await this.ItemTag.sync({ force: true });

            const [post0, image0, question0, tagA, tagB, tagC] = await Promise.all([
              this.Post.create(),
              this.Image.create(),
              this.Question.create(),
              this.Tag.create({ name: 'tagA' }),
              this.Tag.create({ name: 'tagB' }),
              this.Tag.create({ name: 'tagC' })
            ]);

            this.post = post0;
            this.image = image0;
            this.question = question0;

            await Promise.all([post0.setTags([tagA]).then(async () => {
              return Promise.all([post0.createTag({ name: 'postTag' }), post0.addTag(tagB)]);
            }), image0.setTags([tagB]).then(async () => {
              return Promise.all([image0.createTag({ name: 'imageTag' }), image0.addTag(tagC)]);
            }), question0.setTags([tagC]).then(async () => {
              return Promise.all([question0.createTag({ name: 'questionTag' }), question0.addTag(tagA)]);
            })]);

            const [postTags, imageTags, questionTags] = await Promise.all([this.post.getTags(), this.image.getTags(), this.question.getTags()]);
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

            const [post, image, question] = await Promise.all([this.Post.findOne({
              where: {},
              include: [this.Tag]
            }), this.Image.findOne({
              where: {},
              include: [this.Tag]
            }), this.Question.findOne({
              where: {},
              include: [this.Tag]
            })]);

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
    }
  });
});
