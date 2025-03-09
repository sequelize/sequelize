'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');
const { DataTypes } = require('@sequelize/core');
const {
  beforeEach2,
  createSequelizeInstance,
  getSqliteDatabasePath,
  unlinkIfExists,
} = require('../../../support');

const dialect = Support.getTestDialect();
const dbFile = getSqliteDatabasePath('dao.sqlite');

describe('[SQLITE Specific] DAOFactory', () => {
  if (dialect !== 'sqlite3') {
    return;
  }

  function deleteTempFiles() {
    return unlinkIfExists(dbFile);
  }

  after(deleteTempFiles);

  const vars = beforeEach2(async () => {
    await deleteTempFiles();

    const sequelize = createSequelizeInstance({
      storage: dbFile,
    });

    const User = sequelize.define('User', {
      age: DataTypes.INTEGER,
      name: DataTypes.STRING,
      bio: DataTypes.TEXT,
    });
    await User.sync({ force: true });

    return { sequelize, User };
  });

  afterEach(() => {
    return vars.sequelize.close();
  });

  describe('create', () => {
    it('creates a table entry', async () => {
      const { User } = vars;

      const user = await User.create({ age: 21, name: 'John Wayne', bio: 'noot noot' });
      expect(user.age).to.equal(21);
      expect(user.name).to.equal('John Wayne');
      expect(user.bio).to.equal('noot noot');

      const users = await User.findAll();
      const usernames = users.map(user => {
        return user.name;
      });
      expect(usernames).to.contain('John Wayne');
    });

    it('should allow the creation of an object with options as attribute', async () => {
      const { sequelize } = vars;

      const Person = sequelize.define('Person', {
        name: DataTypes.STRING,
        options: DataTypes.TEXT,
      });

      await Person.sync({ force: true });
      const options = JSON.stringify({ foo: 'bar', bar: 'foo' });

      const people = await Person.create({
        name: 'John Doe',
        options,
      });

      expect(people.options).to.deep.equal(options);
    });

    it('should allow the creation of an object with a boolean (true) as attribute', async () => {
      const { sequelize } = vars;

      const Person = sequelize.define('Person', {
        name: DataTypes.STRING,
        has_swag: DataTypes.BOOLEAN,
      });

      await Person.sync({ force: true });

      const people = await Person.create({
        name: 'John Doe',
        has_swag: true,
      });

      expect(people.has_swag).to.be.ok;
    });

    it('should allow the creation of an object with a boolean (false) as attribute', async () => {
      const { sequelize } = vars;

      const Person = sequelize.define('Person', {
        name: DataTypes.STRING,
        has_swag: DataTypes.BOOLEAN,
      });

      await Person.sync({ force: true });

      const people = await Person.create({
        name: 'John Doe',
        has_swag: false,
      });

      expect(people.has_swag).to.not.be.ok;
    });
  });

  describe('.findOne', () => {
    beforeEach(async () => {
      const { User } = vars;

      await User.create({ name: 'user', bio: 'footbar' });
    });

    it('finds normal lookups', async () => {
      const { User } = vars;

      const user = await User.findOne({ where: { name: 'user' } });
      expect(user.name).to.equal('user');
    });
  });

  describe('.all', () => {
    beforeEach(async () => {
      const { User } = vars;

      await User.bulkCreate([
        { name: 'user', bio: 'foobar' },
        { name: 'user', bio: 'foobar' },
      ]);
    });

    it('should return all users', async () => {
      const { User } = vars;

      const users = await User.findAll();
      expect(users).to.have.length(2);
    });
  });

  describe('.min', () => {
    it('should return the min value', async () => {
      const { User } = vars;

      const users = [];

      for (let i = 2; i < 5; i++) {
        users[users.length] = { age: i };
      }

      await User.bulkCreate(users);
      const min = await User.min('age');
      expect(min).to.equal(2);
    });
  });

  describe('.max', () => {
    it('should return the max value', async () => {
      const { User } = vars;

      const users = [];

      for (let i = 2; i <= 5; i++) {
        users[users.length] = { age: i };
      }

      await User.bulkCreate(users);
      const min = await User.max('age');
      expect(min).to.equal(5);
    });
  });
});
