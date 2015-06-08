'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , dialect = Support.getTestDialect();

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] Connector Manager', function() {
    it('should set useStandardConformingStrings=true by default', function() {
      var sequelize = Support.createSequelizeInstance({});

      var config = sequelize.config;
      expect(config.useStandardConformingStrings).to.be.true;
    });

    it('should set useStandardConformingStrings with value passed in options', function() {
      var options = {
        useStandardConformingStrings: false
      };

      var sequelize = Support.createSequelizeInstance(options);

      var config = sequelize.config;
      expect(config.useStandardConformingStrings).to.equal(options.useStandardConformingStrings);
    });
  });
}
