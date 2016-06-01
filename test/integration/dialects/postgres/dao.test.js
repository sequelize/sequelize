'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , dialect = Support.getTestDialect()
  , DataTypes = require(__dirname + '/../../../../lib/data-types')
  , sequelize = require(__dirname + '/../../../../lib/sequelize');

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] DAO', function() {
    beforeEach(function() {
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
        magic_numbers: {
          type: DataTypes.ARRAY(DataTypes.INTEGER),
          defaultValue: []
        },
        course_period: DataTypes.RANGE(DataTypes.DATE),
        acceptable_marks: { type: DataTypes.RANGE(DataTypes.DECIMAL), defaultValue: [0.65, 1] },
        available_amount: DataTypes.RANGE,
        holidays: DataTypes.ARRAY(DataTypes.RANGE(DataTypes.DATE)),
        location: DataTypes.GEOMETRY()
      });
      return this.User.sync({ force: true });
    });

    afterEach(function() {
      this.sequelize.options.quoteIdentifiers = true;
    });

    it('should be able to search within an array', function() {
      return this.User.findAll({
        where: {
          email: ['hello', 'world']
        },
        attributes: ['id','username','email','settings','document','phones','emergency_contact','friends'],
        logging: function (sql) {
          expect(sql).to.equal('Executing (default): SELECT "id", "username", "email", "settings", "document", "phones", "emergency_contact", "friends" FROM "Users" AS "User" WHERE "User"."email" = ARRAY[\'hello\',\'world\']::TEXT[];');
        }
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

    it('should be able to find a record while searching in an array', function() {
      var self = this;
      return this.User.bulkCreate([
        {username: 'bob', email: ['myemail@email.com']},
        {username: 'tony', email: ['wrongemail@email.com']}
      ]).then(function() {
        return self.User.findAll({where: {email: ['myemail@email.com']}}).then(function(user) {
          expect(user).to.be.instanceof(Array);
          expect(user).to.have.length(1);
          expect(user[0].username).to.equal('bob');
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
          fields: ['id', 'username', 'document', 'emergency_contact'],
          logging: function(sql) {
            var expected = '\'{"name":"joe","phones":[1337,42]}\'';
            expect(sql.indexOf(expected)).not.to.equal(-1);
          }
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
        }, {
          logging: function (sql) {
            var expected = '\'"mailing"=>"false","push"=>"facebook","frequency"=>"3"\',\'"default"=>"\'\'value\'\'"\'';
            expect(sql.indexOf(expected)).not.to.equal(-1);
          }
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
      it('should be able to ignore enum types that already exist', function() {
        var User = this.sequelize.define('UserEnums', {
          mood: DataTypes.ENUM('happy', 'sad', 'meh')
        });

        return User.sync({ force: true }).then(function() {
          return User.sync();
        });
      });

      it('should be able to create/drop enums multiple times', function() {
        var User = this.sequelize.define('UserEnums', {
          mood: DataTypes.ENUM('happy', 'sad', 'meh')
        });

        return User.sync({ force: true }).then(function() {
          return User.sync({ force: true });
        });
      });

      it('should be able to create/drop multiple enums multiple times', function() {
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

        return DummyModel.sync({ force: true }).then(function() {
          // now sync one more time:
          return DummyModel.sync({force: true}).then(function() {
            // sync without dropping
            return DummyModel.sync();
          });
        });
      });

      it('should be able to add values to enum types', function() {
        var User = this.sequelize.define('UserEnums', {
            mood: DataTypes.ENUM('happy', 'sad', 'meh')
          });

        return User.sync({ force: true }).bind(this).then(function() {
          User = this.sequelize.define('UserEnums', {
            mood: DataTypes.ENUM('neutral', 'happy', 'sad', 'ecstatic', 'meh', 'joyful')
          });

          return User.sync();
        }).then(function() {
          return this.sequelize.getQueryInterface().pgListEnums(User.getTableName());
        }).then(function (enums) {
          expect(enums).to.have.length(1);
          expect(enums[0].enum_value).to.equal("{neutral,happy,sad,ecstatic,meh,joyful}");
        });
      });
    });

    describe('integers', function() {
      describe('integer', function() {
        beforeEach(function() {
          this.User = this.sequelize.define('User', {
            aNumber: DataTypes.INTEGER
          });

          return this.User.sync({ force: true });
        });

        it('positive', function() {
          var User = this.User;

          return User.create({aNumber: 2147483647}).then(function(user) {
            expect(user.aNumber).to.equal(2147483647);
            return User.find({where: {aNumber: 2147483647}}).then(function(_user) {
              expect(_user.aNumber).to.equal(2147483647);
            });
          });
        });

        it('negative', function() {
          var User = this.User;

          return User.create({aNumber: -2147483647}).then(function(user) {
            expect(user.aNumber).to.equal(-2147483647);
            return User.find({where: {aNumber: -2147483647}}).then(function(_user) {
              expect(_user.aNumber).to.equal(-2147483647);
            });
          });
        });
      });

      describe('bigint', function() {
        beforeEach(function() {
          this.User = this.sequelize.define('User', {
            aNumber: DataTypes.BIGINT
          });

          return this.User.sync({ force: true });
        });

        it('positive', function() {
          var User = this.User;

          return User.create({aNumber: '9223372036854775807'}).then(function(user) {
            expect(user.aNumber).to.equal('9223372036854775807');
            return User.find({where: {aNumber: '9223372036854775807'}}).then(function(_user) {
              expect(_user.aNumber).to.equal('9223372036854775807');
            });
          });
        });

        it('negative', function() {
          var User = this.User;

          return User.create({aNumber: '-9223372036854775807'}).then(function(user) {
            expect(user.aNumber).to.equal('-9223372036854775807');
            return User.find({where: {aNumber: '-9223372036854775807'}}).then(function(_user) {
              expect(_user.aNumber).to.equal('-9223372036854775807');
            });
          });
        });
      });
    });

    describe('timestamps', function() {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          dates: DataTypes.ARRAY(DataTypes.DATE)
        });
        return this.User.sync({ force: true });
      });

      it('should use postgres "TIMESTAMP WITH TIME ZONE" instead of "DATETIME"', function() {
        return this.User.create({
          dates: []
        }, {
          logging: function(sql) {
            expect(sql.indexOf('TIMESTAMP WITH TIME ZONE')).to.be.greaterThan(0);
          }
        });
      });
    });

    describe('model', function() {
      it('create handles array correctly', function() {
        return this.User
          .create({ username: 'user', email: ['foo@bar.com', 'bar@baz.com'] })
          .then(function(oldUser) {
            expect(oldUser.email).to.contain.members(['foo@bar.com', 'bar@baz.com']);
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
          phones: [{ number: '123456789', type: 'mobile' }, { number: '987654321', type: 'landline' }, { number: '8675309', type: "Jenny's"}, {number: '5555554321', type: '"home\n"' }]
        }).then(function() {
          return User.findById(1).then(function(user) {
            expect(user.phones.length).to.equal(4);
            expect(user.phones[1].number).to.equal('987654321');
            expect(user.phones[2].type).to.equal("Jenny's");
            expect(user.phones[3].type).to.equal('"home\n"');
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
          return User.findById(1).then(function(user) {
            expect(user.settings.mailing).to.equal('true');
          });
        });
      });

      it('should update hstore correctly', function() {
        var self = this;

        return this.User.create({ username: 'user', email: ['foo@bar.com'], settings: { test: '"value"' }}).then(function(newUser) {
            // Check to see if the default value for an hstore field works
            expect(newUser.document).to.deep.equal({ default: "'value'" });
            expect(newUser.settings).to.deep.equal({ test: '"value"' });

            // Check to see if updating an hstore field works
            return self.User.update({ settings: { should: 'update', to: 'this', first: 'place' }}, { where: newUser.where() }).then(function() {
              return newUser.reload().then(function() {
                // Postgres always returns keys in alphabetical order (ascending)
                expect(newUser.settings).to.deep.equal({ first: 'place', should: 'update', to: 'this' });
              });
            });
          });
      });

      it('should update hstore correctly and return the affected rows', function() {
        var self = this;

        return this.User.create({ username: 'user', email: ['foo@bar.com'], settings: { test: '"value"' }}).then(function(oldUser) {
            // Update the user and check that the returned object's fields have been parsed by the hstore library
            return self.User.update({ settings: { should: 'update', to: 'this', first: 'place' }}, { where: oldUser.where(), returning: true }).spread(function(count, users) {
              expect(count).to.equal(1);
              expect(users[0].settings).to.deep.equal({ should: 'update', to: 'this', first: 'place' });
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

      it('should read hstore correctly from multiple rows', function() {
        var self = this;

        return self.User
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
          });
      });

      it('should read hstore correctly from included models as well', function() {
        var self = this,
          HstoreSubmodel = self.sequelize.define('hstoreSubmodel', {
            someValue: DataTypes.HSTORE
          }),
          submodelValue = { testing: '"hstore"' };

        self.User.hasMany(HstoreSubmodel);

        return self.sequelize
          .sync({ force: true })
          .then(function() {
            return self.User.create({ username: 'user1' })
              .then(function (user) {
                return HstoreSubmodel.create({ someValue: submodelValue})
                  .then(function (submodel) {
                    return user.setHstoreSubmodels([submodel]);
                  });
              });
          })
          .then(function() {
            return self.User.find({ where: { username: 'user1' }, include: [HstoreSubmodel]});
          })
          .then(function(user) {
            expect(user.hasOwnProperty('hstoreSubmodels')).to.be.ok;
            expect(user.hstoreSubmodels.length).to.equal(1);
            expect(user.hstoreSubmodels[0].someValue).to.deep.equal(submodelValue);
          });
      });

      it('should save range correctly', function() {
        var period = [new Date(2015, 0, 1), new Date(2015, 11, 31)];
        return this.User.create({ username: 'user', email: ['foo@bar.com'], course_period: period}).then(function(newUser) {
          // Check to see if the default value for a range field works

          expect(newUser.acceptable_marks.length).to.equal(2);
          expect(newUser.acceptable_marks[0]).to.equal('0.65'); // lower bound
          expect(newUser.acceptable_marks[1]).to.equal('1'); // upper bound
          expect(newUser.acceptable_marks.inclusive).to.deep.equal([true, false]); // inclusive, exclusive
          expect(newUser.course_period[0] instanceof Date).to.be.ok; // lower bound
          expect(newUser.course_period[1] instanceof Date).to.be.ok; // upper bound
          expect(newUser.course_period[0]).to.equalTime(period[0]); // lower bound
          expect(newUser.course_period[1]).to.equalTime(period[1]); // upper bound
          expect(newUser.course_period.inclusive).to.deep.equal([true, false]); // inclusive, exclusive

          // Check to see if updating a range field works
          return newUser.updateAttributes({acceptable_marks: [0.8, 0.9]}).then(function() {
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

        return User.create({
          username: 'bob',
          email: ['myemail@email.com'],
          holidays: holidays
        }).then(function() {
          return User.findById(1).then(function(user) {
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

        return User.bulkCreate([{
          username: 'bob',
          email: ['myemail@email.com'],
          course_period: period
        }]).then(function() {
          return User.findById(1).then(function(user) {
            expect(user.course_period[0] instanceof Date).to.be.ok;
            expect(user.course_period[1] instanceof Date).to.be.ok;
            expect(user.course_period[0]).to.equalTime(period[0]); // lower bound
            expect(user.course_period[1]).to.equalTime(period[1]); // upper bound
            expect(user.course_period.inclusive).to.deep.equal([true, false]); // inclusive, exclusive
          });
        });
      });

      it('should update range correctly', function() {
        var User = this.User
          , period = [new Date(2015, 0, 1), new Date(2015, 11, 31)];

        return User.create({ username: 'user', email: ['foo@bar.com'], course_period: period }).then(function(newUser) {
          // Check to see if the default value for a range field works
          expect(newUser.acceptable_marks.length).to.equal(2);
          expect(newUser.acceptable_marks[0]).to.equal('0.65'); // lower bound
          expect(newUser.acceptable_marks[1]).to.equal('1'); // upper bound
          expect(newUser.acceptable_marks.inclusive).to.deep.equal([true, false]); // inclusive, exclusive
          expect(newUser.course_period[0] instanceof Date).to.be.ok;
          expect(newUser.course_period[1] instanceof Date).to.be.ok;
          expect(newUser.course_period[0]).to.equalTime(period[0]); // lower bound
          expect(newUser.course_period[1]).to.equalTime(period[1]); // upper bound
          expect(newUser.course_period.inclusive).to.deep.equal([true, false]); // inclusive, exclusive

          period = [new Date(2015, 1, 1), new Date(2015, 10, 30)];

          // Check to see if updating a range field works
          return User.update({course_period: period}, {where: newUser.where()}).then(function() {
            return newUser.reload().then(function() {
              expect(newUser.course_period[0] instanceof Date).to.be.ok;
              expect(newUser.course_period[1] instanceof Date).to.be.ok;
              expect(newUser.course_period[0]).to.equalTime(period[0]); // lower bound
              expect(newUser.course_period[1]).to.equalTime(period[1]); // upper bound
              expect(newUser.course_period.inclusive).to.deep.equal([true, false]); // inclusive, exclusive
            });
          });
        });
      });

      it('should update range correctly and return the affected rows', function () {
        var User = this.User
          , period = [new Date(2015, 1, 1), new Date(2015, 10, 30)];

        return User.create({
          username:      'user',
          email:         ['foo@bar.com'],
          course_period: [new Date(2015, 0, 1), new Date(2015, 11, 31)]
        }).then(function (oldUser) {
            // Update the user and check that the returned object's fields have been parsed by the range parser
            return User.update({ course_period: period }, { where: oldUser.where(), returning: true })
              .spread(function (count, users) {
                expect(count).to.equal(1);
                expect(users[0].course_period[0] instanceof Date).to.be.ok;
                expect(users[0].course_period[1] instanceof Date).to.be.ok;
                expect(users[0].course_period[0]).to.equalTime(period[0]); // lower bound
                expect(users[0].course_period[1]).to.equalTime(period[1]); // upper bound
                expect(users[0].course_period.inclusive).to.deep.equal([true, false]); // inclusive, exclusive
              });
          });
      });

      it('should read range correctly', function() {
        var User = this.User;

        var course_period = [new Date(2015, 1, 1), new Date(2015, 10, 30)];
        course_period.inclusive = [false, false];

        var data = { username: 'user', email: ['foo@bar.com'], course_period: course_period};

        return User.create(data)
          .then(function() {
            return User.find({ where: { username: 'user' }});
          })
          .then(function(user) {
            // Check that the range fields are the same when retrieving the user
            expect(user.course_period).to.deep.equal(data.course_period);
          });
      });

      it('should read range array correctly', function() {
        var User = this.User,
            holidays = [
              [new Date(2015, 3, 1, 10), new Date(2015, 3, 15)],
              [new Date(2015, 8, 1), new Date(2015, 9, 15)]
            ];

        holidays[0].inclusive = [true, true];
        holidays[1].inclusive = [true, true];

        var data = { username: 'user', email: ['foo@bar.com'], holidays: holidays };

        return User.create(data)
          .then(function() {
            // Check that the range fields are the same when retrieving the user
            return User.find({ where: { username: 'user' }});
          }).then(function(user) {
            expect(user.holidays).to.deep.equal(data.holidays);
          });
      });

      it('should read range correctly from multiple rows', function() {
        var User = this.User,
            periods = [
              [new Date(2015, 0, 1), new Date(2015, 11, 31)],
              [new Date(2016, 0, 1), new Date(2016, 11, 31)]
            ];

        return User
          .create({ username: 'user1', email: ['foo@bar.com'], course_period: periods[0]})
          .then(function() {
            return User.create({ username: 'user2', email: ['foo2@bar.com'], course_period: periods[1]});
          })
          .then(function() {
            // Check that the range fields are the same when retrieving the user
            return User.findAll({ order: 'username' });
          })
          .then(function(users) {
            expect(users[0].course_period[0]).to.equalTime(periods[0][0]); // lower bound
            expect(users[0].course_period[1]).to.equalTime(periods[0][1]); // upper bound
            expect(users[0].course_period.inclusive).to.deep.equal([true, false]); // inclusive, exclusive
            expect(users[1].course_period[0]).to.equalTime(periods[1][0]); // lower bound
            expect(users[1].course_period[1]).to.equalTime(periods[1][1]); // upper bound
            expect(users[1].course_period.inclusive).to.deep.equal([true, false]); // inclusive, exclusive
          });
      });

      it('should read range correctly from included models as well', function () {
        var self = this
          , period = [new Date(2016, 0, 1), new Date(2016, 11, 31)]
          , HolidayDate = this.sequelize.define('holidayDate', {
              period: DataTypes.RANGE(DataTypes.DATE)
            });

        self.User.hasMany(HolidayDate);

        return self.sequelize
          .sync({ force: true })
          .then(function () {
            return self.User
              .create({ username: 'user', email: ['foo@bar.com'] })
              .then(function (user) {
                return HolidayDate.create({ period: period })
                  .then(function (holidayDate) {
                    return user.setHolidayDates([holidayDate]);
                  });
              });
          })
          .then(function () {
            return self.User.find({ where: { username: 'user' }, include: [HolidayDate] });
          })
          .then(function (user) {
            expect(user.hasOwnProperty('holidayDates')).to.be.ok;
            expect(user.holidayDates.length).to.equal(1);
            expect(user.holidayDates[0].period.length).to.equal(2);
            expect(user.holidayDates[0].period[0]).to.equalTime(period[0]);
            expect(user.holidayDates[0].period[1]).to.equalTime(period[1]);
          });
      });
    });

    it('should save geometry correctly', function() {
      var point = { type: 'Point', coordinates: [39.807222,-76.984722] };
      return this.User.create({ username: 'user', email: ['foo@bar.com'], location: point}).then(function(newUser) {
        expect(newUser.location).to.deep.eql(point);
      });
    });

    it('should update geometry correctly', function() {
      var User = this.User;
      var point1 = { type: 'Point', coordinates: [39.807222,-76.984722] }
        , point2 = { type: 'Point', coordinates: [39.828333,-77.232222] };
      return User.create({ username: 'user', email: ['foo@bar.com'], location: point1}).then(function(oldUser) {
        return User.update({ location: point2 }, { where: { username: oldUser.username }, returning: true }).spread(function(count, updatedUsers) {
          expect(updatedUsers[0].location).to.deep.eql(point2);
        });
      });
    });

    it('should read geometry correctly', function() {
      var User = this.User;
      var point = { type: 'Point', coordinates: [39.807222,-76.984722] };

      return User.create({ username: 'user', email: ['foo@bar.com'], location: point}).then(function(user) {
          return User.find({ where: { username: user.username }});
      }).then(function(user) {
          expect(user.location).to.deep.eql(point);
      });
    });

    describe('[POSTGRES] Unquoted identifiers', function() {
      it('can insert and select', function() {
        var self = this;
        this.sequelize.options.quoteIdentifiers = false;
        this.sequelize.getQueryInterface().QueryGenerator.options.quoteIdentifiers = false;

        this.User = this.sequelize.define('Userxs', {
          username: DataTypes.STRING,
          fullName: DataTypes.STRING // Note mixed case
        }, {
          quoteIdentifiers: false
        });

        return this.User.sync({ force: true }).then(function() {
          return self.User
            .create({ username: 'user', fullName: 'John Smith' })
            .then(function(user) {
              // We can insert into a table with non-quoted identifiers
              expect(user.id).to.exist;
              expect(user.id).not.to.be.null;
              expect(user.username).to.equal('user');
              expect(user.fullName).to.equal('John Smith');

              // We can query by non-quoted identifiers
              return self.User.find({
                where: {fullName: 'John Smith'}
              })
              .then(function(user2) {
                // We can map values back to non-quoted identifiers
                expect(user2.id).to.equal(user.id);
                expect(user2.username).to.equal('user');
                expect(user2.fullName).to.equal('John Smith');

                // We can query and aggregate by non-quoted identifiers
                return self.User
                  .count({
                    where: {fullName: 'John Smith'}
                  })
                  .then(function(count) {
                    self.sequelize.options.quoteIndentifiers = true;
                    self.sequelize.getQueryInterface().QueryGenerator.options.quoteIdentifiers = true;
                    self.sequelize.options.logging = false;
                    expect(count).to.equal(1);
                  });
              });
            });
        });
      });
    });
  });
}
