'use strict';

const chai      = require('chai');
const expect    = chai.expect;
const DataTypes = require('../../../../lib/data-types');
const Support   = require('../../support');
const Sequelize = Support.Sequelize;
const dialect   = Support.getTestDialect();
const { forEach } = require('../../../../lib/utils/forEach');

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] ExclusionConstraintError', () => {
    const constraintName = 'overlap_period';
    beforeEach(function() {
      this.Booking = this.sequelize.define('Booking', {
        roomNo: DataTypes.INTEGER,
        period: DataTypes.RANGE(DataTypes.DATE)
      });
      return this.Booking
        .sync({ force: true })
        .then(() => {
          return this.sequelize.query(
            `ALTER TABLE "${this.Booking.tableName}" ADD CONSTRAINT ${constraintName} EXCLUDE USING gist ("roomNo" WITH =, period WITH &&)`
          );
        });
    });

    it('should contain error specific properties', () => {
      const errDetails = {
        message: 'Exclusion constraint error',
        constraint: 'constraint_name',
        fields: { 'field1': 1, 'field2': [123, 321] },
        table: 'table_name',
        parent: new Error('Test error')
      };
      const err = new Sequelize.ExclusionConstraintError(errDetails);

      forEach(errDetails, (value, key) => {
        expect(value).to.be.deep.equal(err[key]);
      });
    });

    it('should throw ExclusionConstraintError when "period" value overlaps existing', function() {
      const Booking = this.Booking;

      return Booking
        .create({
          roomNo: 1,
          guestName: 'Incognito Visitor',
          period: [new Date(2015, 0, 1), new Date(2015, 0, 3)]
        })
        .then(() => {
          return expect(Booking
            .create({
              roomNo: 1,
              guestName: 'Frequent Visitor',
              period: [new Date(2015, 0, 2), new Date(2015, 0, 5)]
            })).to.eventually.be.rejectedWith(Sequelize.ExclusionConstraintError);
        });
    });

  });
}
