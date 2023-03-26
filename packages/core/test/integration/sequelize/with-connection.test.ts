import { expect } from 'chai';
import { createSequelizeInstance, getTestDialect } from '../../support';

describe('sequelize.withConnection', () => {
  if (getTestDialect() === 'sqlite') {
    // SQLite does not use the connection pool
    it('returns the connection', async () => {
      const sequelize = createSequelizeInstance();

      await sequelize.withConnection(async connection1 => {
        await sequelize.withConnection(async connection2 => {
          expect(connection1).to.eq(connection2);
        });
      });
    });

    return;
  }

  it('reserves a connection, to ensure multiple queries run on the same connection', async () => {
    const sequelize = createSequelizeInstance();

    await sequelize.withConnection(async () => {
      expect(sequelize.connectionManager.pool.using).to.eq(1);
    });

    expect(sequelize.connectionManager.pool.available).to.eq(1);
  });

  it('has an option to kill the connection after using it', async () => {
    const sequelize = createSequelizeInstance();

    await sequelize.withConnection({ destroyConnection: true }, async () => {
      expect(sequelize.connectionManager.pool.using).to.eq(1);
    });

    expect(sequelize.connectionManager.pool.available).to.eq(0);
  });
});
