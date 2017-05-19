'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Promise = require('../../../../lib/promise'),
  DataTypes = require('../../../../lib/data-types'),
  Support = require('../../support'),
  dialect = Support.getTestDialect();

if (dialect.match(/^mssql/)) {
  describe('[MSSQL Specific] Query Queue', () => {
    beforeEach(function() {
      const User = this.User = this.sequelize.define('User', {
        username: DataTypes.STRING
      });

      return this.sequelize.sync({ force: true }).then(() => {
        return User.create({ username: 'John'});
      });
    });

    it('should queue concurrent requests to a connection', function() {
      const User = this.User;

      return expect(this.sequelize.transaction(t => {
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
