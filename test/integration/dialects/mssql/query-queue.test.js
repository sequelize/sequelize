'use strict';

const chai = require('chai');
const expect = chai.expect;
const Promise = require('../../../../lib/promise');
const DataTypes = require('../../../../lib/data-types');
const Support = require('../../support');
const dialect = Support.getTestDialect();

if (dialect.match(/^mssql/)) {
  describe('[MSSQL Specific] Query Queue', function() {
    beforeEach(function() {
      const User = this.User = this.sequelize.define('User', {
        username: DataTypes.STRING
      });

      return this.sequelize.sync({ force: true }).then(function() {
        return User.create({ username: 'John'});
      });
    });

    it('should queue concurrent requests to a connection', function() {
      const User = this.User;

      return expect(this.sequelize.transaction(function(t) {
        return Promise.all([
          User.findOne({
            transaction: t
          }),
          User.findOne({
            transaction: t
          })
        ]);
      })).not.to.be.rejected;
    });
  });
}
