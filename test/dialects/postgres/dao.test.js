'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , dialect = Support.getTestDialect()
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , _ = require('lodash')
  , sequelize = require(__dirname + '/../../../lib/sequelize');

chai.config.includeStack = true;

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] DAO', function() {
    beforeEach(function(done) {
      this.sequelize.options.quoteIdentifiers = true;
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        email: { type: DataTypes.ARRAY(DataTypes.TEXT) },
        settings: DataTypes.HSTORE,
        document: { type: DataTypes.HSTORE, defaultValue: { default: "'value'" } },
        phones: DataTypes.ARRAY(DataTypes.HSTORE),
        emergency_contact: DataTypes.JSON
      });
      this.User.sync({ force: true }).success(function() {
        done();
      });
    });

    afterEach(function(done) {
      this.sequelize.options.quoteIdentifiers = true;
      done();
    });

    it('should be able to search within an array', function(done) {
      this.User.all({where: {email: ['hello', 'world']}}).on('sql', function(sql) {
        expect(sql).to.equal('SELECT "id", "username", "email", "settings", "document", "phones", "emergency_contact", "createdAt", "updatedAt" FROM "Users" AS "User" WHERE "User"."email" = ARRAY[\'hello\',\'world\']::TEXT[];');
        done();
      });
    });

    it('should be able to find a record while searching in an array', function(done) {
      var self = this;
      this.User.bulkCreate([
        {username: 'bob', email: ['myemail@email.com']},
        {username: 'tony', email: ['wrongemail@email.com']}
      ]).success(function() {
        self.User.all({where: {email: ['myemail@email.com']}}).success(function(user) {
          expect(user).to.be.instanceof(Array);
          expect(user).to.have.length(1);
          expect(user[0].username).to.equal('bob');
          done();
        });
      });
    });

    describe('json', function() {
      it('should tell me that a column is json', function() {
        return this.sequelize.queryInterface.describeTable('Users')
          .then(function(table) {
            expect(table.emergency_contact.type).to.equal('JSON');
          });
      });

      it('should stringify json with insert', function() {
        return this.User.create({
          username: 'bob',
          emergency_contact: { name: 'joe', phones: [1337, 42] }
        }).on('sql', function(sql) {
          var expected = 'INSERT INTO "Users" ("id","username","document","emergency_contact","createdAt","updatedAt") VALUES (DEFAULT,\'bob\',\'"default"=>"\'\'value\'\'"\',\'{"name":"joe","phones":[1337,42]}\'';
          expect(sql.indexOf(expected)).to.equal(0);
        });
      });

      it('should insert json using a custom field name', function() {
        var self = this;

        this.UserFields = this.sequelize.define('UserFields', {
          emergencyContact: { type: DataTypes.JSON, field: 'emergy_contact' }
        });
        return this.UserFields.sync({ force: true }).then(function() {
          return self.UserFields.create({
            emergencyContact: { name: 'joe', phones: [1337, 42] }
          }).then(function(user) {
            expect(user.emergencyContact.name).to.equal('joe');
          });
        });
      });

      it('should update json using a custom field name', function() {
        var self = this;

        this.UserFields = this.sequelize.define('UserFields', {
          emergencyContact: { type: DataTypes.JSON, field: 'emergy_contact' }
        });
        return this.UserFields.sync({ force: true }).then(function() {
          return self.UserFields.create({
            emergencyContact: { name: 'joe', phones: [1337, 42] }
          }).then(function(user) {
            user.emergencyContact = { name: 'larry' };
            return user.save();
          }).then(function(user) {
            expect(user.emergencyContact.name).to.equal('larry');
          });
        });
      });

      it('should be able retrieve json value as object', function() {
        var self = this;
        var emergencyContact = { name: 'kate', phone: 1337 };

        return this.User.create({ username: 'swen', emergency_contact: emergencyContact })
          .then(function(user) {
            expect(user.emergency_contact).to.eql(emergencyContact); // .eql does deep value comparison instead of strict equal comparison
            return self.User.find({ where: { username: 'swen' }, attributes: ['emergency_contact'] });
          })
          .then(function(user) {
            expect(user.emergency_contact).to.eql(emergencyContact);
          });
      });

      it('should be able to retrieve element of array by index', function() {
        var self = this;
        var emergencyContact = { name: 'kate', phones: [1337, 42] };

        return this.User.create({ username: 'swen', emergency_contact: emergencyContact })
          .then(function(user) {
            expect(user.emergency_contact).to.eql(emergencyContact);
            return self.User.find({ where: { username: 'swen' }, attributes: [[sequelize.json('emergency_contact.phones.1'), 'firstEmergencyNumber']] });
          })
          .then(function(user) {
            expect(parseInt(user.getDataValue('firstEmergencyNumber'))).to.equal(42);
          });
      });

      it('should be able to retrieve root level value of an object by key', function() {
        var self = this;
        var emergencyContact = { kate: 1337 };

        return this.User.create({ username: 'swen', emergency_contact: emergencyContact })
          .then(function(user) {
            expect(user.emergency_contact).to.eql(emergencyContact);
            return self.User.find({ where: { username: 'swen' }, attributes: [[sequelize.json('emergency_contact.kate'), 'katesNumber']] });
          })
          .then(function(user) {
            expect(parseInt(user.getDataValue('katesNumber'))).to.equal(1337);
          });
      });

      it('should be able to retrieve nested value of an object by path', function() {
        var self = this;
        var emergencyContact = { kate: { email: 'kate@kate.com', phones: [1337, 42] } };

        return this.User.create({ username: 'swen', emergency_contact: emergencyContact })
          .then(function(user) {
            expect(user.emergency_contact).to.eql(emergencyContact);
            return self.User.find({ where: { username: 'swen' }, attributes: [[sequelize.json('emergency_contact.kate.email'), 'katesEmail']] });
          })
          .then(function(user) {
            expect(user.getDataValue('katesEmail')).to.equal('kate@kate.com');
          })
          .then(function() {
            return self.User.find({ where: { username: 'swen' }, attributes: [[sequelize.json('emergency_contact.kate.phones.1'), 'katesFirstPhone']] });
          })
          .then(function(user) {
            expect(parseInt(user.getDataValue('katesFirstPhone'))).to.equal(42);
          });
      });

      it('should be able to retrieve a row based on the values of the json document', function() {
        var self = this;

        return this.sequelize.Promise.all([
          this.User.create({ username: 'swen', emergency_contact: { name: 'kate' } }),
          this.User.create({ username: 'anna', emergency_contact: { name: 'joe' } })])
          .then(function() {
            return self.User.find({ where: sequelize.json("emergency_contact->>'name'", 'kate'), attributes: ['username', 'emergency_contact'] });
          })
          .then(function(user) {
            expect(user.emergency_contact.name).to.equal('kate');
          });
      });

      it('should be able to query using the nested query language', function() {
        var self = this;

        return this.sequelize.Promise.all([
          this.User.create({ username: 'swen', emergency_contact: { name: 'kate' } }),
          this.User.create({ username: 'anna', emergency_contact: { name: 'joe' } })])
          .then(function() {
            return self.User.find({
              where: sequelize.json({ emergency_contact: { name: 'kate' } })
            });
          })
          .then(function(user) {
            expect(user.emergency_contact.name).to.equal('kate');
          });
      });

      it('should be ablo to query using dot syntax', function() {
        var self = this;

        return this.sequelize.Promise.all([
          this.User.create({ username: 'swen', emergency_contact: { name: 'kate' } }),
          this.User.create({ username: 'anna', emergency_contact: { name: 'joe' } })])
          .then(function() {
            return self.User.find({ where: sequelize.json('emergency_contact.name', 'joe') });
          })
          .then(function(user) {
            expect(user.emergency_contact.name).to.equal('joe');
          });
      });
    });

    describe('hstore', function() {
      it('should tell me that a column is hstore and not USER-DEFINED', function() {
        return this.sequelize.queryInterface.describeTable('Users').then(function(table) {
          expect(table.settings.type).to.equal('HSTORE');
          expect(table.document.type).to.equal('HSTORE');
        });
      });

      it('should stringify hstore with insert', function() {
        return this.User.create({
          username: 'bob',
          email: ['myemail@email.com'],
          settings: {mailing: false, push: 'facebook', frequency: 3}
        }).on('sql', function(sql) {
          var expected = 'INSERT INTO "Users" ("id","username","email","settings","document","createdAt","updatedAt") VALUES (DEFAULT,\'bob\',ARRAY[\'myemail@email.com\']::TEXT[],\'"mailing"=>"false","push"=>"facebook","frequency"=>"3"\',\'"default"=>"\'\'value\'\'"\'';
          expect(sql.indexOf(expected)).to.equal(0);
        });
      });

    });

    describe('enums', function() {
      it('should be able to ignore enum types that already exist', function(done) {
        var User = this.sequelize.define('UserEnums', {
          mood: DataTypes.ENUM('happy', 'sad', 'meh')
        });

        User.sync({ force: true }).success(function() {
          User.sync().success(function() {
            done();
          });
        });
      });

      it('should be able to create/drop enums multiple times', function(done) {
        var User = this.sequelize.define('UserEnums', {
          mood: DataTypes.ENUM('happy', 'sad', 'meh')
        });

        User.sync({ force: true }).success(function() {
          User.sync({ force: true }).success(function() {
            done();
          });
        });
      });

      it('should be able to create/drop multiple enums multiple times', function(done) {
        var DummyModel = this.sequelize.define('Dummy-pg', {
          username: DataTypes.STRING,
          theEnumOne: {
            type: DataTypes.ENUM,
            values: [
              'one',
              'two',
              'three'
            ]
          },
          theEnumTwo: {
            type: DataTypes.ENUM,
            values: [
              'four',
              'five',
              'six'
            ]
          }
        });

        DummyModel.sync({ force: true }).done(function(err) {
          expect(err).not.to.be.ok;
          // now sync one more time:
          DummyModel.sync({force: true}).done(function(err) {
            expect(err).not.to.be.ok;
            // sync without dropping
            DummyModel.sync().done(function(err) {
              expect(err).not.to.be.ok;
              done();
            });
          });
        });
      });

      it('should be able to add enum types', function(done) {
        var self = this
          , User = this.sequelize.define('UserEnums', {
              mood: DataTypes.ENUM('happy', 'sad', 'meh')
            });

        var _done = _.after(4, function() {
          done();
        });

        User.sync({ force: true }).success(function() {
          User = self.sequelize.define('UserEnums', {
            mood: DataTypes.ENUM('neutral', 'happy', 'sad', 'ecstatic', 'meh', 'joyful')
          });

          User.sync().success(function() {
            expect(User.rawAttributes.mood.values).to.deep.equal(['neutral', 'happy', 'sad', 'ecstatic', 'meh', 'joyful']);
            _done();
          }).on('sql', function(sql) {
            if (sql.indexOf('neutral') > -1) {
              expect(sql).to.equal("ALTER TYPE \"enum_UserEnums_mood\" ADD VALUE 'neutral' BEFORE 'happy'");
              _done();
            }
            else if (sql.indexOf('ecstatic') > -1) {
              expect(sql).to.equal("ALTER TYPE \"enum_UserEnums_mood\" ADD VALUE 'ecstatic' BEFORE 'meh'");
              _done();
            }
            else if (sql.indexOf('joyful') > -1) {
              expect(sql).to.equal("ALTER TYPE \"enum_UserEnums_mood\" ADD VALUE 'joyful' AFTER 'meh'");
              _done();
            }
          });
        });
      });
    });

    describe('integers', function() {
      describe('integer', function() {
        beforeEach(function(done) {
          this.User = this.sequelize.define('User', {
            aNumber: DataTypes.INTEGER
          });

          this.User.sync({ force: true }).success(function() {
            done();
          });
        });

        it('positive', function(done) {
          var User = this.User;

          User.create({aNumber: 2147483647}).success(function(user) {
            expect(user.aNumber).to.equal(2147483647);
            User.find({where: {aNumber: 2147483647}}).success(function(_user) {
              expect(_user.aNumber).to.equal(2147483647);
              done();
            });
          });
        });

        it('negative', function(done) {
          var User = this.User;

          User.create({aNumber: -2147483647}).success(function(user) {
            expect(user.aNumber).to.equal(-2147483647);
            User.find({where: {aNumber: -2147483647}}).success(function(_user) {
              expect(_user.aNumber).to.equal(-2147483647);
              done();
            });
          });
        });
      });

      describe('bigint', function() {
        beforeEach(function(done) {
          this.User = this.sequelize.define('User', {
            aNumber: DataTypes.BIGINT
          });

          this.User.sync({ force: true }).success(function() {
            done();
          });
        });

        it('positive', function(done) {
          var User = this.User;

          User.create({aNumber: '9223372036854775807'}).success(function(user) {
            expect(user.aNumber).to.equal('9223372036854775807');
            User.find({where: {aNumber: '9223372036854775807'}}).success(function(_user) {
              expect(_user.aNumber).to.equal('9223372036854775807');
              done();
            });
          });
        });

        it('negative', function(done) {
          var User = this.User;

          User.create({aNumber: '-9223372036854775807'}).success(function(user) {
            expect(user.aNumber).to.equal('-9223372036854775807');
            User.find({where: {aNumber: '-9223372036854775807'}}).success(function(_user) {
              expect(_user.aNumber).to.equal('-9223372036854775807');
              done();
            });
          });
        });
      });
    });

    describe('timestamps', function() {
      beforeEach(function(done) {
        this.User = this.sequelize.define('User', {
          dates: DataTypes.ARRAY(DataTypes.DATE)
        });
        this.User.sync({ force: true }).success(function() {
          done();
        });
      });

      it('should use postgres "TIMESTAMP WITH TIME ZONE" instead of "DATETIME"', function(done) {
        this.User.create({
          dates: []
        }).on('sql', function(sql) {
          expect(sql.indexOf('TIMESTAMP WITH TIME ZONE')).to.be.greaterThan(0);
          done();
        });
      });
    });

    describe('model', function() {
      it('create handles array correctly', function(done) {
        this.User
          .create({ username: 'user', email: ['foo@bar.com', 'bar@baz.com'] })
          .success(function(oldUser) {
            expect(oldUser.email).to.contain.members(['foo@bar.com', 'bar@baz.com']);
            done();
          })
          .error(function(err) {
            console.log(err);
          });
      });

      it('should save hstore correctly', function() {
        return this.User.create({ username: 'user', email: ['foo@bar.com'], settings: { created: '"value"' }}).then(function(newUser) {
          // Check to see if the default value for an hstore field works
          expect(newUser.document).to.deep.equal({ default: "'value'" });
          expect(newUser.settings).to.deep.equal({ created: '"value"' });

          // Check to see if updating an hstore field works
          return newUser.updateAttributes({settings: {should: 'update', to: 'this', first: 'place'}}).then(function(oldUser) {
            // Postgres always returns keys in alphabetical order (ascending)
            expect(oldUser.settings).to.deep.equal({first: 'place', should: 'update', to: 'this'});
          });
        });
      });

      it('should save hstore array correctly', function() {
        var User = this.User;

        return this.User.create({
          username: 'bob',
          email: ['myemail@email.com'],
          phones: [{ number: '123456789', type: 'mobile' }, { number: '987654321', type: 'landline' }, { number: '8675309', type: "Jenny's"}, {number: '5555554321', type: '"home"' }]
        }).then(function() {
          return User.find(1).then(function(user) {
            expect(user.phones.length).to.equal(4);
            expect(user.phones[1].number).to.equal('987654321');
            expect(user.phones[2].type).to.equal("Jenny's");
            expect(user.phones[3].type).to.equal('"home"');
          });
        });
      });

      it('should bulkCreate with hstore property', function() {
        var User = this.User;

        return this.User.bulkCreate([{
          username: 'bob',
          email: ['myemail@email.com'],
          settings: {mailing: true, push: 'facebook', frequency: 3}
        }]).then(function() {
          return User.find(1).then(function(user) {
            expect(user.settings.mailing).to.equal('true');
          });
        });
      });

      it('should update hstore correctly', function() {
        var self = this;

        return this.User.create({ username: 'user', email: ['foo@bar.com'], settings: { test: '"value"' }}).then(function(newUser) {
            // Check to see if the default value for an hstore field works
            expect(newUser.document).to.deep.equal({default: "'value'"});
            expect(newUser.settings).to.deep.equal({ test: '"value"' });

            // Check to see if updating an hstore field works
            return self.User.update({settings: {should: 'update', to: 'this', first: 'place'}}, {where: newUser.identifiers}).then(function() {
              return newUser.reload().success(function() {
                // Postgres always returns keys in alphabetical order (ascending)
                expect(newUser.settings).to.deep.equal({first: 'place', should: 'update', to: 'this'});
              });
            });
          });
      });

      it('should update hstore correctly and return the affected rows', function() {
        var self = this;

        return this.User.create({ username: 'user', email: ['foo@bar.com'], settings: { test: '"value"' }}).then(function(oldUser) {
            // Update the user and check that the returned object's fields have been parsed by the hstore library
            return self.User.update({settings: {should: 'update', to: 'this', first: 'place'}}, {where: oldUser.identifiers, returning: true }).spread(function(count, users) {
              expect(count).to.equal(1);
              expect(users[0].settings).to.deep.equal({should: 'update', to: 'this', first: 'place'});
            });
          });
      });

      it('should read hstore correctly', function() {
        var self = this;
        var data = { username: 'user', email: ['foo@bar.com'], settings: { test: '"value"' }};

        return this.User.create(data)
          .then(function() {
            return self.User.find({ where: { username: 'user' }});
          })
          .then(function(user) {
            // Check that the hstore fields are the same when retrieving the user
            expect(user.settings).to.deep.equal(data.settings);
          });
      });

      it('should read an hstore array correctly', function() {
        var self = this;
        var data = { username: 'user', email: ['foo@bar.com'], phones: [{ number: '123456789', type: 'mobile' }, { number: '987654321', type: 'landline' }] };

        return this.User.create(data)
          .then(function() {
            // Check that the hstore fields are the same when retrieving the user
            return self.User.find({ where: { username: 'user' }});
          }).then(function(user) {
            expect(user.phones).to.deep.equal(data.phones);
          });
      });

      it('should read hstore correctly from multiple rows', function(done) {
        var self = this;

        self.User
          .create({ username: 'user1', email: ['foo@bar.com'], settings: { test: '"value"' }})
          .then(function() {
            return self.User.create({ username: 'user2', email: ['foo2@bar.com'], settings: { another: '"example"' }});
          })
          .then(function() {
            // Check that the hstore fields are the same when retrieving the user
            return self.User.findAll({ order: 'username' });
          })
          .then(function(users) {
            expect(users[0].settings).to.deep.equal({ test: '"value"' });
            expect(users[1].settings).to.deep.equal({ another: '"example"' });

            done();
          })
          .error(console.log);
      });
    });

    describe('[POSTGRES] Unquoted identifiers', function() {
      it('can insert and select', function(done) {
        var self = this;
        this.sequelize.options.quoteIdentifiers = false;
        this.sequelize.getQueryInterface().QueryGenerator.options.quoteIdentifiers = false;

        this.User = this.sequelize.define('Userxs', {
          username: DataTypes.STRING,
          fullName: DataTypes.STRING // Note mixed case
        }, {
          quoteIdentifiers: false
        });

        this.User.sync({ force: true }).success(function() {
          self.User
            .create({ username: 'user', fullName: 'John Smith' })
            .success(function(user) {
              // We can insert into a table with non-quoted identifiers
              expect(user.id).to.exist;
              expect(user.id).not.to.be.null;
              expect(user.username).to.equal('user');
              expect(user.fullName).to.equal('John Smith');

              // We can query by non-quoted identifiers
              self.User.find({
                where: {fullName: 'John Smith'}
              })
              .success(function(user2) {
                // We can map values back to non-quoted identifiers
                expect(user2.id).to.equal(user.id);
                expect(user2.username).to.equal('user');
                expect(user2.fullName).to.equal('John Smith');

                // We can query and aggregate by non-quoted identifiers
                self.User
                  .count({
                    where: {fullName: 'John Smith'}
                  })
                  .success(function(count) {
                    self.sequelize.options.quoteIndentifiers = true;
                    self.sequelize.getQueryInterface().QueryGenerator.options.quoteIdentifiers = true;
                    self.sequelize.options.logging = false;

                    expect(count).to.equal(1);
                    done();
                  });
              });
            });
        });
      });
    });
  });
}
