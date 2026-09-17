import { Sequelize, sql } from '@sequelize/core';
import { expect } from 'chai';
import oracledb from 'oracledb';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import { beforeEach2, createSequelizeInstance, expectPerDialect, sequelize } from '../support';

describe('Sequelize', () => {
  describe('version', () => {
    it('should be a string', () => {
      expect(typeof Sequelize.version).to.eq('string');
    });
  });

  describe('query', () => {
    let stubs: Array<SinonStub<any>> = [];

    afterEach(() => {
      for (const stub of stubs) {
        stub.restore();
      }

      stubs = [];
    });

    it('supports sql expressions', async () => {
      // mock sequelize.queryRaw using sinon
      stubs.push(sinon.stub(sequelize, 'queryRaw').resolves([[], 0]));

      await sequelize.query(sql`SELECT * FROM "users" WHERE id = ${1} AND id2 = :id2`, {
        replacements: {
          id2: 2,
        },
      });

      expect(sequelize.queryRaw).to.have.been.calledWith(
        'SELECT * FROM "users" WHERE id = 1 AND id2 = 2',
      );
    });
  });

  describe('queryRaw', () => {
    const date = new Date('2012-01-10T09:10:10.123Z');

    async function getBoundParameters(
      sequelizeInstance: Sequelize,
      sqlString: string,
      bind: unknown[] | Record<string, unknown>,
    ): Promise<unknown[]> {
      const run = sinon.stub(sequelizeInstance.dialect.Query.prototype, 'run').resolves([]);
      try {
        await sequelizeInstance.queryRaw(sqlString, { bind, connection: {} as any });
      } finally {
        run.restore();
      }

      return Object.values(run.firstCall.args[1] as unknown[] | Record<string, unknown>);
    }

    it('binds Date values the same way as model queries', async () => {
      const positional = await getBoundParameters(sequelize, 'SELECT $1, $2', [date, 'foo']);
      const named = await getBoundParameters(sequelize, 'SELECT $date', { date });

      expectPerDialect(() => [positional, named], {
        default: [['2012-01-10 09:10:10.123', 'foo'], ['2012-01-10 09:10:10.123']],
        'mssql sqlite3': [
          ['2012-01-10 09:10:10.123 +00:00', 'foo'],
          ['2012-01-10 09:10:10.123 +00:00'],
        ],
        postgres: [[date, 'foo'], [date]],
        oracle: [
          [{ type: oracledb.DB_TYPE_TIMESTAMP_LTZ, val: date }, 'foo'],
          [{ type: oracledb.DB_TYPE_TIMESTAMP_LTZ, val: date }],
        ],
      });
    });

    it('does not modify the bind option', async () => {
      const bind = { date };
      await getBoundParameters(sequelize, 'SELECT $date', bind);

      expect(bind).to.deep.equal({ date });
      expect(bind.date).to.equal(date);
    });

    if (sequelize.dialect.supports.globalTimeZoneConfig) {
      it('binds Date values in the configured timezone', async () => {
        const sequelizeWithTimezone = createSequelizeInstance({ timezone: '+05:30' });
        const parameters = await getBoundParameters(sequelizeWithTimezone, 'SELECT $1', [date]);
        await sequelizeWithTimezone.close();

        expectPerDialect(() => parameters, {
          'mysql mariadb snowflake': ['2012-01-10 14:40:10.123'],
          postgres: [date],
        });
      });
    }
  });

  describe('setSessionVariables', () => {
    afterEach(() => sinon.restore());

    if (!['mysql', 'mariadb'].includes(sequelize.dialect.name)) {
      return;
    }

    it('escapes an injection value in the generated assignment', async () => {
      const query = sinon.stub(sequelize, 'query').resolves([[], 0]);
      const value = `", @is_admin := 1, apostrophe ', backslash \\`;

      await sequelize.setSessionVariables({ café: value }, { connection: {} });

      expect(query).to.have.been.calledWith(
        String.raw`SET @café := '", @is_admin := 1, apostrophe \', backslash \\'`,
      );
    });
  });

  describe('close', () => {
    it('clears the pool & closes Sequelize', async () => {
      const options = {
        replication: null,
      };

      const sequelize2 = createSequelizeInstance(options);

      const poolClearSpy = sinon.spy(sequelize2.pool, 'destroyAllNow');

      await sequelize2.close();

      expect(poolClearSpy.calledOnce).to.be.true;
      expect(sequelize2.isClosed()).to.be.true;
    });
  });

  describe('init', () => {
    afterEach(async () => {
      Sequelize.hooks.removeAllListeners();
    });

    it('beforeInit hook can alter options', () => {
      Sequelize.hooks.addListener('beforeInit', options => {
        options.databaseVersion = sequelize.dialect.minimumDatabaseVersion;
      });

      const seq = createSequelizeInstance();

      expect(seq.getDatabaseVersion()).to.equal(sequelize.dialect.minimumDatabaseVersion);
    });

    it('afterInit hook cannot alter options', () => {
      Sequelize.hooks.addListener('afterInit', sequelize2 => {
        // @ts-expect-error -- only exists in some dialects but the principle remains identical
        sequelize2.options.protocol = 'udp';
      });

      expect(() => createSequelizeInstance()).to.throw();
    });
  });

  describe('log', () => {
    it('is disabled by default', () => {
      expect(sequelize.options.logging).to.equal(false);
    });

    describe('with a custom function for logging', () => {
      const vars = beforeEach2(() => {
        const spy = sinon.spy();

        return { spy, sequelize: createSequelizeInstance({ logging: spy }) };
      });

      it('calls the custom logger method', () => {
        vars.sequelize.log('om nom');
        expect(vars.spy.calledOnce).to.be.true;
      });

      it('calls the custom logger method with options', () => {
        const message = 'om nom';
        const timeTaken = 5;
        const options = { correlationId: 'ABC001' };
        vars.sequelize.log(message, timeTaken, options);
        expect(vars.spy.withArgs(message, timeTaken, options).calledOnce).to.be.true;
      });
    });
  });
});
