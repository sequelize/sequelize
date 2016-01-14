'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , Sequelize = require('../../index')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../lib/data-types')
  , dialect = Support.getTestDialect()
  , sinon = require('sinon')
  , _ = require('lodash')
  , moment = require('moment')
  , Promise = require('bluebird')
  , current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), function() {

  describe('not breaking built-ins', function() {
    it('test set breakage', function() {
      var User = this.sequelize.define('FrozenUser', {set:DataTypes.STRING}, { freezeTableName: true, timestamps: false, underscored: true });

			return this.sequelize.sync({force:true}).then(function(){
				var testuser = User.build({set:'value'});
				expect(testuser.getDataValue('set')).to.equal('value');
				testuser.save().then(function(){
					testuser.reload().then(function(){
						expect(testuser.getDataValue('set')).to.equal('value');
					});
				});
			});
    });
	});
});
