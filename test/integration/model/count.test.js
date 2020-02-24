'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('../../../lib/data-types');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('count', () => {
    beforeEach(function() {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        age: DataTypes.INTEGER
      });
      this.Project = this.sequelize.define('Project', {
        name: DataTypes.STRING
      });
  
      this.User.hasMany(this.Project);
      this.Project.belongsTo(this.User);
  
      return this.sequelize.sync({ force: true });
    });

    it('should count rows', function() {
      return this.User.bulkCreate([
        { username: 'foo' },
        { username: 'bar' }
      ]).then(() => {
        return expect(this.User.count()).to.eventually.equal(2);
      });
    });

    it('should support include', function() {
      return this.User.bulkCreate([
        { username: 'foo' },
        { username: 'bar' }
      ]).then(() => this.User.findOne())
        .then(user => user.createProject({ name: 'project1' }))
        .then(() => {
          return expect(this.User.count({
            include: [{
              model: this.Project,
              where: { name: 'project1' }
            }]
          })).to.eventually.equal(1);
        });
    });

    it('should count groups correctly and return attributes', function() {
      return this.User.bulkCreate([
        { username: 'foo' },
        { username: 'bar' },
        {
          username: 'valak',
          createdAt: new Date().setFullYear(2015)
        }
      ]).then(() => this.User.count({
        attributes: ['createdAt'],
        group: ['createdAt']
      })).then(users => {
        expect(users.length).to.be.eql(2);
        expect(users[0].createdAt).to.exist;
        expect(users[1].createdAt).to.exist;
      });
    });

    it('should not return NaN', function() {
      return this.User.bulkCreate([
        { username: 'valak', age: 10 },
        { username: 'conjuring', age: 20 },
        { username: 'scary', age: 10 }
      ]).then(() => this.User.count({
        where: { age: 10 },
        group: ['age'],
        order: ['age']
      })).then(result => {
        // TODO: `parseInt` should not be needed, see #10533
        expect(parseInt(result[0].count, 10)).to.be.eql(2);
        return this.User.count({
          where: { username: 'fire' }
        });
      }).then(count => {
        expect(count).to.be.eql(0);
        return this.User.count({
          where: { username: 'fire' },
          group: 'age'
        });
      }).then(count => {
        expect(count).to.be.eql([]);
      });
    });

    it('should be able to specify column for COUNT()', function() {
      return this.User.bulkCreate([
        { username: 'ember', age: 10 },
        { username: 'angular', age: 20 },
        { username: 'mithril', age: 10 }
      ]).then(() => this.User.count({ col: 'username' }))
        .then(count => {
          expect(count).to.be.eql(3);
          return this.User.count({
            col: 'age',
            distinct: true
          });
        })
        .then(count => {
          expect(count).to.be.eql(2);
        });
    });

    it('should be able to specify NO column for COUNT() with DISTINCT', function() {
      return this.User.bulkCreate([
        { username: 'ember', age: 10 },
        { username: 'angular', age: 20 },
        { username: 'mithril', age: 10 }
      ]).then(() => {
        return this.User.count({
          distinct: true
        });
      })
        .then(count => {
          expect(count).to.be.eql(3);
        });
    });

    it('should be able to use where clause on included models', function() {
      const countOptions = {
        col: 'username',
        include: [this.Project],
        where: {
          '$Projects.name$': 'project1'
        }
      };
      return this.User.bulkCreate([
        { username: 'foo' },
        { username: 'bar' }
      ]).then(() => this.User.findOne())
        .then(user => user.createProject({ name: 'project1' }))
        .then(() => {
          return this.User.count(countOptions).then(count => {
            expect(count).to.be.eql(1);
            countOptions.where['$Projects.name$'] = 'project2';
            return this.User.count(countOptions);
          });
        })
        .then(count => {
          expect(count).to.be.eql(0);
        });
    });

    it('should be able to specify column for COUNT() with includes', function() {
      return this.User.bulkCreate([
        { username: 'ember', age: 10 },
        { username: 'angular', age: 20 },
        { username: 'mithril', age: 10 }
      ]).then(() => this.User.count({
        col: 'username',
        distinct: true,
        include: [this.Project]
      })).then(count => {
        expect(count).to.be.eql(3);
        return this.User.count({
          col: 'age',
          distinct: true,
          include: [this.Project]
        });
      }).then(count => {
        expect(count).to.be.eql(2);
      });
    });

    it('should work correctly with include and whichever raw option', function() {
      const Post = this.sequelize.define('Post', {});
      this.User.hasMany(Post);
      return Post.sync({ force: true })
        .then(() => Promise.all([this.User.create({}), Post.create({})]))
        .then(([user, post]) => user.addPost(post))
        .then(() => Promise.all([
          this.User.count(),
          this.User.count({ raw: undefined }),
          this.User.count({ raw: false }),
          this.User.count({ raw: true }),
          this.User.count({ include: Post }),
          this.User.count({ include: Post, raw: undefined }),
          this.User.count({ include: Post, raw: false }),
          this.User.count({ include: Post, raw: true })
        ]))
        .then(counts => {
          expect(counts).to.deep.equal([1, 1, 1, 1, 1, 1, 1, 1]);
        });
    });

  });
});
