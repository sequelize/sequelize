import { expect } from 'chai';
import { QueryTypes } from '@sequelize/core';
import {
  createSequelizeInstance,
  disableDatabaseResetForSuite,
  getTestDialect,
  prepareTransactionTest,
  sequelize,
} from '../support';

const dialectName = getTestDialect();

describe('sequelize.setSessionVariables', () => {
  if (!['mysql', 'mariadb'].includes(dialectName)) {
    return;
  }

  disableDatabaseResetForSuite();

  it(`rejects if no connection or transaction is provided`, async () => {
    await expect(sequelize.setSessionVariables({ foo: 'bar' }))
      .to.be.rejectedWith(Error, 'specify either options.transaction or options.connection');
  });

  it('supports CLS transactions', async () => {
    const clsSequelize = await prepareTransactionTest(createSequelizeInstance({
      disableClsTransactions: false,
    }));

    await clsSequelize.transaction(async () => {
      await clsSequelize.setSessionVariables({ foo: 'bar' });
      const [data] = await clsSequelize.query<{ foo: string }>('SELECT @foo as `foo`', { type: QueryTypes.SELECT });
      expect(data).to.be.ok;
      expect(data.foo).to.be.equal('bar');
    });
  });

  it('supports manual transactions', async () => {
    const transaction = await sequelize.startUnmanagedTransaction();

    try {
      await sequelize.setSessionVariables({ foo: 'bar' }, { transaction });
      const [data] = await sequelize.query<{ foo: string }>('SELECT @foo as `foo`', { type: QueryTypes.SELECT, transaction });
      expect(data).to.be.ok;
      expect(data.foo).to.be.equal('bar');
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  });

  it('supports connections', async () => {
    await sequelize.withConnection(async connection => {
      await sequelize.setSessionVariables({ foo: 'bar' }, { connection });
      const [data] = await sequelize.query<{ foo: string }>('SELECT @foo as `foo`', { type: QueryTypes.SELECT, connection });
      expect(data).to.be.ok;
      expect(data.foo).to.be.equal('bar');
    });
  });

  it('supports setting multiple values', async () => {
    await sequelize.withConnection(async connection => {
      await sequelize.setSessionVariables({ foo: 'bar', foos: 'bars' }, { connection });
      const [data] = await sequelize.query<{ foo: string, foos: string }>('SELECT @foo as `foo`, @foos as `foos`', { type: QueryTypes.SELECT, connection });
      expect(data).to.be.ok;
      expect(data.foo).to.be.equal('bar');
      expect(data.foos).to.be.equal('bars');
    });
  });
});

