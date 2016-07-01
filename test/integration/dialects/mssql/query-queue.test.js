'use strict';

const chai = require('chai');
const expect = chai.expect;
const Sequelize = require('./../../../../index');
const DataTypes = require('../../../../lib/data-types');
const Support = require('../../support');
const dialect = Support.getTestDialect();

if (dialect.match(/^mssql/)) {
  describe('[MSSQL Specific] Query Queue', () => {
    beforeEach(function () {
      const User = this.User = this.sequelize.define('User', {
        username: DataTypes.STRING
      });

      return this.sequelize.sync({ force: true }).then(() => User.create({ username: 'John'}));
    });

    it('should queue concurrent requests to a connection', function() {
      const User = this.User;

      return expect(this.sequelize.transaction(t => Sequelize.Promise.all([
        User.findOne({
          transaction: t
        }),
        User.findOne({
          transaction: t
        })
      ]))).not.to.be.rejected;
    });
  });
}
