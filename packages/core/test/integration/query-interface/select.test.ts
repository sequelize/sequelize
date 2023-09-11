import { expect } from 'chai';
import { DataTypes } from '@sequelize/core';
import { createSingleTestSequelizeInstance, getTestDialect } from '../support';

const dialect = getTestDialect();

const supportedByDialect = ['postgres'].includes(dialect);

describe('QueryInterface#select', () => {
  if (supportedByDialect) {
    it('fetches records with alias minification', async () => {
      const instance = createSingleTestSequelizeInstance();
      const User = instance.define('user', {
        name: { type: DataTypes.TEXT },
      }, { timestamps: false });

      await User.sync({ force: true });

      await User.create({ name: 'Sourav' });

      const qi = instance.queryInterface;

      const result = await qi.select(User, 'users', { where: { name: 'Sourav' }, minifyAliases: true });

      // @ts-expect-error -- queryInterface.select returns `object[]` can't really make it infer to user
      expect(result[0].name).to.equal('Sourav');
    });
  }
});
