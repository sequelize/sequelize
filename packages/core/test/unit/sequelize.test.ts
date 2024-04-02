import { Sequelize, sql } from '@sequelize/core';
import { expect } from 'chai';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import { createSequelizeInstance, sequelize } from '../support';

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

  describe('cloe', () => {
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
});
