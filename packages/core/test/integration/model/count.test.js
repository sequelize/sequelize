'use strict';

const chai = require('chai');

const expect = chai.expect;
const { DataTypes, Op } = require('@sequelize/core');
const Support = require('../support');
const sinon = require('sinon');

const dialectName = Support.sequelize.dialect.name;

describe('Model.count', () => {
  context('test-shared models', () => {
    beforeEach(async function () {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        age: DataTypes.INTEGER,
      });
      this.Project = this.sequelize.define('Project', {
        name: DataTypes.STRING,
      });

      this.User.hasMany(this.Project);
      this.Project.belongsTo(this.User);

      await this.sequelize.sync({ force: true });
    });

    it('counts all created objects', async function () {
      await this.User.bulkCreate([{ username: 'user1' }, { username: 'user2' }]);
      expect(await this.User.count()).to.equal(2);
    });

    it('returns multiple rows when using group', async function () {
      await this.User.bulkCreate([
        { username: 'user1' },
        { username: 'user1' },
        { username: 'user2' },
      ]);

      const count = await this.User.count({
        attributes: ['username'],
        group: ['username'],
      });
      expect(count).to.have.lengthOf(2);

      // The order of count varies across dialects; Hence find element by identified first.
      expect(count.find(i => i.username === 'user1')).to.deep.equal({
        username: 'user1',
        count: 2,
      });
      expect(count.find(i => i.username === 'user2')).to.deep.equal({
        username: 'user2',
        count: 1,
      });
    });

    if (dialectName !== 'mssql' && dialectName !== 'db2' && dialectName !== 'ibmi') {
      describe('aggregate', () => {
        it('allows grouping by aliased attribute', async function () {
          await this.User.aggregate('id', 'count', {
            attributes: [['id', 'id2']],
            group: ['id2'],
          });
        });
      });
    }

    describe('options sent to aggregate', () => {
      let options;
      let aggregateSpy;

      beforeEach(function () {
        options = { where: { username: 'user1' } };

        aggregateSpy = sinon.spy(this.User, 'aggregate');
      });

      afterEach(() => {
        expect(aggregateSpy).to.have.been.calledWith(
          sinon.match.any,
          sinon.match.any,
          sinon.match.object.and(sinon.match.has('where', { username: 'user1' })),
        );

        aggregateSpy.restore();
      });

      it('modifies option "limit" by setting it to null', async function () {
        options.limit = 5;

        await this.User.count(options);
        expect(aggregateSpy).to.have.been.calledWith(
          sinon.match.any,
          sinon.match.any,
          sinon.match.object.and(sinon.match.has('limit', null)),
        );
      });

      it('modifies option "offset" by setting it to null', async function () {
        options.offset = 10;

        await this.User.count(options);
        expect(aggregateSpy).to.have.been.calledWith(
          sinon.match.any,
          sinon.match.any,
          sinon.match.object.and(sinon.match.has('offset', null)),
        );
      });

      it('modifies option "order" by setting it to null', async function () {
        options.order = 'username';

        await this.User.count(options);
        expect(aggregateSpy).to.have.been.calledWith(
          sinon.match.any,
          sinon.match.any,
          sinon.match.object.and(sinon.match.has('order', null)),
        );
      });
    });

    it('allows sql logging', async function () {
      let test = false;
      await this.User.count({
        logging(sql) {
          test = true;
          expect(sql).to.exist;
          expect(sql.toUpperCase()).to.include('SELECT');
        },
      });
      expect(test).to.be.true;
    });

    it('filters object', async function () {
      await this.User.create({ username: 'user1' });
      await this.User.create({ username: 'foo' });
      const count = await this.User.count({ where: { username: { [Op.like]: '%us%' } } });
      expect(count).to.equal(1);
    });

    it('supports distinct option', async function () {
      const Post = this.sequelize.define('Post', {});
      const PostComment = this.sequelize.define('PostComment', {});
      Post.hasMany(PostComment);
      await Post.sync({ force: true });
      await PostComment.sync({ force: true });
      const post = await Post.create({});
      await PostComment.bulkCreate([{ postId: post.id }, { postId: post.id }]);
      const count1 = await Post.count({
        distinct: false,
        include: { model: PostComment, required: false },
      });
      const count2 = await Post.count({
        distinct: true,
        include: { model: PostComment, required: false },
      });
      expect(count1).to.equal(2);
      expect(count2).to.equal(1);
    });

    it('should count rows', async function () {
      await this.User.bulkCreate([{ username: 'foo' }, { username: 'bar' }]);

      await expect(this.User.count()).to.eventually.equal(2);
    });

    it('should support include', async function () {
      await this.User.bulkCreate([{ username: 'foo' }, { username: 'bar' }]);

      const user = await this.User.findOne();
      await user.createProject({ name: 'project1' });

      await expect(
        this.User.count({
          include: [
            {
              model: this.Project,
              where: { name: 'project1' },
            },
          ],
        }),
      ).to.eventually.equal(1);
    });

    it('should count groups correctly and return attributes', async function () {
      await this.User.bulkCreate([
        { username: 'foo' },
        { username: 'bar' },
        {
          username: 'valak',
          createdAt: new Date().setFullYear(2015),
        },
      ]);

      const users = await this.User.count({
        attributes: ['createdAt'],
        group: ['createdAt'],
      });

      expect(users.length).to.be.eql(2);
      expect(users[0].createdAt).to.exist;
      expect(users[1].createdAt).to.exist;
    });

    it('should not return NaN', async function () {
      await this.User.bulkCreate([
        { username: 'valak', age: 10 },
        { username: 'conjuring', age: 20 },
        { username: 'scary', age: 10 },
      ]);

      const result = await this.User.count({
        where: { age: 10 },
        group: ['age'],
        order: ['age'],
      });

      // TODO: `parseInt` should not be needed, see #10533
      expect(Number.parseInt(result[0].count, 10)).to.be.eql(2);

      const count0 = await this.User.count({
        where: { username: 'fire' },
      });

      expect(count0).to.be.eql(0);

      const count = await this.User.count({
        where: { username: 'fire' },
        group: 'age',
      });

      expect(count).to.be.eql([]);
    });

    it('should be able to specify column for COUNT()', async function () {
      await this.User.bulkCreate([
        { username: 'ember', age: 10 },
        { username: 'angular', age: 20 },
        { username: 'mithril', age: 10 },
      ]);

      const count0 = await this.User.count({ col: 'username' });
      expect(count0).to.be.eql(3);

      const count = await this.User.count({
        col: 'age',
        distinct: true,
      });

      expect(count).to.be.eql(2);
    });

    it('should be able to specify NO column for COUNT() with DISTINCT', async function () {
      await this.User.bulkCreate([
        { username: 'ember', age: 10 },
        { username: 'angular', age: 20 },
        { username: 'mithril', age: 10 },
      ]);

      const count = await this.User.count({
        distinct: true,
      });

      expect(count).to.be.eql(3);
    });

    it('should be able to use where clause on included models', async function () {
      const countOptions = {
        col: 'username',
        include: [this.Project],
        where: {
          '$projects.name$': 'project1',
        },
      };

      await this.User.bulkCreate([{ username: 'foo' }, { username: 'bar' }]);

      const user = await this.User.findOne();
      await user.createProject({ name: 'project1' });
      const count0 = await this.User.count(countOptions);
      expect(count0).to.be.eql(1);
      countOptions.where['$projects.name$'] = 'project2';
      const count = await this.User.count(countOptions);
      expect(count).to.be.eql(0);
    });

    it('should be able to specify column for COUNT() with includes', async function () {
      await this.User.bulkCreate([
        { username: 'ember', age: 10 },
        { username: 'angular', age: 20 },
        { username: 'mithril', age: 10 },
      ]);

      const count0 = await this.User.count({
        col: 'username',
        distinct: true,
        include: [this.Project],
      });

      expect(count0).to.be.eql(3);

      const count = await this.User.count({
        col: 'age',
        distinct: true,
        include: [this.Project],
      });

      expect(count).to.be.eql(2);
    });

    it('should work correctly with include and whichever raw option', async function () {
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
        this.User.count({ include: Post, raw: true }),
      ]);

      expect(counts).to.deep.equal([1, 1, 1, 1, 1, 1, 1, 1]);
    });

    it('can count grouped rows', async function () {
      await this.User.bulkCreate([
        { username: 'user1', age: 10 },
        { username: 'user2', age: 20 },
        { username: 'user3', age: 30 },
        { username: 'user4', age: 10 },
        { username: 'user5', age: 20 },
        { username: 'user6', age: 30 },
      ]);

      const count = await this.User.count({
        attributes: ['age'],
        group: ['age'],
        countGroupedRows: true,
      });

      expect(count).to.be.eql(3);
    });
  });

  context('test-specific models', () => {
    if (Support.sequelize.dialect.supports.transactions) {
      it('supports transactions', async function () {
        const sequelize = await Support.createSingleTransactionalTestSequelizeInstance(
          this.sequelize,
        );
        const User = sequelize.define('User', { username: DataTypes.STRING });

        await User.sync({ force: true });
        const t = await sequelize.startUnmanagedTransaction();
        await User.create({ username: 'foo' }, { transaction: t });
        const count1 = await User.count();
        const count2 = await User.count({ transaction: t });
        expect(count1).to.equal(0);
        expect(count2).to.equal(1);
        await t.rollback();
      });
    }
  });
});
