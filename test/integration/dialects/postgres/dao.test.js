'use strict';

/* jshint -W030 */
/* jshint -W110 */
const chai = require('chai');
const expect = chai.expect;
const Support = require(__dirname + '/../../support');
const dialect = Support.getTestDialect();
const DataTypes = require(__dirname + '/../../../../lib/data-types');
const sequelize = require(__dirname + '/../../../../lib/sequelize');

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] DAO', () => {
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
        logging(sql) {
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
      }).then(userInstance => {
        expect(userInstance.friends).to.have.length(1);
        expect(userInstance.friends[0].name).to.equal('John Smith');

        return userInstance.update({
          friends: [{
            name: 'John Smythe'
          }]
        });
      })
      .get('friends')
      .tap(friends => {
        expect(friends).to.have.length(1);
        expect(friends[0].name).to.equal('John Smythe');
      });
    });

    it('should be able to find a record while searching in an array', function() {
      const self = this;
      return this.User.bulkCreate([
        {username: 'bob', email: ['myemail@email.com']},
        {username: 'tony', email: ['wrongemail@email.com']}
      ]).then(() => self.User.findAll({where: {email: ['myemail@email.com']}}).then(user => {
        expect(user).to.be.instanceof(Array);
        expect(user).to.have.length(1);
        expect(user[0].username).to.equal('bob');
      }));
    });

    describe('json', () => {
      it('should tell me that a column is json', function() {
        return this.sequelize.queryInterface.describeTable('Users')
          .then(table => {
            expect(table.emergency_contact.type).to.equal('JSON');
          });
      });

      it('should stringify json with insert', function() {
        return this.User.create({
          username: 'bob',
          emergency_contact: { name: 'joe', phones: [1337, 42] }
        }, {
          fields: ['id', 'username', 'document', 'emergency_contact'],
          logging(sql) {
            const expected = '\'{"name":"joe","phones":[1337,42]}\'';
            expect(sql.indexOf(expected)).not.to.equal(-1);
          }
        });
      });

      it('should insert json using a custom field name', function() {
        const self = this;

        this.UserFields = this.sequelize.define('UserFields', {
          emergencyContact: { type: DataTypes.JSON, field: 'emergy_contact' }
        });
        return this.UserFields.sync({ force: true }).then(() => self.UserFields.create({
          emergencyContact: { name: 'joe', phones: [1337, 42] }
        }).then(user => {
          expect(user.emergencyContact.name).to.equal('joe');
        }));
      });

      it('should update json using a custom field name', function() {
        const self = this;

        this.UserFields = this.sequelize.define('UserFields', {
          emergencyContact: { type: DataTypes.JSON, field: 'emergy_contact' }
        });
        return this.UserFields.sync({ force: true }).then(() => self.UserFields.create({
          emergencyContact: { name: 'joe', phones: [1337, 42] }
        }).then(user => {
          user.emergencyContact = { name: 'larry' };
          return user.save();
        }).then(user => {
          expect(user.emergencyContact.name).to.equal('larry');
        }));
      });

      it('should be able retrieve json value as object', function() {
        const self = this;
        const emergencyContact = { name: 'kate', phone: 1337 };

        return this.User.create({ username: 'swen', emergency_contact: emergencyContact })
          .then(user => {
            expect(user.emergency_contact).to.eql(emergencyContact); // .eql does deep value comparison instead of
                                                                     // strict equal comparison
            return self.User.find({ where: { username: 'swen' }, attributes: ['emergency_contact'] });
          })
          .then(user => {
            expect(user.emergency_contact).to.eql(emergencyContact);
          });
      });

      it('should be able to retrieve element of array by index', function() {
        const self = this;
        const emergencyContact = { name: 'kate', phones: [1337, 42] };

        return this.User.create({ username: 'swen', emergency_contact: emergencyContact })
          .then(user => {
            expect(user.emergency_contact).to.eql(emergencyContact);
            return self.User.find({ where: { username: 'swen' }, attributes: [[sequelize.json('emergency_contact.phones.1'), 'firstEmergencyNumber']] });
          })
          .then(user => {
            expect(parseInt(user.getDataValue('firstEmergencyNumber'))).to.equal(42);
          });
      });

      it('should be able to retrieve root level value of an object by key', function() {
        const self = this;
        const emergencyContact = { kate: 1337 };

        return this.User.create({ username: 'swen', emergency_contact: emergencyContact })
          .then(user => {
            expect(user.emergency_contact).to.eql(emergencyContact);
            return self.User.find({ where: { username: 'swen' }, attributes: [[sequelize.json('emergency_contact.kate'), 'katesNumber']] });
          })
          .then(user => {
            expect(parseInt(user.getDataValue('katesNumber'))).to.equal(1337);
          });
      });

      it('should be able to retrieve nested value of an object by path', function() {
        const self = this;
        const emergencyContact = { kate: { email: 'kate@kate.com', phones: [1337, 42] } };

        return this.User.create({ username: 'swen', emergency_contact: emergencyContact })
          .then(user => {
            expect(user.emergency_contact).to.eql(emergencyContact);
            return self.User.find({ where: { username: 'swen' }, attributes: [[sequelize.json('emergency_contact.kate.email'), 'katesEmail']] });
          })
          .then(user => {
            expect(user.getDataValue('katesEmail')).to.equal('kate@kate.com');
          })
          .then(() => self.User.find({ where: { username: 'swen' }, attributes: [[sequelize.json('emergency_contact.kate.phones.1'), 'katesFirstPhone']] }))
          .then(user => {
            expect(parseInt(user.getDataValue('katesFirstPhone'))).to.equal(42);
          });
      });

      it('should be able to retrieve a row based on the values of the json document', function() {
        const self = this;

        return this.sequelize.Promise.all([
          this.User.create({ username: 'swen', emergency_contact: { name: 'kate' } }),
          this.User.create({ username: 'anna', emergency_contact: { name: 'joe' } })])
          .then(() => self.User.find({ where: sequelize.json("emergency_contact->>'name'", 'kate'), attributes: ['username', 'emergency_contact'] }))
          .then(user => {
            expect(user.emergency_contact.name).to.equal('kate');
          });
      });

      it('should be able to query using the nested query language', function() {
        const self = this;

        return this.sequelize.Promise.all([
          this.User.create({ username: 'swen', emergency_contact: { name: 'kate' } }),
          this.User.create({ username: 'anna', emergency_contact: { name: 'joe' } })])
          .then(() => self.User.find({
          where: sequelize.json({ emergency_contact: { name: 'kate' } })
        }))
          .then(user => {
            expect(user.emergency_contact.name).to.equal('kate');
          });
      });

      it('should be able to query using dot syntax', function() {
        const self = this;

        return this.sequelize.Promise.all([
          this.User.create({ username: 'swen', emergency_contact: { name: 'kate' } }),
          this.User.create({ username: 'anna', emergency_contact: { name: 'joe' } })])
          .then(() => self.User.find({ where: sequelize.json('emergency_contact.name', 'joe') }))
          .then(user => {
            expect(user.emergency_contact.name).to.equal('joe');
          });
      });

      it('should be able to store values that require JSON escaping', function() {
        const self = this;
        const text = "Multi-line '$string' needing \"escaping\" for $$ and $1 type values";

        return this.User.create({ username: 'swen', emergency_contact: { value: text } })
          .then(user => {
            expect(user.isNewRecord).to.equal(false);
          })
          .then(() => self.User.find({ where: { username: 'swen' } }))
          .then(() => self.User.find({ where: sequelize.json('emergency_contact.value', text) }))
          .then(user => {
            expect(user.username).to.equal('swen');
          });
      });

      it('should be able to findOrCreate with values that require JSON escaping', function() {
        const self = this;
        const text = "Multi-line '$string' needing \"escaping\" for $$ and $1 type values";

        return this.User.findOrCreate({ where: { username: 'swen' }, defaults: { emergency_contact: { value: text } } })
          .then(user => {
            expect(!user.isNewRecord).to.equal(true);
          })
          .then(() => self.User.find({ where: { username: 'swen' } }))
          .then(() => self.User.find({ where: sequelize.json('emergency_contact.value', text) }))
          .then(user => {
            expect(user.username).to.equal('swen');
          });
      });
    });

    describe('hstore', () => {
      it('should tell me that a column is hstore and not USER-DEFINED', function() {
        return this.sequelize.queryInterface.describeTable('Users').then(table => {
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
          logging(sql) {
            const expected = '\'"mailing"=>"false","push"=>"facebook","frequency"=>"3"\',\'"default"=>"\'\'value\'\'"\'';
            expect(sql.indexOf(expected)).not.to.equal(-1);
          }
        });
      });

    });

    describe('range', () => {
      it('should tell me that a column is range and not USER-DEFINED', function() {
        return this.sequelize.queryInterface.describeTable('Users').then(table => {
          expect(table.course_period.type).to.equal('TSTZRANGE');
          expect(table.available_amount.type).to.equal('INT4RANGE');
        });
      });

    });

    describe('enums', () => {
      it('should be able to ignore enum types that already exist', function() {
        const User = this.sequelize.define('UserEnums', {
          mood: DataTypes.ENUM('happy', 'sad', 'meh')
        });

        return User.sync({ force: true }).then(() => User.sync());
      });

      it('should be able to create/drop enums multiple times', function() {
        const User = this.sequelize.define('UserEnums', {
          mood: DataTypes.ENUM('happy', 'sad', 'meh')
        });

        return User.sync({ force: true }).then(() => User.sync({ force: true }));
      });

      it('should be able to create/drop multiple enums multiple times', function() {
        const DummyModel = this.sequelize.define('Dummy-pg', {
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

        return DummyModel.sync({ force: true }).then(() => DummyModel.sync({force: true}).then(() => DummyModel.sync()));
      });

      it('should be able to add values to enum types', function() {
        let User = this.sequelize.define('UserEnums', {
            mood: DataTypes.ENUM('happy', 'sad', 'meh')
          });

        return User.sync({ force: true }).bind(this).then(function() {
          User = this.sequelize.define('UserEnums', {
            mood: DataTypes.ENUM('neutral', 'happy', 'sad', 'ecstatic', 'meh', 'joyful')
          });

          return User.sync();
        }).then(function() {
          return this.sequelize.getQueryInterface().pgListEnums(User.getTableName());
        }).then(enums => {
          expect(enums).to.have.length(1);
          expect(enums[0].enum_value).to.equal("{neutral,happy,sad,ecstatic,meh,joyful}");
        });
      });
    });

    describe('integers', () => {
      describe('integer', () => {
        beforeEach(function() {
          this.User = this.sequelize.define('User', {
            aNumber: DataTypes.INTEGER
          });

          return this.User.sync({ force: true });
        });

        it('positive', function() {
          const User = this.User;

          return User.create({aNumber: 2147483647}).then(user => {
            expect(user.aNumber).to.equal(2147483647);
            return User.find({where: {aNumber: 2147483647}}).then(_user => {
              expect(_user.aNumber).to.equal(2147483647);
            });
          });
        });

        it('negative', function() {
          const User = this.User;

          return User.create({aNumber: -2147483647}).then(user => {
            expect(user.aNumber).to.equal(-2147483647);
            return User.find({where: {aNumber: -2147483647}}).then(_user => {
              expect(_user.aNumber).to.equal(-2147483647);
            });
          });
        });
      });

      describe('bigint', () => {
        beforeEach(function() {
          this.User = this.sequelize.define('User', {
            aNumber: DataTypes.BIGINT
          });

          return this.User.sync({ force: true });
        });

        it('positive', function() {
          const User = this.User;

          return User.create({aNumber: '9223372036854775807'}).then(user => {
            expect(user.aNumber).to.equal('9223372036854775807');
            return User.find({where: {aNumber: '9223372036854775807'}}).then(_user => {
              expect(_user.aNumber).to.equal('9223372036854775807');
            });
          });
        });

        it('negative', function() {
          const User = this.User;

          return User.create({aNumber: '-9223372036854775807'}).then(user => {
            expect(user.aNumber).to.equal('-9223372036854775807');
            return User.find({where: {aNumber: '-9223372036854775807'}}).then(_user => {
              expect(_user.aNumber).to.equal('-9223372036854775807');
            });
          });
        });
      });
    });

    describe('timestamps', () => {
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
          logging(sql) {
            expect(sql.indexOf('TIMESTAMP WITH TIME ZONE')).to.be.greaterThan(0);
          }
        });
      });
    });

    describe('model', () => {
      it('create handles array correctly', function() {
        return this.User
          .create({ username: 'user', email: ['foo@bar.com', 'bar@baz.com'] })
          .then(oldUser => {
            expect(oldUser.email).to.contain.members(['foo@bar.com', 'bar@baz.com']);
          });
      });

      it('should save hstore correctly', function() {
        return this.User.create({ username: 'user', email: ['foo@bar.com'], settings: { created: '"value"' }}).then(newUser => {
          // Check to see if the default value for an hstore field works
          expect(newUser.document).to.deep.equal({ default: "'value'" });
          expect(newUser.settings).to.deep.equal({ created: '"value"' });

          // Check to see if updating an hstore field works
          return newUser.updateAttributes({settings: {should: 'update', to: 'this', first: 'place'}}).then(oldUser => {
            // Postgres always returns keys in alphabetical order (ascending)
            expect(oldUser.settings).to.deep.equal({first: 'place', should: 'update', to: 'this'});
          });
        });
      });

      it('should save hstore array correctly', function() {
        const User = this.User;

        return this.User.create({
          username: 'bob',
          email: ['myemail@email.com'],
          phones: [{ number: '123456789', type: 'mobile' }, { number: '987654321', type: 'landline' }, { number: '8675309', type: "Jenny's"}, {number: '5555554321', type: '"home\n"' }]
        }).then(() => User.findById(1).then(user => {
          expect(user.phones.length).to.equal(4);
          expect(user.phones[1].number).to.equal('987654321');
          expect(user.phones[2].type).to.equal("Jenny's");
          expect(user.phones[3].type).to.equal('"home\n"');
        }));
      });

      it('should bulkCreate with hstore property', function() {
        const User = this.User;

        return this.User.bulkCreate([{
          username: 'bob',
          email: ['myemail@email.com'],
          settings: {mailing: true, push: 'facebook', frequency: 3}
        }]).then(() => User.findById(1).then(user => {
          expect(user.settings.mailing).to.equal('true');
        }));
      });

      it('should update hstore correctly', function() {
        const self = this;

        return this.User.create({ username: 'user', email: ['foo@bar.com'], settings: { test: '"value"' }}).then(newUser => {
            // Check to see if the default value for an hstore field works
            expect(newUser.document).to.deep.equal({ default: "'value'" });
            expect(newUser.settings).to.deep.equal({ test: '"value"' });

            // Check to see if updating an hstore field works
            return self.User.update({ settings: { should: 'update', to: 'this', first: 'place' }}, { where: newUser.where() }).then(() => newUser.reload().then(() => {
              // Postgres always returns keys in alphabetical order (ascending)
              expect(newUser.settings).to.deep.equal({ first: 'place', should: 'update', to: 'this' });
            }));
          });
      });

      it('should update hstore correctly and return the affected rows', function() {
        const self = this;

        return this.User.create({ username: 'user', email: ['foo@bar.com'], settings: { test: '"value"' }}).then(oldUser => self.User.update({ settings: { should: 'update', to: 'this', first: 'place' }}, { where: oldUser.where(), returning: true }).spread((count, users) => {
          expect(count).to.equal(1);
          expect(users[0].settings).to.deep.equal({ should: 'update', to: 'this', first: 'place' });
        }));
      });

      it('should read hstore correctly', function() {
        const self = this;
        const data = { username: 'user', email: ['foo@bar.com'], settings: { test: '"value"' }};

        return this.User.create(data)
          .then(() => self.User.find({ where: { username: 'user' }}))
          .then(user => {
            // Check that the hstore fields are the same when retrieving the user
            expect(user.settings).to.deep.equal(data.settings);
          });
      });

      it('should read an hstore array correctly', function() {
        const self = this;
        const data = { username: 'user', email: ['foo@bar.com'], phones: [{ number: '123456789', type: 'mobile' }, { number: '987654321', type: 'landline' }] };

        return this.User.create(data)
          .then(() => self.User.find({ where: { username: 'user' }})).then(user => {
            expect(user.phones).to.deep.equal(data.phones);
          });
      });

      it('should read hstore correctly from multiple rows', function() {
        const self = this;

        return self.User
          .create({ username: 'user1', email: ['foo@bar.com'], settings: { test: '"value"' }})
          .then(() => self.User.create({ username: 'user2', email: ['foo2@bar.com'], settings: { another: '"example"' }}))
          .then(() => self.User.findAll({ order: 'username' }))
          .then(users => {
            expect(users[0].settings).to.deep.equal({ test: '"value"' });
            expect(users[1].settings).to.deep.equal({ another: '"example"' });
          });
      });

      it('should read hstore correctly from included models as well', function() {
        const self = this,
              HstoreSubmodel = self.sequelize.define('hstoreSubmodel', {
                someValue: DataTypes.HSTORE
              }),
              submodelValue = { testing: '"hstore"' };

        self.User.hasMany(HstoreSubmodel);

        return self.sequelize
          .sync({ force: true })
          .then(() => self.User.create({ username: 'user1' })
          .then(user => HstoreSubmodel.create({ someValue: submodelValue})
          .then(submodel => user.setHstoreSubmodels([submodel]))))
          .then(() => self.User.find({ where: { username: 'user1' }, include: [HstoreSubmodel]}))
          .then(user => {
            expect(user.hasOwnProperty('hstoreSubmodels')).to.be.ok;
            expect(user.hstoreSubmodels.length).to.equal(1);
            expect(user.hstoreSubmodels[0].someValue).to.deep.equal(submodelValue);
          });
      });

      it('should save range correctly', function() {
        const period = [new Date(2015, 0, 1), new Date(2015, 11, 31)];
        return this.User.create({ username: 'user', email: ['foo@bar.com'], course_period: period}).then(newUser => {
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
          return newUser.updateAttributes({acceptable_marks: [0.8, 0.9]}).then(() => {
            expect(newUser.acceptable_marks.length).to.equal(2);
            expect(newUser.acceptable_marks[0]).to.equal(0.8); // lower bound
            expect(newUser.acceptable_marks[1]).to.equal(0.9); // upper bound
          });
        });
      });

      it('should save range array correctly', function() {
        const User = this.User,
              holidays = [
                [new Date(2015, 3, 1), new Date(2015, 3, 15)],
                [new Date(2015, 8, 1), new Date(2015, 9, 15)]
              ];

        return User.create({
          username: 'bob',
          email: ['myemail@email.com'],
          holidays
        }).then(() => User.findById(1).then(user => {
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
        }));
      });

      it('should bulkCreate with range property', function() {
        const User = this.User, period = [new Date(2015, 0, 1), new Date(2015, 11, 31)];

        return User.bulkCreate([{
          username: 'bob',
          email: ['myemail@email.com'],
          course_period: period
        }]).then(() => User.findById(1).then(user => {
          expect(user.course_period[0] instanceof Date).to.be.ok;
          expect(user.course_period[1] instanceof Date).to.be.ok;
          expect(user.course_period[0]).to.equalTime(period[0]); // lower bound
          expect(user.course_period[1]).to.equalTime(period[1]); // upper bound
          expect(user.course_period.inclusive).to.deep.equal([true, false]); // inclusive, exclusive
        }));
      });

      it('should update range correctly', function() {
        const User = this.User;
        let period = [new Date(2015, 0, 1), new Date(2015, 11, 31)];

        return User.create({ username: 'user', email: ['foo@bar.com'], course_period: period }).then(newUser => {
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
          return User.update({course_period: period}, {where: newUser.where()}).then(() => newUser.reload().then(() => {
            expect(newUser.course_period[0] instanceof Date).to.be.ok;
            expect(newUser.course_period[1] instanceof Date).to.be.ok;
            expect(newUser.course_period[0]).to.equalTime(period[0]); // lower bound
            expect(newUser.course_period[1]).to.equalTime(period[1]); // upper bound
            expect(newUser.course_period.inclusive).to.deep.equal([true, false]); // inclusive, exclusive
          }));
        });
      });

      it('should update range correctly and return the affected rows', function () {
        const User = this.User, period = [new Date(2015, 1, 1), new Date(2015, 10, 30)];

        return User.create({
          username:      'user',
          email:         ['foo@bar.com'],
          course_period: [new Date(2015, 0, 1), new Date(2015, 11, 31)]
        }).then(oldUser => User.update({ course_period: period }, { where: oldUser.where(), returning: true })
          .spread((count, users) => {
            expect(count).to.equal(1);
            expect(users[0].course_period[0] instanceof Date).to.be.ok;
            expect(users[0].course_period[1] instanceof Date).to.be.ok;
            expect(users[0].course_period[0]).to.equalTime(period[0]); // lower bound
            expect(users[0].course_period[1]).to.equalTime(period[1]); // upper bound
            expect(users[0].course_period.inclusive).to.deep.equal([true, false]); // inclusive, exclusive
          }));
      });

      it('should read range correctly', function() {
        const User = this.User;

        const course_period = [new Date(2015, 1, 1), new Date(2015, 10, 30)];
        course_period.inclusive = [false, false];

        const data = { username: 'user', email: ['foo@bar.com'], course_period};

        return User.create(data)
          .then(() => User.find({ where: { username: 'user' }}))
          .then(user => {
            // Check that the range fields are the same when retrieving the user
            expect(user.course_period).to.deep.equal(data.course_period);
          });
      });

      it('should read range array correctly', function() {
        const User = this.User,
              holidays = [
                [new Date(2015, 3, 1, 10), new Date(2015, 3, 15)],
                [new Date(2015, 8, 1), new Date(2015, 9, 15)]
              ];

        holidays[0].inclusive = [true, true];
        holidays[1].inclusive = [true, true];

        const data = { username: 'user', email: ['foo@bar.com'], holidays };

        return User.create(data)
          .then(() => User.find({ where: { username: 'user' }})).then(user => {
            expect(user.holidays).to.deep.equal(data.holidays);
          });
      });

      it('should read range correctly from multiple rows', function() {
        const User = this.User,
              periods = [
                [new Date(2015, 0, 1), new Date(2015, 11, 31)],
                [new Date(2016, 0, 1), new Date(2016, 11, 31)]
              ];

        return User
          .create({ username: 'user1', email: ['foo@bar.com'], course_period: periods[0]})
          .then(() => User.create({ username: 'user2', email: ['foo2@bar.com'], course_period: periods[1]}))
          .then(() => User.findAll({ order: 'username' }))
          .then(users => {
            expect(users[0].course_period[0]).to.equalTime(periods[0][0]); // lower bound
            expect(users[0].course_period[1]).to.equalTime(periods[0][1]); // upper bound
            expect(users[0].course_period.inclusive).to.deep.equal([true, false]); // inclusive, exclusive
            expect(users[1].course_period[0]).to.equalTime(periods[1][0]); // lower bound
            expect(users[1].course_period[1]).to.equalTime(periods[1][1]); // upper bound
            expect(users[1].course_period.inclusive).to.deep.equal([true, false]); // inclusive, exclusive
          });
      });

      it('should read range correctly from included models as well', function () {
        const self = this,
              period = [new Date(2016, 0, 1), new Date(2016, 11, 31)],
              HolidayDate = this.sequelize.define('holidayDate', {
                    period: DataTypes.RANGE(DataTypes.DATE)
                  });

        self.User.hasMany(HolidayDate);

        return self.sequelize
          .sync({ force: true })
          .then(() => self.User
          .create({ username: 'user', email: ['foo@bar.com'] })
          .then(user => HolidayDate.create({ period })
          .then(holidayDate => user.setHolidayDates([holidayDate]))))
          .then(() => self.User.find({ where: { username: 'user' }, include: [HolidayDate] }))
          .then(user => {
            expect(user.hasOwnProperty('holidayDates')).to.be.ok;
            expect(user.holidayDates.length).to.equal(1);
            expect(user.holidayDates[0].period.length).to.equal(2);
            expect(user.holidayDates[0].period[0]).to.equalTime(period[0]);
            expect(user.holidayDates[0].period[1]).to.equalTime(period[1]);
          });
      });
    });

    it('should save geometry correctly', function() {
      const point = { type: 'Point', coordinates: [39.807222,-76.984722] };
      return this.User.create({ username: 'user', email: ['foo@bar.com'], location: point}).then(newUser => {
        expect(newUser.location).to.deep.eql(point);
      });
    });

    it('should update geometry correctly', function() {
      const User = this.User;
      const point1 = { type: 'Point', coordinates: [39.807222,-76.984722] }, point2 = { type: 'Point', coordinates: [39.828333,-77.232222] };
      return User.create({ username: 'user', email: ['foo@bar.com'], location: point1}).then(oldUser => User.update({ location: point2 }, { where: { username: oldUser.username }, returning: true }).spread((count, updatedUsers) => {
        expect(updatedUsers[0].location).to.deep.eql(point2);
      }));
    });

    it('should read geometry correctly', function() {
      const User = this.User;
      const point = { type: 'Point', coordinates: [39.807222,-76.984722] };

      return User.create({ username: 'user', email: ['foo@bar.com'], location: point}).then(user => User.find({ where: { username: user.username }})).then(user => {
          expect(user.location).to.deep.eql(point);
      });
    });

    describe('[POSTGRES] Unquoted identifiers', () => {
      it('can insert and select', function() {
        const self = this;
        this.sequelize.options.quoteIdentifiers = false;
        this.sequelize.getQueryInterface().QueryGenerator.options.quoteIdentifiers = false;

        this.User = this.sequelize.define('Userxs', {
          username: DataTypes.STRING,
          fullName: DataTypes.STRING // Note mixed case
        }, {
          quoteIdentifiers: false
        });

        return this.User.sync({ force: true }).then(() => self.User
          .create({ username: 'user', fullName: 'John Smith' })
          .then(user => {
            // We can insert into a table with non-quoted identifiers
            expect(user.id).to.exist;
            expect(user.id).not.to.be.null;
            expect(user.username).to.equal('user');
            expect(user.fullName).to.equal('John Smith');

            // We can query by non-quoted identifiers
            return self.User.find({
              where: {fullName: 'John Smith'}
            })
            .then(user2 => {
              // We can map values back to non-quoted identifiers
              expect(user2.id).to.equal(user.id);
              expect(user2.username).to.equal('user');
              expect(user2.fullName).to.equal('John Smith');

              // We can query and aggregate by non-quoted identifiers
              return self.User
                .count({
                  where: {fullName: 'John Smith'}
                })
                .then(count => {
                  self.sequelize.options.quoteIndentifiers = true;
                  self.sequelize.getQueryInterface().QueryGenerator.options.quoteIdentifiers = true;
                  self.sequelize.options.logging = false;
                  expect(count).to.equal(1);
                });
            });
          }));
      });
    });
  });
}
