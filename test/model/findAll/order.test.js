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

describe(Support.getTestDialectTeaser('Model'), function() {
  describe('findAll', function () {
    describe('order', function () {
      describe('Sequelize.literal()', function () {
        beforeEach(function () {
          this.User = this.sequelize.define('User', {
            email: DataTypes.STRING
          });

          return this.User.sync({force: true}).bind(this).then(function () {
            return this.User.create({
              email: 'test@sequelizejs.com'
            });
          });
        });

        it('should work with order: literal()', function () {
          return this.User.findAll({
            order: this.sequelize.literal('email IS NOT NULL') 
          }).then(function (users) {
            expect(users.length).to.equal(1);
            users.forEach(function (user) {
              expect(user.get('email')).to.be.ok;
            });
          });
        });

        it('should work with order: [literal()]', function () {
          return this.User.findAll({
            order: [this.sequelize.literal('email IS NOT NULL')]
          }).then(function (users) {
            expect(users.length).to.equal(1);
            users.forEach(function (user) {
              expect(user.get('email')).to.be.ok;
            });
          });
        });

        it('should work with order: [[literal()]]', function () {
          return this.User.findAll({
            order: [
              [this.sequelize.literal('email IS NOT NULL')]
            ]
          }).then(function (users) {
            expect(users.length).to.equal(1);
            users.forEach(function (user) {
              expect(user.get('email')).to.be.ok;
            });
          });
        });
      });
    });
  });
});