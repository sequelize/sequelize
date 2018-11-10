'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../../support'),
  Sequelize = Support.Sequelize,
  dialect = Support.getTestDialect(),
  DataTypes = require(__dirname + '/../../../../lib/data-types');

if (dialect === 'sqlite') {
  describe('[SQLITE Specific] DAO', () => {
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

    describe('findAll', () => {
      it('handles dates correctly', function() {
        const user = this.User.build({ username: 'user' });

        user.dataValues.createdAt = new Date(2011, 4, 4);

        return user.save().then(() => {
          return this.User.create({ username: 'new user' }).then(() => {
            return this.User.findAll({
              where: { createdAt: { $gt: new Date(2012, 1, 1) } }
            }).then(users => {
              expect(users).to.have.length(1);
            });
          });
        });
      });

      it('handles dates with aliasses correctly #3611', function() {
        return this.User.create({
          dateField: new Date(2010, 10, 10)
        }).then(() => {
          return this.User.findAll().get(0);
        }).then(user => {
          expect(user.get('dateField')).to.be.an.instanceof(Date);
          expect(user.get('dateField')).to.equalTime(new Date(2010, 10, 10));
        });
      });

      it('handles dates in includes correctly #2644', function() {
        return this.User.create({
          projects: [
            { dateField: new Date(1990, 5, 5) }
          ]
        }, { include: [this.Project] }).then(() => {
          return this.User.findAll({
            include: [this.Project]
          }).get(0);
        }).then(user => {
          expect(user.projects[0].get('dateField')).to.be.an.instanceof(Date);
          expect(user.projects[0].get('dateField')).to.equalTime(new Date(1990, 5, 5));
        });
      });
    });

    describe('json', () => {
      it('should be able to retrieve a row with json_extract function', function() {
        return this.sequelize.Promise.all([
          this.User.create({ username: 'swen', emergency_contact: { name: 'kate' } }),
          this.User.create({ username: 'anna', emergency_contact: { name: 'joe' } })
        ]).then(() => {
          return this.User.find({
            where: Sequelize.json('json_extract(emergency_contact, \'$.name\')', 'kate'),
            attributes: ['username', 'emergency_contact']
          });
        }).then(user => {
          expect(user.emergency_contact.name).to.equal('kate');
        });
      });

      it('should be able to retrieve a row by json_type function', function() {
        return this.sequelize.Promise.all([
          this.User.create({ username: 'swen', emergency_contact: { name: 'kate' } }),
          this.User.create({ username: 'anna', emergency_contact: ['kate', 'joe'] })
        ]).then(() => {
          return this.User.find({
            where: Sequelize.json('json_type(emergency_contact)', 'array'),
            attributes: ['username', 'emergency_contact']
          });
        }).then(user => {
          expect(user.username).to.equal('anna');
        });
      });
    });

    describe('regression tests', () => {
      it('do not crash while parsing unique constraint errors', function() {
        const Payments = this.sequelize.define('payments', {});

        return Payments.sync({ force: true }).then(() => {
          return expect(Payments.bulkCreate([{ id: 1 }, { id: 1 }], { ignoreDuplicates: false })).to.eventually.be.rejected;
        });
      });
    });
  });
}
