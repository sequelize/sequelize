'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , dialect = Support.getTestDialect()
  , DataTypes = require(__dirname + '/../../../../lib/data-types')
  , _ = require('lodash');

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES] Sequelize', function() {
    function checkTimezoneParsing(baseOptions) {
      var options = _.extend({}, baseOptions, { timezone: 'Asia/Kolkata', timestamps: true });
      var sequelize = Support.createSequelizeInstance(options);

      var tzTable = sequelize.define('tz_table', { foo: DataTypes.STRING });
      return tzTable.sync({force: true}).then(function() {
        return tzTable.create({foo: 'test'}).then(function(row) {
          expect(row).to.be.not.null;
        });
      });
    }

    it('should correctly parse the moment based timezone', function() {
      return checkTimezoneParsing(this.sequelize.options);
    });
  });
}
