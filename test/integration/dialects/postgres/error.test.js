'use strict';

var chai      = require('chai')
  , sinon     = require('sinon')
  , expect    = chai.expect
  , DataTypes = require(__dirname + '/../../../../lib/data-types')
  , Support   = require(__dirname + '/../../support')
  , Sequelize = Support.Sequelize
  , dialect   = Support.getTestDialect()
  , Promise   = Sequelize.Promise
  , _ = require('lodash');

chai.config.includeStack = true;

if (dialect.match(/^postgres/)) {
  var constraintName = 'overlap_period';
  beforeEach(function () {
    var self = this;
    this.Booking = self.sequelize.define('Booking', {
      roomNo: DataTypes.INTEGER,
      period: DataTypes.RANGE(DataTypes.DATE)
    });
    return self.Booking
      .sync({ force: true })
      .then(function () {
        return self.sequelize.query('ALTER TABLE "' + self.Booking.tableName + '" ADD CONSTRAINT ' + constraintName +
                                    ' EXCLUDE USING gist ("roomNo" WITH =, period WITH &&)');
      });
  });

  describe('[POSTGRES Specific] ExclusionConstraintError', function () {

    it('should contain error specific properties', function () {
      var errDetails = {
        message:    'Exclusion constraint error',
        constraint: 'constraint_name',
        fields:     { 'field1': 1, 'field2': [123, 321] },
        table:      'table_name',
        parent:     new Error('Test error')
      };
      var err = new Sequelize.ExclusionConstraintError(errDetails);

      _.each(errDetails, function (value, key) {
        expect(value).to.be.deep.equal(err[key]);
      });
    });

    it('should throw ExclusionConstraintError when "period" value overlaps existing', function () {
      var Booking = this.Booking;

      return Booking
        .create({
          roomNo:    1,
          guestName: 'Incognito Visitor',
          period:    [new Date(2015, 0, 1), new Date(2015, 0, 3)]
        })
        .then(function () {
          return Booking
            .create({
              roomNo:    1,
              guestName: 'Frequent Visitor',
              period:    [new Date(2015, 0, 2), new Date(2015, 0, 5)]
            })
            .done(function (err) {
              expect(!!err).to.be.ok;
              expect(err instanceof Sequelize.ExclusionConstraintError).to.be.ok;
            });
        });
    });

  });
}
