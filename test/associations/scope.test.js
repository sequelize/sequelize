"use strict";

/* jshint camelcase: false, expr: true */
var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + "/../../lib/data-types")
  , Sequelize = require('../../index')
  , Promise   = Sequelize.Promise
  , assert    = require('assert');

chai.config.includeStack = true;

describe(Support.getTestDialectTeaser("associations"), function() {
	describe('scope', function () {
		beforeEach(function () {
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
						return this['get'+this.get('commentable').substr(0, 1).toUpperCase()+this.get('commentable').substr(1)]();
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
				as: 'post',
				scope: {
					commentable: 'post'
				}
			});

			this.Image.hasMany(this.Comment, {
				foreignKey: 'commentable_id',
				scope: {
					commentable: 'image'
				}
			});
			this.Comment.belongsTo(this.Image, {
				foreignKey: 'commentable_id',
				as: 'image',
				scope: {
					commentable: 'image'
				}
			});

			this.Question.hasMany(this.Comment, {
				foreignKey: 'commentable_id',
				scope: {
					commentable: 'question'
				}
			});
			this.Comment.belongsTo(this.Question, {
				foreignKey: 'commentable_id',
				as: 'question',
				scope: {
					commentable: 'question'
				}
			});
		});

		it('should create associations and find association with scope values', function () {
			var self = this;
			return this.sequelize.sync({force: true}).then(function () {
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
			}).bind(this).spread(function (post, image, question, commentA, commentB) {
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
			}).then(function () {
				return self.Comment.findAll();
			}).then(function (comments) {
				comments.forEach(function (comment) {
					expect(comment.get('commentable')).to.be.ok;
				});
				expect(comments.map(function (comment) {
					return comment.get('commentable');
				}).sort()).to.deep.equal(['image', 'post', 'question']);
			}).then(function () {
				return Promise.join(
					this.post.getComments(),
					this.image.getComments(),
					this.question.getComments()
				);
			}).spread(function (postComments, imageComments, questionComments) {
				expect(postComments.length).to.equal(1);
				expect(postComments[0].get('title')).to.equal('I am a post comment');
				expect(imageComments.length).to.equal(1);
				expect(imageComments[0].get('title')).to.equal('I am a image comment');
				expect(questionComments.length).to.equal(1);
				expect(questionComments[0].get('title')).to.equal('I am a question comment');

				return [postComments[0], imageComments[0], questionComments[0]];
			}).spread(function (postComment, imageComment, questionComment) {
				return Promise.join(
					postComment.getItem(),
					imageComment.getItem(),
					questionComment.getItem()
				);
			}).spread(function (post, image, question) {
				expect(post.Model).to.equal(self.Post);
				expect(image.Model).to.equal(self.Image);
				expect(question.Model).to.equal(self.Question);
			});
		});
	});
});