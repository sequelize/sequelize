'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('../../../lib/data-types');

describe(Support.getTestDialectTeaser('Model'), () => {
  beforeEach(function() {
    this.Payment = this.sequelize.define('Payment', {
      amount: DataTypes.DECIMAL
    });

    return this.sequelize.sync({force: true});
  });

  describe('sum', () => {

    it('should sum without rows', function() {
      return expect(this.Payment.sum('amount')).to.eventually.be.null;
    });

  });
});
