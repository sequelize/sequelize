'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('./support'),
  dialect = Support.getTestDialect(),
  Sequelize = Support.Sequelize,
  current = Support.sequelize,
  DataTypes = Sequelize.DataTypes;

describe('model', () => {
  if (current.dialect.supports.JSON) {
    describe('json', () => {
      beforeEach(async function() {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          emergency_contact: DataTypes.JSON,
          emergencyContact: DataTypes.JSON
        });
        this.Order = this.sequelize.define('Order');
        this.Order.belongsTo(this.User);

        await this.sequelize.sync({ force: true });
      });

      it('should tell me that a column is json', async function() {
        const table = await this.sequelize.queryInterface.describeTable('Users');
        // expected for mariadb 10.4 : https://jira.mariadb.org/browse/MDEV-15558
        // oracledb 19c doesn't support JSON and the DB datatype is BLOB
        if (dialect === 'oracle') {
          expect(table.emergency_contact.type).to.equal('BLOB');
        } else if (dialect !== 'mariadb') {
          expect(table.emergency_contact.type).to.equal('JSON');
        }
      });

      it('should use a placeholder for json with insert', async function() {
        await this.User.create({
          username: 'bob',
          emergency_contact: { name: 'joe', phones: [1337, 42] }
        }, {
          fields: ['id', 'username', 'document', 'emergency_contact'],
          logging: sql => {
            if (dialect.match(/^mysql|mariadb/)) {
              expect(sql).to.include('?');
            } else if (dialect === 'oracle') {
              expect(sql).to.include(':1');
            } else {
              expect(sql).to.include('$1');
            }
          }
        });
      });

      it('should insert json using a custom field name', async function() {
        this.UserFields = this.sequelize.define('UserFields', {
          emergencyContact: { type: DataTypes.JSON, field: 'emergy_contact' }
        });
        await this.UserFields.sync({ force: true });

        const user = await this.UserFields.create({
          emergencyContact: { name: 'joe', phones: [1337, 42] }
        });

        expect(user.emergencyContact.name).to.equal('joe');
      });

      it('should update json using a custom field name', async function() {
        this.UserFields = this.sequelize.define('UserFields', {
          emergencyContact: { type: DataTypes.JSON, field: 'emergy_contact' }
        });
        await this.UserFields.sync({ force: true });

        const user0 = await this.UserFields.create({
          emergencyContact: { name: 'joe', phones: [1337, 42] }
        });

        user0.emergencyContact = { name: 'larry' };
        const user = await user0.save();
        expect(user.emergencyContact.name).to.equal('larry');
      });

      it('should be able retrieve json value as object', async function() {
        const emergencyContact = { name: 'kate', phone: 1337 };

        const user0 = await this.User.create({ username: 'swen', emergency_contact: emergencyContact });
        expect(user0.emergency_contact).to.eql(emergencyContact);
        const user = await this.User.findOne({ where: { username: 'swen' }, attributes: ['emergency_contact'] });
        expect(user.emergency_contact).to.eql(emergencyContact);
      });

      it('should be able to retrieve element of array by index', async function() {
        const emergencyContact = { name: 'kate', phones: [1337, 42] };

        const user0 = await this.User.create({ username: 'swen', emergency_contact: emergencyContact });
        expect(user0.emergency_contact).to.eql(emergencyContact);

        const user = await this.User.findOne({
          where: { username: 'swen' },
          attributes: [[Sequelize.json('emergency_contact.phones[1]'), 'firstEmergencyNumber']]
        });

        expect(parseInt(user.getDataValue('firstEmergencyNumber'), 10)).to.equal(42);
      });

      it('should be able to retrieve root level value of an object by key', async function() {
        const emergencyContact = { kate: 1337 };

        const user0 = await this.User.create({ username: 'swen', emergency_contact: emergencyContact });
        expect(user0.emergency_contact).to.eql(emergencyContact);

        const user = await this.User.findOne({
          where: { username: 'swen' },
          attributes: [[Sequelize.json('emergency_contact.kate'), 'katesNumber']]
        });

        expect(parseInt(user.getDataValue('katesNumber'), 10)).to.equal(1337);
      });

      it('should be able to retrieve nested value of an object by path', async function() {
        const emergencyContact = { kate: { email: 'kate@kate.com', phones: [1337, 42] } };

        const user1 = await this.User.create({ username: 'swen', emergency_contact: emergencyContact });
        expect(user1.emergency_contact).to.eql(emergencyContact);

        const user0 = await this.User.findOne({
          where: { username: 'swen' },
          attributes: [[Sequelize.json('emergency_contact.kate.email'), 'katesEmail']]
        });

        expect(user0.getDataValue('katesEmail')).to.equal('kate@kate.com');

        const user = await this.User.findOne({
          where: { username: 'swen' },
          attributes: [[Sequelize.json('emergency_contact.kate.phones[1]'), 'katesFirstPhone']]
        });

        expect(parseInt(user.getDataValue('katesFirstPhone'), 10)).to.equal(42);
      });

      it('should be able to retrieve a row based on the values of the json document', async function() {
        await Promise.all([
          this.User.create({ username: 'swen', emergency_contact: { name: 'kate' } }),
          this.User.create({ username: 'anna', emergency_contact: { name: 'joe' } })
        ]);

        const user = await this.User.findOne({
          where: Sequelize.json('emergency_contact.name', 'kate'),
          attributes: ['username', 'emergency_contact']
        });

        expect(user.emergency_contact.name).to.equal('kate');
      });

      it('should be able to query using the nested query language', async function() {
        await Promise.all([
          this.User.create({ username: 'swen', emergency_contact: { name: 'kate' } }),
          this.User.create({ username: 'anna', emergency_contact: { name: 'joe' } })
        ]);

        const user = await this.User.findOne({
          where: Sequelize.json({ emergency_contact: { name: 'kate' } })
        });

        expect(user.emergency_contact.name).to.equal('kate');
      });

      it('should be able to query using dot notation', async function() {
        await Promise.all([
          this.User.create({ username: 'swen', emergency_contact: { name: 'kate' } }),
          this.User.create({ username: 'anna', emergency_contact: { name: 'joe' } })
        ]);

        const user = await this.User.findOne({ where: Sequelize.json('emergency_contact.name', 'joe') });
        expect(user.emergency_contact.name).to.equal('joe');
      });

      it('should be able to query using dot notation with uppercase name', async function() {
        await Promise.all([
          this.User.create({ username: 'swen', emergencyContact: { name: 'kate' } }),
          this.User.create({ username: 'anna', emergencyContact: { name: 'joe' } })
        ]);

        const user = await this.User.findOne({
          attributes: [[Sequelize.json('emergencyContact.name'), 'contactName']],
          where: Sequelize.json('emergencyContact.name', 'joe')
        });

        expect(user.get('contactName')).to.equal('joe');
      });

      it('should be able to query array using property accessor', async function() {
        await Promise.all([
          this.User.create({ username: 'swen', emergency_contact: ['kate', 'joe'] }),
          this.User.create({ username: 'anna', emergency_contact: [{ name: 'joe' }] })
        ]);

        const user0 = await this.User.findOne({ where: Sequelize.json('emergency_contact.0', 'kate') });
        expect(user0.username).to.equal('swen');
        const user = await this.User.findOne({ where: Sequelize.json('emergency_contact[0].name', 'joe') });
        expect(user.username).to.equal('anna');
      });

      it('should be able to store strings', async function() {
        if (dialect === 'oracle') {
          const dbVersion = this.sequelize.options.databaseVersion;
          // Oracle DB below 21c doesn't recognize a string as a valid json
          if (dbVersion.localeCompare('21.0.0.0') === -1) {
            this.skip();
          }
        }
        await this.User.create({ username: 'swen', emergency_contact: 'joe' });
        const user = await this.User.findOne({ where: { username: 'swen' } });
        expect(user.emergency_contact).to.equal('joe');
      });

      it('should be able to store values that require JSON escaping', async function() {
        const text = 'Multi-line \'$string\' needing "escaping" for $$ and $1 type values';

        const user0 = await this.User.create({
          username: 'swen',
          emergency_contact: { value: text }
        });

        expect(user0.isNewRecord).to.equal(false);
        await this.User.findOne({ where: { username: 'swen' } });
        const user = await this.User.findOne({ where: Sequelize.json('emergency_contact.value', text) });
        expect(user.username).to.equal('swen');
      });

      it('should be able to findOrCreate with values that require JSON escaping', async function() {
        const text = 'Multi-line \'$string\' needing "escaping" for $$ and $1 type values';

        const user0 = await this.User.findOrCreate({
          where: { username: 'swen' },
          defaults: { emergency_contact: { value: text } }
        });

        expect(!user0.isNewRecord).to.equal(true);
        await this.User.findOne({ where: { username: 'swen' } });
        const user = await this.User.findOne({ where: Sequelize.json('emergency_contact.value', text) });
        expect(user.username).to.equal('swen');
      });

      // JSONB Supports this, but not JSON in postgres/mysql
      if (current.dialect.name === 'sqlite') {
        it('should be able to find with just string', async function() {
          await this.User.create({
            username: 'swen123',
            emergency_contact: 'Unknown'
          });

          const user = await this.User.findOne({ where: {
            emergency_contact: 'Unknown'
          } });

          expect(user.username).to.equal('swen123');
        });
      }

      it('should be able retrieve json value with nested include', async function() {
        const user = await this.User.create({
          emergency_contact: {
            name: 'kate'
          }
        });

        await this.Order.create({ UserId: user.id });

        const orders = await this.Order.findAll({
          attributes: ['id'],
          include: [{
            model: this.User,
            attributes: [
              [this.sequelize.json('emergency_contact.name'), 'katesName']
            ]
          }]
        });

        expect(orders[0].User.getDataValue('katesName')).to.equal('kate');
      });
    });
  }

  if (current.dialect.supports.JSONB) {
    describe('jsonb', () => {
      beforeEach(async function() {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          emergency_contact: DataTypes.JSONB
        });
        this.Order = this.sequelize.define('Order');
        this.Order.belongsTo(this.User);

        await this.sequelize.sync({ force: true });
      });

      it('should be able retrieve json value with nested include', async function() {
        const user = await this.User.create({
          emergency_contact: {
            name: 'kate'
          }
        });

        await this.Order.create({ UserId: user.id });

        const orders = await this.Order.findAll({
          attributes: ['id'],
          include: [{
            model: this.User,
            attributes: [
              [this.sequelize.json('emergency_contact.name'), 'katesName']
            ]
          }]
        });

        expect(orders[0].User.getDataValue('katesName')).to.equal('kate');
      });
    });
  }
});
