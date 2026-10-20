import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import { sequelize as current, getTestDialectTeaser } from '../../support';

describe(getTestDialectTeaser('Model'), () => {
  describe('method destroy', () => {
    const User = current.define('User', {
      name: DataTypes.STRING,
      secretValue: DataTypes.INTEGER,
    });

    let stubDelete: SinonStub;
    before(() => {
      stubDelete = sinon.stub(current, 'queryRaw').resolves([[], 0]);
    });

    beforeEach(() => {
      stubDelete.resetHistory();
    });

    after(() => {
      stubDelete.restore();
    });

    it('can detect complex objects', async () => {
      class Where {
        secretValue = '1';
      }

      await expect(
        User.destroy({
          // @ts-expect-error -- testing that class instances are rejected
          where: new Where(),
        }),
      ).to.be.rejected;
    });
  });
});
