'use strict';

const each = require('lodash/each');

const chai = require('chai');

const expect = chai.expect;
const { DataTypes, Sequelize } = require('@sequelize/core');
const Support = require('../../support');

const dialect = Support.getTestDialect();

if (dialect.startsWith('postgres')) {
  describe('[POSTGRES Specific] ExclusionConstraintError', () => {
    const constraintName = 'overlap_period';
    beforeEach(async function () {
      this.Booking = this.sequelize.define('Booking', {
        roomNo: DataTypes.INTEGER,
        period: DataTypes.RANGE(DataTypes.DATE),
      });

      await this.Booking.sync({ force: true });

      await this.sequelize.query(
        `ALTER TABLE "${this.Booking.tableName}" ADD CONSTRAINT ${constraintName} EXCLUDE USING gist ("roomNo" WITH =, period WITH &&)`,
      );
    });

    it('should contain error specific properties', () => {
      const errDetails = {
        message: 'Exclusion constraint error',
        constraint: 'constraint_name',
        fields: { field1: 1, field2: [123, 321] },
        table: 'table_name',
        cause: new Error('Test error'),
      };
      const err = new Sequelize.ExclusionConstraintError(errDetails);

      each(errDetails, (value, key) => {
        expect(err[key]).to.be.deep.equal(value, `Value for key ${key} is invalid`);
      });
    });

    it('should throw ExclusionConstraintError when "period" value overlaps existing', async function () {
      const Booking = this.Booking;

      await Booking.create({
        roomNo: 1,
        guestName: 'Incognito Visitor',
        period: [new Date(2015, 0, 1), new Date(2015, 0, 3)],
      });

      await expect(
        Booking.create({
          roomNo: 1,
          guestName: 'Frequent Visitor',
          period: [new Date(2015, 0, 2), new Date(2015, 0, 5)],
        }),
      ).to.eventually.be.rejectedWith(Sequelize.ExclusionConstraintError);
    });
  });
}
