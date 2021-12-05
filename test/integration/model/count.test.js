'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types');

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('count', () => {
    beforeEach(async function() {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        age: DataTypes.INTEGER
      });
      this.Project = this.sequelize.define('Project', {
        name: DataTypes.STRING
      });

      this.User.hasMany(this.Project);
      this.Project.belongsTo(this.User);

      await this.sequelize.sync({ force: true });
    });

    it('should count rows', async function() {
      await this.User.bulkCreate([
        { username: 'foo' },
        { username: 'bar' }
      ]);

      await expect(this.User.count()).to.eventually.equal(2);
    });

    it('should support include', async function() {
      await this.User.bulkCreate([
        { username: 'foo' },
        { username: 'bar' }
      ]);

      const user = await this.User.findOne();
      await user.createProject({ name: 'project1' });

      await expect(this.User.count({
        include: [{
          model: this.Project,
          where: { name: 'project1' }
        }]
      })).to.eventually.equal(1);
    });

    it('should count groups correctly and return attributes', async function() {
      await this.User.bulkCreate([
        { username: 'foo' },
        { username: 'bar' },
        {
          username: 'valak',
          createdAt: new Date().setFullYear(2015)
        }
      ]);

      const users = await this.User.count({
        attributes: ['createdAt'],
        group: ['createdAt']
      });

      expect(users.length).to.be.eql(2);
      expect(users[0].createdAt).to.exist;
      expect(users[1].createdAt).to.exist;
    });

    it('should not return NaN', async function() {
      await this.User.bulkCreate([
        { username: 'valak', age: 10 },
        { username: 'conjuring', age: 20 },
        { username: 'scary', age: 10 }
      ]);

      const result = await this.User.count({
        where: { age: 10 },
        group: ['age'],
        order: ['age']
      });

      // TODO: `parseInt` should not be needed, see #10533
      expect(parseInt(result[0].count, 10)).to.be.eql(2);

      const count0 = await this.User.count({
        where: { username: 'fire' }
      });

      expect(count0).to.be.eql(0);

      const count = await this.User.count({
        where: { username: 'fire' },
        group: 'age'
      });

      expect(count).to.be.eql([]);
    });

    it('should be able to specify column for COUNT()', async function() {
      await this.User.bulkCreate([
        { username: 'ember', age: 10 },
        { username: 'angular', age: 20 },
        { username: 'mithril', age: 10 }
      ]);

      const count0 = await this.User.count({ col: 'username' });
      expect(count0).to.be.eql(3);

      const count = await this.User.count({
        col: 'age',
        distinct: true
      });

      expect(count).to.be.eql(2);
    });

    it('should be able to specify NO column for COUNT() with DISTINCT', async function() {
      await this.User.bulkCreate([
        { username: 'ember', age: 10 },
        { username: 'angular', age: 20 },
        { username: 'mithril', age: 10 }
      ]);

      const count = await this.User.count({
        distinct: true
      });

      expect(count).to.be.eql(3);
    });

    it('should be able to use where clause on included models', async function() {
      const countOptions = {
        col: 'username',
        include: [this.Project],
        where: {
          '$Projects.name$': 'project1'
        }
      };

      await this.User.bulkCreate([
        { username: 'foo' },
        { username: 'bar' }
      ]);

      const user = await this.User.findOne();
      await user.createProject({ name: 'project1' });
      const count0 = await this.User.count(countOptions);
      expect(count0).to.be.eql(1);
      countOptions.where['$Projects.name$'] = 'project2';
      const count = await this.User.count(countOptions);
      expect(count).to.be.eql(0);
    });

    it('should be able to specify column for COUNT() with includes', async function() {
      await this.User.bulkCreate([
        { username: 'ember', age: 10 },
        { username: 'angular', age: 20 },
        { username: 'mithril', age: 10 }
      ]);

      const count0 = await this.User.count({
        col: 'username',
        distinct: true,
        include: [this.Project]
      });

      expect(count0).to.be.eql(3);

      const count = await this.User.count({
        col: 'age',
        distinct: true,
        include: [this.Project]
      });

      expect(count).to.be.eql(2);
    });

    it('should work correctly with include and whichever raw option', async function() {
      const Post = this.sequelize.define('Post', {});
      this.User.hasMany(Post);
      await Post.sync({ force: true });
      const [user, post] = await Promise.all([this.User.create({}), Post.create({})]);
      await user.addPost(post);

      const counts = await Promise.all([
        this.User.count(),
        this.User.count({ raw: undefined }),
        this.User.count({ raw: false }),
        this.User.count({ raw: true }),
        this.User.count({ include: Post }),
        this.User.count({ include: Post, raw: undefined }),
        this.User.count({ include: Post, raw: false }),
        this.User.count({ include: Post, raw: true })
      ]);

      expect(counts).to.deep.equal([1, 1, 1, 1, 1, 1, 1, 1]);
    });

  });
});
