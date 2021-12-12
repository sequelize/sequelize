'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('./support'),
  DataTypes = require('sequelize/lib/data-types'),
  dialect = Support.getTestDialect(),
  sinon = require('sinon'),
  isUUID = require('validator').isUUID;

describe(Support.getTestDialectTeaser('Instance'), () => {
  before(function() {
    this.clock = sinon.useFakeTimers();
  });

  afterEach(function() {
    this.clock.reset();
  });

  after(function() {
    this.clock.restore();
  });

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

      dateAllowNullTrue: {
        type: DataTypes.DATE,
        allowNull: true
      },

      isSuperUser: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      }
    });

    await this.User.sync({ force: true });
  });

  describe('Escaping', () => {
    it('is done properly for special characters', async function() {
      // Ideally we should test more: "\0\n\r\b\t\\\'\"\x1a"
      // But this causes sqlite to fail and exits the entire test suite immediately
      const bio = `${dialect}'"\n`; // Need to add the dialect here so in case of failure I know what DB it failed for

      const u1 = await this.User.create({ username: bio });
      const u2 = await this.User.findByPk(u1.id);
      expect(u2.username).to.equal(bio);
    });
  });

  describe('isNewRecord', () => {
    it('returns true for non-saved objects', function() {
      const user = this.User.build({ username: 'user' });
      expect(user.id).to.be.null;
      expect(user.isNewRecord).to.be.ok;
    });

    it('returns false for saved objects', async function() {
      const user = await this.User.build({ username: 'user' }).save();
      expect(user.isNewRecord).to.not.be.ok;
    });

    it('returns false for created objects', async function() {
      const user = await this.User.create({ username: 'user' });
      expect(user.isNewRecord).to.not.be.ok;
    });

    it('returns false for upserted objects', async function() {
      // adding id here so MSSQL doesn't fail. It needs a primary key to upsert
      const [user] = await this.User.upsert({ id: 2, username: 'user' });
      expect(user.isNewRecord).to.not.be.ok;
    });

    it('returns false for objects found by find method', async function() {
      await this.User.create({ username: 'user' });
      const user = await this.User.create({ username: 'user' });
      const user0 = await this.User.findByPk(user.id);
      expect(user0.isNewRecord).to.not.be.ok;
    });

    it('returns false for objects found by findAll method', async function() {
      const users = [];

      for (let i = 0; i < 10; i++) {
        users[i] = { username: 'user' };
      }

      await this.User.bulkCreate(users);
      const users0 = await this.User.findAll();
      users0.forEach(u => {
        expect(u.isNewRecord).to.not.be.ok;
      });
    });
  });

  describe('default values', () => {
    describe('uuid', () => {
      it('should store a string in uuidv1 and uuidv4', function() {
        const user = this.User.build({ username: 'a user' });
        expect(user.uuidv1).to.be.a('string');
        expect(user.uuidv4).to.be.a('string');
      });

      it('should store a string of length 36 in uuidv1 and uuidv4', function() {
        const user = this.User.build({ username: 'a user' });
        expect(user.uuidv1).to.have.length(36);
        expect(user.uuidv4).to.have.length(36);
      });

      it('should store a valid uuid in uuidv1 and uuidv4 that conforms to the UUID v1 and v4 specifications', function() {
        const user = this.User.build({ username: 'a user' });
        expect(isUUID(user.uuidv1)).to.be.true;
        expect(isUUID(user.uuidv4, 4)).to.be.true;
      });

      it('should store a valid uuid if the multiple primary key fields used', function() {
        const Person = this.sequelize.define('Person', {
          id1: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV1,
            primaryKey: true
          },
          id2: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV1,
            primaryKey: true
          }
        });

        const person = Person.build({});
        expect(person.id1).to.be.ok;
        expect(person.id1).to.have.length(36);

        expect(person.id2).to.be.ok;
        expect(person.id2).to.have.length(36);
      });
    });
    describe('current date', () => {
      it('should store a date in touchedAt', function() {
        const user = this.User.build({ username: 'a user' });
        expect(user.touchedAt).to.be.instanceof(Date);
      });

      it('should store the current date in touchedAt', function() {
        const clock = sinon.useFakeTimers();
        clock.tick(5000);
        const user = this.User.build({ username: 'a user' });
        clock.restore();
        expect(+user.touchedAt).to.be.equal(5000);
      });
    });

    describe('allowNull date', () => {
      it('should be just "null" and not Date with Invalid Date', async function() {
        await this.User.build({ username: 'a user' }).save();
        const user = await this.User.findOne({ where: { username: 'a user' } });
        expect(user.dateAllowNullTrue).to.be.null;
      });

      it('should be the same valid date when saving the date', async function() {
        const date = new Date();
        await this.User.build({ username: 'a user', dateAllowNullTrue: date }).save();
        const user = await this.User.findOne({ where: { username: 'a user' } });
        expect(user.dateAllowNullTrue.toString()).to.equal(date.toString());
      });
    });

    describe('super user boolean', () => {
      it('should default to false', async function() {
        await this.User.build({
          username: 'a user'
        })
          .save();

        const user = await this.User.findOne({
          where: {
            username: 'a user'
          }
        });

        expect(user.isSuperUser).to.be.false;
      });

      it('should override default when given truthy boolean', async function() {
        await this.User.build({
          username: 'a user',
          isSuperUser: true
        })
          .save();

        const user = await this.User.findOne({
          where: {
            username: 'a user'
          }
        });

        expect(user.isSuperUser).to.be.true;
      });

      it('should override default when given truthy boolean-string ("true")', async function() {
        await this.User.build({
          username: 'a user',
          isSuperUser: 'true'
        })
          .save();

        const user = await this.User.findOne({
          where: {
            username: 'a user'
          }
        });

        expect(user.isSuperUser).to.be.true;
      });

      it('should override default when given truthy boolean-int (1)', async function() {
        await this.User.build({
          username: 'a user',
          isSuperUser: 1
        })
          .save();

        const user = await this.User.findOne({
          where: {
            username: 'a user'
          }
        });

        expect(user.isSuperUser).to.be.true;
      });

      it('should throw error when given value of incorrect type', async function() {
        let callCount = 0;

        try {
          await this.User.build({
            username: 'a user',
            isSuperUser: 'INCORRECT_VALUE_TYPE'
          })
            .save();

          callCount += 1;
        } catch (err) {
          expect(callCount).to.equal(0);
          expect(err).to.exist;
          expect(err.message).to.exist;
        }
      });
    });
  });

  describe('complete', () => {
    it('gets triggered if an error occurs', async function() {
      try {
        await this.User.findOne({ where: ['asdasdasd'] });
      } catch (err) {
        expect(err).to.exist;
        expect(err.message).to.exist;
      }
    });

    it('gets triggered if everything was ok', async function() {
      const result = await this.User.count();
      expect(result).to.exist;
    });
  });

  describe('findAll', () => {
    beforeEach(async function() {
      this.ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: { type: DataTypes.STRING }
      }, { paranoid: true });

      this.ParanoidUser.hasOne(this.ParanoidUser);
      await this.ParanoidUser.sync({ force: true });
    });

    it('sql should have paranoid condition', async function() {
      await this.ParanoidUser.create({ username: 'cuss' });
      const users0 = await this.ParanoidUser.findAll();
      expect(users0).to.have.length(1);
      await users0[0].destroy();
      const users = await this.ParanoidUser.findAll();
      expect(users).to.have.length(0);
    });

    it('sequelize.and as where should include paranoid condition', async function() {
      await this.ParanoidUser.create({ username: 'cuss' });

      const users0 = await this.ParanoidUser.findAll({
        where: this.sequelize.and({
          username: 'cuss'
        })
      });

      expect(users0).to.have.length(1);
      await users0[0].destroy();

      const users = await this.ParanoidUser.findAll({
        where: this.sequelize.and({
          username: 'cuss'
        })
      });

      expect(users).to.have.length(0);
    });

    it('sequelize.or as where should include paranoid condition', async function() {
      await this.ParanoidUser.create({ username: 'cuss' });

      const users0 = await this.ParanoidUser.findAll({
        where: this.sequelize.or({
          username: 'cuss'
        })
      });

      expect(users0).to.have.length(1);
      await users0[0].destroy();

      const users = await this.ParanoidUser.findAll({
        where: this.sequelize.or({
          username: 'cuss'
        })
      });

      expect(users).to.have.length(0);
    });

    it('escapes a single single quotes properly in where clauses', async function() {
      await this.User
        .create({ username: "user'name" });

      const users = await this.User.findAll({
        where: { username: "user'name" }
      });

      expect(users.length).to.equal(1);
      expect(users[0].username).to.equal("user'name");
    });

    it('escapes two single quotes properly in where clauses', async function() {
      await this.User
        .create({ username: "user''name" });

      const users = await this.User.findAll({
        where: { username: "user''name" }
      });

      expect(users.length).to.equal(1);
      expect(users[0].username).to.equal("user''name");
    });

    it('returns the timestamps if no attributes have been specified', async function() {
      await this.User.create({ username: 'fnord' });
      const users = await this.User.findAll();
      expect(users[0].createdAt).to.exist;
    });

    it('does not return the timestamps if the username attribute has been specified', async function() {
      await this.User.create({ username: 'fnord' });
      const users = await this.User.findAll({ attributes: ['username'] });
      expect(users[0].createdAt).not.to.exist;
      expect(users[0].username).to.exist;
    });

    it('creates the deletedAt property, when defining paranoid as true', async function() {
      await this.ParanoidUser.create({ username: 'fnord' });
      const users = await this.ParanoidUser.findAll();
      expect(users[0].deletedAt).to.be.null;
    });

    it('destroys a record with a primary key of something other than id', async function() {
      const UserDestroy = this.sequelize.define('UserDestroy', {
        newId: {
          type: DataTypes.STRING,
          primaryKey: true
        },
        email: DataTypes.STRING
      });

      await UserDestroy.sync();
      await UserDestroy.create({ newId: '123ABC', email: 'hello' });
      const user = await UserDestroy.findOne({ where: { email: 'hello' } });

      await user.destroy();
    });

    it('sets deletedAt property to a specific date when deleting an instance', async function() {
      await this.ParanoidUser.create({ username: 'fnord' });
      const users = await this.ParanoidUser.findAll();
      await users[0].destroy();
      expect(users[0].deletedAt.getMonth).to.exist;

      const user = await users[0].reload({ paranoid: false });
      expect(user.deletedAt.getMonth).to.exist;
    });

    it('keeps the deletedAt-attribute with value null, when running update', async function() {
      await this.ParanoidUser.create({ username: 'fnord' });
      const users = await this.ParanoidUser.findAll();
      const user = await users[0].update({ username: 'newFnord' });
      expect(user.deletedAt).not.to.exist;
    });

    it('keeps the deletedAt-attribute with value null, when updating associations', async function() {
      await this.ParanoidUser.create({ username: 'fnord' });
      const users = await this.ParanoidUser.findAll();
      const linkedUser = await this.ParanoidUser.create({ username: 'linkedFnord' });
      const user = await users[0].setParanoidUser(linkedUser);
      expect(user.deletedAt).not.to.exist;
    });

    it('can reuse query option objects', async function() {
      await this.User.create({ username: 'fnord' });
      const query = { where: { username: 'fnord' } };
      const users = await this.User.findAll(query);
      expect(users[0].username).to.equal('fnord');
      const users0 = await this.User.findAll(query);
      expect(users0[0].username).to.equal('fnord');
    });
  });

  describe('findOne', () => {
    it('can reuse query option objects', async function() {
      await this.User.create({ username: 'fnord' });
      const query = { where: { username: 'fnord' } };
      const user = await this.User.findOne(query);
      expect(user.username).to.equal('fnord');
      const user0 = await this.User.findOne(query);
      expect(user0.username).to.equal('fnord');
    });
    it('returns null for null, undefined, and unset boolean values', async function() {
      const Setting = this.sequelize.define('SettingHelper', {
        setting_key: DataTypes.STRING,
        bool_value: { type: DataTypes.BOOLEAN, allowNull: true },
        bool_value2: { type: DataTypes.BOOLEAN, allowNull: true },
        bool_value3: { type: DataTypes.BOOLEAN, allowNull: true }
      }, { timestamps: false, logging: false });

      await Setting.sync({ force: true });
      await Setting.create({ setting_key: 'test', bool_value: null, bool_value2: undefined });
      const setting = await Setting.findOne({ where: { setting_key: 'test' } });
      expect(setting.bool_value).to.equal(null);
      expect(setting.bool_value2).to.equal(null);
      expect(setting.bool_value3).to.equal(null);
    });
  });

  describe('equals', () => {
    it('can compare records with Date field', async function() {
      const user1 = await this.User.create({ username: 'fnord' });
      const user2 = await this.User.findOne({ where: { username: 'fnord' } });
      expect(user1.equals(user2)).to.be.true;
    });

    it('does not compare the existence of associations', async function() {
      this.UserAssociationEqual = this.sequelize.define('UserAssociationEquals', {
        username: DataTypes.STRING,
        age: DataTypes.INTEGER
      }, { timestamps: false });

      this.ProjectAssociationEqual = this.sequelize.define('ProjectAssocationEquals', {
        title: DataTypes.STRING,
        overdue_days: DataTypes.INTEGER
      }, { timestamps: false });

      this.UserAssociationEqual.hasMany(this.ProjectAssociationEqual, { as: 'Projects', foreignKey: 'userId' });
      this.ProjectAssociationEqual.belongsTo(this.UserAssociationEqual, { as: 'Users', foreignKey: 'userId' });

      await this.UserAssociationEqual.sync({ force: true });
      await this.ProjectAssociationEqual.sync({ force: true });
      const user1 = await this.UserAssociationEqual.create({ username: 'jimhalpert' });
      const project1 = await this.ProjectAssociationEqual.create({ title: 'A Cool Project' });
      await user1.setProjects([project1]);
      const user2 = await this.UserAssociationEqual.findOne({ where: { username: 'jimhalpert' }, include: [{ model: this.ProjectAssociationEqual, as: 'Projects' }] });
      const user3 = await this.UserAssociationEqual.create({ username: 'pambeesly' });
      expect(user1.get('Projects')).to.not.exist;
      expect(user2.get('Projects')).to.exist;
      expect(user1.equals(user2)).to.be.true;
      expect(user2.equals(user1)).to.be.true;
      expect(user1.equals(user3)).to.not.be.true;
      expect(user3.equals(user1)).to.not.be.true;
    });
  });

  describe('values', () => {
    it('returns all values', async function() {
      const User = this.sequelize.define('UserHelper', {
        username: DataTypes.STRING
      }, { timestamps: false, logging: false });

      await User.sync();
      const user = User.build({ username: 'foo' });
      expect(user.get({ plain: true })).to.deep.equal({ username: 'foo', id: null });
    });
  });

  describe('isSoftDeleted', () => {
    beforeEach(async function() {
      this.ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: { type: DataTypes.STRING }
      }, { paranoid: true });

      await this.ParanoidUser.sync({ force: true });
    });

    it('should return false when model is just created', async function() {
      const user = await this.ParanoidUser.create({ username: 'foo' });
      expect(user.isSoftDeleted()).to.be.false;
    });

    it('returns false if user is not soft deleted', async function() {
      await this.ParanoidUser.create({ username: 'fnord' });
      const users = await this.ParanoidUser.findAll();
      expect(users[0].isSoftDeleted()).to.be.false;
    });

    it('returns true if user is soft deleted', async function() {
      await this.ParanoidUser.create({ username: 'fnord' });
      const users = await this.ParanoidUser.findAll();
      await users[0].destroy();
      expect(users[0].isSoftDeleted()).to.be.true;

      const user = await users[0].reload({ paranoid: false });
      expect(user.isSoftDeleted()).to.be.true;
    });

    it('works with custom `deletedAt` field name', async function() {
      this.ParanoidUserWithCustomDeletedAt = this.sequelize.define('ParanoidUserWithCustomDeletedAt', {
        username: { type: DataTypes.STRING }
      }, {
        deletedAt: 'deletedAtThisTime',
        paranoid: true
      });

      this.ParanoidUserWithCustomDeletedAt.hasOne(this.ParanoidUser);

      await this.ParanoidUserWithCustomDeletedAt.sync({ force: true });
      await this.ParanoidUserWithCustomDeletedAt.create({ username: 'fnord' });
      const users = await this.ParanoidUserWithCustomDeletedAt.findAll();
      expect(users[0].isSoftDeleted()).to.be.false;

      await users[0].destroy();
      expect(users[0].isSoftDeleted()).to.be.true;

      const user = await users[0].reload({ paranoid: false });
      expect(user.isSoftDeleted()).to.be.true;
    });
  });

  describe('restore', () => {
    it('returns an error if the model is not paranoid', async function() {
      const user = await this.User.create({ username: 'Peter', secretValue: '42' });
      await expect(user.restore()).to.be.rejectedWith(Error, 'Model is not paranoid');
    });

    it('restores a previously deleted model', async function() {
      const ParanoidUser = this.sequelize.define('ParanoidUser', {
          username: DataTypes.STRING,
          secretValue: DataTypes.STRING,
          data: DataTypes.STRING,
          intVal: { type: DataTypes.INTEGER, defaultValue: 1 }
        }, {
          paranoid: true
        }),
        data = [{ username: 'Peter', secretValue: '42' },
          { username: 'Paul', secretValue: '43' },
          { username: 'Bob', secretValue: '44' }];

      await ParanoidUser.sync({ force: true });
      await ParanoidUser.bulkCreate(data);
      const user0 = await ParanoidUser.findOne({ where: { secretValue: '42' } });
      await user0.destroy();
      await user0.restore();
      const user = await ParanoidUser.findOne({ where: { secretValue: '42' } });
      expect(user).to.be.ok;
      expect(user.username).to.equal('Peter');
    });

    it('supports custom deletedAt field', async function() {
      const ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: DataTypes.STRING,
        destroyTime: DataTypes.DATE
      }, { paranoid: true, deletedAt: 'destroyTime' });

      await ParanoidUser.sync({ force: true });

      const user2 = await ParanoidUser.create({
        username: 'username'
      });

      const user1 = await user2.destroy();
      expect(user1.destroyTime).to.be.ok;
      expect(user1.deletedAt).to.not.be.ok;
      const user0 = await user1.restore();
      expect(user0.destroyTime).to.not.be.ok;
      const user = await ParanoidUser.findOne({ where: { username: 'username' } });
      expect(user).to.be.ok;
      expect(user.destroyTime).to.not.be.ok;
      expect(user.deletedAt).to.not.be.ok;
    });

    it('supports custom deletedAt field name', async function() {
      const ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: DataTypes.STRING,
        deletedAt: { type: DataTypes.DATE, field: 'deleted_at' }
      }, { paranoid: true });

      await ParanoidUser.sync({ force: true });

      const user2 = await ParanoidUser.create({
        username: 'username'
      });

      const user1 = await user2.destroy();
      expect(user1.dataValues.deletedAt).to.be.ok;
      expect(user1.dataValues.deleted_at).to.not.be.ok;
      const user0 = await user1.restore();
      expect(user0.dataValues.deletedAt).to.not.be.ok;
      expect(user0.dataValues.deleted_at).to.not.be.ok;
      const user = await ParanoidUser.findOne({ where: { username: 'username' } });
      expect(user).to.be.ok;
      expect(user.deletedAt).to.not.be.ok;
      expect(user.deleted_at).to.not.be.ok;
    });

    it('supports custom deletedAt field and database column', async function() {
      const ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: DataTypes.STRING,
        destroyTime: { type: DataTypes.DATE, field: 'destroy_time' }
      }, { paranoid: true, deletedAt: 'destroyTime' });

      await ParanoidUser.sync({ force: true });

      const user2 = await ParanoidUser.create({
        username: 'username'
      });

      const user1 = await user2.destroy();
      expect(user1.dataValues.destroyTime).to.be.ok;
      expect(user1.dataValues.deletedAt).to.not.be.ok;
      expect(user1.dataValues.destroy_time).to.not.be.ok;
      const user0 = await user1.restore();
      expect(user0.dataValues.destroyTime).to.not.be.ok;
      expect(user0.dataValues.destroy_time).to.not.be.ok;
      const user = await ParanoidUser.findOne({ where: { username: 'username' } });
      expect(user).to.be.ok;
      expect(user.destroyTime).to.not.be.ok;
      expect(user.destroy_time).to.not.be.ok;
    });

    it('supports custom default value', async function() {
      const ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: DataTypes.STRING,
        deletedAt: { type: DataTypes.DATE, defaultValue: new Date(0) }
      }, { paranoid: true });

      await ParanoidUser.sync({ force: true });

      const user2 = await ParanoidUser.create({
        username: 'username'
      });

      const user1 = await user2.destroy();
      const user0 = await user1.restore();
      expect(user0.dataValues.deletedAt.toISOString()).to.equal(new Date(0).toISOString());
      const user = await ParanoidUser.findOne({ where: { username: 'username' } });
      expect(user).to.be.ok;
      expect(user.deletedAt.toISOString()).to.equal(new Date(0).toISOString());
    });
  });
});
