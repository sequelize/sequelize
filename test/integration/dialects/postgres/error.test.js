'use strict';

const chai      = require('chai'),
  expect    = chai.expect,
  DataTypes = require(__dirname + '/../../../../lib/data-types'),
  Support   = require(__dirname + '/../../support'),
  Sequelize = Support.Sequelize,
  dialect   = Support.getTestDialect(),
  _ = require('lodash');

if (dialect.match(/^postgres/)) {
  const constraintName = 'overlap_period';
  beforeEach(function() {
    const self = this;
    this.Booking = self.sequelize.define('Booking', {
      roomNo: DataTypes.INTEGER,
      period: DataTypes.RANGE(DataTypes.DATE)
    });
    return self.Booking
      .sync({ force: true })
      .then(() => {
        return self.sequelize.query('ALTER TABLE "' + self.Booking.tableName + '" ADD CONSTRAINT ' + constraintName +
                                    ' EXCLUDE USING gist ("roomNo" WITH =, period WITH &&)');
      });
  });

  describe('[POSTGRES Specific] ExclusionConstraintError', () => {

    it('should contain error specific properties', () => {
      const errDetails = {
        message: 'Exclusion constraint error',
        constraint: 'constraint_name',
        fields: { 'field1': 1, 'field2': [123, 321] },
        table: 'table_name',
        parent: new Error('Test error')
      };
      const err = new Sequelize.ExclusionConstraintError(errDetails);

      _.each(errDetails, (value, key) => {
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
