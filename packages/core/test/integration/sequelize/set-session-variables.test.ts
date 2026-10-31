import { QueryTypes, sql } from '@sequelize/core';
import { expect } from 'chai';
import {
  createSingleTransactionalTestSequelizeInstance,
  getTestDialect,
  sequelize,
  setResetMode,
} from '../support';

const dialectName = getTestDialect();

describe('sequelize.setSessionVariables', () => {
  if (!['mysql', 'mariadb'].includes(dialectName)) {
    return;
  }

  setResetMode('none');

  it(`rejects if no connection or transaction is provided`, async () => {
    await expect(sequelize.setSessionVariables({ foo: 'bar' })).to.be.rejectedWith(
      Error,
      'specify either options.transaction or options.connection',
    );
  });

  it('supports CLS transactions', async () => {
    const clsSequelize = await createSingleTransactionalTestSequelizeInstance(sequelize, {
      disableClsTransactions: false,
    });

    await clsSequelize.transaction(async () => {
      await clsSequelize.setSessionVariables({ foo: 'bar' });
      const [data] = await clsSequelize.query<{ foo: string }>('SELECT @foo as `foo`', {
        type: QueryTypes.SELECT,
      });
      expect(data).to.be.ok;
      expect(data.foo).to.equal('bar');
    });
  });

  it('supports manual transactions', async () => {
    const transaction = await sequelize.startUnmanagedTransaction();

    try {
      await sequelize.setSessionVariables({ foo: 'bar' }, { transaction });
      const [data] = await sequelize.query<{ foo: string }>('SELECT @foo as `foo`', {
        type: QueryTypes.SELECT,
        transaction,
      });
      expect(data).to.be.ok;
      expect(data.foo).to.equal('bar');
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  });

  it('supports connections', async () => {
    await sequelize.withConnection(async connection => {
      await sequelize.setSessionVariables({ foo: 'bar' }, { connection });
      const [data] = await sequelize.query<{ foo: string }>('SELECT @foo as `foo`', {
        type: QueryTypes.SELECT,
        connection,
      });
      expect(data).to.be.ok;
      expect(data.foo).to.equal('bar');
    });
  });

  it('round-trips strings with quotes and backslashes', async () => {
    const value = `single quote ', double quote ", backslash \\ value`;

    await sequelize.withConnection(async connection => {
      await sequelize.setSessionVariables({ text: value }, { connection });
      const [data] = await sequelize.query<{ text: string }>('SELECT @text as `text`', {
        type: QueryTypes.SELECT,
        connection,
      });
      expect(data).to.be.ok;
      expect(data.text).to.equal(value);
    });
  });

  it('supports scalar values', async () => {
    await sequelize.withConnection(async connection => {
      await sequelize.setSessionVariables(
        { count: 42, enabled: true, missing: null },
        { connection },
      );
      const [data] = await sequelize.query<{
        count: string | number;
        enabled: string | number;
        missing: string | number;
      }>(
        'SELECT @count + 1 as `count`, @enabled = true as `enabled`, @missing IS NULL as `missing`',
        { type: QueryTypes.SELECT, connection },
      );
      expect(data).to.be.ok;
      expect(Number(data.count)).to.equal(43);
      expect(Number(data.enabled)).to.equal(1);
      expect(Number(data.missing)).to.equal(1);
    });
  });

  it('supports setting multiple values', async () => {
    await sequelize.withConnection(async connection => {
      await sequelize.setSessionVariables({ foo: 'bar', $foo: 'bars' }, { connection });
      const [data] = await sequelize.query<{ foo: string; dollarFoo: string }>(
        'SELECT @foo as `foo`, @$foo as `dollarFoo`',
        { type: QueryTypes.SELECT, connection },
      );
      expect(data).to.be.ok;
      expect(data.foo).to.equal('bar');
      expect(data.dollarFoo).to.equal('bars');
    });
  });

  it('rejects invalid variable names', async () => {
    await sequelize.withConnection(async connection => {
      for (const name of ['', 'display-name', 'display name', 'foo/*comment*/', 'a'.repeat(65)]) {
        // eslint-disable-next-line no-await-in-loop -- Reuse the held connection sequentially.
        await expect(
          sequelize.setSessionVariables({ [name]: 'value' }, { connection }),
        ).to.be.rejectedWith(TypeError, 'Invalid session variable name');
      }
    });
  });

  it('rejects SQL expressions as values', async () => {
    await sequelize.withConnection(async connection => {
      await expect(
        sequelize.setSessionVariables({ foo: sql.literal('1') }, { connection }),
      ).to.be.rejectedWith(TypeError, 'does not accept SQL expressions as variable values');
    });
  });
});
