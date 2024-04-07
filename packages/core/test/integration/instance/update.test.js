'use strict';

const chai = require('chai');
const sinon = require('sinon');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes, Sequelize, sql } = require('@sequelize/core');

const current = Support.sequelize;

describe('Model#update', () => {
  beforeEach(async function () {
    this.User = this.sequelize.define('User', {
      username: { type: DataTypes.STRING },
      uuidv1: { type: DataTypes.UUID, defaultValue: sql.uuidV1 },
      uuidv4: { type: DataTypes.UUID, defaultValue: sql.uuidV4 },
      touchedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      aNumber: { type: DataTypes.INTEGER },
      bNumber: { type: DataTypes.INTEGER },
      aDate: { type: DataTypes.DATE },

      validateTest: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: { isInt: true },
      },
      validateCustom: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: { len: { msg: 'Length failed.', args: [1, 20] } },
      },
      validateSideEffect: {
        type: DataTypes.VIRTUAL,
        allowNull: true,
        validate: { isInt: true },
        set(val) {
          this.setDataValue('validateSideEffect', val);
          this.setDataValue('validateSideAffected', val * 2);
        },
      },
      validateSideAffected: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: { isInt: true },
      },

      dateAllowNullTrue: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    });
    await this.User.sync({ force: true });
  });

  context('Fake Timers Suite', () => {
    before(function () {
      this.clock = sinon.useFakeTimers();
    });

    after(function () {
      this.clock.restore();
    });

    it('should update timestamps with milliseconds', async function () {
      const User = this.sequelize.define(
        `User${Support.rand()}`,
        {
          name: DataTypes.STRING,
          bio: DataTypes.TEXT,
          email: DataTypes.STRING,
        },
        {
          timestamps: true,
        },
      );

      this.clock.tick(2100); // move the clock forward 2100 ms.

      await User.sync({ force: true });

      const user0 = await User.create({
        name: 'snafu',
        email: 'email',
      });

      const user = await user0.reload();
      expect(user.get('name')).to.equal('snafu');
      expect(user.get('email')).to.equal('email');
      const testDate = new Date();
      testDate.setTime(2100);
      expect(user.get('createdAt')).to.equalTime(testDate);
    });

    it('does not update timestamps when option "silent=true" is used', async function () {
      const user = await this.User.create({ username: 'user' });
      const updatedAt = user.updatedAt;

      this.clock.tick(1000);

      await user.update(
        {
          username: 'userman',
        },
        {
          silent: true,
        },
      );

      expect(user.updatedAt).to.equalTime(updatedAt);
    });

    it(`doesn't update primary keys or timestamps`, async function () {
      const User = this.sequelize.define(`User${Support.rand()}`, {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
        identifier: { type: DataTypes.STRING, primaryKey: true },
      });

      await User.sync({ force: true });

      const user = await User.create({
        name: 'snafu',
        identifier: 'identifier',
      });

      const oldCreatedAt = user.createdAt;
      const oldUpdatedAt = user.updatedAt;
      const oldIdentifier = user.identifier;

      this.clock.tick(1000);

      const user0 = await user.update({
        name: 'foobar',
        createdAt: new Date(2000, 1, 1),
        identifier: 'another identifier',
      });

      expect(new Date(user0.createdAt)).to.equalDate(new Date(oldCreatedAt));
      expect(new Date(user0.updatedAt)).to.not.equalTime(new Date(oldUpdatedAt));
      expect(user0.identifier).to.equal(oldIdentifier);
    });
  });

  if (current.dialect.supports.transactions) {
    it('supports transactions', async function () {
      const sequelize = await Support.createSingleTransactionalTestSequelizeInstance(
        this.sequelize,
      );
      const User = sequelize.define('User', { username: DataTypes.STRING });

      await User.sync({ force: true });
      const user = await User.create({ username: 'foo' });
      const t = await sequelize.startUnmanagedTransaction();
      await user.update({ username: 'bar' }, { transaction: t });
      const users1 = await User.findAll();
      const users2 = await User.findAll({ transaction: t });
      expect(users1[0].username).to.equal('foo');
      expect(users2[0].username).to.equal('bar');
      await t.rollback();
    });
  }

  it('should update fields that are not specified on create', async function () {
    const User = this.sequelize.define(`User${Support.rand()}`, {
      name: DataTypes.STRING,
      bio: DataTypes.TEXT,
      email: DataTypes.STRING,
    });

    await User.sync({ force: true });

    const user1 = await User.create(
      {
        name: 'snafu',
        email: 'email',
      },
      {
        fields: ['name', 'email'],
      },
    );

    const user0 = await user1.update({ bio: 'swag' });
    const user = await user0.reload();
    expect(user.get('name')).to.equal('snafu');
    expect(user.get('email')).to.equal('email');
    expect(user.get('bio')).to.equal('swag');
  });

  it('should succeed in updating when values are unchanged (without timestamps)', async function () {
    const User = this.sequelize.define(
      `User${Support.rand()}`,
      {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
        email: DataTypes.STRING,
      },
      {
        timestamps: false,
      },
    );

    await User.sync({ force: true });

    const user1 = await User.create(
      {
        name: 'snafu',
        email: 'email',
      },
      {
        fields: ['name', 'email'],
      },
    );

    const user0 = await user1.update({
      name: 'snafu',
      email: 'email',
    });

    const user = await user0.reload();
    expect(user.get('name')).to.equal('snafu');
    expect(user.get('email')).to.equal('email');
  });

  it('should only save passed attributes', async function () {
    const user = this.User.build();
    await user.save();
    user.set('validateTest', 5);
    expect(user.changed('validateTest')).to.be.ok;

    await user.update({
      validateCustom: '1',
    });

    expect(user.changed('validateTest')).to.be.ok;
    expect(user.validateTest).to.equal(5);
    await user.reload();
    expect(user.validateTest).to.not.be.equal(5);
  });

  it('should save attributes affected by setters', async function () {
    const user = await this.User.create();
    await user.update({ validateSideEffect: 5 });
    expect(user.validateSideEffect).to.equal(5);
    await user.reload();
    expect(user.validateSideAffected).to.equal(10);
    expect(user.validateSideEffect).not.to.be.ok;
  });

  it('fails if the update was made to a new record which is not persisted', async function () {
    const Foo = this.sequelize.define(
      'Foo',
      {
        name: { type: DataTypes.STRING },
      },
      { noPrimaryKey: true },
    );
    await Foo.sync({ force: true });

    const instance = Foo.build({ name: 'FooBar' }, { isNewRecord: true });
    await expect(instance.update()).to.be.rejectedWith(
      'You attempted to update an instance that is not persisted.',
    );
  });

  describe('hooks', () => {
    it('should update attributes added in hooks when default fields are used', async function () {
      const User = this.sequelize.define(`User${Support.rand()}`, {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
        email: DataTypes.STRING,
      });

      User.beforeUpdate(instance => {
        instance.set('email', 'B');
      });

      await User.sync({ force: true });

      const user0 = await User.create({
        name: 'A',
        bio: 'A',
        email: 'A',
      });

      await user0.update({
        name: 'B',
        bio: 'B',
      });

      const user = await User.findOne({});
      expect(user.get('name')).to.equal('B');
      expect(user.get('bio')).to.equal('B');
      expect(user.get('email')).to.equal('B');
    });

    it('should update attributes changed in hooks when default fields are used', async function () {
      const User = this.sequelize.define(`User${Support.rand()}`, {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
        email: DataTypes.STRING,
      });

      User.beforeUpdate(instance => {
        instance.set('email', 'C');
      });

      await User.sync({ force: true });

      const user0 = await User.create({
        name: 'A',
        bio: 'A',
        email: 'A',
      });

      await user0.update({
        name: 'B',
        bio: 'B',
        email: 'B',
      });

      const user = await User.findOne({});
      expect(user.get('name')).to.equal('B');
      expect(user.get('bio')).to.equal('B');
      expect(user.get('email')).to.equal('C');
    });

    it('should work on a model with an attribute named length', async function () {
      const Box = this.sequelize.define('box', {
        length: DataTypes.INTEGER,
        width: DataTypes.INTEGER,
        height: DataTypes.INTEGER,
      });

      await Box.sync({ force: true });

      const box0 = await Box.create({
        length: 1,
        width: 2,
        height: 3,
      });

      await box0.update({
        length: 4,
        width: 5,
        height: 6,
      });

      const box = await Box.findOne({});
      expect(box.get('length')).to.equal(4);
      expect(box.get('width')).to.equal(5);
      expect(box.get('height')).to.equal(6);
    });

    it('runs validation', async function () {
      const user = await this.User.create({ aNumber: 0 });

      const error = await expect(user.update({ validateTest: 'hello' })).to.be.rejectedWith(
        Sequelize.ValidationError,
      );

      expect(error).to.exist;
      expect(error).to.be.instanceof(Object);
      expect(error.get('validateTest')).to.exist;
      expect(error.get('validateTest')).to.be.instanceof(Array);
      expect(error.get('validateTest')[1]).to.exist;
      expect(error.get('validateTest')[1].message).to.equal(
        'Validation isInt on validateTest failed',
      );
    });

    it('should validate attributes added in hooks when default fields are used', async function () {
      const User = this.sequelize.define(`User${Support.rand()}`, {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
        email: {
          type: DataTypes.STRING,
          validate: {
            isEmail: true,
          },
        },
      });

      User.beforeUpdate(instance => {
        instance.set('email', 'B');
      });

      await User.sync({ force: true });

      const user0 = await User.create({
        name: 'A',
        bio: 'A',
        email: 'valid.email@gmail.com',
      });

      await expect(
        user0.update({
          name: 'B',
        }),
      ).to.be.rejectedWith(Sequelize.ValidationError);

      const user = await User.findOne({});
      expect(user.get('email')).to.equal('valid.email@gmail.com');
    });

    it('should validate attributes changed in hooks when default fields are used', async function () {
      const User = this.sequelize.define(`User${Support.rand()}`, {
        name: DataTypes.STRING,
        bio: DataTypes.TEXT,
        email: {
          type: DataTypes.STRING,
          validate: {
            isEmail: true,
          },
        },
      });

      User.beforeUpdate(instance => {
        instance.set('email', 'B');
      });

      await User.sync({ force: true });

      const user0 = await User.create({
        name: 'A',
        bio: 'A',
        email: 'valid.email@gmail.com',
      });

      await expect(
        user0.update({
          name: 'B',
          email: 'still.valid.email@gmail.com',
        }),
      ).to.be.rejectedWith(Sequelize.ValidationError);

      const user = await User.findOne({});
      expect(user.get('email')).to.equal('valid.email@gmail.com');
    });
  });

  it('should not set attributes that are not specified by fields', async function () {
    const User = this.sequelize.define(`User${Support.rand()}`, {
      name: DataTypes.STRING,
      bio: DataTypes.TEXT,
      email: DataTypes.STRING,
    });

    await User.sync({ force: true });

    const user0 = await User.create({
      name: 'snafu',
      email: 'email',
    });

    const user = await user0.update(
      {
        bio: 'heyo',
        email: 'heho',
      },
      {
        fields: ['bio'],
      },
    );

    expect(user.get('name')).to.equal('snafu');
    expect(user.get('email')).to.equal('email');
    expect(user.get('bio')).to.equal('heyo');
  });

  it('updates attributes in the database', async function () {
    const user = await this.User.create({ username: 'user' });
    expect(user.username).to.equal('user');
    const user0 = await user.update({ username: 'person' });
    expect(user0.username).to.equal('person');
  });

  it('ignores unknown attributes', async function () {
    const user = await this.User.create({ username: 'user' });
    const user0 = await user.update({ username: 'person', foo: 'bar' });
    expect(user0.username).to.equal('person');
    expect(user0.foo).not.to.exist;
  });

  it('ignores undefined attributes', async function () {
    await this.User.sync({ force: true });
    const user = await this.User.create({ username: 'user' });
    const user0 = await user.update({ username: undefined });
    expect(user0.username).to.equal('user');
  });

  // NOTE: This is a regression test for https://github.com/sequelize/sequelize/issues/12717
  it('updates attributes for model with date pk (#12717)', async function () {
    const Event = this.sequelize.define('Event', {
      date: { type: DataTypes.DATE, allowNull: false, primaryKey: true },
      name: { type: DataTypes.STRING },
    });

    await Event.sync({ force: true });
    const event = await Event.create({
      date: new Date(),
      name: 'event',
    });

    expect(event.name).to.equal('event');
    await event.update({ name: 'event updated' });

    const event0 = await Event.findOne({ where: { date: event.date } });
    expect(event0.name).to.equal('event updated');
  });

  it('stores and restores null values', async function () {
    const Download = this.sequelize.define('download', {
      startedAt: DataTypes.DATE,
      canceledAt: DataTypes.DATE,
      finishedAt: DataTypes.DATE,
    });

    await Download.sync();

    const download = await Download.create({
      startedAt: new Date(),
    });

    expect(download.startedAt instanceof Date).to.be.true;
    expect(download.canceledAt).to.not.be.ok;
    expect(download.finishedAt).to.not.be.ok;

    const download0 = await download.update({
      canceledAt: new Date(),
    });

    expect(download0.startedAt instanceof Date).to.be.true;
    expect(download0.canceledAt instanceof Date).to.be.true;
    expect(download0.finishedAt).to.not.be.ok;

    const downloads = await Download.findAll({
      where: { finishedAt: null },
    });

    for (const download of downloads) {
      expect(download.startedAt instanceof Date).to.be.true;
      expect(download.canceledAt instanceof Date).to.be.true;
      expect(download.finishedAt).to.not.be.ok;
    }
  });

  it('should support logging', async function () {
    const spy = sinon.spy();

    const user = await this.User.create({});
    await user.update({ username: 'yolo' }, { logging: spy });
    expect(spy.called).to.be.ok;
  });

  it('supports falsy primary keys', async () => {
    const Book = current.define('Book', {
      id: {
        type: DataTypes.INTEGER,
        // must have autoIncrement disabled, as mysql treats 0 as "generate next value"
        autoIncrement: false,
        primaryKey: true,
      },
      title: { type: DataTypes.STRING },
    });

    await Book.sync();

    const title1 = 'title 1';
    const title2 = 'title 2';

    const book1 = await Book.create({ id: 0, title: title1 });
    expect(book1.id).to.equal(0);
    expect(book1.title).to.equal(title1);

    const book2 = await Book.findByPk(0, { rejectOnEmpty: true });
    expect(book2.id).to.equal(0);
    expect(book2.title).to.equal(title1);

    await book2.update({ title: title2 });
    expect(book2.id).to.equal(0);
    expect(book2.title).to.equal(title2);
  });
});
