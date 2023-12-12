import { expect } from 'chai';
import sinon from 'sinon';
import { Sequelize, sql } from '@sequelize/core';
import { createSequelizeInstance, sequelize } from '../support';

describe('Sequelize', () => {
  describe('constructor', () => {
    it('should correctly set the host and the port', () => {
      const localSequelize = createSequelizeInstance({ host: '127.0.0.1', port: 1234 });
      expect(localSequelize.config.port).to.equal(1234);
      expect(localSequelize.config.host).to.equal('127.0.0.1');
    });
  });

  describe('version', () => {
    it('should be a string', () => {
      expect(typeof Sequelize.version).to.eq('string');
    });
  });

  describe('query', () => {
    it('supports sql expressions', async () => {
      // mock sequelize.queryRaw using sinon
      sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

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
});
