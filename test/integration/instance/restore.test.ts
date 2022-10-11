import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../support';

describe('Model#restore', () => {
  it('is disallowed if no primary key is present', async () => {
    const User = sequelize.define('User', {
      name: { type: DataTypes.STRING },
    }, { noPrimaryKey: true, paranoid: true });
    await User.sync({ force: true });

    const instance = await User.create({});
    await expect(instance.restore()).to.be.rejectedWith('but the model does not have a primary key attribute definition.');
  });
});
