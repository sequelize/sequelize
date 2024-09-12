'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Sequelize = require('sequelize'),
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
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

  describe('reload', () => {
    if (current.dialect.supports.transactions) {
      it('supports transactions', async function() {
        const sequelize = await Support.prepareTransactionTest(this.sequelize);
        const User = sequelize.define('User', { username: Support.Sequelize.STRING });

        await User.sync({ force: true });
        const user = await User.create({ username: 'foo' });
        const t = await sequelize.transaction();
        await User.update({ username: 'bar' }, { where: { username: 'foo' }, transaction: t });
        const user1 = await user.reload();
        expect(user1.username).to.equal('foo');
        const user0 = await user1.reload({ transaction: t });
        expect(user0.username).to.equal('bar');
        await t.rollback();
      });
    }

    it('should return a reference to the same DAO instead of creating a new one', async function() {
      const originalUser = await this.User.create({ username: 'John Doe' });
      await originalUser.update({ username: 'Doe John' });
      const updatedUser = await originalUser.reload();
      expect(originalUser === updatedUser).to.be.true;
    });

    it('should use default internal where', async function() {
      const user = await this.User.create({ username: 'Balak Bukhara' });
      const anotherUser = await this.User.create({ username: 'John Smith' });

      const primaryKey = user.get('id');

      await user.reload();
      expect(user.get('id')).to.equal(primaryKey);

      // options.where should be ignored
      await user.reload({ where: { id: anotherUser.get('id') } });
      expect(user.get('id')).to.equal(primaryKey).and.not.equal(anotherUser.get('id'));
    });

    it('should update the values on all references to the DAO', async function() {
      const originalUser = await this.User.create({ username: 'John Doe' });
      const updater = await this.User.findByPk(originalUser.id);
      await updater.update({ username: 'Doe John' });
      // We used a different reference when calling update, so originalUser is now out of sync
      expect(originalUser.username).to.equal('John Doe');
      const updatedUser = await originalUser.reload();
      expect(originalUser.username).to.equal('Doe John');
      expect(updatedUser.username).to.equal('Doe John');
    });

    it('should support updating a subset of attributes', async function() {
      const user1 = await this.User.create({
        aNumber: 1,
        bNumber: 1
      });

      await this.User.update({
        bNumber: 2
      }, {
        where: {
          id: user1.get('id')
        }
      });

      const user0 = user1;

      const user = await user0.reload({
        attributes: ['bNumber']
      });

      expect(user.get('aNumber')).to.equal(1);
      expect(user.get('bNumber')).to.equal(2);
    });

    it('should update read only attributes as well (updatedAt)', async function() {
      const originalUser = await this.User.create({ username: 'John Doe' });
      this.originallyUpdatedAt = originalUser.updatedAt;
      this.originalUser = originalUser;

      // Wait for a second, so updatedAt will actually be different
      this.clock.tick(1000);
      const updater = await this.User.findByPk(originalUser.id);
      const updatedUser = await updater.update({ username: 'Doe John' });
      this.updatedUser = updatedUser;
      await this.originalUser.reload();
      expect(this.originalUser.updatedAt).to.be.above(this.originallyUpdatedAt);
      expect(this.updatedUser.updatedAt).to.be.above(this.originallyUpdatedAt);
    });

    it('should update the associations as well', async function() {
      const Book = this.sequelize.define('Book', { title: DataTypes.STRING }),
        Page = this.sequelize.define('Page', { content: DataTypes.TEXT });

      Book.hasMany(Page);
      Page.belongsTo(Book);

      await Book.sync({ force: true });
      await Page.sync({ force: true });
      const book = await Book.create({ title: 'A very old book' });
      const page = await Page.create({ content: 'om nom nom' });
      await book.setPages([page]);

      const leBook = await Book.findOne({
        where: { id: book.id },
        include: [Page]
      });

      const page0 = await page.update({ content: 'something totally different' });
      expect(leBook.Pages.length).to.equal(1);
      expect(leBook.Pages[0].content).to.equal('om nom nom');
      expect(page0.content).to.equal('something totally different');
      const leBook0 = await leBook.reload();
      expect(leBook0.Pages.length).to.equal(1);
      expect(leBook0.Pages[0].content).to.equal('something totally different');
      expect(page0.content).to.equal('something totally different');
    });

    it('should update internal options of the instance', async function() {
      const Book = this.sequelize.define('Book', { title: DataTypes.STRING }),
        Page = this.sequelize.define('Page', { content: DataTypes.TEXT });

      Book.hasMany(Page);
      Page.belongsTo(Book);

      await Book.sync({ force: true });
      await Page.sync({ force: true });
      const book = await Book.create({ title: 'A very old book' });
      const page = await Page.create();
      await book.setPages([page]);

      const leBook = await Book.findOne({
        where: { id: book.id }
      });

      const oldOptions = leBook._options;

      const leBook0 = await leBook.reload({
        include: [Page]
      });

      expect(oldOptions).not.to.equal(leBook0._options);
      expect(leBook0._options.include.length).to.equal(1);
      expect(leBook0.Pages.length).to.equal(1);
      expect(leBook0.get({ plain: true }).Pages.length).to.equal(1);
    });

    it('should return an error when reload fails', async function() {
      const user = await this.User.create({ username: 'John Doe' });
      await user.destroy();

      await expect(user.reload()).to.be.rejectedWith(
        Sequelize.InstanceError,
        'Instance could not be reloaded because it does not exist anymore (find call returned null)'
      );
    });

    it('should set an association to null after deletion, 1-1', async function() {
      const Shoe = this.sequelize.define('Shoe', { brand: DataTypes.STRING }),
        Player = this.sequelize.define('Player', { name: DataTypes.STRING });

      Player.hasOne(Shoe);
      Shoe.belongsTo(Player);

      await this.sequelize.sync({ force: true });

      const shoe = await Shoe.create({
        brand: 'the brand',
        Player: {
          name: 'the player'
        }
      }, { include: [Player] });

      const lePlayer1 = await Player.findOne({
        where: { id: shoe.Player.id },
        include: [Shoe]
      });

      expect(lePlayer1.Shoe).not.to.be.null;
      await lePlayer1.Shoe.destroy();
      const lePlayer0 = lePlayer1;
      const lePlayer = await lePlayer0.reload();
      expect(lePlayer.Shoe).to.be.null;
    });

    it('should set an association to empty after all deletion, 1-N', async function() {
      const Team = this.sequelize.define('Team', { name: DataTypes.STRING }),
        Player = this.sequelize.define('Player', { name: DataTypes.STRING });

      Team.hasMany(Player);
      Player.belongsTo(Team);

      await this.sequelize.sync({ force: true });

      const team = await Team.create({
        name: 'the team',
        Players: [{
          name: 'the player1'
        }, {
          name: 'the player2'
        }]
      }, { include: [Player] });

      const leTeam1 = await Team.findOne({
        where: { id: team.id },
        include: [Player]
      });

      expect(leTeam1.Players).not.to.be.empty;
      await leTeam1.Players[1].destroy();
      await leTeam1.Players[0].destroy();
      const leTeam0 = leTeam1;
      const leTeam = await leTeam0.reload();
      expect(leTeam.Players).to.be.empty;
    });

    it('should update the associations after one element deleted', async function() {
      const Team = this.sequelize.define('Team', { name: DataTypes.STRING }),
        Player = this.sequelize.define('Player', { name: DataTypes.STRING });

      Team.hasMany(Player);
      Player.belongsTo(Team);


      await this.sequelize.sync({ force: true });

      const team = await Team.create({
        name: 'the team',
        Players: [{
          name: 'the player1'
        }, {
          name: 'the player2'
        }]
      }, { include: [Player] });

      const leTeam1 = await Team.findOne({
        where: { id: team.id },
        include: [Player]
      });

      expect(leTeam1.Players).to.have.length(2);
      await leTeam1.Players[0].destroy();
      const leTeam0 = leTeam1;
      const leTeam = await leTeam0.reload();
      expect(leTeam.Players).to.have.length(1);
    });

    it('should inject default scope when reloading', async function() {
      const Bar = this.sequelize.define('Bar', {
        name: DataTypes.TEXT
      });

      const Foo = this.sequelize.define('Foo', {
        name: DataTypes.TEXT
      }, {
        defaultScope: {
          include: [{ model: Bar }]
        }
      });

      Bar.belongsTo(Foo);
      Foo.hasMany(Bar);

      await this.sequelize.sync();

      const foo = await Foo.create({ name: 'foo' });
      await foo.createBar({ name: 'bar' });
      const fooFromFind = await Foo.findByPk(foo.id);

      expect(fooFromFind.Bars).to.be.ok;
      expect(fooFromFind.Bars[0].name).to.equal('bar');

      await foo.reload();

      expect(foo.Bars).to.be.ok;
      expect(foo.Bars[0].name).to.equal('bar');
    });
  });
});
