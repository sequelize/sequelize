'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../../support'),
  DataTypes = require(__dirname + '/../../../../lib/data-types'),
  dialect = Support.getTestDialect(),
  dbFile = __dirname + '/test.sqlite',
  storages = [dbFile];

if (dialect === 'sqlite') {
  describe('[SQLITE Specific] DAOFactory', () => {
    after(function() {
      this.sequelize.options.storage = ':memory:';
    });

    beforeEach(function() {
      this.sequelize.options.storage = dbFile;
      this.User = this.sequelize.define('User', {
        age: DataTypes.INTEGER,
        name: DataTypes.STRING,
        bio: DataTypes.TEXT
      });
      return this.User.sync({ force: true });
    });

    storages.forEach(storage => {
      describe('with storage "' + storage + '"', () => {
        after(() => {
          if (storage === dbFile) {
            require('fs').writeFileSync(dbFile, '');
          }
        });

        describe('create', () => {
          it('creates a table entry', function() {
            const self = this;
            return this.User.create({ age: 21, name: 'John Wayne', bio: 'noot noot' }).then(user => {
              expect(user.age).to.equal(21);
              expect(user.name).to.equal('John Wayne');
              expect(user.bio).to.equal('noot noot');

              return self.User.findAll().then(users => {
                const usernames = users.map(user => {
                  return user.name;
                });
                expect(usernames).to.contain('John Wayne');
              });
            });
          });

          it('should allow the creation of an object with options as attribute', function() {
            const Person = this.sequelize.define('Person', {
              name: DataTypes.STRING,
              options: DataTypes.TEXT
            });

            return Person.sync({ force: true }).then(() => {
              const options = JSON.stringify({ foo: 'bar', bar: 'foo' });

              return Person.create({
                name: 'John Doe',
                options
              }).then(people => {
                expect(people.options).to.deep.equal(options);
              });
            });
          });

          it('should allow the creation of an object with a boolean (true) as attribute', function() {
            const Person = this.sequelize.define('Person', {
              name: DataTypes.STRING,
              has_swag: DataTypes.BOOLEAN
            });

            return Person.sync({ force: true }).then(() => {
              return Person.create({
                name: 'John Doe',
                has_swag: true
              }).then(people => {
                expect(people.has_swag).to.be.ok;
              });
            });
          });

          it('should allow the creation of an object with a boolean (false) as attribute', function() {
            const Person = this.sequelize.define('Person', {
              name: DataTypes.STRING,
              has_swag: DataTypes.BOOLEAN
            });

            return Person.sync({ force: true }).then(() => {
              return Person.create({
                name: 'John Doe',
                has_swag: false
              }).then(people => {
                expect(people.has_swag).to.not.be.ok;
              });
            });
          });
        });

        describe('.find', () => {
          beforeEach(function() {
            return this.User.create({name: 'user', bio: 'footbar'});
          });

          it('finds normal lookups', function() {
            return this.User.find({ where: { name: 'user' } }).then(user => {
              expect(user.name).to.equal('user');
            });
          });

          it.skip('should make aliased attributes available', function() {
            return this.User.find({ where: { name: 'user' }, attributes: ['id', ['name', 'username']] }).then(user => {
              expect(user.username).to.equal('user');
            });
          });
        });

        describe('.all', () => {
          beforeEach(function() {
            return this.User.bulkCreate([
              {name: 'user', bio: 'foobar'},
              {name: 'user', bio: 'foobar'}
            ]);
          });

          it('should return all users', function() {
            return this.User.findAll().then(users => {
              expect(users).to.have.length(2);
            });
          });
        });

        describe('.min', () => {
          it('should return the min value', function() {
            const self = this,
              users = [];

            for (let i = 2; i < 5; i++) {
              users[users.length] = {age: i};
            }

            return this.User.bulkCreate(users).then(() => {
              return self.User.min('age').then(min => {
                expect(min).to.equal(2);
              });
            });
          });
        });

        describe('.max', () => {
          it('should return the max value', function() {
            const self = this,
              users = [];

            for (let i = 2; i <= 5; i++) {
              users[users.length] = {age: i};
            }

            return this.User.bulkCreate(users).then(() => {
              return self.User.max('age').then(min => {
                expect(min).to.equal(5);
              });
            });
          });
        });
      });
    });
  });
}
