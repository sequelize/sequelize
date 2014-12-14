"use strict";

/* jshint camelcase: false */
var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../../support')
  , Query     = require("../../../lib/dialects/mysql/query")

chai.config.includeStack = true

if (Support.dialectIsMySQL()) {
  describe("[MYSQL Specific] Query", function () {
    describe('formatError', function() {
      var origError = {
        code: 1062,
        message: 'Duplicate entry \'Error with\n:\n a newline\' for key \'compositeIndex\''
      }

      var query = new Query();
      var parsedError = query.formatError(origError);

      expect(parsedError.name).to.equal('SequelizeUniqueConstraintError');
      expect(parsedError).to.have.property('parent');
      expect(parsedError.message).to.equal(origError.message);
    });
  });
};
