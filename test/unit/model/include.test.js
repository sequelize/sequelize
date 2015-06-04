'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support   = require(__dirname + '/../support')
  , current   = Support.sequelize;

describe(Support.getTestDialectTeaser('Include'), function() {
  describe('all', function (){

    var Referral = current.define('referal');

    Referral.belongsTo(Referral);

    it('can expand nested self-reference', function () {
      var options = { include: [{ all: true, nested: true }] };

      current.Model.$expandIncludeAll.call(Referral, options);

      expect(options.include).to.deep.equal([
        { model: Referral }
      ]);
    });
  });
});
