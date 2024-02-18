import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../../support';

describe('Model#update', () => {
  it('is not allowed if the primary key is not defined', async () => {
    const User = sequelize.define('User', {
      name: { type: DataTypes.STRING },
    });
    const instance = User.build({}, { isNewRecord: false });

    await expect(instance.update({ name: 'john' })).to.be.rejectedWith(
      'You attempted to save an instance with no primary key, this is not allowed since',
    );
  });

  it('is not allowed if the primary key is not defined and is a newly created record', async () => {
    const User = sequelize.define('User', {
      name: { type: DataTypes.STRING },
    });
    const instance = User.build({}, { isNewRecord: true });

    await expect(instance.update({ name: 'john' })).to.be.rejectedWith(
      'You attempted to update an instance that is not persisted.',
    );
  });
});
