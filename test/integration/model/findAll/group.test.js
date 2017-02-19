'use strict';

/* jshint -W030 */
var chai = require('chai')
, expect = chai.expect
, Support = require(__dirname + '/../../support')
, Sequelize = Support.Sequelize
, DataTypes = require(__dirname + '/../../../../lib/data-types')
, current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), function() {
  describe('findAll', function () {
    describe('group', function () {
      it('should correctly group with attributes, #3009', function() {

        var Post = current.define('Post', {
          id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
          name: { type: DataTypes.STRING, allowNull: false }
        });

        var Comment = current.define('Comment', {
          id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
          text: { type: DataTypes.STRING, allowNull: false }
        });

        Post.hasMany(Comment);

        return current.sync({ force: true }).then(function() {
          // Create an enviroment
          return Post.bulkCreate([
            { name: 'post-1' },
            { name: 'post-2' }
          ]);
        }).then(function(u) {
          return Comment.bulkCreate([
            { text: 'Market', PostId: 1},
            { text: 'Text', PostId: 2},
            { text: 'Abc', PostId: 2},
            { text: 'Semaphor', PostId: 1},
            { text: 'Text', PostId: 1},
          ]);
        }).then(function(p) {
          return Post.findAll({
            attributes: [ [ Sequelize.fn('COUNT', Sequelize.col('Comments.id')), 'comment_count' ] ],
            include: [
              { model: Comment, attributes: [] }
            ],
            group: [ 'Post.id' ]
          });
        }).then(function(posts) {
          expect(parseInt(posts[0].get('comment_count'))).to.be.equal(3);
          expect(parseInt(posts[1].get('comment_count'))).to.be.equal(2);
        });
      });
    });
  });
});
