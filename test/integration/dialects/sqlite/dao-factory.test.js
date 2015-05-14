'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , DataTypes = require(__dirname + '/../../../../lib/data-types')
  , dialect = Support.getTestDialect()
  , dbFile = __dirname + '/test.sqlite'
  , storages = [dbFile];

if (dialect === 'sqlite') {
  describe('[SQLITE Specific] DAOFactory', function() {
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

    storages.forEach(function(storage) {
      describe('with storage "' + storage + '"', function() {
        after(function() {
          if (storage === dbFile) {
            require('fs').writeFileSync(dbFile, '');
          }
        });

        describe('create', function() {
          it('creates a table entry', function() {
            var self = this;
            return this.User.create({ age: 21, name: 'John Wayne', bio: 'noot noot' }).then(function(user) {
              expect(user.age).to.equal(21);
              expect(user.name).to.equal('John Wayne');
              expect(user.bio).to.equal('noot noot');

              return self.User.findAll().then(function(users) {
                var usernames = users.map(function(user) {
                  return user.name;
                });
                expect(usernames).to.contain('John Wayne');
              });
            });
          });

          it('should allow the creation of an object with options as attribute', function() {
            var Person = this.sequelize.define('Person', {
              name: DataTypes.STRING,
              options: DataTypes.TEXT
            });

            return Person.sync({ force: true }).then(function() {
              var options = JSON.stringify({ foo: 'bar', bar: 'foo' });

              return Person.create({
                name: 'John Doe',
                options: options
              }).then(function(people) {
                expect(people.options).to.deep.equal(options);
              });
            });
          });

          it('should allow the creation of an object with a boolean (true) as attribute', function() {
            var Person = this.sequelize.define('Person', {
              name: DataTypes.STRING,
              has_swag: DataTypes.BOOLEAN
            });

            return Person.sync({ force: true }).then(function() {
              return Person.create({
                name: 'John Doe',
                has_swag: true
              }).then(function(people) {
                expect(people.has_swag).to.be.ok;
              });
            });
          });

          it('should allow the creation of an object with a boolean (false) as attribute', function() {
            var Person = this.sequelize.define('Person', {
              name: DataTypes.STRING,
              has_swag: DataTypes.BOOLEAN
            });

            return Person.sync({ force: true }).then(function() {
              return Person.create({
                name: 'John Doe',
                has_swag: false
              }).then(function(people) {
                expect(people.has_swag).to.not.be.ok;
              });
            });
          });
        });

        describe('.find', function() {
          beforeEach(function() {
            return this.User.create({name: 'user', bio: 'footbar'});
          });

          it('finds normal lookups', function() {
            return this.User.find({ where: { name: 'user' } }).then(function(user) {
              expect(user.name).to.equal('user');
            });
          });

          it.skip('should make aliased attributes available', function() {
            return this.User.find({ where: { name: 'user' }, attributes: ['id', ['name', 'username']] }).then(function(user) {
              expect(user.username).to.equal('user');
            });
          });
        });

        describe('.all', function() {
          beforeEach(function() {
            return this.User.bulkCreate([
              {name: 'user', bio: 'foobar'},
              {name: 'user', bio: 'foobar'}
            ]);
          });

          it('should return all users', function() {
            return this.User.findAll().then(function(users) {
              expect(users).to.have.length(2);
            });
          });
        });

        describe('.min', function() {
          it('should return the min value', function() {
            var self = this
              , users = [];

            for (var i = 2; i < 5; i++) {
              users[users.length] = {age: i};
            }

            return this.User.bulkCreate(users).then(function() {
              return self.User.min('age').then(function(min) {
                expect(min).to.equal(2);
              });
            });
          });
        });

        describe('.max', function() {
          it('should return the max value', function() {
            var self = this
              , users = [];

            for (var i = 2; i <= 5; i++) {
              users[users.length] = {age: i};
            }

            return this.User.bulkCreate(users).then(function() {
              return self.User.max('age').then(function(min) {
                expect(min).to.equal(5);
              });
            });
          });
        });
      });
    });
  });
}
