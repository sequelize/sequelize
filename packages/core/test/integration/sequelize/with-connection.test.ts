import { expect } from 'chai';
import { createSingleTestSequelizeInstance } from '../support';

describe('sequelize.withConnection', () => {
  it('reserves a connection, to ensure multiple queries run on the same connection', async () => {
    const sequelize = createSingleTestSequelizeInstance();

    await sequelize.withConnection(async () => {
      expect(sequelize.pool.using).to.eq(1);
    });

    expect(sequelize.pool.available).to.eq(1);
  });

  it('has an option to kill the connection after using it', async () => {
    const sequelize = createSingleTestSequelizeInstance();

    await sequelize.withConnection({ destroyConnection: true }, async () => {
      expect(sequelize.pool.using).to.eq(1);
    });

    expect(sequelize.pool.available).to.eq(0);
  });
});
