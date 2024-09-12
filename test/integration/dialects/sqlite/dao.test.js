'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  Sequelize = Support.Sequelize,
  Op = Sequelize.Op,
  dialect = Support.getTestDialect(),
  DataTypes = require('sequelize/lib/data-types');

if (dialect === 'sqlite') {
  describe('[SQLITE Specific] DAO', () => {
    beforeEach(async function() {
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
      await this.sequelize.sync({ force: true });
    });

    describe('findAll', () => {
      it('handles dates correctly', async function() {
        const user = this.User.build({ username: 'user' });

        user.dataValues.createdAt = new Date(2011, 4, 4);

        await user.save();
        await this.User.create({ username: 'new user' });

        const users = await this.User.findAll({
          where: { createdAt: { [Op.gt]: new Date(2012, 1, 1) } }
        });

        expect(users).to.have.length(1);
      });

      it('handles dates with aliasses correctly #3611', async function() {
        await this.User.create({
          dateField: new Date(2010, 10, 10)
        });

        const obj = await this.User.findAll();
        const user = await obj[0];
        expect(user.get('dateField')).to.be.an.instanceof(Date);
        expect(user.get('dateField')).to.equalTime(new Date(2010, 10, 10));
      });

      it('handles dates in includes correctly #2644', async function() {
        await this.User.create({
          projects: [
            { dateField: new Date(1990, 5, 5) }
          ]
        }, { include: [this.Project] });

        const obj = await this.User.findAll({
          include: [this.Project]
        });

        const user = await obj[0];
        expect(user.projects[0].get('dateField')).to.be.an.instanceof(Date);
        expect(user.projects[0].get('dateField')).to.equalTime(new Date(1990, 5, 5));
      });
    });

    describe('json', () => {
      it('should be able to retrieve a row with json_extract function', async function() {
        await Promise.all([
          this.User.create({ username: 'swen', emergency_contact: { name: 'kate' } }),
          this.User.create({ username: 'anna', emergency_contact: { name: 'joe' } })
        ]);

        const user = await this.User.findOne({
          where: Sequelize.json('json_extract(emergency_contact, \'$.name\')', 'kate'),
          attributes: ['username', 'emergency_contact']
        });

        expect(user.emergency_contact.name).to.equal('kate');
      });

      it('should be able to retrieve a row by json_type function', async function() {
        await Promise.all([
          this.User.create({ username: 'swen', emergency_contact: { name: 'kate' } }),
          this.User.create({ username: 'anna', emergency_contact: ['kate', 'joe'] })
        ]);

        const user = await this.User.findOne({
          where: Sequelize.json('json_type(emergency_contact)', 'array'),
          attributes: ['username', 'emergency_contact']
        });

        expect(user.username).to.equal('anna');
      });
    });

    describe('regression tests', () => {
      it('do not crash while parsing unique constraint errors', async function() {
        const Payments = this.sequelize.define('payments', {});

        await Payments.sync({ force: true });

        await expect(Payments.bulkCreate([{ id: 1 }, { id: 1 }], { ignoreDuplicates: false })).to.eventually.be.rejected;
      });
    });
  });
}
