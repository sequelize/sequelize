'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../../support'),
  Sequelize = Support.Sequelize,
  DataTypes = require(__dirname + '/../../../../lib/data-types'),
  current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('findAll', () => {
    describe('group', () => {
      it('should correctly group with attributes, #3009', () => {

        const Post = current.define('Post', {
          id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
          name: { type: DataTypes.STRING, allowNull: false }
        });

        const Comment = current.define('Comment', {
          id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
          text: { type: DataTypes.STRING, allowNull: false }
        });

        Post.hasMany(Comment);

        return current.sync({ force: true }).then(() => {
          // Create an enviroment
          return Post.bulkCreate([
            { name: 'post-1' },
            { name: 'post-2' }
          ]);
        }).then(() => {
          return Comment.bulkCreate([
            { text: 'Market', PostId: 1},
            { text: 'Text', PostId: 2},
            { text: 'Abc', PostId: 2},
            { text: 'Semaphor', PostId: 1},
            { text: 'Text', PostId: 1}
          ]);
        }).then(() => {
          return Post.findAll({
            attributes: [ [ Sequelize.fn('COUNT', Sequelize.col('Comments.id')), 'comment_count' ] ],
            include: [
              { model: Comment, attributes: [] }
            ],
            group: [ 'Post.id' ]
          });
        }).then((posts) => {
          expect(parseInt(posts[0].get('comment_count'))).to.be.equal(3);
          expect(parseInt(posts[1].get('comment_count'))).to.be.equal(2);
        });
      });
    });
  });
});
