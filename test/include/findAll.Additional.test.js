 // order-by-included.test.js
 'use strict';

var chai = require('chai')
  , Sequelize = require('../../../index')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , dialect = Support.getTestDialect()
  , config = require(__dirname + '/../../config/config')
  , datetime = require('chai-datetime')
  , _ = require('lodash')
  , moment = require('moment')
  , async = require('async')
  , current = Support.sequelize;

chai.use(datetime);
chai.config.includeStack = true;

describe(Support.getTestDialectTeaser('Include'), function() {
	describe('findAll', function () {
		describe('order', function () {
			describe('nested eagerly-loaded models with 1:1 association', function () {
				beforeEach(function(done) {
					this.Model1 = this.sequelize.define('Model1', { name: Sequelize.STRING }, { timestamps: false });
					this.Model2 = this.sequelize.define('Model2', { name: Sequelize.STRING }, { timestamps: false });
					this.Model3 = this.sequelize.define('Model3', { name: Sequelize.STRING }, { timestamps: false });
					this.Model1.hasOne(this.Model2);
					this.Model2.hasOne(this.Model3);
					return this.sequelize.sync({ force: true })
						.then(function() { done(); });
				});

				it('should be possible to order by attribute of nested model', function(done) {
					Model1.findAll({ 
						include: [{ model: Model2, include: [ Model3 ] }],
						order: [ [ Model2, Model3, 'name' ] ] 
					})
					.catch(function(err) {
						done(err);
					});
				});		
			});
 		});
 	});
});