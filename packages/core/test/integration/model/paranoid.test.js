'use strict';

const Support = require('../support');
const { DataTypes } = require('@sequelize/core');
const chai = require('chai');

const expect = chai.expect;
const sinon = require('sinon');

const current = Support.sequelize;
const { dialect } = current;
const dialectName = dialect.name;

describe('Paranoid Model', () => {
  before(function () {
    this.clock = sinon.useFakeTimers();
  });

  after(function () {
    this.clock.restore();
  });

  it('should be able to soft delete with timestamps', async function () {
    const Account = this.sequelize.define(
      'Account',
      {
        ownerId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'owner_id',
        },
        name: {
          type: DataTypes.STRING,
        },
      },
      {
        paranoid: true,
        timestamps: true,
      },
    );

    await Account.sync({ force: true });
    await Account.create({ ownerId: 12 });
    const count2 = await Account.count();
    expect(count2).to.equal(1);
    const result = await Account.destroy({ where: { ownerId: 12 } });
    expect(result).to.equal(1);
    const count1 = await Account.count();
    expect(count1).to.equal(0);
    const count0 = await Account.count({ paranoid: false });
    expect(count0).to.equal(1);
    await Account.restore({ where: { ownerId: 12 } });
    const count = await Account.count();
    expect(count).to.equal(1);
  });

  it('should be able to soft delete without timestamps', async function () {
    const Account = this.sequelize.define(
      'Account',
      {
        ownerId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'owner_id',
        },
        name: {
          type: DataTypes.STRING,
        },
        deletedAt: {
          allowNull: true,
          field: 'deleted_at',
        },
      },
      {
        paranoid: true,
        timestamps: true,
        deletedAt: 'deletedAt',
        createdAt: false,
        updatedAt: false,
      },
    );

    await Account.sync({ force: true });
    await Account.create({ ownerId: 12 });
    const count2 = await Account.count();
    expect(count2).to.equal(1);
    await Account.destroy({ where: { ownerId: 12 } });
    const count1 = await Account.count();
    expect(count1).to.equal(0);
    const count0 = await Account.count({ paranoid: false });
    expect(count0).to.equal(1);
    await Account.restore({ where: { ownerId: 12 } });
    const count = await Account.count();
    expect(count).to.equal(1);
  });

  if (current.dialect.supports.jsonOperations && current.dialect.supports.jsonExtraction.quoted) {
    describe('JSON Operations', () => {
      before(function () {
        this.Model = this.sequelize.define(
          'Model',
          {
            name: {
              type: DataTypes.STRING,
            },
            data: {
              type: dialectName === 'postgres' ? DataTypes.JSONB : DataTypes.JSON,
            },
            deletedAt: {
              type: DataTypes.DATE,
              allowNull: true,
              field: 'deleted_at',
            },
          },
          {
            paranoid: true,
            timestamps: true,
            deletedAt: 'deletedAt',
          },
        );
      });

      beforeEach(async function () {
        await this.Model.sync({ force: true });
      });

      it('should soft delete with JSON condition', async function () {
        await this.Model.bulkCreate([
          {
            name: 'One',
            data: {
              field: {
                deep: true,
              },
            },
          },
          {
            name: 'Two',
            data: {
              field: {
                deep: false,
              },
            },
          },
        ]);

        await this.Model.destroy({
          where: {
            data: {
              field: {
                deep: true,
              },
            },
          },
        });

        const records = await this.Model.findAll();
        expect(records.length).to.equal(1);
        expect(records[0].get('name')).to.equal('Two');
      });
    });
  }

  it(`prevents finding deleted records`, async function () {
    const User = this.sequelize.define(
      'UserCol',
      {
        username: DataTypes.STRING,
      },
      { paranoid: true },
    );

    await User.sync({ force: true });
    await User.bulkCreate([{ username: 'Toni' }, { username: 'Tobi' }, { username: 'Max' }]);
    const user = await User.findByPk(1);
    await user.destroy();
    expect(await User.findByPk(1)).to.be.null;
    expect(await User.count()).to.equal(2);
    expect(await User.findAll()).to.have.length(2);
  });

  it('allows finding deleted records if paranoid:false is used in the query', async function () {
    const User = this.sequelize.define(
      'UserCol',
      {
        username: DataTypes.STRING,
      },
      { paranoid: true },
    );

    await User.sync({ force: true });
    await User.bulkCreate([{ username: 'Toni' }, { username: 'Tobi' }, { username: 'Max' }]);
    const user = await User.findByPk(1);
    await user.destroy();
    expect(await User.findOne({ where: { id: 1 }, paranoid: false })).to.exist;
    expect(await User.findByPk(1)).to.be.null;
    expect(await User.count()).to.equal(2);
    expect(await User.count({ paranoid: false })).to.equal(3);
  });

  it('should include deleted associated records if include has paranoid marked as false', async function () {
    const User = this.sequelize.define(
      'User',
      {
        username: DataTypes.STRING,
      },
      { paranoid: true },
    );
    const Pet = this.sequelize.define(
      'Pet',
      {
        name: DataTypes.STRING,
        userId: DataTypes.INTEGER,
      },
      { paranoid: true },
    );

    User.hasMany(Pet);
    Pet.belongsTo(User);

    await User.sync({ force: true });
    await Pet.sync({ force: true });
    const userId = (await User.create({ username: 'Joe' })).id;
    await Pet.bulkCreate([
      { name: 'Fido', userId },
      { name: 'Fifi', userId },
    ]);
    const pet = await Pet.findByPk(1);
    await pet.destroy();
    const user = await User.findOne({
      where: { id: userId },
      include: Pet,
    });
    const userWithDeletedPets = await User.findOne({
      where: { id: userId },
      include: { model: Pet, paranoid: false },
    });
    expect(user).to.exist;
    expect(user.pets).to.have.length(1);
    expect(userWithDeletedPets).to.exist;
    expect(userWithDeletedPets.pets).to.have.length(2);
  });
});
