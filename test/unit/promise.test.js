'use strict';

/* jshint -W030 */
var chai = require('chai')
, expect = chai.expect
, Support = require(__dirname + '/support')
, Sequelize = Support.Sequelize
, Promise = Sequelize.Promise
, Bluebird = require('bluebird');

describe('Promise', function() {
  it('should be an independent copy of bluebird library', function() {
    expect(Promise.prototype.then).to.be.a('function');
    expect(Promise).to.not.equal(Bluebird);
    expect(Promise.prototype).to.not.equal(Bluebird.prototype);
  });
});
