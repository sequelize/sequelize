import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import { sequelize } from '../../support';

describe('Model#reload', () => {
  it('is not allowed if the instance does not have a primary key defined', async () => {
    const User = sequelize.define('User', {});
    const instance = User.build({});

    await expect(instance.reload()).to.be.rejectedWith(
      'but this model instance is missing the value of its primary key',
    );
  });

  describe('options tests', () => {
    let stub: SinonStub;

    before(() => {
      // The typings of queryRaw don't cover the found instance being returned when "plain" is set
      stub = sinon.stub(sequelize, 'queryRaw').resolves({
        _previousDataValues: { id: 1 },
        dataValues: { id: 2 },
      } as any);
    });

    after(() => {
      stub.restore();
    });

    it('should allow reloads even if options are not given', async () => {
      const User = sequelize.define(
        'User',
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
        },
        {
          paranoid: true,
        },
      );

      const instance = User.build({ id: 1 }, { isNewRecord: false });
      await expect(instance.reload()).to.be.fulfilled;
    });
  });
});
