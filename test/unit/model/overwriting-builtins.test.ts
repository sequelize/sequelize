import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import { getTestDialectTeaser, sequelize } from '../../support';

describe(getTestDialectTeaser('Model'), () => {
  describe('not breaking built-ins', () => {
    it('it should not break instance.set by defining a model set attribute', () => {
      const User = sequelize.define('OverWrittenKeys', {
        set: DataTypes.STRING,
      });

      const user = User.build({ set: 'A' });
      expect(user.get('set')).to.equal('A');
      user.set('set', 'B');
      expect(user.get('set')).to.equal('B');
    });
  });
});
