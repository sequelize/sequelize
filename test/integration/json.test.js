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
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          emergency_contact: DataTypes.JSON,
          emergencyContact: DataTypes.JSON
        });
        this.Order = this.sequelize.define('Order');
        this.Order.belongsTo(this.User);

        return this.sequelize.sync({ force: true });
      });

      it('should tell me that a column is json', function() {
        return this.sequelize.queryInterface.describeTable('Users')
          .then(table => {
            // expected for mariadb 10.4 : https://jira.mariadb.org/browse/MDEV-15558
            if (dialect !== 'mariadb') {
              expect(table.emergency_contact.type).to.equal('JSON');
            }
          });
      });

      it('should use a placeholder for json with insert', function() {
        return this.User.create({
          username: 'bob',
          emergency_contact: { name: 'joe', phones: [1337, 42] }
        }, {
          fields: ['id', 'username', 'document', 'emergency_contact'],
          logging: sql => {
            if (dialect.match(/^mysql|mariadb/)) {
              expect(sql).to.include('?');
            } else {
              expect(sql).to.include('$1');
            }
          }
        });
      });

      it('should insert json using a custom field name', function() {
        this.UserFields = this.sequelize.define('UserFields', {
          emergencyContact: { type: DataTypes.JSON, field: 'emergy_contact' }
        });
        return this.UserFields.sync({ force: true }).then(() => {
          return this.UserFields.create({
            emergencyContact: { name: 'joe', phones: [1337, 42] }
          }).then(user => {
            expect(user.emergencyContact.name).to.equal('joe');
          });
        });
      });

      it('should update json using a custom field name', function() {
        this.UserFields = this.sequelize.define('UserFields', {
          emergencyContact: { type: DataTypes.JSON, field: 'emergy_contact' }
        });
        return this.UserFields.sync({ force: true }).then(() => {
          return this.UserFields.create({
            emergencyContact: { name: 'joe', phones: [1337, 42] }
          }).then(user => {
            user.emergencyContact = { name: 'larry' };
            return user.save();
          }).then(user => {
            expect(user.emergencyContact.name).to.equal('larry');
          });
        });
      });

      it('should be able retrieve json value as object', function() {
        const emergencyContact = { name: 'kate', phone: 1337 };

        return this.User.create({ username: 'swen', emergency_contact: emergencyContact })
          .then(user => {
            expect(user.emergency_contact).to.eql(emergencyContact);
            return this.User.findOne({ where: { username: 'swen' }, attributes: ['emergency_contact'] });
          })
          .then(user => {
            expect(user.emergency_contact).to.eql(emergencyContact);
          });
      });

      it('should be able to retrieve element of array by index', function() {
        const emergencyContact = { name: 'kate', phones: [1337, 42] };

        return this.User.create({ username: 'swen', emergency_contact: emergencyContact })
          .then(user => {
            expect(user.emergency_contact).to.eql(emergencyContact);
            return this.User.findOne({
              where: { username: 'swen' },
              attributes: [[Sequelize.json('emergency_contact.phones[1]'), 'firstEmergencyNumber']]
            });
          })
          .then(user => {
            expect(parseInt(user.getDataValue('firstEmergencyNumber'), 10)).to.equal(42);
          });
      });

      it('should be able to retrieve root level value of an object by key', function() {
        const emergencyContact = { kate: 1337 };

        return this.User.create({ username: 'swen', emergency_contact: emergencyContact })
          .then(user => {
            expect(user.emergency_contact).to.eql(emergencyContact);
            return this.User.findOne({
              where: { username: 'swen' },
              attributes: [[Sequelize.json('emergency_contact.kate'), 'katesNumber']]
            });
          })
          .then(user => {
            expect(parseInt(user.getDataValue('katesNumber'), 10)).to.equal(1337);
          });
      });

      it('should be able to retrieve nested value of an object by path', function() {
        const emergencyContact = { kate: { email: 'kate@kate.com', phones: [1337, 42] } };

        return this.User.create({ username: 'swen', emergency_contact: emergencyContact })
          .then(user => {
            expect(user.emergency_contact).to.eql(emergencyContact);
            return this.User.findOne({
              where: { username: 'swen' },
              attributes: [[Sequelize.json('emergency_contact.kate.email'), 'katesEmail']]
            });
          }).then(user => {
            expect(user.getDataValue('katesEmail')).to.equal('kate@kate.com');
          }).then(() => {
            return this.User.findOne({
              where: { username: 'swen' },
              attributes: [[Sequelize.json('emergency_contact.kate.phones[1]'), 'katesFirstPhone']]
            });
          }).then(user => {
            expect(parseInt(user.getDataValue('katesFirstPhone'), 10)).to.equal(42);
          });
      });

      it('should be able to retrieve a row based on the values of the json document', function() {
        return Sequelize.Promise.all([
          this.User.create({ username: 'swen', emergency_contact: { name: 'kate' } }),
          this.User.create({ username: 'anna', emergency_contact: { name: 'joe' } })
        ]).then(() => {
          return this.User.findOne({
            where: Sequelize.json('emergency_contact.name', 'kate'),
            attributes: ['username', 'emergency_contact']
          });
        }).then(user => {
          expect(user.emergency_contact.name).to.equal('kate');
        });
      });

      it('should be able to query using the nested query language', function() {
        return Sequelize.Promise.all([
          this.User.create({ username: 'swen', emergency_contact: { name: 'kate' } }),
          this.User.create({ username: 'anna', emergency_contact: { name: 'joe' } })
        ]).then(() => {
          return this.User.findOne({
            where: Sequelize.json({ emergency_contact: { name: 'kate' } })
          });
        }).then(user => {
          expect(user.emergency_contact.name).to.equal('kate');
        });
      });

      it('should be able to query using dot notation', function() {
        return Sequelize.Promise.all([
          this.User.create({ username: 'swen', emergency_contact: { name: 'kate' } }),
          this.User.create({ username: 'anna', emergency_contact: { name: 'joe' } })
        ]).then(() => {
          return this.User.findOne({ where: Sequelize.json('emergency_contact.name', 'joe') });
        }).then(user => {
          expect(user.emergency_contact.name).to.equal('joe');
        });
      });

      it('should be able to query using dot notation with uppercase name', function() {
        return Sequelize.Promise.all([
          this.User.create({ username: 'swen', emergencyContact: { name: 'kate' } }),
          this.User.create({ username: 'anna', emergencyContact: { name: 'joe' } })
        ]).then(() => {
          return this.User.findOne({
            attributes: [[Sequelize.json('emergencyContact.name'), 'contactName']],
            where: Sequelize.json('emergencyContact.name', 'joe')
          });
        }).then(user => {
          expect(user.get('contactName')).to.equal('joe');
        });
      });

      it('should be able to query array using property accessor', function() {
        return Sequelize.Promise.all([
          this.User.create({ username: 'swen', emergency_contact: ['kate', 'joe'] }),
          this.User.create({ username: 'anna', emergency_contact: [{ name: 'joe' }] })
        ]).then(() => {
          return this.User.findOne({ where: Sequelize.json('emergency_contact.0', 'kate') });
        }).then(user => {
          expect(user.username).to.equal('swen');
        }).then(() => {
          return this.User.findOne({ where: Sequelize.json('emergency_contact[0].name', 'joe') });
        }).then(user => {
          expect(user.username).to.equal('anna');
        });
      });

      it('should be able to store values that require JSON escaping', function() {
        const text = 'Multi-line \'$string\' needing "escaping" for $$ and $1 type values';

        return this.User.create({
          username: 'swen',
          emergency_contact: { value: text }
        }).then(user => {
          expect(user.isNewRecord).to.equal(false);
        }).then(() => {
          return this.User.findOne({ where: { username: 'swen' } });
        }).then(() => {
          return this.User.findOne({ where: Sequelize.json('emergency_contact.value', text) });
        }).then(user => {
          expect(user.username).to.equal('swen');
        });
      });

      it('should be able to findOrCreate with values that require JSON escaping', function() {
        const text = 'Multi-line \'$string\' needing "escaping" for $$ and $1 type values';

        return this.User.findOrCreate({
          where: { username: 'swen' },
          defaults: { emergency_contact: { value: text } }
        }).then(user => {
          expect(!user.isNewRecord).to.equal(true);
        }).then(() => {
          return this.User.findOne({ where: { username: 'swen' } });
        }).then(() => {
          return this.User.findOne({ where: Sequelize.json('emergency_contact.value', text) });
        }).then(user => {
          expect(user.username).to.equal('swen');
        });
      });

      // JSONB Supports this, but not JSON in postgres/mysql
      if (current.dialect.name === 'sqlite') {
        it('should be able to find with just string', function() {
          return this.User.create({
            username: 'swen123',
            emergency_contact: 'Unknown'
          }).then(() => {
            return this.User.findOne({ where: {
              emergency_contact: 'Unknown'
            } });
          }).then(user => {
            expect(user.username).to.equal('swen123');
          });
        });
      }

      it('should be able retrieve json value with nested include', function() {
        return this.User.create({
          emergency_contact: {
            name: 'kate'
          }
        }).then(user => {
          return this.Order.create({ UserId: user.id });
        }).then(() => {
          return this.Order.findAll({
            attributes: ['id'],
            include: [{
              model: this.User,
              attributes: [
                [this.sequelize.json('emergency_contact.name'), 'katesName']
              ]
            }]
          });
        }).then(orders => {
          expect(orders[0].User.getDataValue('katesName')).to.equal('kate');
        });
      });
    });
  }

  if (current.dialect.supports.JSONB) {
    describe('jsonb', () => {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          emergency_contact: DataTypes.JSONB
        });
        this.Order = this.sequelize.define('Order');
        this.Order.belongsTo(this.User);

        return this.sequelize.sync({ force: true });
      });

      it('should be able retrieve json value with nested include', function() {
        return this.User.create({
          emergency_contact: {
            name: 'kate'
          }
        }).then(user => {
          return this.Order.create({ UserId: user.id });
        }).then(() => {
          return this.Order.findAll({
            attributes: ['id'],
            include: [{
              model: this.User,
              attributes: [
                [this.sequelize.json('emergency_contact.name'), 'katesName']
              ]
            }]
          });
        }).then(orders => {
          expect(orders[0].User.getDataValue('katesName')).to.equal('kate');
        });
      });
    });
  }
});
