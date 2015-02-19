'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , dialect = Support.getTestDialect()
  , DataTypes = require(__dirname + '/../../../../lib/data-types')
  , _ = require('lodash')
  , sequelize = require(__dirname + '/../../../../lib/sequelize');

chai.use(require('chai-datetime'));
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
        emergency_contact: DataTypes.JSON,
        friends: {
          type: DataTypes.ARRAY(DataTypes.JSON),
          defaultValue: []
        },
        course_period: DataTypes.RANGE(DataTypes.DATE),
        acceptable_marks: { type: DataTypes.RANGE(DataTypes.DECIMAL), defaultValue: [0.65, 1] },
        available_amount: DataTypes.RANGE,
        holidays: DataTypes.ARRAY(DataTypes.RANGE(DataTypes.DATE))
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
      this.User.all({where: {email: ['hello', 'world']}, attributes: ['id','username','email','settings','document','phones','emergency_contact','friends']}).on('sql', function(sql) {
        expect(sql).to.equal('SELECT "id", "username", "email", "settings", "document", "phones", "emergency_contact", "friends" FROM "Users" AS "User" WHERE "User"."email" = ARRAY[\'hello\',\'world\']::TEXT[];');
        done();
      });
    });

    it('should be able to update a field with type ARRAY(JSON)', function(){
      return this.User.create({
        username: 'bob',
        email: ['myemail@email.com'],
        friends: [{
          name: 'John Smith'
        }]
      }).then(function(userInstance){
        expect(userInstance.friends).to.have.length(1);
        expect(userInstance.friends[0].name).to.equal('John Smith');

        return userInstance.update({
          friends: [{
            name: 'John Smythe'
          }]
        });
      })
      .get('friends')
      .tap(function(friends){
        expect(friends).to.have.length(1);
        expect(friends[0].name).to.equal('John Smythe');
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
        }, {
          fields: ['id', 'username', 'document', 'emergency_contact']
        }).on('sql', function(sql) {
          var expected = '\'{"name":"joe","phones":[1337,42]}\'';
          expect(sql.indexOf(expected)).not.to.equal(-1);
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
            expect(user.emergency_contact).to.eql(emergencyContact); // .eql does deep value comparison instead of
                                                                     // strict equal comparison
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

      it('should be able to query using dot syntax', function() {
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

      it('should be able to store values that require JSON escaping', function() {
        var self = this;
        var text = "Multi-line '$string' needing \"escaping\" for $$ and $1 type values";

        return this.User.create({ username: 'swen', emergency_contact: { value: text } })
          .then(function(user) {
            expect(user.isNewRecord).to.equal(false);
          })
          .then(function() {
            return self.User.find({ where: { username: 'swen' } });
          })
          .then(function() {
            return self.User.find({ where: sequelize.json('emergency_contact.value', text) });
          })
          .then(function(user) {
            expect(user.username).to.equal('swen');
          });
      });

      it('should be able to findOrCreate with values that require JSON escaping', function() {
        var self = this;
        var text = "Multi-line '$string' needing \"escaping\" for $$ and $1 type values";

        return this.User.findOrCreate({ where: { username: 'swen' }, defaults: { emergency_contact: { value: text } } })
          .then(function(user) {
            expect(!user.isNewRecord).to.equal(true);
          })
          .then(function() {
            return self.User.find({ where: { username: 'swen' } });
          })
          .then(function() {
            return self.User.find({ where: sequelize.json('emergency_contact.value', text) });
          })
          .then(function(user) {
            expect(user.username).to.equal('swen');
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
          var expected = '\'"mailing"=>"false","push"=>"facebook","frequency"=>"3"\',\'"default"=>"\'\'value\'\'"\'';
          expect(sql.indexOf(expected)).not.to.equal(-1);
        });
      });

    });

    describe('range', function() {
      it('should tell me that a column is range and not USER-DEFINED', function() {
        return this.sequelize.queryInterface.describeTable('Users').then(function(table) {
          expect(table.course_period.type).to.equal('TSTZRANGE');
          expect(table.available_amount.type).to.equal('INT4RANGE');
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

      it('should save range correctly', function() {
        var period = [new Date(2015, 0, 1), new Date(2015, 11, 31)];
        return this.User.create({ username: 'user', email: ['foo@bar.com'], course_period: period}).then(function(newUser) {
          // Check to see if the default value for a range field works
          expect(newUser.acceptable_marks.length).to.equal(2);
          expect(newUser.acceptable_marks[0]).to.equal(0.65); // lower bound
          expect(newUser.acceptable_marks[1]).to.equal(1); // upper bound
          expect(newUser.acceptable_marks.inclusive).to.deep.equal([false, false]); // not inclusive
          expect(newUser.course_period[0] instanceof Date).to.be.ok; // lower bound
          expect(newUser.course_period[1] instanceof Date).to.be.ok; // upper bound
          expect(newUser.course_period[0]).to.equalTime(period[0]); // lower bound
          expect(newUser.course_period[1]).to.equalTime(period[1]); // upper bound
          expect(newUser.course_period.inclusive).to.deep.equal([false, false]); // not inclusive

          // Check to see if updating a range field works
          return newUser.updateAttributes({acceptable_marks: [0.8, 0.9]}).then(function(oldUser) {
            expect(newUser.acceptable_marks.length).to.equal(2);
            expect(newUser.acceptable_marks[0]).to.equal(0.8); // lower bound
            expect(newUser.acceptable_marks[1]).to.equal(0.9); // upper bound
          });
        });
      });

      it('should save range array correctly', function() {
        var User = this.User,
          holidays = [
            [new Date(2015, 3, 1), new Date(2015, 3, 15)],
            [new Date(2015, 8, 1), new Date(2015, 9, 15)]
          ];

        return this.User.create({
          username: 'bob',
          email: ['myemail@email.com'],
          holidays: holidays
        }).then(function() {
          return User.find(1).then(function(user) {
            expect(user.holidays.length).to.equal(2);
            expect(user.holidays[0].length).to.equal(2);
            expect(user.holidays[0][0] instanceof Date).to.be.ok;
            expect(user.holidays[0][1] instanceof Date).to.be.ok;
            expect(user.holidays[0][0]).to.equalTime(holidays[0][0]);
            expect(user.holidays[0][1]).to.equalTime(holidays[0][1]);
            expect(user.holidays[1].length).to.equal(2);
            expect(user.holidays[1][0] instanceof Date).to.be.ok;
            expect(user.holidays[1][1] instanceof Date).to.be.ok;
            expect(user.holidays[1][0]).to.equalTime(holidays[1][0]);
            expect(user.holidays[1][1]).to.equalTime(holidays[1][1]);
          });
        });
      });

      it('should bulkCreate with range property', function() {
        var User = this.User,
            period = [new Date(2015, 0, 1), new Date(2015, 11, 31)];

        return this.User.bulkCreate([{
          username: 'bob',
          email: ['myemail@email.com'],
          course_period: period
        }]).then(function() {
          return User.find(1).then(function(user) {
            expect(user.course_period[0] instanceof Date).to.be.ok;
            expect(user.course_period[1] instanceof Date).to.be.ok;
            expect(user.course_period[0]).to.equalTime(period[0]); // lower bound
            expect(user.course_period[1]).to.equalTime(period[1]); // upper bound
            expect(user.course_period.inclusive).to.deep.equal([false, false]); // not inclusive
          });
        });
      });

      it('should update range correctly', function() {
        var self = this,
            period = [new Date(2015, 0, 1), new Date(2015, 11, 31)];

        return this.User.create({ username: 'user', email: ['foo@bar.com'], course_period: period}).then(function(newUser) {
          // Check to see if the default value for a range field works
          expect(newUser.acceptable_marks.length).to.equal(2);
          expect(newUser.acceptable_marks[0]).to.equal(0.65); // lower bound
          expect(newUser.acceptable_marks[1]).to.equal(1); // upper bound
          expect(newUser.acceptable_marks.inclusive).to.deep.equal([false, false]); // not inclusive
          expect(newUser.course_period[0] instanceof Date).to.be.ok;
          expect(newUser.course_period[1] instanceof Date).to.be.ok;
          expect(newUser.course_period[0]).to.equalTime(period[0]); // lower bound
          expect(newUser.course_period[1]).to.equalTime(period[1]); // upper bound
          expect(newUser.course_period.inclusive).to.deep.equal([false, false]); // not inclusive

          period = [new Date(2015, 1, 1), new Date(2015, 10, 30)];

          // Check to see if updating a range field works
          return self.User.update({course_period: period}, {where: newUser.identifiers}).then(function() {
            return newUser.reload().success(function() {
              expect(newUser.course_period[0] instanceof Date).to.be.ok;
              expect(newUser.course_period[1] instanceof Date).to.be.ok;
              expect(newUser.course_period[0]).to.equalTime(period[0]); // lower bound
              expect(newUser.course_period[1]).to.equalTime(period[1]); // upper bound
              expect(newUser.course_period.inclusive).to.deep.equal([false, false]); // not inclusive
            });
          });
        });
      });

      it('should update range correctly and return the affected rows', function() {
        var self = this,
            period = [new Date(2015, 1, 1), new Date(2015, 10, 30)];

        return this.User.create({ username: 'user', email: ['foo@bar.com'], course_period: [new Date(2015, 0, 1), new Date(2015, 11, 31)]}).then(function(oldUser) {
          // Update the user and check that the returned object's fields have been parsed by the range parser
          return self.User.update({course_period: period}, {where: oldUser.identifiers, returning: true }).spread(function(count, users) {
            expect(count).to.equal(1);
            expect(users[0].course_period[0] instanceof Date).to.be.ok;
            expect(users[0].course_period[1] instanceof Date).to.be.ok;
            expect(users[0].course_period[0]).to.equalTime(period[0]); // lower bound
            expect(users[0].course_period[1]).to.equalTime(period[1]); // upper bound
            expect(users[0].course_period.inclusive).to.deep.equal([false, false]); // not inclusive
          });
        });
      });

      it('should read range correctly', function() {
        var self = this;
        var course_period = [new Date(2015, 1, 1), new Date(2015, 10, 30)];
        course_period.inclusive = [false, false];
        var data = { username: 'user', email: ['foo@bar.com'], course_period: course_period};

        return this.User.create(data)
          .then(function() {
            return self.User.find({ where: { username: 'user' }});
          })
          .then(function(user) {
            // Check that the range fields are the same when retrieving the user
            expect(user.course_period).to.deep.equal(data.course_period);
          });
      });

      it('should read range array correctly', function() {
        var self = this,
            holidays = [
              [new Date(2015, 3, 1, 10), new Date(2015, 3, 15)],
              [new Date(2015, 8, 1), new Date(2015, 9, 15)]
            ];

        holidays[0].inclusive = [true, true];
        holidays[1].inclusive = [true, true];

        var data = { username: 'user', email: ['foo@bar.com'], holidays: holidays };

        return this.User.create(data)
          .then(function() {
            // Check that the range fields are the same when retrieving the user
            return self.User.find({ where: { username: 'user' }});
          }).then(function(user) {
            expect(user.holidays).to.deep.equal(data.holidays);
          });
      });

      it('should read range correctly from multiple rows', function() {
        var self = this,
            periods = [
              [new Date(2015, 0, 1), new Date(2015, 11, 31)],
              [new Date(2016, 0, 1), new Date(2016, 11, 31)]
            ];

        return self.User
          .create({ username: 'user1', email: ['foo@bar.com'], course_period: periods[0]})
          .then(function() {
            return self.User.create({ username: 'user2', email: ['foo2@bar.com'], course_period: periods[1]});
          })
          .then(function() {
            // Check that the range fields are the same when retrieving the user
            return self.User.findAll({ order: 'username' });
          })
          .then(function(users) {
            expect(users[0].course_period[0]).to.equalTime(periods[0][0]); // lower bound
            expect(users[0].course_period[1]).to.equalTime(periods[0][1]); // upper bound
            expect(users[0].course_period.inclusive).to.deep.equal([false, false]); // not inclusive
            expect(users[1].course_period[0]).to.equalTime(periods[1][0]); // lower bound
            expect(users[1].course_period[1]).to.equalTime(periods[1][1]); // upper bound
            expect(users[1].course_period.inclusive).to.deep.equal([false, false]); // not inclusive
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
