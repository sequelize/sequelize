'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  DataTypes = require('sequelize/lib/data-types'),
  dialect = Support.getTestDialect(),
  dbFile = 'test.sqlite',
  storages = [dbFile];

if (dialect === 'sqlite') {
  describe('[SQLITE Specific] DAOFactory', () => {
    after(function() {
      this.sequelize.options.storage = ':memory:';
    });

    beforeEach(async function() {
      this.sequelize.options.storage = dbFile;
      this.User = this.sequelize.define('User', {
        age: DataTypes.INTEGER,
        name: DataTypes.STRING,
        bio: DataTypes.TEXT
      });
      await this.User.sync({ force: true });
    });

    storages.forEach(storage => {
      describe(`with storage "${storage}"`, () => {
        after(() => {
          if (storage === dbFile) {
            require('fs').writeFileSync(dbFile, '');
          }
        });

        describe('create', () => {
          it('creates a table entry', async function() {
            const user = await this.User.create({ age: 21, name: 'John Wayne', bio: 'noot noot' });
            expect(user.age).to.equal(21);
            expect(user.name).to.equal('John Wayne');
            expect(user.bio).to.equal('noot noot');

            const users = await this.User.findAll();
            const usernames = users.map(user => {
              return user.name;
            });
            expect(usernames).to.contain('John Wayne');
          });

          it('should allow the creation of an object with options as attribute', async function() {
            const Person = this.sequelize.define('Person', {
              name: DataTypes.STRING,
              options: DataTypes.TEXT
            });

            await Person.sync({ force: true });
            const options = JSON.stringify({ foo: 'bar', bar: 'foo' });

            const people = await Person.create({
              name: 'John Doe',
              options
            });

            expect(people.options).to.deep.equal(options);
          });

          it('should allow the creation of an object with a boolean (true) as attribute', async function() {
            const Person = this.sequelize.define('Person', {
              name: DataTypes.STRING,
              has_swag: DataTypes.BOOLEAN
            });

            await Person.sync({ force: true });

            const people = await Person.create({
              name: 'John Doe',
              has_swag: true
            });

            expect(people.has_swag).to.be.ok;
          });

          it('should allow the creation of an object with a boolean (false) as attribute', async function() {
            const Person = this.sequelize.define('Person', {
              name: DataTypes.STRING,
              has_swag: DataTypes.BOOLEAN
            });

            await Person.sync({ force: true });

            const people = await Person.create({
              name: 'John Doe',
              has_swag: false
            });

            expect(people.has_swag).to.not.be.ok;
          });
        });

        describe('.findOne', () => {
          beforeEach(async function() {
            await this.User.create({ name: 'user', bio: 'footbar' });
          });

          it('finds normal lookups', async function() {
            const user = await this.User.findOne({ where: { name: 'user' } });
            expect(user.name).to.equal('user');
          });

          it.skip('should make aliased attributes available', async function() { // eslint-disable-line mocha/no-skipped-tests
            const user = await this.User.findOne({
              where: { name: 'user' },
              attributes: ['id', ['name', 'username']]
            });

            expect(user.username).to.equal('user');
          });
        });

        describe('.all', () => {
          beforeEach(async function() {
            await this.User.bulkCreate([
              { name: 'user', bio: 'foobar' },
              { name: 'user', bio: 'foobar' }
            ]);
          });

          it('should return all users', async function() {
            const users = await this.User.findAll();
            expect(users).to.have.length(2);
          });
        });

        describe('.min', () => {
          it('should return the min value', async function() {
            const users = [];

            for (let i = 2; i < 5; i++) {
              users[users.length] = { age: i };
            }

            await this.User.bulkCreate(users);
            const min = await this.User.min('age');
            expect(min).to.equal(2);
          });
        });

        describe('.max', () => {
          it('should return the max value', async function() {
            const users = [];

            for (let i = 2; i <= 5; i++) {
              users[users.length] = { age: i };
            }

            await this.User.bulkCreate(users);
            const min = await this.User.max('age');
            expect(min).to.equal(5);
          });
        });
      });
    });
  });
}
