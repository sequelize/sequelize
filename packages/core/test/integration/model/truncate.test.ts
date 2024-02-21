import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../../support';
import { setResetMode } from '../support';

describe('Model.truncate', () => {
  setResetMode('truncate');

  it('clears the table', async () => {
    const User = sequelize.define('User', { username: DataTypes.STRING });
    await sequelize.sync({ force: true });
    await User.bulkCreate([{ username: 'user1' }, { username: 'user2' }]);
    await User.truncate();

    expect(await User.findAll()).to.have.lengthOf(0);
  });
});
