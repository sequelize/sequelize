'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const dialect = Support.getTestDialect();
const { DataTypes } = require('@sequelize/core');

if (dialect === 'postgres') {
  describe('[POSTGRES Specific] Data Types', () => {
    beforeEach(async () => {
      await Support.clearDatabase(Support.sequelize);
    });

    describe('DATE/DATEONLY Validate and Stringify', () => {
      const now = new Date();
      const nowString = now.toISOString();

      it('DATE should validate a Date as normal', () => {
        expect(DataTypes[dialect].DATE().validate(now)).to.equal(true);
        expect(DataTypes[dialect].DATE().validate(nowString)).to.equal(true);
      });

      it('DATE should validate Infinity/-Infinity as true', () => {
        expect(DataTypes[dialect].DATE().validate(Number.POSITIVE_INFINITY)).to.equal(true);
        expect(DataTypes[dialect].DATE().validate(Number.NEGATIVE_INFINITY)).to.equal(true);
      });

      it('DATE should stringify Infinity/-Infinity to infinity/-infinity', () => {
        expect(DataTypes[dialect].DATE().stringify(Number.POSITIVE_INFINITY)).to.equal('Infinity');
        expect(DataTypes[dialect].DATE().stringify(Number.NEGATIVE_INFINITY)).to.equal('-Infinity');
      });

      it('DATEONLY should stringify Infinity/-Infinity to infinity/-infinity', () => {
        expect(DataTypes[dialect].DATEONLY().stringify(Number.POSITIVE_INFINITY)).to.equal('Infinity');
        expect(DataTypes[dialect].DATEONLY().stringify(Number.NEGATIVE_INFINITY)).to.equal('-Infinity');
      });
    });

    describe('DATE/DATEONLY Sanitize', () => {
      const now = new Date();
      const nowString = now.toISOString();
      const nowDateOnly = nowString.slice(0, 10);

      it('DATE should sanitize a Date as normal', () => {
        expect(DataTypes[dialect].DATE()._sanitize(now)).to.equalTime(now);
        expect(DataTypes[dialect].DATE()._sanitize(nowString)).to.equalTime(now);
      });

      it('DATE should sanitize Infinity/-Infinity as Infinity/-Infinity', () => {
        expect(DataTypes[dialect].DATE()._sanitize(Number.POSITIVE_INFINITY)).to.equal(Number.POSITIVE_INFINITY);
        expect(DataTypes[dialect].DATE()._sanitize(Number.NEGATIVE_INFINITY)).to.equal(Number.NEGATIVE_INFINITY);
      });

      it('DATE should sanitize "Infinity"/"-Infinity" as Infinity/-Infinity', () => {
        expect(DataTypes[dialect].DATE()._sanitize('Infinity')).to.equal(Number.POSITIVE_INFINITY);
        expect(DataTypes[dialect].DATE()._sanitize('-Infinity')).to.equal(Number.NEGATIVE_INFINITY);
      });

      it('DATEONLY should sanitize a Date as normal', () => {
        expect(DataTypes[dialect].DATEONLY()._sanitize(now)).to.equal(nowDateOnly);
        expect(DataTypes[dialect].DATEONLY()._sanitize(nowString)).to.equal(nowDateOnly);
      });

      it('DATEONLY should sanitize Infinity/-Infinity as Infinity/-Infinity', () => {
        expect(DataTypes[dialect].DATEONLY()._sanitize(Number.POSITIVE_INFINITY)).to.equal(Number.POSITIVE_INFINITY);
        expect(DataTypes[dialect].DATEONLY()._sanitize(Number.NEGATIVE_INFINITY)).to.equal(Number.NEGATIVE_INFINITY);
      });

      it('DATEONLY should sanitize "Infinity"/"-Infinity" as Infinity/-Infinity', () => {
        expect(DataTypes[dialect].DATEONLY()._sanitize('Infinity')).to.equal(Number.POSITIVE_INFINITY);
        expect(DataTypes[dialect].DATEONLY()._sanitize('-Infinity')).to.equal(Number.NEGATIVE_INFINITY);
      });
    });

    describe('DATE SQL', () => {
      // create dummy user
      it('should be able to create and update records with Infinity/-Infinity', async function () {
        this.sequelize.options.typeValidation = true;

        const date = new Date();
        const User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          beforeTime: {
            type: DataTypes.DATE,
            defaultValue: Number.NEGATIVE_INFINITY,
          },
          sometime: {
            type: DataTypes.DATE,
            defaultValue: this.sequelize.fn('NOW'),
          },
          anotherTime: {
            type: DataTypes.DATE,
          },
          afterTime: {
            type: DataTypes.DATE,
            defaultValue: Number.POSITIVE_INFINITY,
          },
        }, {
          timestamps: true,
        });

        await User.sync({
          force: true,
        });

        const user4 = await User.create({
          username: 'bob',
          anotherTime: Number.POSITIVE_INFINITY,
        }, {
          validate: true,
        });

        expect(user4.username).to.equal('bob');
        expect(user4.beforeTime).to.equal(Number.NEGATIVE_INFINITY);
        expect(user4.sometime).to.be.withinTime(date, new Date());
        expect(user4.anotherTime).to.equal(Number.POSITIVE_INFINITY);
        expect(user4.afterTime).to.equal(Number.POSITIVE_INFINITY);

        const user3 = await user4.update({
          sometime: Number.POSITIVE_INFINITY,
        }, {
          returning: true,
        });

        expect(user3.sometime).to.equal(Number.POSITIVE_INFINITY);

        const user2 = await user3.update({
          sometime: Number.POSITIVE_INFINITY,
        });

        expect(user2.sometime).to.equal(Number.POSITIVE_INFINITY);

        const user1 = await user2.update({
          sometime: this.sequelize.fn('NOW'),
        }, {
          returning: true,
        });

        expect(user1.sometime).to.be.withinTime(date, new Date());

        // find
        const users = await User.findAll();
        expect(users[0].beforeTime).to.equal(Number.NEGATIVE_INFINITY);
        expect(users[0].sometime).to.not.equal(Number.POSITIVE_INFINITY);
        expect(users[0].afterTime).to.equal(Number.POSITIVE_INFINITY);

        const user0 = await users[0].update({
          sometime: date,
        });

        expect(user0.sometime).to.equalTime(date);

        const user = await user0.update({
          sometime: date,
        });

        expect(user.sometime).to.equalTime(date);
      });
    });

    describe('DATEONLY SQL', () => {
      // create dummy user
      it('should be able to create and update records with Infinity/-Infinity', async function () {
        this.sequelize.options.typeValidation = true;

        const date = new Date();
        const User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          beforeTime: {
            type: DataTypes.DATEONLY,
            defaultValue: Number.NEGATIVE_INFINITY,
          },
          sometime: {
            type: DataTypes.DATEONLY,
            defaultValue: this.sequelize.fn('NOW'),
          },
          anotherTime: {
            type: DataTypes.DATEONLY,
          },
          afterTime: {
            type: DataTypes.DATEONLY,
            defaultValue: Number.POSITIVE_INFINITY,
          },
        }, {
          timestamps: true,
        });

        await User.sync({
          force: true,
        });

        const user4 = await User.create({
          username: 'bob',
          anotherTime: Number.POSITIVE_INFINITY,
        }, {
          validate: true,
        });

        expect(user4.username).to.equal('bob');
        expect(user4.beforeTime).to.equal(Number.NEGATIVE_INFINITY);
        expect(new Date(user4.sometime)).to.be.withinDate(date, new Date());
        expect(user4.anotherTime).to.equal(Number.POSITIVE_INFINITY);
        expect(user4.afterTime).to.equal(Number.POSITIVE_INFINITY);

        const user3 = await user4.update({
          sometime: Number.POSITIVE_INFINITY,
        }, {
          returning: true,
        });

        expect(user3.sometime).to.equal(Number.POSITIVE_INFINITY);

        const user2 = await user3.update({
          sometime: Number.POSITIVE_INFINITY,
        });

        expect(user2.sometime).to.equal(Number.POSITIVE_INFINITY);

        const user1 = await user2.update({
          sometime: this.sequelize.fn('NOW'),
        }, {
          returning: true,
        });

        expect(user1.sometime).to.not.equal(Number.POSITIVE_INFINITY);
        expect(new Date(user1.sometime)).to.be.withinDate(date, new Date());

        // find
        const users = await User.findAll();
        expect(users[0].beforeTime).to.equal(Number.NEGATIVE_INFINITY);
        expect(users[0].sometime).to.not.equal(Number.POSITIVE_INFINITY);
        expect(users[0].afterTime).to.equal(Number.POSITIVE_INFINITY);

        const user0 = await users[0].update({
          sometime: '1969-07-20',
        });

        expect(user0.sometime).to.equal('1969-07-20');

        const user = await user0.update({
          sometime: '1969-07-20',
        });

        expect(user.sometime).to.equal('1969-07-20');
      });
    });

  });
}
