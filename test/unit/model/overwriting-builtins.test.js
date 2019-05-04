'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  DataTypes = require('../../../lib/data-types');

describe(Support.getTestDialectTeaser('Model'), () => {

  describe('not breaking built-ins', () => {
    it('it should not break instance.set by defining a model set attribute', function() {
      const User = this.sequelize.define('OverWrittenKeys', {
        set: DataTypes.STRING
      });

      const user = new User({ set: 'A' });
      expect(user.get('set')).to.equal('A');
      user.set('set', 'B');
      expect(user.get('set')).to.equal('B');
    });
  });
});
