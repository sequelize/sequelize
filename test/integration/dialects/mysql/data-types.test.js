'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , DataTypes = require(__dirname + '/../../../../lib/data-types');

if (Support.dialectIsMySQL()) {
  describe.only('[MYSQL Specific] DataTypes', function() {
    describe('DATEONLY', function() {
      it('do not say error when save a date stringified', function() {
        var sequelize = Support.createSequelizeInstance({ pool: false });
        var User = sequelize.define('User', {
          dob: {
            type: DataTypes.DATEONLY,
            validate: { isDate: true }
          }
        });
        return User.sync({ force: true }).then(function() {
          return User.create({ dob: new Date('2017-02-02').toJSON() }).then(function(user) {
            expect(user).to.be.ok;
          });
        });
      });
    });
  });
}
