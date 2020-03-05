'use strict';

const chai = require('chai'),
  assert = chai.assert,
  Support = require('../../support'),
  Sequelize = Support.Sequelize,
  dialect = Support.getTestDialect();

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] sync with alter method with dataType enum', () => {
    it('properly sync, #7649', function() {
      this.sequelize.define('User', {
        role: Sequelize.ENUM('guest', 'customer', 'admin')
      });

      return this.sequelize
        .sync({ alter: true })
        .catch(err => {
          assert.fail(err.message);
        });
    });
  });
}
