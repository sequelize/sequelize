'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Sequelize = require('../../../index'),
  Support = require('../support'),
  DataTypes = require('../../../lib/data-types'),
  sinon = require('sinon'),
  current = Support.sequelize;

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

  describe('save', () => {
    if (current.dialect.supports.transactions) {
      it('supports transactions', async function() {
        const sequelize = await Support.prepareTransactionTest(this.sequelize);
        const User = sequelize.define('User', { username: Support.Sequelize.STRING });
        await User.sync({ force: true });
        const t = await sequelize.transaction();
        await User.build({ username: 'foo' }).save({ transaction: t });
        const count1 = await User.count();
        const count2 = await User.count({ transaction: t });
        expect(count1).to.equal(0);
        expect(count2).to.equal(1);
        await t.rollback();
      });
    }

    it('only updates fields in passed array', async function() {
      const date = new Date(1990, 1, 1);

      const user = await this.User.create({
        username: 'foo',
        touchedAt: new Date()
      });

      user.username = 'fizz';
      user.touchedAt = date;

      await user.save({ fields: ['username'] });
      // re-select user
      const user2 = await this.User.findByPk(user.id);
      // name should have changed
      expect(user2.username).to.equal('fizz');
      // bio should be unchanged
      expect(user2.birthDate).not.to.equal(date);
    });

    it('should work on a model with an attribute named length', async function() {
      const Box = this.sequelize.define('box', {
        length: DataTypes.INTEGER,
        width: DataTypes.INTEGER,
        height: DataTypes.INTEGER
      });

      await Box.sync({ force: true });

      const box0 = await Box.create({
        length: 1,
        width: 2,
        height: 3
      });

      await box0.update({
        length: 4,
        width: 5,
        height: 6
      });

      const box = await Box.findOne({});
      expect(box.get('length')).to.equal(4);
      expect(box.get('width')).to.equal(5);
      expect(box.get('height')).to.equal(6);
    });

    it('only validates fields in passed array', async function() {
      await this.User.build({
        validateTest: 'cake', // invalid, but not saved
        validateCustom: '1'
      }).save({
        fields: ['validateCustom']
      });
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

        await user0.set({
          name: 'B',
          bio: 'B'
        }).save();

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

        await user0.set({
          name: 'B',
          bio: 'B',
          email: 'B'
        }).save();

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

        await expect(user0.set({
          name: 'B'
        }).save()).to.be.rejectedWith(Sequelize.ValidationError);

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

        await expect(user0.set({
          name: 'B',
          email: 'still.valid.email@gmail.com'
        }).save()).to.be.rejectedWith(Sequelize.ValidationError);

        const user = await User.findOne({});
        expect(user.get('email')).to.equal('valid.email@gmail.com');
      });
    });

    it('stores an entry in the database', async function() {
      const username = 'user',
        User = this.User,
        user = this.User.build({
          username,
          touchedAt: new Date(1984, 8, 23)
        });

      const users = await User.findAll();
      expect(users).to.have.length(0);
      await user.save();
      const users0 = await User.findAll();
      expect(users0).to.have.length(1);
      expect(users0[0].username).to.equal(username);
      expect(users0[0].touchedAt).to.be.instanceof(Date);
      expect(users0[0].touchedAt).to.equalDate(new Date(1984, 8, 23));
    });

    it('handles an entry with primaryKey of zero', async function() {
      const username = 'user',
        newUsername = 'newUser',
        User2 = this.sequelize.define('User2',
          {
            id: {
              type: DataTypes.INTEGER.UNSIGNED,
              autoIncrement: false,
              primaryKey: true
            },
            username: { type: DataTypes.STRING }
          });

      await User2.sync();
      const user = await User2.create({ id: 0, username });
      expect(user).to.be.ok;
      expect(user.id).to.equal(0);
      expect(user.username).to.equal(username);
      const user1 = await User2.findByPk(0);
      expect(user1).to.be.ok;
      expect(user1.id).to.equal(0);
      expect(user1.username).to.equal(username);
      const user0 = await user1.update({ username: newUsername });
      expect(user0).to.be.ok;
      expect(user0.id).to.equal(0);
      expect(user0.username).to.equal(newUsername);
    });

    it('updates the timestamps', async function() {
      const now = new Date();
      now.setMilliseconds(0);

      const user = this.User.build({ username: 'user' });
      this.clock.tick(1000);

      const savedUser = await user.save();
      expect(savedUser).have.property('updatedAt').afterTime(now);

      this.clock.tick(1000);
      const updatedUser = await savedUser.save();
      expect(updatedUser).have.property('updatedAt').afterTime(now);
    });

    it('does not update timestamps when passing silent=true', async function() {
      const user = await this.User.create({ username: 'user' });
      const updatedAt = user.updatedAt;

      this.clock.tick(1000);

      await expect(user.update({
        username: 'userman'
      }, {
        silent: true
      })).to.eventually.have.property('updatedAt').equalTime(updatedAt);
    });

    it('does not update timestamps when passing silent=true in a bulk update', async function() {
      const data = [
        { username: 'Paul' },
        { username: 'Peter' }
      ];

      await this.User.bulkCreate(data);
      const users0 = await this.User.findAll();
      const updatedAtPaul = users0[0].updatedAt;
      const updatedAtPeter = users0[1].updatedAt;
      this.clock.tick(150);

      await this.User.update(
        { aNumber: 1 },
        { where: {}, silent: true }
      );

      const users = await this.User.findAll();
      expect(users[0].updatedAt).to.equalTime(updatedAtPeter);
      expect(users[1].updatedAt).to.equalTime(updatedAtPaul);
    });

    describe('when nothing changed', () => {
      it('does not update timestamps', async function() {
        await this.User.create({ username: 'John' });
        const user = await this.User.findOne({ where: { username: 'John' } });
        const updatedAt = user.updatedAt;
        this.clock.tick(2000);
        const newlySavedUser = await user.save();
        expect(newlySavedUser.updatedAt).to.equalTime(updatedAt);
        const newlySavedUser0 = await this.User.findOne({ where: { username: 'John' } });
        expect(newlySavedUser0.updatedAt).to.equalTime(updatedAt);
      });

      it('should not throw ER_EMPTY_QUERY if changed only virtual fields', async function() {
        const User = this.sequelize.define(`User${Support.rand()}`, {
          name: DataTypes.STRING,
          bio: {
            type: DataTypes.VIRTUAL,
            get: () => 'swag'
          }
        }, {
          timestamps: false
        });
        await User.sync({ force: true });
        const user = await User.create({ name: 'John', bio: 'swag 1' });
        await user.update({ bio: 'swag 2' }).should.be.fulfilled;
      });
    });

    it('updates with function and column value', async function() {
      const user = await this.User.create({
        aNumber: 42
      });

      user.bNumber = this.sequelize.col('aNumber');
      user.username = this.sequelize.fn('upper', 'sequelize');
      await user.save();
      const user2 = await this.User.findByPk(user.id);
      expect(user2.username).to.equal('SEQUELIZE');
      expect(user2.bNumber).to.equal(42);
    });

    it('updates with function that contains escaped dollar symbol', async function() {
      const user = await this.User.create({});
      user.username = this.sequelize.fn('upper', '$sequelize');
      await user.save();
      const userAfterUpdate = await this.User.findByPk(user.id);
      expect(userAfterUpdate.username).to.equal('$SEQUELIZE');
    });

    describe('without timestamps option', () => {
      it("doesn't update the updatedAt column", async function() {
        const User2 = this.sequelize.define('User2', {
          username: DataTypes.STRING,
          updatedAt: DataTypes.DATE
        }, { timestamps: false });
        await User2.sync();
        const johnDoe = await User2.create({ username: 'john doe' });
        // sqlite and mysql return undefined, whereas postgres returns null
        expect([undefined, null]).to.include(johnDoe.updatedAt);
      });
    });

    describe('with custom timestamp options', () => {
      it('updates the createdAt column if updatedAt is disabled', async function() {
        const now = new Date();
        this.clock.tick(1000);

        const User2 = this.sequelize.define('User2', {
          username: DataTypes.STRING
        }, { updatedAt: false });

        await User2.sync();
        const johnDoe = await User2.create({ username: 'john doe' });
        expect(johnDoe.updatedAt).to.be.undefined;
        expect(now).to.be.beforeTime(johnDoe.createdAt);
      });

      it('updates the updatedAt column if createdAt is disabled', async function() {
        const now = new Date();
        this.clock.tick(1000);

        const User2 = this.sequelize.define('User2', {
          username: DataTypes.STRING
        }, { createdAt: false });

        await User2.sync();
        const johnDoe = await User2.create({ username: 'john doe' });
        expect(johnDoe.createdAt).to.be.undefined;
        expect(now).to.be.beforeTime(johnDoe.updatedAt);
      });

      it('works with `allowNull: false` on createdAt and updatedAt columns', async function() {
        const User2 = this.sequelize.define('User2', {
          username: DataTypes.STRING,
          createdAt: {
            type: DataTypes.DATE,
            allowNull: false
          },
          updatedAt: {
            type: DataTypes.DATE,
            allowNull: false
          }
        }, { timestamps: true });

        await User2.sync();
        const johnDoe = await User2.create({ username: 'john doe' });
        expect(johnDoe.createdAt).to.be.an.instanceof(Date);
        expect( ! isNaN(johnDoe.createdAt.valueOf()) ).to.be.ok;
        expect(johnDoe.createdAt).to.equalTime(johnDoe.updatedAt);
      });
    });

    it('should fail a validation upon creating', async function() {
      try {
        await this.User.create({ aNumber: 0, validateTest: 'hello' });
      } catch (err) {
        expect(err).to.exist;
        expect(err).to.be.instanceof(Object);
        expect(err.get('validateTest')).to.be.instanceof(Array);
        expect(err.get('validateTest')[0]).to.exist;
        expect(err.get('validateTest')[0].message).to.equal('Validation isInt on validateTest failed');
      }
    });

    it('should fail a validation upon creating with hooks false', async function() {
      try {
        await this.User.create({ aNumber: 0, validateTest: 'hello' }, { hooks: false });
      } catch (err) {
        expect(err).to.exist;
        expect(err).to.be.instanceof(Object);
        expect(err.get('validateTest')).to.be.instanceof(Array);
        expect(err.get('validateTest')[0]).to.exist;
        expect(err.get('validateTest')[0].message).to.equal('Validation isInt on validateTest failed');
      }
    });

    it('should fail a validation upon building', async function() {
      try {
        await this.User.build({ aNumber: 0, validateCustom: 'aaaaaaaaaaaaaaaaaaaaaaaaaa' }).save();
      } catch (err) {
        expect(err).to.exist;
        expect(err).to.be.instanceof(Object);
        expect(err.get('validateCustom')).to.exist;
        expect(err.get('validateCustom')).to.be.instanceof(Array);
        expect(err.get('validateCustom')[0]).to.exist;
        expect(err.get('validateCustom')[0].message).to.equal('Length failed.');
      }
    });

    it('should fail a validation when updating', async function() {
      const user = await this.User.create({ aNumber: 0 });

      try {
        await user.update({ validateTest: 'hello' });
      } catch (err) {
        expect(err).to.exist;
        expect(err).to.be.instanceof(Object);
        expect(err.get('validateTest')).to.exist;
        expect(err.get('validateTest')).to.be.instanceof(Array);
        expect(err.get('validateTest')[0]).to.exist;
        expect(err.get('validateTest')[0].message).to.equal('Validation isInt on validateTest failed');
      }
    });

    it('takes zero into account', async function() {
      const user = await this.User.build({ aNumber: 0 }).save({
        fields: ['aNumber']
      });

      expect(user.aNumber).to.equal(0);
    });

    it('saves a record with no primary key', async function() {
      const HistoryLog = this.sequelize.define('HistoryLog', {
        someText: { type: DataTypes.STRING },
        aNumber: { type: DataTypes.INTEGER },
        aRandomId: { type: DataTypes.INTEGER }
      });
      await HistoryLog.sync();
      const log = await HistoryLog.create({ someText: 'Some random text', aNumber: 3, aRandomId: 5 });
      const newLog = await log.update({ aNumber: 5 });
      expect(newLog.aNumber).to.equal(5);
    });

    describe('eagerly loaded objects', () => {
      beforeEach(async function() {
        this.UserEager = this.sequelize.define('UserEagerLoadingSaves', {
          username: DataTypes.STRING,
          age: DataTypes.INTEGER
        }, { timestamps: false });

        this.ProjectEager = this.sequelize.define('ProjectEagerLoadingSaves', {
          title: DataTypes.STRING,
          overdue_days: DataTypes.INTEGER
        }, { timestamps: false });

        this.UserEager.hasMany(this.ProjectEager, { as: 'Projects', foreignKey: 'PoobahId' });
        this.ProjectEager.belongsTo(this.UserEager, { as: 'Poobah', foreignKey: 'PoobahId' });

        await this.UserEager.sync({ force: true });

        await this.ProjectEager.sync({ force: true });
      });

      it('saves one object that has a collection of eagerly loaded objects', async function() {
        const user = await this.UserEager.create({ username: 'joe', age: 1 });
        const project1 = await this.ProjectEager.create({ title: 'project-joe1', overdue_days: 0 });
        const project2 = await this.ProjectEager.create({ title: 'project-joe2', overdue_days: 0 });
        await user.setProjects([project1, project2]);
        const user1 = await this.UserEager.findOne({ where: { age: 1 }, include: [{ model: this.ProjectEager, as: 'Projects' }] });
        expect(user1.username).to.equal('joe');
        expect(user1.age).to.equal(1);
        expect(user1.Projects).to.exist;
        expect(user1.Projects.length).to.equal(2);

        user1.age = user1.age + 1; // happy birthday joe
        const user0 = await user1.save();
        expect(user0.username).to.equal('joe');
        expect(user0.age).to.equal(2);
        expect(user0.Projects).to.exist;
        expect(user0.Projects.length).to.equal(2);
      });

      it('saves many objects that each a have collection of eagerly loaded objects', async function() {
        const bart = await this.UserEager.create({ username: 'bart', age: 20 });
        const lisa = await this.UserEager.create({ username: 'lisa', age: 20 });
        const detention1 = await this.ProjectEager.create({ title: 'detention1', overdue_days: 0 });
        const detention2 = await this.ProjectEager.create({ title: 'detention2', overdue_days: 0 });
        const exam1 = await this.ProjectEager.create({ title: 'exam1', overdue_days: 0 });
        const exam2 = await this.ProjectEager.create({ title: 'exam2', overdue_days: 0 });
        await bart.setProjects([detention1, detention2]);
        await lisa.setProjects([exam1, exam2]);
        const simpsons = await this.UserEager.findAll({ where: { age: 20 }, order: [['username', 'ASC']], include: [{ model: this.ProjectEager, as: 'Projects' }] });
        expect(simpsons.length).to.equal(2);

        const _bart = simpsons[0];
        const _lisa = simpsons[1];

        expect(_bart.Projects).to.exist;
        expect(_lisa.Projects).to.exist;
        expect(_bart.Projects.length).to.equal(2);
        expect(_lisa.Projects.length).to.equal(2);

        _bart.age = _bart.age + 1; // happy birthday bart - off to Moe's

        const savedbart = await _bart.save();
        expect(savedbart.username).to.equal('bart');
        expect(savedbart.age).to.equal(21);

        _lisa.username = 'lsimpson';

        const savedlisa = await _lisa.save();
        expect(savedlisa.username).to.equal('lsimpson');
        expect(savedlisa.age).to.equal(20);
      });

      it('saves many objects that each has one eagerly loaded object (to which they belong)', async function() {
        const user = await this.UserEager.create({ username: 'poobah', age: 18 });
        const homework = await this.ProjectEager.create({ title: 'homework', overdue_days: 10 });
        const party = await this.ProjectEager.create({ title: 'party', overdue_days: 2 });
        await user.setProjects([homework, party]);
        const projects = await this.ProjectEager.findAll({ include: [{ model: this.UserEager, as: 'Poobah' }] });
        expect(projects.length).to.equal(2);
        expect(projects[0].Poobah).to.exist;
        expect(projects[1].Poobah).to.exist;
        expect(projects[0].Poobah.username).to.equal('poobah');
        expect(projects[1].Poobah.username).to.equal('poobah');

        projects[0].title = 'partymore';
        projects[1].title = 'partymore';
        projects[0].overdue_days = 0;
        projects[1].overdue_days = 0;

        await projects[0].save();
        await projects[1].save();
        const savedprojects = await this.ProjectEager.findAll({ where: { title: 'partymore', overdue_days: 0 }, include: [{ model: this.UserEager, as: 'Poobah' }] });
        expect(savedprojects.length).to.equal(2);
        expect(savedprojects[0].Poobah).to.exist;
        expect(savedprojects[1].Poobah).to.exist;
        expect(savedprojects[0].Poobah.username).to.equal('poobah');
        expect(savedprojects[1].Poobah.username).to.equal('poobah');
      });
    });
  });
});
