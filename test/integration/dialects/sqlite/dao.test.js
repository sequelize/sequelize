'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require(__dirname + '/../../support');
const DataTypes = require(__dirname + '/../../../../lib/data-types');
const dialect = Support.getTestDialect();

if (dialect === 'sqlite') {
  describe('[SQLITE Specific] DAO', () => {
    beforeEach(function() {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
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
        const self = this, user = this.User.build({ username: 'user' });

        user.dataValues.createdAt = new Date(2011, 4, 4);

        return user.save().then(() => self.User.create({ username: 'new user' }).then(() => self.User.findAll({
          where: { createdAt: { $gt:  new Date(2012, 1, 1) }}
        }).then(users => {
          expect(users).to.have.length(1);
        })));
      });

      it('handles dates with aliasses correctly #3611', function() {
        return this.User.create({
          dateField: new Date(2010, 10, 10)
        }).bind(this).then(function () {
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
        }, { include: [this.Project]}).bind(this).then(function () {
          return this.User.findAll({
            include: [this.Project]
          }).get(0);
        }).then(user => {
          expect(user.projects[0].get('dateField')).to.be.an.instanceof(Date);
          expect(user.projects[0].get('dateField')).to.equalTime(new Date(1990, 5, 5));
        });
      });
    });

    describe('regression tests', () => {

      it('do not crash while parsing unique constraint errors', function() {
        const Payments = this.sequelize.define('payments', {});

        return Payments.sync({force: true}).then(() => expect(Payments.bulkCreate([{id: 1}, {id: 1}], { ignoreDuplicates: false })).to.eventually.be.rejected);

      });
    });
  });
}
