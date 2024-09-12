'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  Sequelize = Support.Sequelize,
  Op = Sequelize.Op,
  dialect = Support.getTestDialect(),
  DataTypes = require('sequelize/lib/data-types'),
  sequelize = require('sequelize/lib/sequelize');

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] DAO', () => {
    beforeEach(async function() {
      this.sequelize.options.quoteIdentifiers = true;
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        email: { type: DataTypes.ARRAY(DataTypes.TEXT) },
        settings: DataTypes.HSTORE,
        document: { type: DataTypes.HSTORE, defaultValue: { default: "'value'" } },
        phones: DataTypes.ARRAY(DataTypes.HSTORE),
        emergency_contact: DataTypes.JSON,
        emergencyContact: DataTypes.JSON,
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
      await this.User.sync({ force: true });
    });

    afterEach(function() {
      this.sequelize.options.quoteIdentifiers = true;
    });

    it('should be able to search within an array', async function() {
      await this.User.findAll({
        where: {
          email: ['hello', 'world']
        },
        attributes: ['id', 'username', 'email', 'settings', 'document', 'phones', 'emergency_contact', 'friends'],
        logging(sql) {
          expect(sql).to.equal('Executing (default): SELECT "id", "username", "email", "settings", "document", "phones", "emergency_contact", "friends" FROM "Users" AS "User" WHERE "User"."email" = ARRAY[\'hello\',\'world\']::TEXT[];');
        }
      });
    });

    it('should be able to update a field with type ARRAY(JSON)', async function() {
      const userInstance = await this.User.create({
        username: 'bob',
        email: ['myemail@email.com'],
        friends: [{
          name: 'John Smith'
        }]
      });

      expect(userInstance.friends).to.have.length(1);
      expect(userInstance.friends[0].name).to.equal('John Smith');

      const obj = await userInstance.update({
        friends: [{
          name: 'John Smythe'
        }]
      });

      const friends = await obj['friends'];
      expect(friends).to.have.length(1);
      expect(friends[0].name).to.equal('John Smythe');
      await friends;
    });

    it('should be able to find a record while searching in an array', async function() {
      await this.User.bulkCreate([
        { username: 'bob', email: ['myemail@email.com'] },
        { username: 'tony', email: ['wrongemail@email.com'] }
      ]);

      const user = await this.User.findAll({ where: { email: ['myemail@email.com'] } });
      expect(user).to.be.instanceof(Array);
      expect(user).to.have.length(1);
      expect(user[0].username).to.equal('bob');
    });

    describe('json', () => {
      it('should be able to retrieve a row with ->> operator', async function() {
        await Promise.all([
          this.User.create({ username: 'swen', emergency_contact: { name: 'kate' } }),
          this.User.create({ username: 'anna', emergency_contact: { name: 'joe' } })]);

        const user = await this.User.findOne({ where: sequelize.json("emergency_contact->>'name'", 'kate'), attributes: ['username', 'emergency_contact'] });
        expect(user.emergency_contact.name).to.equal('kate');
      });

      it('should be able to query using the nested query language', async function() {
        await Promise.all([
          this.User.create({ username: 'swen', emergency_contact: { name: 'kate' } }),
          this.User.create({ username: 'anna', emergency_contact: { name: 'joe' } })]);

        const user = await this.User.findOne({
          where: sequelize.json({ emergency_contact: { name: 'kate' } })
        });

        expect(user.emergency_contact.name).to.equal('kate');
      });

      it('should be able to query using dot syntax', async function() {
        await Promise.all([
          this.User.create({ username: 'swen', emergency_contact: { name: 'kate' } }),
          this.User.create({ username: 'anna', emergency_contact: { name: 'joe' } })]);

        const user = await this.User.findOne({ where: sequelize.json('emergency_contact.name', 'joe') });
        expect(user.emergency_contact.name).to.equal('joe');
      });

      it('should be able to query using dot syntax with uppercase name', async function() {
        await Promise.all([
          this.User.create({ username: 'swen', emergencyContact: { name: 'kate' } }),
          this.User.create({ username: 'anna', emergencyContact: { name: 'joe' } })]);

        const user = await this.User.findOne({
          attributes: [[sequelize.json('emergencyContact.name'), 'contactName']],
          where: sequelize.json('emergencyContact.name', 'joe')
        });

        expect(user.get('contactName')).to.equal('joe');
      });

      it('should be able to store values that require JSON escaping', async function() {
        const text = "Multi-line '$string' needing \"escaping\" for $$ and $1 type values";

        const user0 = await this.User.create({ username: 'swen', emergency_contact: { value: text } });
        expect(user0.isNewRecord).to.equal(false);
        await this.User.findOne({ where: { username: 'swen' } });
        const user = await this.User.findOne({ where: sequelize.json('emergency_contact.value', text) });
        expect(user.username).to.equal('swen');
      });

      it('should be able to findOrCreate with values that require JSON escaping', async function() {
        const text = "Multi-line '$string' needing \"escaping\" for $$ and $1 type values";

        const user0 = await this.User.findOrCreate({ where: { username: 'swen' }, defaults: { emergency_contact: { value: text } } });
        expect(!user0.isNewRecord).to.equal(true);
        await this.User.findOne({ where: { username: 'swen' } });
        const user = await this.User.findOne({ where: sequelize.json('emergency_contact.value', text) });
        expect(user.username).to.equal('swen');
      });
    });

    describe('hstore', () => {
      it('should tell me that a column is hstore and not USER-DEFINED', async function() {
        const table = await this.sequelize.queryInterface.describeTable('Users');
        expect(table.settings.type).to.equal('HSTORE');
        expect(table.document.type).to.equal('HSTORE');
      });

      it('should NOT stringify hstore with insert', async function() {
        await this.User.create({
          username: 'bob',
          email: ['myemail@email.com'],
          settings: { mailing: false, push: 'facebook', frequency: 3 }
        }, {
          logging(sql) {
            const unexpected = '\'"mailing"=>"false","push"=>"facebook","frequency"=>"3"\',\'"default"=>"\'\'value\'\'"\'';
            expect(sql).not.to.include(unexpected);
          }
        });
      });

      it('should not rename hstore fields', async function() {
        const Equipment = this.sequelize.define('Equipment', {
          grapplingHook: {
            type: DataTypes.STRING,
            field: 'grappling_hook'
          },
          utilityBelt: {
            type: DataTypes.HSTORE
          }
        });

        await Equipment.sync({ force: true });

        await Equipment.findAll({
          where: {
            utilityBelt: {
              grapplingHook: true
            }
          },
          logging(sql) {
            expect(sql).to.contains(' WHERE "Equipment"."utilityBelt" = \'"grapplingHook"=>"true"\';');
          }
        });
      });

      it('should not rename json fields', async function() {
        const Equipment = this.sequelize.define('Equipment', {
          grapplingHook: {
            type: DataTypes.STRING,
            field: 'grappling_hook'
          },
          utilityBelt: {
            type: DataTypes.JSON
          }
        });

        await Equipment.sync({ force: true });

        await Equipment.findAll({
          where: {
            utilityBelt: {
              grapplingHook: true
            }
          },
          logging(sql) {
            expect(sql).to.contains(' WHERE CAST(("Equipment"."utilityBelt"#>>\'{grapplingHook}\') AS BOOLEAN) = true;');
          }
        });
      });

    });

    describe('range', () => {
      it('should tell me that a column is range and not USER-DEFINED', async function() {
        const table = await this.sequelize.queryInterface.describeTable('Users');
        expect(table.course_period.type).to.equal('TSTZRANGE');
        expect(table.available_amount.type).to.equal('INT4RANGE');
      });

    });

    describe('enums', () => {
      it('should be able to create enums with escape values', async function() {
        const User = this.sequelize.define('UserEnums', {
          mood: DataTypes.ENUM('happy', 'sad', '1970\'s')
        });

        await User.sync({ force: true });
      });

      it('should be able to ignore enum types that already exist', async function() {
        const User = this.sequelize.define('UserEnums', {
          mood: DataTypes.ENUM('happy', 'sad', 'meh')
        });

        await User.sync({ force: true });

        await User.sync();
      });

      it('should be able to create/drop enums multiple times', async function() {
        const User = this.sequelize.define('UserEnums', {
          mood: DataTypes.ENUM('happy', 'sad', 'meh')
        });

        await User.sync({ force: true });

        await User.sync({ force: true });
      });

      it('should be able to create/drop multiple enums multiple times', async function() {
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

        await DummyModel.sync({ force: true });
        // now sync one more time:
        await DummyModel.sync({ force: true });
        // sync without dropping
        await DummyModel.sync();
      });

      it('should be able to create/drop multiple enums multiple times with field name (#7812)', async function() {
        const DummyModel = this.sequelize.define('Dummy-pg', {
          username: DataTypes.STRING,
          theEnumOne: {
            field: 'oh_my_this_enum_one',
            type: DataTypes.ENUM,
            values: [
              'one',
              'two',
              'three'
            ]
          },
          theEnumTwo: {
            field: 'oh_my_this_enum_two',
            type: DataTypes.ENUM,
            values: [
              'four',
              'five',
              'six'
            ]
          }
        });

        await DummyModel.sync({ force: true });
        // now sync one more time:
        await DummyModel.sync({ force: true });
        // sync without dropping
        await DummyModel.sync();
      });

      it('should be able to add values to enum types', async function() {
        let User = this.sequelize.define('UserEnums', {
          mood: DataTypes.ENUM('happy', 'sad', 'meh')
        });

        await User.sync({ force: true });
        User = this.sequelize.define('UserEnums', {
          mood: DataTypes.ENUM('neutral', 'happy', 'sad', 'ecstatic', 'meh', 'joyful')
        });

        await User.sync();
        const enums = await this.sequelize.getQueryInterface().pgListEnums(User.getTableName());
        expect(enums).to.have.length(1);
        expect(enums[0].enum_value).to.equal('{neutral,happy,sad,ecstatic,meh,joyful}');
      });

      it('should be able to add multiple values with different order', async function() {
        let User = this.sequelize.define('UserEnums', {
          priority: DataTypes.ENUM('1', '2', '6')
        });

        await User.sync({ force: true });
        User = this.sequelize.define('UserEnums', {
          priority: DataTypes.ENUM('0', '1', '2', '3', '4', '5', '6', '7')
        });

        await User.sync();
        const enums = await this.sequelize.getQueryInterface().pgListEnums(User.getTableName());
        expect(enums).to.have.length(1);
        expect(enums[0].enum_value).to.equal('{0,1,2,3,4,5,6,7}');
      });

      describe('ARRAY(ENUM)', () => {
        it('should be able to ignore enum types that already exist', async function() {
          const User = this.sequelize.define('UserEnums', {
            permissions: DataTypes.ARRAY(DataTypes.ENUM([
              'access',
              'write',
              'check',
              'delete'
            ]))
          });

          await User.sync({ force: true });

          await User.sync();
        });

        it('should be able to create/drop enums multiple times', async function() {
          const User = this.sequelize.define('UserEnums', {
            permissions: DataTypes.ARRAY(DataTypes.ENUM([
              'access',
              'write',
              'check',
              'delete'
            ]))
          });

          await User.sync({ force: true });

          await User.sync({ force: true });
        });

        it('should be able to add values to enum types', async function() {
          let User = this.sequelize.define('UserEnums', {
            permissions: DataTypes.ARRAY(DataTypes.ENUM([
              'access',
              'write',
              'check',
              'delete'
            ]))
          });

          await User.sync({ force: true });
          User = this.sequelize.define('UserEnums', {
            permissions: DataTypes.ARRAY(
              DataTypes.ENUM('view', 'access', 'edit', 'write', 'check', 'delete')
            )
          });

          await User.sync();
          const enums = await this.sequelize.getQueryInterface().pgListEnums(User.getTableName());
          expect(enums).to.have.length(1);
          expect(enums[0].enum_value).to.equal('{view,access,edit,write,check,delete}');
        });

        it('should be able to insert new record', async function() {
          const User = this.sequelize.define('UserEnums', {
            name: DataTypes.STRING,
            type: DataTypes.ENUM('A', 'B', 'C'),
            owners: DataTypes.ARRAY(DataTypes.STRING),
            permissions: DataTypes.ARRAY(DataTypes.ENUM([
              'access',
              'write',
              'check',
              'delete'
            ]))
          });

          await User.sync({ force: true });

          const user = await User.create({
            name: 'file.exe',
            type: 'C',
            owners: ['userA', 'userB'],
            permissions: ['access', 'write']
          });

          expect(user.name).to.equal('file.exe');
          expect(user.type).to.equal('C');
          expect(user.owners).to.deep.equal(['userA', 'userB']);
          expect(user.permissions).to.deep.equal(['access', 'write']);
        });

        it('should be able to insert a new record even with a redefined field name', async function() {
          const User = this.sequelize.define('UserEnums', {
            name: DataTypes.STRING,
            type: DataTypes.ENUM('A', 'B', 'C'),
            owners: DataTypes.ARRAY(DataTypes.STRING),
            specialPermissions: {
              type: DataTypes.ARRAY(DataTypes.ENUM([
                'access',
                'write',
                'check',
                'delete'
              ])),
              field: 'special_permissions'
            }
          });

          await User.sync({ force: true });

          const user = await User.bulkCreate([{
            name: 'file.exe',
            type: 'C',
            owners: ['userA', 'userB'],
            specialPermissions: ['access', 'write']
          }]);

          expect(user.length).to.equal(1);
        });

        it('should be able to insert a new record even with an array of enums in a schema', async function() {
          const schema = 'special_schema';
          this.sequelize.createSchema(schema);
          const User = this.sequelize.define('UserEnums', {
            name: DataTypes.STRING,
            type: DataTypes.ENUM('A', 'B', 'C'),
            owners: DataTypes.ARRAY(DataTypes.STRING),
            specialPermissions: {
              type: DataTypes.ARRAY(DataTypes.ENUM([
                'access',
                'write',
                'check',
                'delete'
              ])),
              field: 'special_permissions'
            }
          }, {
            schema
          });

          await User.sync({ force: true });

          const user = await User.bulkCreate([{
            name: 'file.exe',
            type: 'C',
            owners: ['userA', 'userB'],
            specialPermissions: ['access', 'write']
          }]);

          expect(user.length).to.equal(1);
        });

        it('should fail when trying to insert foreign element on ARRAY(ENUM)', async function() {
          const User = this.sequelize.define('UserEnums', {
            name: DataTypes.STRING,
            type: DataTypes.ENUM('A', 'B', 'C'),
            owners: DataTypes.ARRAY(DataTypes.STRING),
            permissions: DataTypes.ARRAY(DataTypes.ENUM([
              'access',
              'write',
              'check',
              'delete'
            ]))
          });

          await expect(User.sync({ force: true }).then(() => {
            return User.create({
              name: 'file.exe',
              type: 'C',
              owners: ['userA', 'userB'],
              permissions: ['cosmic_ray_disk_access']
            });
          })).to.be.rejectedWith(/invalid input value for enum "enum_UserEnums_permissions": "cosmic_ray_disk_access"/);
        });

        it('should be able to find records', async function() {
          const User = this.sequelize.define('UserEnums', {
            name: DataTypes.STRING,
            type: DataTypes.ENUM('A', 'B', 'C'),
            permissions: DataTypes.ARRAY(DataTypes.ENUM([
              'access',
              'write',
              'check',
              'delete'
            ]))
          });

          await User.sync({ force: true });

          await User.bulkCreate([{
            name: 'file1.exe',
            type: 'C',
            permissions: ['access', 'write']
          }, {
            name: 'file2.exe',
            type: 'A',
            permissions: ['access', 'check']
          }, {
            name: 'file3.exe',
            type: 'B',
            permissions: ['access', 'write', 'delete']
          }]);

          const users = await User.findAll({
            where: {
              type: {
                [Op.in]: ['A', 'C']
              },
              permissions: {
                [Op.contains]: ['write']
              }
            }
          });

          expect(users.length).to.equal(1);
          expect(users[0].name).to.equal('file1.exe');
          expect(users[0].type).to.equal('C');
          expect(users[0].permissions).to.deep.equal(['access', 'write']);
        });
      });
    });

    describe('integers', () => {
      describe('integer', () => {
        beforeEach(async function() {
          this.User = this.sequelize.define('User', {
            aNumber: DataTypes.INTEGER
          });

          await this.User.sync({ force: true });
        });

        it('positive', async function() {
          const User = this.User;

          const user = await User.create({ aNumber: 2147483647 });
          expect(user.aNumber).to.equal(2147483647);
          const _user = await User.findOne({ where: { aNumber: 2147483647 } });
          expect(_user.aNumber).to.equal(2147483647);
        });

        it('negative', async function() {
          const User = this.User;

          const user = await User.create({ aNumber: -2147483647 });
          expect(user.aNumber).to.equal(-2147483647);
          const _user = await User.findOne({ where: { aNumber: -2147483647 } });
          expect(_user.aNumber).to.equal(-2147483647);
        });
      });

      describe('bigint', () => {
        beforeEach(async function() {
          this.User = this.sequelize.define('User', {
            aNumber: DataTypes.BIGINT
          });

          await this.User.sync({ force: true });
        });

        it('positive', async function() {
          const User = this.User;

          const user = await User.create({ aNumber: '9223372036854775807' });
          expect(user.aNumber).to.equal('9223372036854775807');
          const _user = await User.findOne({ where: { aNumber: '9223372036854775807' } });
          expect(_user.aNumber).to.equal('9223372036854775807');
        });

        it('negative', async function() {
          const User = this.User;

          const user = await User.create({ aNumber: '-9223372036854775807' });
          expect(user.aNumber).to.equal('-9223372036854775807');
          const _user = await User.findOne({ where: { aNumber: '-9223372036854775807' } });
          expect(_user.aNumber).to.equal('-9223372036854775807');
        });
      });
    });

    describe('timestamps', () => {
      beforeEach(async function() {
        this.User = this.sequelize.define('User', {
          dates: DataTypes.ARRAY(DataTypes.DATE)
        });
        await this.User.sync({ force: true });
      });

      it('should use bind params instead of "TIMESTAMP WITH TIME ZONE"', async function() {
        await this.User.create({
          dates: []
        }, {
          logging(sql) {
            expect(sql).not.to.contain('TIMESTAMP WITH TIME ZONE');
            expect(sql).not.to.contain('DATETIME');
          }
        });
      });
    });

    describe('model', () => {
      it('create handles array correctly', async function() {
        const oldUser = await this.User
          .create({ username: 'user', email: ['foo@bar.com', 'bar@baz.com'] });

        expect(oldUser.email).to.contain.members(['foo@bar.com', 'bar@baz.com']);
      });

      it('should save hstore correctly', async function() {
        const newUser = await this.User.create({ username: 'user', email: ['foo@bar.com'], settings: { created: '"value"' } });
        // Check to see if the default value for an hstore field works
        expect(newUser.document).to.deep.equal({ default: "'value'" });
        expect(newUser.settings).to.deep.equal({ created: '"value"' });

        // Check to see if updating an hstore field works
        const oldUser = await newUser.update({ settings: { should: 'update', to: 'this', first: 'place' } });
        // Postgres always returns keys in alphabetical order (ascending)
        expect(oldUser.settings).to.deep.equal({ first: 'place', should: 'update', to: 'this' });
      });

      it('should save hstore array correctly', async function() {
        const User = this.User;

        await this.User.create({
          username: 'bob',
          email: ['myemail@email.com'],
          phones: [{ number: '123456789', type: 'mobile' }, { number: '987654321', type: 'landline' }, { number: '8675309', type: "Jenny's" }, { number: '5555554321', type: '"home\n"' }]
        });

        const user = await User.findByPk(1);
        expect(user.phones.length).to.equal(4);
        expect(user.phones[1].number).to.equal('987654321');
        expect(user.phones[2].type).to.equal("Jenny's");
        expect(user.phones[3].type).to.equal('"home\n"');
      });

      it('should bulkCreate with hstore property', async function() {
        const User = this.User;

        await this.User.bulkCreate([{
          username: 'bob',
          email: ['myemail@email.com'],
          settings: { mailing: true, push: 'facebook', frequency: 3 }
        }]);

        const user = await User.findByPk(1);
        expect(user.settings.mailing).to.equal('true');
      });

      it('should update hstore correctly', async function() {
        const newUser = await this.User.create({ username: 'user', email: ['foo@bar.com'], settings: { test: '"value"' } });
        // Check to see if the default value for an hstore field works
        expect(newUser.document).to.deep.equal({ default: "'value'" });
        expect(newUser.settings).to.deep.equal({ test: '"value"' });

        // Check to see if updating an hstore field works
        await this.User.update({ settings: { should: 'update', to: 'this', first: 'place' } }, { where: newUser.where() });
        await newUser.reload();
        // Postgres always returns keys in alphabetical order (ascending)
        expect(newUser.settings).to.deep.equal({ first: 'place', should: 'update', to: 'this' });
      });

      it('should update hstore correctly and return the affected rows', async function() {
        const oldUser = await this.User.create({ username: 'user', email: ['foo@bar.com'], settings: { test: '"value"' } });
        // Update the user and check that the returned object's fields have been parsed by the hstore library
        const [count, users] = await this.User.update({ settings: { should: 'update', to: 'this', first: 'place' } }, { where: oldUser.where(), returning: true });
        expect(count).to.equal(1);
        expect(users[0].settings).to.deep.equal({ should: 'update', to: 'this', first: 'place' });
      });

      it('should read hstore correctly', async function() {
        const data = { username: 'user', email: ['foo@bar.com'], settings: { test: '"value"' } };

        await this.User.create(data);
        const user = await this.User.findOne({ where: { username: 'user' } });
        // Check that the hstore fields are the same when retrieving the user
        expect(user.settings).to.deep.equal(data.settings);
      });

      it('should read an hstore array correctly', async function() {
        const data = { username: 'user', email: ['foo@bar.com'], phones: [{ number: '123456789', type: 'mobile' }, { number: '987654321', type: 'landline' }] };

        await this.User.create(data);
        // Check that the hstore fields are the same when retrieving the user
        const user = await this.User.findOne({ where: { username: 'user' } });
        expect(user.phones).to.deep.equal(data.phones);
      });

      it('should read hstore correctly from multiple rows', async function() {
        await this.User
          .create({ username: 'user1', email: ['foo@bar.com'], settings: { test: '"value"' } });

        await this.User.create({ username: 'user2', email: ['foo2@bar.com'], settings: { another: '"example"' } });
        // Check that the hstore fields are the same when retrieving the user
        const users = await this.User.findAll({ order: ['username'] });
        expect(users[0].settings).to.deep.equal({ test: '"value"' });
        expect(users[1].settings).to.deep.equal({ another: '"example"' });
      });

      it('should read hstore correctly from included models as well', async function() {
        const HstoreSubmodel = this.sequelize.define('hstoreSubmodel', {
          someValue: DataTypes.HSTORE
        });
        const submodelValue = { testing: '"hstore"' };

        this.User.hasMany(HstoreSubmodel);

        await this.sequelize
          .sync({ force: true });

        const user0 = await this.User.create({ username: 'user1' });
        const submodel = await HstoreSubmodel.create({ someValue: submodelValue });
        await user0.setHstoreSubmodels([submodel]);
        const user = await this.User.findOne({ where: { username: 'user1' }, include: [HstoreSubmodel] });
        expect(user.hasOwnProperty('hstoreSubmodels')).to.be.ok;
        expect(user.hstoreSubmodels.length).to.equal(1);
        expect(user.hstoreSubmodels[0].someValue).to.deep.equal(submodelValue);
      });

      it('should save range correctly', async function() {
        const period = [new Date(2015, 0, 1), new Date(2015, 11, 31)];
        const newUser = await this.User.create({ username: 'user', email: ['foo@bar.com'], course_period: period });
        // Check to see if the default value for a range field works

        expect(newUser.acceptable_marks.length).to.equal(2);
        expect(newUser.acceptable_marks[0].value).to.equal('0.65'); // lower bound
        expect(newUser.acceptable_marks[1].value).to.equal('1'); // upper bound
        expect(newUser.acceptable_marks[0].inclusive).to.deep.equal(true); // inclusive
        expect(newUser.acceptable_marks[1].inclusive).to.deep.equal(false); // exclusive
        expect(newUser.course_period[0].value instanceof Date).to.be.ok; // lower bound
        expect(newUser.course_period[1].value instanceof Date).to.be.ok; // upper bound
        expect(newUser.course_period[0].value).to.equalTime(period[0]); // lower bound
        expect(newUser.course_period[1].value).to.equalTime(period[1]); // upper bound
        expect(newUser.course_period[0].inclusive).to.deep.equal(true); // inclusive
        expect(newUser.course_period[1].inclusive).to.deep.equal(false); // exclusive

        // Check to see if updating a range field works
        await newUser.update({ acceptable_marks: [0.8, 0.9] });
        await newUser.reload(); // Ensure the acceptable_marks array is loaded with the complete range definition
        expect(newUser.acceptable_marks.length).to.equal(2);
        expect(newUser.acceptable_marks[0].value).to.equal('0.8'); // lower bound
        expect(newUser.acceptable_marks[1].value).to.equal('0.9'); // upper bound
      });

      it('should save range array correctly', async function() {
        const User = this.User;
        const holidays = [
          [new Date(2015, 3, 1), new Date(2015, 3, 15)],
          [new Date(2015, 8, 1), new Date(2015, 9, 15)]
        ];

        await User.create({
          username: 'bob',
          email: ['myemail@email.com'],
          holidays
        });

        const user = await User.findByPk(1);
        expect(user.holidays.length).to.equal(2);
        expect(user.holidays[0].length).to.equal(2);
        expect(user.holidays[0][0].value instanceof Date).to.be.ok;
        expect(user.holidays[0][1].value instanceof Date).to.be.ok;
        expect(user.holidays[0][0].value).to.equalTime(holidays[0][0]);
        expect(user.holidays[0][1].value).to.equalTime(holidays[0][1]);
        expect(user.holidays[1].length).to.equal(2);
        expect(user.holidays[1][0].value instanceof Date).to.be.ok;
        expect(user.holidays[1][1].value instanceof Date).to.be.ok;
        expect(user.holidays[1][0].value).to.equalTime(holidays[1][0]);
        expect(user.holidays[1][1].value).to.equalTime(holidays[1][1]);
      });

      it('should bulkCreate with range property', async function() {
        const User = this.User;
        const period = [new Date(2015, 0, 1), new Date(2015, 11, 31)];

        await User.bulkCreate([{
          username: 'bob',
          email: ['myemail@email.com'],
          course_period: period
        }]);

        const user = await User.findByPk(1);
        expect(user.course_period[0].value instanceof Date).to.be.ok;
        expect(user.course_period[1].value instanceof Date).to.be.ok;
        expect(user.course_period[0].value).to.equalTime(period[0]);  // lower bound
        expect(user.course_period[1].value).to.equalTime(period[1]);  // upper bound
        expect(user.course_period[0].inclusive).to.deep.equal(true);  // inclusive
        expect(user.course_period[1].inclusive).to.deep.equal(false); // exclusive
      });

      it('should update range correctly', async function() {
        const User = this.User;
        const period = [new Date(2015, 0, 1), new Date(2015, 11, 31)];

        const newUser = await User.create({ username: 'user', email: ['foo@bar.com'], course_period: period });
        // Check to see if the default value for a range field works
        expect(newUser.acceptable_marks.length).to.equal(2);
        expect(newUser.acceptable_marks[0].value).to.equal('0.65'); // lower bound
        expect(newUser.acceptable_marks[1].value).to.equal('1'); // upper bound
        expect(newUser.acceptable_marks[0].inclusive).to.deep.equal(true); // inclusive
        expect(newUser.acceptable_marks[1].inclusive).to.deep.equal(false); // exclusive
        expect(newUser.course_period[0].value instanceof Date).to.be.ok;
        expect(newUser.course_period[1].value instanceof Date).to.be.ok;
        expect(newUser.course_period[0].value).to.equalTime(period[0]); // lower bound
        expect(newUser.course_period[1].value).to.equalTime(period[1]); // upper bound
        expect(newUser.course_period[0].inclusive).to.deep.equal(true);  // inclusive
        expect(newUser.course_period[1].inclusive).to.deep.equal(false); // exclusive


        const period2 = [new Date(2015, 1, 1), new Date(2015, 10, 30)];

        // Check to see if updating a range field works
        await User.update({ course_period: period2 }, { where: newUser.where() });
        await newUser.reload();
        expect(newUser.course_period[0].value instanceof Date).to.be.ok;
        expect(newUser.course_period[1].value instanceof Date).to.be.ok;
        expect(newUser.course_period[0].value).to.equalTime(period2[0]); // lower bound
        expect(newUser.course_period[1].value).to.equalTime(period2[1]); // upper bound
        expect(newUser.course_period[0].inclusive).to.deep.equal(true);  // inclusive
        expect(newUser.course_period[1].inclusive).to.deep.equal(false); // exclusive
      });

      it('should update range correctly and return the affected rows', async function() {
        const User = this.User;
        const period = [new Date(2015, 1, 1), new Date(2015, 10, 30)];

        const oldUser = await User.create({
          username: 'user',
          email: ['foo@bar.com'],
          course_period: [new Date(2015, 0, 1), new Date(2015, 11, 31)]
        });

        // Update the user and check that the returned object's fields have been parsed by the range parser
        const [count, users] = await User.update({ course_period: period }, { where: oldUser.where(), returning: true });
        expect(count).to.equal(1);
        expect(users[0].course_period[0].value instanceof Date).to.be.ok;
        expect(users[0].course_period[1].value instanceof Date).to.be.ok;
        expect(users[0].course_period[0].value).to.equalTime(period[0]); // lower bound
        expect(users[0].course_period[1].value).to.equalTime(period[1]); // upper bound
        expect(users[0].course_period[0].inclusive).to.deep.equal(true);  // inclusive
        expect(users[0].course_period[1].inclusive).to.deep.equal(false); // exclusive
      });

      it('should read range correctly', async function() {
        const User = this.User;

        const course_period = [{ value: new Date(2015, 1, 1), inclusive: false }, { value: new Date(2015, 10, 30), inclusive: false }];

        const data = { username: 'user', email: ['foo@bar.com'], course_period };

        await User.create(data);
        const user = await User.findOne({ where: { username: 'user' } });
        // Check that the range fields are the same when retrieving the user
        expect(user.course_period).to.deep.equal(data.course_period);
      });

      it('should read range array correctly', async function() {
        const User = this.User;
        const holidays = [
          [{ value: new Date(2015, 3, 1, 10), inclusive: true }, { value: new Date(2015, 3, 15), inclusive: true }],
          [{ value: new Date(2015, 8, 1), inclusive: true }, { value: new Date(2015, 9, 15), inclusive: true }]
        ];
        const data = { username: 'user', email: ['foo@bar.com'], holidays };

        await User.create(data);
        // Check that the range fields are the same when retrieving the user
        const user = await User.findOne({ where: { username: 'user' } });
        expect(user.holidays).to.deep.equal(data.holidays);
      });

      it('should read range correctly from multiple rows', async function() {
        const User = this.User;
        const periods = [
          [new Date(2015, 0, 1), new Date(2015, 11, 31)],
          [new Date(2016, 0, 1), new Date(2016, 11, 31)]
        ];

        await User
          .create({ username: 'user1', email: ['foo@bar.com'], course_period: periods[0] });

        await User.create({ username: 'user2', email: ['foo2@bar.com'], course_period: periods[1] });
        // Check that the range fields are the same when retrieving the user
        const users = await User.findAll({ order: ['username'] });
        expect(users[0].course_period[0].value).to.equalTime(periods[0][0]); // lower bound
        expect(users[0].course_period[1].value).to.equalTime(periods[0][1]); // upper bound
        expect(users[0].course_period[0].inclusive).to.deep.equal(true); // inclusive
        expect(users[0].course_period[1].inclusive).to.deep.equal(false); // exclusive
        expect(users[1].course_period[0].value).to.equalTime(periods[1][0]); // lower bound
        expect(users[1].course_period[1].value).to.equalTime(periods[1][1]); // upper bound
        expect(users[1].course_period[0].inclusive).to.deep.equal(true); // inclusive
        expect(users[1].course_period[1].inclusive).to.deep.equal(false); // exclusive
      });

      it('should read range correctly from included models as well', async function() {
        const period = [new Date(2016, 0, 1), new Date(2016, 11, 31)];
        const HolidayDate = this.sequelize.define('holidayDate', {
          period: DataTypes.RANGE(DataTypes.DATE)
        });

        this.User.hasMany(HolidayDate);

        await this.sequelize
          .sync({ force: true });

        const user0 = await this.User
          .create({ username: 'user', email: ['foo@bar.com'] });

        const holidayDate = await HolidayDate.create({ period });
        await user0.setHolidayDates([holidayDate]);
        const user = await this.User.findOne({ where: { username: 'user' }, include: [HolidayDate] });
        expect(user.hasOwnProperty('holidayDates')).to.be.ok;
        expect(user.holidayDates.length).to.equal(1);
        expect(user.holidayDates[0].period.length).to.equal(2);
        expect(user.holidayDates[0].period[0].value).to.equalTime(period[0]);
        expect(user.holidayDates[0].period[1].value).to.equalTime(period[1]);
      });
    });

    it('should save geometry correctly', async function() {
      const point = { type: 'Point', coordinates: [39.807222, -76.984722] };
      const newUser = await this.User.create({ username: 'user', email: ['foo@bar.com'], location: point });
      expect(newUser.location).to.deep.eql(point);
    });

    it('should update geometry correctly', async function() {
      const User = this.User;
      const point1 = { type: 'Point', coordinates: [39.807222, -76.984722] };
      const point2 = { type: 'Point', coordinates: [39.828333, -77.232222] };
      const oldUser = await User.create({ username: 'user', email: ['foo@bar.com'], location: point1 });
      const [, updatedUsers] = await User.update({ location: point2 }, { where: { username: oldUser.username }, returning: true });
      expect(updatedUsers[0].location).to.deep.eql(point2);
    });

    it('should read geometry correctly', async function() {
      const User = this.User;
      const point = { type: 'Point', coordinates: [39.807222, -76.984722] };

      const user0 = await User.create({ username: 'user', email: ['foo@bar.com'], location: point });
      const user = await User.findOne({ where: { username: user0.username } });
      expect(user.location).to.deep.eql(point);
    });

    describe('[POSTGRES] Unquoted identifiers', () => {
      it('can insert and select', async function() {
        this.sequelize.options.quoteIdentifiers = false;
        this.sequelize.getQueryInterface().queryGenerator.options.quoteIdentifiers = false;

        this.User = this.sequelize.define('Userxs', {
          username: DataTypes.STRING,
          fullName: DataTypes.STRING // Note mixed case
        }, {
          quoteIdentifiers: false
        });

        await this.User.sync({ force: true });

        const user = await this.User
          .create({ username: 'user', fullName: 'John Smith' });

        // We can insert into a table with non-quoted identifiers
        expect(user.id).to.exist;
        expect(user.id).not.to.be.null;
        expect(user.username).to.equal('user');
        expect(user.fullName).to.equal('John Smith');

        // We can query by non-quoted identifiers
        const user2 = await this.User.findOne({
          where: { fullName: 'John Smith' }
        });

        // We can map values back to non-quoted identifiers
        expect(user2.id).to.equal(user.id);
        expect(user2.username).to.equal('user');
        expect(user2.fullName).to.equal('John Smith');

        // We can query and aggregate by non-quoted identifiers
        const count = await this.User
          .count({
            where: { fullName: 'John Smith' }
          });

        this.sequelize.options.quoteIndentifiers = true;
        this.sequelize.getQueryInterface().queryGenerator.options.quoteIdentifiers = true;
        this.sequelize.options.logging = false;
        expect(count).to.equal(1);
      });

      it('can select nested include', async function() {
        this.sequelize.options.quoteIdentifiers = false;
        this.sequelize.getQueryInterface().queryGenerator.options.quoteIdentifiers = false;
        this.Professor = this.sequelize.define('Professor', {
          fullName: DataTypes.STRING
        }, {
          quoteIdentifiers: false
        });
        this.Class = this.sequelize.define('Class', {
          name: DataTypes.STRING
        }, {
          quoteIdentifiers: false
        });
        this.Student = this.sequelize.define('Student', {
          fullName: DataTypes.STRING
        }, {
          quoteIdentifiers: false
        });
        this.ClassStudent = this.sequelize.define('ClassStudent', {
        }, {
          quoteIdentifiers: false,
          tableName: 'class_student'
        });
        this.Professor.hasMany(this.Class);
        this.Class.belongsTo(this.Professor);
        this.Class.belongsToMany(this.Student, { through: this.ClassStudent });
        this.Student.belongsToMany(this.Class, { through: this.ClassStudent });

        try {
          await this.Professor.sync({ force: true });
          await this.Student.sync({ force: true });
          await this.Class.sync({ force: true });
          await this.ClassStudent.sync({ force: true });

          await this.Professor.bulkCreate([
            {
              id: 1,
              fullName: 'Albus Dumbledore'
            },
            {
              id: 2,
              fullName: 'Severus Snape'
            }
          ]);

          await this.Class.bulkCreate([
            {
              id: 1,
              name: 'Transfiguration',
              ProfessorId: 1
            },
            {
              id: 2,
              name: 'Potions',
              ProfessorId: 2
            },
            {
              id: 3,
              name: 'Defence Against the Dark Arts',
              ProfessorId: 2
            }
          ]);

          await this.Student.bulkCreate([
            {
              id: 1,
              fullName: 'Harry Potter'
            },
            {
              id: 2,
              fullName: 'Ron Weasley'
            },
            {
              id: 3,
              fullName: 'Ginny Weasley'
            },
            {
              id: 4,
              fullName: 'Hermione Granger'
            }
          ]);

          await Promise.all([
            this.Student.findByPk(1)
              .then(Harry => {
                return Harry.setClasses([1, 2, 3]);
              }),
            this.Student.findByPk(2)
              .then(Ron => {
                return Ron.setClasses([1, 2]);
              }),
            this.Student.findByPk(3)
              .then(Ginny => {
                return Ginny.setClasses([2, 3]);
              }),
            this.Student.findByPk(4)
              .then(Hermione => {
                return Hermione.setClasses([1, 2, 3]);
              })
          ]);

          const professors = await this.Professor.findAll({
            include: [
              {
                model: this.Class,
                include: [
                  {
                    model: this.Student
                  }
                ]
              }
            ],
            order: [
              ['id'],
              [this.Class, 'id'],
              [this.Class, this.Student, 'id']
            ]
          });

          expect(professors.length).to.eql(2);
          expect(professors[0].fullName).to.eql('Albus Dumbledore');
          expect(professors[0].Classes.length).to.eql(1);
          expect(professors[0].Classes[0].Students.length).to.eql(3);
        } finally {
          this.sequelize.getQueryInterface().queryGenerator.options.quoteIdentifiers = true;
        }
      });
    });
  });
}
