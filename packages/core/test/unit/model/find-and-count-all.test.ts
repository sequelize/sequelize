import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { beforeAll2, sequelize as current, getTestDialectTeaser } from '../../support';

describe(getTestDialectTeaser('Model'), () => {
  describe('findAndCountAll', () => {
    describe('should handle promise rejection', () => {
      const vars = beforeAll2(() => {
        const stub = sinon.stub();

        process.on('unhandledRejection', stub);

        const User = current.define('User', {
          username: DataTypes.STRING,
          age: DataTypes.INTEGER,
        });

        const findAll = sinon.stub(User, 'findAll').rejects(new Error('findAll failed'));

        const count = sinon.stub(User, 'count').rejects(new Error('count failed'));

        return { stub, User, findAll, count };
      });

      after(() => {
        process.off('unhandledRejection', vars.stub);
        vars.findAll.restore();
        vars.count.restore();
      });

      it('with errors in count and findAll both', async () => {
        await expect(vars.User.findAndCountAll({})).to.be.rejected;
        expect(vars.stub.callCount).to.eql(0);
      });
    });
  });
});
