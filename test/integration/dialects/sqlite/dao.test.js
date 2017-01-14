'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , Sequelize = Support.Sequelize
  , dialect = Support.getTestDialect()
  , DataTypes = require(__dirname + '/../../../../lib/data-types');

if (dialect === 'sqlite') {
  describe('[SQLITE Specific] DAO', function() {
    beforeEach(function() {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        emergency_contact: DataTypes.JSON,
        emergencyContact: DataTypes.JSON,
        dateField: {
          type: DataTypes.DATE,
          field: 'date_field'
        }
      });
      this.Project = this.sequelize.define('project', {
        dateField: {
          type: DataTypes.DATE,
          field: 'date_field'
        }
      });

      this.User.hasMany(this.Project);
      return this.sequelize.sync({ force: true });
    });

    describe('findAll', function() {
      it('handles dates correctly', function() {
        var self = this
          , user = this.User.build({ username: 'user' });

        user.dataValues.createdAt = new Date(2011, 4, 4);

        return user.save().then(function() {
          return self.User.create({ username: 'new user' }).then(function() {
            return self.User.findAll({
              where: { createdAt: { $gt: new Date(2012, 1, 1) }}
            }).then(function(users) {
              expect(users).to.have.length(1);
            });
          });
        });
      });

      it('handles dates with aliasses correctly #3611', function() {
        return this.User.create({
          dateField: new Date(2010, 10, 10)
        }).bind(this).then(function () {
          return this.User.findAll().get(0);
        }).then(function (user) {
          expect(user.get('dateField')).to.be.an.instanceof(Date);
          expect(user.get('dateField')).to.equalTime(new Date(2010, 10, 10));
        });
      });

      it('handles dates in includes correctly #2644', function() {
        return this.User.create({
          projects: [
            { dateField: new Date(1990, 5, 5) }
          ]
        }, { include: [this.Project]}).bind(this).then(function () {
          return this.User.findAll({
            include: [this.Project]
          }).get(0);
        }).then(function (user) {
          expect(user.projects[0].get('dateField')).to.be.an.instanceof(Date);
          expect(user.projects[0].get('dateField')).to.equalTime(new Date(1990, 5, 5));
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
            return self.User.find({ where: { username: 'swen' }, attributes: [[Sequelize.json('emergency_contact.phones[1]'), 'firstEmergencyNumber']] });
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
            return self.User.find({ where: { username: 'swen' }, attributes: [[Sequelize.json('emergency_contact.kate'), 'katesNumber']] });
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
            return self.User.find({ where: { username: 'swen' }, attributes: [[Sequelize.json('emergency_contact.kate.email'), 'katesEmail']] });
          })
          .then(function(user) {
            expect(user.getDataValue('katesEmail')).to.equal('kate@kate.com');
          })
          .then(function() {
            return self.User.find({ where: { username: 'swen' }, attributes: [[Sequelize.json('emergency_contact.kate.phones[1]'), 'katesFirstPhone']] });
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
            return self.User.find({ where: Sequelize.json(`json_extract(emergency_contact, '$.name')`, 'kate'), attributes: ['username', 'emergency_contact'] });
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
              where: Sequelize.json({ emergency_contact: { name: 'kate' } })
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
            return self.User.find({ where: Sequelize.json('emergency_contact.name', 'joe') });
          })
          .then(function(user) {
            expect(user.emergency_contact.name).to.equal('joe');
          });
      });

      it('should be able to query using dot syntax with uppercase name', function() {
        var self = this;

        return this.sequelize.Promise.all([
          this.User.create({ username: 'swen', emergencyContact: { name: 'kate' } }),
          this.User.create({ username: 'anna', emergencyContact: { name: 'joe' } })])
          .then(function() {
            return self.User.find({
              attributes: [[Sequelize.json('emergencyContact.name'), 'contactName']],
              where: Sequelize.json('emergencyContact.name', 'joe')
            });
          })
          .then(function(user) {
            expect(user.get('contactName')).to.equal('joe');
          });
      });

      it('should be able to store values that require JSON escaping', function() {
        var self = this;
        var text = `Multi-line '$string' needing "escaping" for $$ and $1 type values`;

        return this.User.create({ username: 'swen', emergency_contact: { value: text } })
          .then(function(user) {
            expect(user.isNewRecord).to.equal(false);
          })
          .then(function() {
            return self.User.find({ where: { username: 'swen' } });
          })
          .then(function() {
            return self.User.find({ where: Sequelize.json('emergency_contact.value', text) });
          })
          .then(function(user) {
            expect(user.username).to.equal('swen');
          });
      });

      it('should be able to findOrCreate with values that require JSON escaping', function() {
        var self = this;
        var text = `Multi-line '$string' needing "escaping" for $$ and $1 type values`;

        return this.User.findOrCreate({ where: { username: 'swen' }, defaults: { emergency_contact: { value: text } } })
          .then(function(user) {
            expect(!user.isNewRecord).to.equal(true);
          })
          .then(function() {
            return self.User.find({ where: { username: 'swen' } });
          })
          .then(function() {
            return self.User.find({ where: Sequelize.json('emergency_contact.value', text) });
          })
          .then(function(user) {
            expect(user.username).to.equal('swen');
          });
      });
    });

    describe('regression tests', function() {

      it('do not crash while parsing unique constraint errors', function() {
        var Payments = this.sequelize.define('payments', {});

        return Payments.sync({force: true}).then(function () {
          return (expect(Payments.bulkCreate([{id: 1}, {id: 1}], { ignoreDuplicates: false })).to.eventually.be.rejected);
        });

      });
    });
  });
}
