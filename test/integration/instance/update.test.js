'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  Sequelize = require('sequelize'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
  current = Support.sequelize;

describe(Support.getTestDialectTeaser('Instance'), () => {
  before(function() {
    this.clock = sinon.useFakeTimers();
  });
  after(function() {
    this.clock.restore();
  });

  describe('update', () => {
    beforeEach(async function() {
      this.User = this.sequelize.define('User', {
        username: { type: DataTypes.STRING },
        uuidv1: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV1 },
        uuidv4: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
        touchedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
        aNumber: { type: DataTypes.INTEGER },
        bNumber: { type: DataTypes.INTEGER },
        aDate: { type: DataTypes.DATE },

        validateTest: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: { isInt: true }
        },
        validateCustom: {
          type: DataTypes.STRING,
          allowNull: true,
          validate: { len: { msg: 'Length failed.', args: [1, 20] } }
        },
        validateSideEffect: {
          type: DataTypes.VIRTUAL,
          allowNull: true,
          validate: { isInt: true },
          set(val) {
            this.setDataValue('validateSideEffect', val);
            this.setDataValue('validateSideAffected', val * 2);
          }
        },
        validateSideAffected: {
          type: DataTypes.INTEGER,
          allowNull: true,
          validate: { isInt: true }
        },

        dateAllowNullTrue: {
          type: DataTypes.DATE,
          allowNull: true
        }
      });
      await this.User.sync({ force: true });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', async function() {
        const sequelize = await Support.prepareTransactionTest(this.sequelize);
        const User = sequelize.define('User', { username: Support.Sequelize.STRING });

        await User.sync({ force: true });
        const user = await User.create({ username: 'foo' });
        const t = await sequelize.transaction();
        await user.update({ username: 'bar' }, { transaction: t });
        const users1 = await User.findAll();
        const users2 = await User.findAll({ transaction: t });
        expect(users1[0].username).to.equal('foo');
        expect(users2[0].username).to.equal('bar');
        await t.rollback();
      });
    }

    it('should update fields that are not specified on create', async function() {
      const User = this.sequelize.define(`User${Support.rand()}`, {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
        email: DataTypes.STRING
      });

      await User.sync({ force: true });

      const user1 = await User.create({
        name: 'snafu',
        email: 'email'
      }, {
        fields: ['name', 'email']
      });

      const user0 = await user1.update({ bio: 'swag' });
      const user = await user0.reload();
      expect(user.get('name')).to.equal('snafu');
      expect(user.get('email')).to.equal('email');
      expect(user.get('bio')).to.equal('swag');
    });

    it('should succeed in updating when values are unchanged (without timestamps)', async function() {
      const User = this.sequelize.define(`User${Support.rand()}`, {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
        email: DataTypes.STRING
      }, {
        timestamps: false
      });

      await User.sync({ force: true });

      const user1 = await User.create({
        name: 'snafu',
        email: 'email'
      }, {
        fields: ['name', 'email']
      });

      const user0 = await user1.update({
        name: 'snafu',
        email: 'email'
      });

      const user = await user0.reload();
      expect(user.get('name')).to.equal('snafu');
      expect(user.get('email')).to.equal('email');
    });

    it('should update timestamps with milliseconds', async function() {
      const User = this.sequelize.define(`User${Support.rand()}`, {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
        email: DataTypes.STRING,
        createdAt: { type: DataTypes.DATE(6), allowNull: false },
        updatedAt: { type: DataTypes.DATE(6), allowNull: false }
      }, {
        timestamps: true
      });

      this.clock.tick(2100); //move the clock forward 2100 ms.

      await User.sync({ force: true });

      const user0 = await User.create({
        name: 'snafu',
        email: 'email'
      });

      const user = await user0.reload();
      expect(user.get('name')).to.equal('snafu');
      expect(user.get('email')).to.equal('email');
      const testDate = new Date();
      testDate.setTime(2100);
      expect(user.get('createdAt')).to.equalTime(testDate);
    });

    it('should only save passed attributes', async function() {
      const user = this.User.build();
      await user.save();
      user.set('validateTest', 5);
      expect(user.changed('validateTest')).to.be.ok;

      await user.update({
        validateCustom: '1'
      });

      expect(user.changed('validateTest')).to.be.ok;
      expect(user.validateTest).to.be.equal(5);
      await user.reload();
      expect(user.validateTest).to.not.be.equal(5);
    });

    it('should save attributes affected by setters', async function() {
      const user = this.User.build();
      await user.update({ validateSideEffect: 5 });
      expect(user.validateSideEffect).to.be.equal(5);
      await user.reload();
      expect(user.validateSideAffected).to.be.equal(10);
      expect(user.validateSideEffect).not.to.be.ok;
    });

    describe('hooks', () => {
      it('should update attributes added in hooks when default fields are used', async function() {
        const User = this.sequelize.define(`User${Support.rand()}`, {
          name: DataTypes.STRING,
          bio: DataTypes.TEXT,
          email: DataTypes.STRING
        });

        User.beforeUpdate(instance => {
          instance.set('email', 'B');
        });

        await User.sync({ force: true });

        const user0 = await User.create({
          name: 'A',
          bio: 'A',
          email: 'A'
        });

        await user0.update({
          name: 'B',
          bio: 'B'
        });

        const user = await User.findOne({});
        expect(user.get('name')).to.equal('B');
        expect(user.get('bio')).to.equal('B');
        expect(user.get('email')).to.equal('B');
      });

      it('should update attributes changed in hooks when default fields are used', async function() {
        const User = this.sequelize.define(`User${Support.rand()}`, {
          name: DataTypes.STRING,
          bio: DataTypes.TEXT,
          email: DataTypes.STRING
        });

        User.beforeUpdate(instance => {
          instance.set('email', 'C');
        });

        await User.sync({ force: true });

        const user0 = await User.create({
          name: 'A',
          bio: 'A',
          email: 'A'
        });

        await user0.update({
          name: 'B',
          bio: 'B',
          email: 'B'
        });

        const user = await User.findOne({});
        expect(user.get('name')).to.equal('B');
        expect(user.get('bio')).to.equal('B');
        expect(user.get('email')).to.equal('C');
      });

      it('should validate attributes added in hooks when default fields are used', async function() {
        const User = this.sequelize.define(`User${Support.rand()}`, {
          name: DataTypes.STRING,
          bio: DataTypes.TEXT,
          email: {
            type: DataTypes.STRING,
            validate: {
              isEmail: true
            }
          }
        });

        User.beforeUpdate(instance => {
          instance.set('email', 'B');
        });

        await User.sync({ force: true });

        const user0 = await User.create({
          name: 'A',
          bio: 'A',
          email: 'valid.email@gmail.com'
        });

        await expect(user0.update({
          name: 'B'
        })).to.be.rejectedWith(Sequelize.ValidationError);

        const user = await User.findOne({});
        expect(user.get('email')).to.equal('valid.email@gmail.com');
      });

      it('should validate attributes changed in hooks when default fields are used', async function() {
        const User = this.sequelize.define(`User${Support.rand()}`, {
          name: DataTypes.STRING,
          bio: DataTypes.TEXT,
          email: {
            type: DataTypes.STRING,
            validate: {
              isEmail: true
            }
          }
        });

        User.beforeUpdate(instance => {
          instance.set('email', 'B');
        });

        await User.sync({ force: true });

        const user0 = await User.create({
          name: 'A',
          bio: 'A',
          email: 'valid.email@gmail.com'
        });

        await expect(user0.update({
          name: 'B',
          email: 'still.valid.email@gmail.com'
        })).to.be.rejectedWith(Sequelize.ValidationError);

        const user = await User.findOne({});
        expect(user.get('email')).to.equal('valid.email@gmail.com');
      });
    });

    it('should not set attributes that are not specified by fields', async function() {
      const User = this.sequelize.define(`User${Support.rand()}`, {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
        email: DataTypes.STRING
      });

      await User.sync({ force: true });

      const user0 = await User.create({
        name: 'snafu',
        email: 'email'
      });

      const user = await user0.update({
        bio: 'heyo',
        email: 'heho'
      }, {
        fields: ['bio']
      });

      expect(user.get('name')).to.equal('snafu');
      expect(user.get('email')).to.equal('email');
      expect(user.get('bio')).to.equal('heyo');
    });

    it('updates attributes in the database', async function() {
      const user = await this.User.create({ username: 'user' });
      expect(user.username).to.equal('user');
      const user0 = await user.update({ username: 'person' });
      expect(user0.username).to.equal('person');
    });

    it('ignores unknown attributes', async function() {
      const user = await this.User.create({ username: 'user' });
      const user0 = await user.update({ username: 'person', foo: 'bar' });
      expect(user0.username).to.equal('person');
      expect(user0.foo).not.to.exist;
    });

    it('ignores undefined attributes', async function() {
      await this.User.sync({ force: true });
      const user = await this.User.create({ username: 'user' });
      const user0 = await user.update({ username: undefined });
      expect(user0.username).to.equal('user');
    });

    it('doesn\'t update primary keys or timestamps', async function() {
      const User = this.sequelize.define(`User${Support.rand()}`, {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
        identifier: { type: DataTypes.STRING, primaryKey: true }
      });

      await User.sync({ force: true });

      const user = await User.create({
        name: 'snafu',
        identifier: 'identifier'
      });

      const oldCreatedAt = user.createdAt,
        oldUpdatedAt = user.updatedAt,
        oldIdentifier = user.identifier;

      this.clock.tick(1000);

      const user0 = await user.update({
        name: 'foobar',
        createdAt: new Date(2000, 1, 1),
        identifier: 'another identifier'
      });

      expect(new Date(user0.createdAt)).to.equalDate(new Date(oldCreatedAt));
      expect(new Date(user0.updatedAt)).to.not.equalTime(new Date(oldUpdatedAt));
      expect(user0.identifier).to.equal(oldIdentifier);
    });

    it('stores and restores null values', async function() {
      const Download = this.sequelize.define('download', {
        startedAt: DataTypes.DATE,
        canceledAt: DataTypes.DATE,
        finishedAt: DataTypes.DATE
      });

      await Download.sync();

      const download = await Download.create({
        startedAt: new Date()
      });

      expect(download.startedAt instanceof Date).to.be.true;
      expect(download.canceledAt).to.not.be.ok;
      expect(download.finishedAt).to.not.be.ok;

      const download0 = await download.update({
        canceledAt: new Date()
      });

      expect(download0.startedAt instanceof Date).to.be.true;
      expect(download0.canceledAt instanceof Date).to.be.true;
      expect(download0.finishedAt).to.not.be.ok;

      const downloads = await Download.findAll({
        where: { finishedAt: null }
      });

      downloads.forEach(download => {
        expect(download.startedAt instanceof Date).to.be.true;
        expect(download.canceledAt instanceof Date).to.be.true;
        expect(download.finishedAt).to.not.be.ok;
      });
    });

    it('should support logging', async function() {
      const spy = sinon.spy();

      const user = await this.User.create({});
      await user.update({ username: 'yolo' }, { logging: spy });
      expect(spy.called).to.be.ok;
    });
  });
});
