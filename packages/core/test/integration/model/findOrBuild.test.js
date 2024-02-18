'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes } = require('@sequelize/core');

describe('Model#findOrBuild', () => {
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

    describe('returns an instance if it already exists', () => {
      it('with a single find field', async function () {
        const user = await this.User.create({ username: 'Username' });
        const [_user, initialized] = await this.User.findOrBuild({
          where: { username: user.username },
        });
        expect(_user.id).to.equal(user.id);
        expect(_user.username).to.equal('Username');
        expect(initialized).to.be.false;
      });

      it('with multiple find fields', async function () {
        const user = await this.User.create({ username: 'Username', age: 27 });
        const [_user, initialized] = await this.User.findOrBuild({
          where: {
            username: user.username,
            age: user.age,
          },
        });
        expect(_user.id).to.equal(user.id);
        expect(_user.username).to.equal('Username');
        expect(_user.age).to.equal(27);
        expect(initialized).to.be.false;
      });

      it('builds a new instance with default value.', async function () {
        const [user, initialized] = await this.User.findOrBuild({
          where: { username: 'Username' },
          defaults: { age: 27 },
        });
        expect(user.id).to.be.null;
        expect(user.username).to.equal('Username');
        expect(user.age).to.equal(27);
        expect(initialized).to.be.true;
        expect(user.isNewRecord).to.be.true;
      });
    });

    it('initialize with includes', async function () {
      const [, user2] = await this.User.bulkCreate(
        [
          { username: 'Mello', age: 10 },
          { username: 'Mello', age: 20 },
        ],
        { returning: true },
      );

      const project = await this.Project.create({
        name: 'Investigate',
      });

      await user2.setProjects([project]);

      const [user, created] = await this.User.findOrBuild({
        defaults: {
          username: 'Mello',
          age: 10,
        },
        where: {
          age: 20,
        },
        include: [
          {
            model: this.Project,
          },
        ],
      });

      expect(created).to.be.false;
      expect(user.get('id')).to.be.ok;
      expect(user.get('username')).to.equal('Mello');
      expect(user.get('age')).to.equal(20);

      expect(user.projects).to.have.length(1);
      expect(user.projects[0].get('name')).to.equal('Investigate');
    });
  });

  context('test-specific models', () => {
    if (Support.sequelize.dialect.supports.transactions) {
      it('supports transactions', async function () {
        const sequelize = await Support.createSingleTransactionalTestSequelizeInstance(
          this.sequelize,
        );
        const User = sequelize.define('User', {
          username: DataTypes.STRING,
          foo: DataTypes.STRING,
        });

        await User.sync({ force: true });
        const t = await sequelize.startUnmanagedTransaction();
        await User.create({ username: 'foo' }, { transaction: t });
        const [user1] = await User.findOrBuild({
          where: { username: 'foo' },
        });
        const [user2] = await User.findOrBuild({
          where: { username: 'foo' },
          transaction: t,
        });
        const [user3] = await User.findOrBuild({
          where: { username: 'foo' },
          defaults: { foo: 'asd' },
          transaction: t,
        });
        expect(user1.isNewRecord).to.be.true;
        expect(user2.isNewRecord).to.be.false;
        expect(user3.isNewRecord).to.be.false;
        await t.commit();
      });
    }
  });
});
