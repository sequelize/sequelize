import { expect } from 'chai';
import { Sequelize } from '@sequelize/core';
import { SqliteDialect } from '@sequelize/sqlite';

describe('ConnectionManager', () => {
  describe('getConnection', () => {
    it('should forward empty string storage to SQLite connector to create temporary disk-based database', async () => {
      // storage='' means anonymous disk-based database
      const sequelize = new Sequelize({
        dialect: SqliteDialect,
        storage: '',
        pool: { max: 1, idle: Infinity },
      });

      const connection = await sequelize.pool.acquire();
      expect(connection.filename).to.equal('');
    });
  });
});
