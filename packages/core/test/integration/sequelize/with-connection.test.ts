import { expect } from 'chai';
import { createSequelizeInstance } from '../../support';

describe('sequelize.withConnection', () => {
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
