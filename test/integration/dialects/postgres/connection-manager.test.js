'use strict';

/* jshint -W030 */
const chai = require('chai');
const expect = chai.expect;
const Support = require(__dirname + '/../../support');
const dialect = Support.getTestDialect();
const DataTypes = require(__dirname + '/../../../../lib/data-types');
const _ = require('lodash');

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES] Sequelize', function() {
    function checkTimezoneParsing(baseOptions) {
      const options = _.extend({}, baseOptions, { timezone: 'Asia/Kolkata', timestamps: true });
      const sequelize = Support.createSequelizeInstance(options);

      const tzTable = sequelize.define('tz_table', { foo: DataTypes.STRING });
      return tzTable.sync({force: true}).then(function() {
        return tzTable.create({foo: 'test'}).then(function(row) {
          expect(row).to.be.not.null;
        });
      });
    }

    it('should correctly parse the moment based timezone', function() {
      return checkTimezoneParsing(this.sequelize.options);
    });

    it('should correctly parse the moment based timezone while fetching hstore oids', function() {
      // reset oids so we need to refetch them
      DataTypes.HSTORE.types.postgres.oids = [];
      DataTypes.HSTORE.types.postgres.array_oids = [];
      return checkTimezoneParsing(this.sequelize.options);
    });
  });
}
