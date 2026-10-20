import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import { beforeAll2, sequelize as current, getTestDialectTeaser } from '../../support';

describe(getTestDialectTeaser('Model'), () => {
  describe('method update', () => {
    const vars = beforeAll2(() => {
      const User = current.define('User', {
        name: DataTypes.STRING,
        secretValue: DataTypes.INTEGER,
      });

      return { User };
    });

    let stubUpdate: SinonStub;
    let updates: { name: string; secretValue: string };
    let cloneUpdates: { name: string; secretValue: string };
    beforeEach(() => {
      stubUpdate = sinon.stub(current.queryInterface, 'bulkUpdate').resolves([]);
      updates = { name: 'Batman', secretValue: '7' };
      cloneUpdates = { ...updates };
    });

    afterEach(() => {
      stubUpdate.restore();
    });

    describe('properly clones input values', () => {
      it('with default options', async () => {
        await vars.User.update(updates, { where: { secretValue: '1' } });
        expect(updates).to.deep.equal(cloneUpdates);
      });

      it('when using fields option', async () => {
        await vars.User.update(updates, { where: { secretValue: '1' }, fields: ['name'] });
        expect(updates).to.deep.equal(cloneUpdates);
      });
    });

    it('can detect complexe objects', async () => {
      class Where {
        secretValue = '1';
      }

      await expect(
        vars.User.update(updates, {
          // @ts-expect-error -- testing that class instances are rejected
          where: new Where(),
        }),
      ).to.be.rejected;
    });
  });

  describe('Update with multiple models to the same table', () => {
    const vars = beforeAll2(() => {
      const Model1 = current.define(
        'Model1',
        {
          value: DataTypes.INTEGER,
          name: DataTypes.STRING,
          isModel2: DataTypes.BOOLEAN,
          model1ExclusiveData: DataTypes.STRING,
        },
        {
          tableName: 'model_table',
        },
      );

      const Model2 = current.define(
        'Model2',
        {
          value: DataTypes.INTEGER,
          name: DataTypes.STRING,
        },
        {
          tableName: 'model_table',
        },
      );

      return { Model1, Model2 };
    });

    let stubQuery: SinonStub;
    beforeEach(() => {
      stubQuery = sinon.stub(current, 'queryRaw').resolves([[], 0]);
    });

    afterEach(() => {
      stubQuery.restore();
    });

    it('updates model1 using model1 model', async () => {
      await vars.Model1.update(
        {
          name: 'other name',
          model1ExclusiveData: 'only I can update this field',
        },
        {
          where: { value: 1 },
        },
      );
      expect(stubQuery.lastCall.lastArg.model).to.eq(vars.Model1);
    });

    it('updates model2 using model2 model', async () => {
      await vars.Model2.update(
        {
          name: 'other name',
        },
        {
          where: { value: 2 },
        },
      );
      expect(stubQuery.lastCall.lastArg.model).to.eq(vars.Model2);
    });
  });
});
