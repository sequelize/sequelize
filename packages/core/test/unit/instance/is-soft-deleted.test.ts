import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import dayjs from 'dayjs';
import { beforeEach2, sequelize } from '../../support';

describe('Model#isSoftDeleted', () => {
  const vars = beforeEach2(() => {
    const User = sequelize.define('User', {
      name: DataTypes.STRING,
      birthdate: DataTypes.DATE,
      meta: DataTypes.TEXT,
      deletedAt: {
        type: DataTypes.DATE,
      },
    });

    const ParanoidUser = sequelize.define(
      'User',
      {
        name: DataTypes.STRING,
        birthdate: DataTypes.DATE,
        meta: DataTypes.TEXT,
        deletedAt: {
          type: DataTypes.DATE,
        },
      },
      {
        paranoid: true,
      },
    );

    const paranoidUser = ParanoidUser.build(
      {
        name: 'a',
      },
      {
        isNewRecord: false,
        raw: true,
      },
    );

    const user = User.build(
      {
        name: 'a',
      },
      {
        isNewRecord: false,
        raw: true,
      },
    );

    return { paranoidUser, user };
  });

  it('should not throw if paranoid is set to true', () => {
    expect(() => {
      vars.paranoidUser.isSoftDeleted();
    }).to.not.throw();
  });

  it('should throw if paranoid is set to false', () => {
    expect(() => {
      vars.user.isSoftDeleted();
    }).to.throw('Model is not paranoid');
  });

  it('should return false if the soft-delete property is the same as the default value', () => {
    vars.paranoidUser.setDataValue('deletedAt', null);
    expect(vars.paranoidUser.isSoftDeleted()).to.be.false;
  });

  it('should return true if the soft-delete property is set', () => {
    vars.paranoidUser.setDataValue('deletedAt', dayjs().subtract(5, 'days').format());
    expect(vars.paranoidUser.isSoftDeleted()).to.be.true;
  });
});
