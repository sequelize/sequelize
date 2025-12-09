import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import { beforeAll2, sequelize } from '../support';

describe('Model.increment', () => {
  const vars = beforeAll2(() => {
    const User = sequelize.define('User', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      count: DataTypes.INTEGER,
    });

    return { User };
  });

  it('should reject if options are missing', async () => {
    // @ts-expect-error -- we're testing that this will be rejected
    await expect(vars.User.increment(['id', 'count'])).to.be.rejectedWith(
      'Missing where attribute in the options parameter',
    );
  });

  it('should reject if options.where are missing', async () => {
    await expect(vars.User.increment(['id', 'count'], { by: 10 })).to.be.rejectedWith(
      'Missing where attribute in the options parameter',
    );
  });
});
