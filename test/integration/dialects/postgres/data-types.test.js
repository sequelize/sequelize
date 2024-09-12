'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('../../support');
const dialect = Support.getTestDialect();
const DataTypes = require('sequelize/lib/data-types');


if (dialect === 'postgres') {
  describe('[POSTGRES Specific] Data Types', () => {
    describe('DATE/DATEONLY Validate and Stringify', () => {
      const now = new Date();
      const nowString = now.toISOString();

      it('DATE should validate a Date as normal', () => {
        expect(DataTypes[dialect].DATE().validate(now)).to.equal(true);
        expect(DataTypes[dialect].DATE().validate(nowString)).to.equal(true);
      });

      it('DATE should validate Infinity/-Infinity as true', () => {
        expect(DataTypes[dialect].DATE().validate(Infinity)).to.equal(true);
        expect(DataTypes[dialect].DATE().validate(-Infinity)).to.equal(true);
      });

      it('DATE should stringify Infinity/-Infinity to infinity/-infinity', () => {
        expect(DataTypes[dialect].DATE().stringify(Infinity)).to.equal('Infinity');
        expect(DataTypes[dialect].DATE().stringify(-Infinity)).to.equal('-Infinity');
      });

      it('DATEONLY should stringify Infinity/-Infinity to infinity/-infinity', () => {
        expect(DataTypes[dialect].DATEONLY().stringify(Infinity)).to.equal('Infinity');
        expect(DataTypes[dialect].DATEONLY().stringify(-Infinity)).to.equal('-Infinity');
      });
    });

    describe('DATE/DATEONLY Sanitize', () => {
      const now = new Date();
      const nowString = now.toISOString();
      const nowDateOnly = nowString.substr(0, 10);

      it('DATE should sanitize a Date as normal', () => {
        expect(DataTypes[dialect].DATE()._sanitize(now)).to.equalTime(now);
        expect(DataTypes[dialect].DATE()._sanitize(nowString)).to.equalTime(now);
      });

      it('DATE should sanitize Infinity/-Infinity as Infinity/-Infinity', () => {
        expect(DataTypes[dialect].DATE()._sanitize(Infinity)).to.equal(Infinity);
        expect(DataTypes[dialect].DATE()._sanitize(-Infinity)).to.equal(-Infinity);
      });

      it('DATE should sanitize "Infinity"/"-Infinity" as Infinity/-Infinity', () => {
        expect(DataTypes[dialect].DATE()._sanitize('Infinity')).to.equal(Infinity);
        expect(DataTypes[dialect].DATE()._sanitize('-Infinity')).to.equal(-Infinity);
      });

      it('DATEONLY should sanitize a Date as normal', () => {
        expect(DataTypes[dialect].DATEONLY()._sanitize(now)).to.equal(nowDateOnly);
        expect(DataTypes[dialect].DATEONLY()._sanitize(nowString)).to.equal(nowDateOnly);
      });

      it('DATEONLY should sanitize Infinity/-Infinity as Infinity/-Infinity', () => {
        expect(DataTypes[dialect].DATEONLY()._sanitize(Infinity)).to.equal(Infinity);
        expect(DataTypes[dialect].DATEONLY()._sanitize(-Infinity)).to.equal(-Infinity);
      });

      it('DATEONLY should sanitize "Infinity"/"-Infinity" as Infinity/-Infinity', () => {
        expect(DataTypes[dialect].DATEONLY()._sanitize('Infinity')).to.equal(Infinity);
        expect(DataTypes[dialect].DATEONLY()._sanitize('-Infinity')).to.equal(-Infinity);
      });
    });

    describe('DATE SQL', () => {
      // create dummy user
      it('should be able to create and update records with Infinity/-Infinity', async function() {
        this.sequelize.options.typeValidation = true;

        const date = new Date();
        const User = this.sequelize.define('User', {
          username: this.sequelize.Sequelize.STRING,
          beforeTime: {
            type: this.sequelize.Sequelize.DATE,
            defaultValue: -Infinity
          },
          sometime: {
            type: this.sequelize.Sequelize.DATE,
            defaultValue: this.sequelize.fn('NOW')
          },
          anotherTime: {
            type: this.sequelize.Sequelize.DATE
          },
          afterTime: {
            type: this.sequelize.Sequelize.DATE,
            defaultValue: Infinity
          }
        }, {
          timestamps: true
        });

        await User.sync({
          force: true
        });

        const user4 = await User.create({
          username: 'bob',
          anotherTime: Infinity
        }, {
          validate: true
        });

        expect(user4.username).to.equal('bob');
        expect(user4.beforeTime).to.equal(-Infinity);
        expect(user4.sometime).to.be.withinTime(date, new Date());
        expect(user4.anotherTime).to.equal(Infinity);
        expect(user4.afterTime).to.equal(Infinity);

        const user3 = await user4.update({
          sometime: Infinity
        }, {
          returning: true
        });

        expect(user3.sometime).to.equal(Infinity);

        const user2 = await user3.update({
          sometime: Infinity
        });

        expect(user2.sometime).to.equal(Infinity);

        const user1 = await user2.update({
          sometime: this.sequelize.fn('NOW')
        }, {
          returning: true
        });

        expect(user1.sometime).to.be.withinTime(date, new Date());

        // find
        const users = await User.findAll();
        expect(users[0].beforeTime).to.equal(-Infinity);
        expect(users[0].sometime).to.not.equal(Infinity);
        expect(users[0].afterTime).to.equal(Infinity);

        const user0 = await users[0].update({
          sometime: date
        });

        expect(user0.sometime).to.equalTime(date);

        const user = await user0.update({
          sometime: date
        });

        expect(user.sometime).to.equalTime(date);
      });
    });

    describe('DATEONLY SQL', () => {
      // create dummy user
      it('should be able to create and update records with Infinity/-Infinity', async function() {
        this.sequelize.options.typeValidation = true;

        const date = new Date();
        const User = this.sequelize.define('User', {
          username: this.sequelize.Sequelize.STRING,
          beforeTime: {
            type: this.sequelize.Sequelize.DATEONLY,
            defaultValue: -Infinity
          },
          sometime: {
            type: this.sequelize.Sequelize.DATEONLY,
            defaultValue: this.sequelize.fn('NOW')
          },
          anotherTime: {
            type: this.sequelize.Sequelize.DATEONLY
          },
          afterTime: {
            type: this.sequelize.Sequelize.DATEONLY,
            defaultValue: Infinity
          }
        }, {
          timestamps: true
        });

        await User.sync({
          force: true
        });

        const user4 = await User.create({
          username: 'bob',
          anotherTime: Infinity
        }, {
          validate: true
        });

        expect(user4.username).to.equal('bob');
        expect(user4.beforeTime).to.equal(-Infinity);
        expect(new Date(user4.sometime)).to.be.withinDate(date, new Date());
        expect(user4.anotherTime).to.equal(Infinity);
        expect(user4.afterTime).to.equal(Infinity);

        const user3 = await user4.update({
          sometime: Infinity
        }, {
          returning: true
        });

        expect(user3.sometime).to.equal(Infinity);

        const user2 = await user3.update({
          sometime: Infinity
        });

        expect(user2.sometime).to.equal(Infinity);

        const user1 = await user2.update({
          sometime: this.sequelize.fn('NOW')
        }, {
          returning: true
        });

        expect(user1.sometime).to.not.equal(Infinity);
        expect(new Date(user1.sometime)).to.be.withinDate(date, new Date());

        // find
        const users = await User.findAll();
        expect(users[0].beforeTime).to.equal(-Infinity);
        expect(users[0].sometime).to.not.equal(Infinity);
        expect(users[0].afterTime).to.equal(Infinity);

        const user0 = await users[0].update({
          sometime: '1969-07-20'
        });

        expect(user0.sometime).to.equal('1969-07-20');

        const user = await user0.update({
          sometime: '1969-07-20'
        });

        expect(user.sometime).to.equal('1969-07-20');
      });
    });

  });
}
