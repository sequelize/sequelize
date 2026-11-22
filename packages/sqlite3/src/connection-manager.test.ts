import { Sequelize } from '@sequelize/core';
import { SqliteDialect } from '@sequelize/sqlite3';
import { expect } from 'chai';

describe('SqliteConnectionManager#getConnection', () => {
  async function acquireFilename(storage: string): Promise<string> {
    const sequelize = new Sequelize({
      dialect: SqliteDialect,
      storage,
      pool: { max: 1, idle: Infinity },
    });

    try {
      const connection = await sequelize.pool.acquire();

      return connection.filename;
    } finally {
      await sequelize.close();
    }
  }

  it('forwards an empty string storage to create a temporary disk-based database', async () => {
    expect(await acquireFilename('')).to.equal('');
  });

  it('supports :memory: database', async () => {
    expect(await acquireFilename(':memory:')).to.equal(':memory:');
  });
});
