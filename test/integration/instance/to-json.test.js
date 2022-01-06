'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types');

describe(Support.getTestDialectTeaser('Instance'), () => {
  describe('toJSON', () => {
    beforeEach(async function() {
      this.User = this.sequelize.define('User', {
        username: { type: DataTypes.STRING },
        age: DataTypes.INTEGER,
        level: { type: DataTypes.INTEGER },
        isUser: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        },
        isAdmin: { type: DataTypes.BOOLEAN }
      }, {
        timestamps: false
      });

      this.Project = this.sequelize.define('NiceProject', { title: DataTypes.STRING }, { timestamps: false });

      this.User.hasMany(this.Project, { as: 'Projects', foreignKey: 'lovelyUserId' });
      this.Project.belongsTo(this.User, { as: 'LovelyUser', foreignKey: 'lovelyUserId' });

      await this.User.sync({ force: true });

      await this.Project.sync({ force: true });
    });

    it("doesn't return instance that isn't defined", async function() {
      const project0 = await this.Project.create({ lovelyUserId: null });

      const project = await this.Project.findOne({
        where: {
          id: project0.id
        },
        include: [
          { model: this.User, as: 'LovelyUser' }
        ]
      });

      const json = project.toJSON();
      expect(json.LovelyUser).to.be.equal(null);
    });

    it("doesn't return instances that aren't defined", async function() {
      const user0 = await this.User.create({ username: 'cuss' });

      const user = await this.User.findOne({
        where: {
          id: user0.id
        },
        include: [
          { model: this.Project, as: 'Projects' }
        ]
      });

      expect(user.Projects).to.be.instanceof(Array);
      expect(user.Projects).to.be.length(0);
    });

    describe('build', () => {
      it('returns an object containing all values', function() {
        const user = this.User.build({
          username: 'Adam',
          age: 22,
          level: -1,
          isUser: false,
          isAdmin: true
        });

        expect(user.toJSON()).to.deep.equal({
          id: null,
          username: 'Adam',
          age: 22,
          level: -1,
          isUser: false,
          isAdmin: true
        });
      });

      it('returns a response that can be stringified', function() {
        const user = this.User.build({
          username: 'test.user',
          age: 99,
          isAdmin: true,
          isUser: false
        });
        expect(JSON.stringify(user)).to.deep.equal('{"id":null,"username":"test.user","age":99,"isAdmin":true,"isUser":false}');
      });

      it('returns a response that can be stringified and then parsed', function() {
        const user = this.User.build({ username: 'test.user', age: 99, isAdmin: true });
        expect(JSON.parse(JSON.stringify(user))).to.deep.equal({ username: 'test.user', age: 99, isAdmin: true, isUser: false, id: null });
      });
    });

    describe('create', () => {
      it('returns an object containing all values', async function() {
        const user = await this.User.create({
          username: 'Adam',
          age: 22,
          level: -1,
          isUser: false,
          isAdmin: true
        });

        expect(user.toJSON()).to.deep.equal({
          id: user.get('id'),
          username: 'Adam',
          age: 22,
          isUser: false,
          isAdmin: true,
          level: -1
        });
      });

      it('returns a response that can be stringified', async function() {
        const user = await this.User.create({
          username: 'test.user',
          age: 99,
          isAdmin: true,
          isUser: false,
          level: null
        });

        expect(JSON.stringify(user)).to.deep.equal(`{"id":${user.get('id')},"username":"test.user","age":99,"isAdmin":true,"isUser":false,"level":null}`);
      });

      it('returns a response that can be stringified and then parsed', async function() {
        const user = await this.User.create({
          username: 'test.user',
          age: 99,
          isAdmin: true,
          level: null
        });

        expect(JSON.parse(JSON.stringify(user))).to.deep.equal({
          age: 99,
          id: user.get('id'),
          isAdmin: true,
          isUser: false,
          level: null,
          username: 'test.user'
        });
      });
    });

    describe('find', () => {
      it('returns an object containing all values', async function() {
        const user0 = await this.User.create({
          username: 'Adam',
          age: 22,
          level: -1,
          isUser: false,
          isAdmin: true
        });

        const user = await this.User.findByPk(user0.get('id'));
        expect(user.toJSON()).to.deep.equal({
          id: user.get('id'),
          username: 'Adam',
          age: 22,
          level: -1,
          isUser: false,
          isAdmin: true
        });
      });

      it('returns a response that can be stringified', async function() {
        const user0 = await this.User.create({
          username: 'test.user',
          age: 99,
          isAdmin: true,
          isUser: false
        });

        const user = await this.User.findByPk(user0.get('id'));
        expect(JSON.stringify(user)).to.deep.equal(`{"id":${user.get('id')},"username":"test.user","age":99,"level":null,"isUser":false,"isAdmin":true}`);
      });

      it('returns a response that can be stringified and then parsed', async function() {
        const user0 = await this.User.create({
          username: 'test.user',
          age: 99,
          isAdmin: true
        });

        const user = await this.User.findByPk(user0.get('id'));
        expect(JSON.parse(JSON.stringify(user))).to.deep.equal({
          id: user.get('id'),
          username: 'test.user',
          age: 99,
          isAdmin: true,
          isUser: false,
          level: null
        });
      });
    });

    it('includes the eagerly loaded associations', async function() {
      const user = await this.User.create({ username: 'fnord', age: 1, isAdmin: true });
      const project = await this.Project.create({ title: 'fnord' });
      await user.setProjects([project]);
      const users = await this.User.findAll({ include: [{ model: this.Project, as: 'Projects' }] });
      const _user = users[0];

      expect(_user.Projects).to.exist;
      expect(JSON.parse(JSON.stringify(_user)).Projects).to.exist;

      const projects = await this.Project.findAll({ include: [{ model: this.User, as: 'LovelyUser' }] });
      const _project = projects[0];

      expect(_project.LovelyUser).to.exist;
      expect(JSON.parse(JSON.stringify(_project)).LovelyUser).to.exist;
    });
  });
});
