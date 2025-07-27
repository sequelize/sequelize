import { Sequelize, sql } from '@sequelize/core';
import { expect } from 'chai';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import { beforeEach2, createSequelizeInstance, sequelize } from '../support';

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
