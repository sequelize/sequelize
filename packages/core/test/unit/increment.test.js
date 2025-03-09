'use strict';

const { expect } = require('chai');
const { DataTypes } = require('@sequelize/core');
const { beforeAll2, sequelize } = require('../support');

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
