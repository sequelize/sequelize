'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const dialect = Support.getTestDialect();
const { DataTypes } = require('@sequelize/core');

if (dialect === 'snowflake') {
  describe('[SNOWFLAKE Specific] Connection Manager', () => {
    it('-FOUND_ROWS can be suppressed to get back legacy behavior', async () => {
      const sequelize = Support.createSingleTestSequelizeInstance();
      const User = sequelize.define('User', { username: DataTypes.STRING });

      await User.sync({ force: true });
      await User.create({ id: 1, username: 'jozef' });

      const [affectedCount] = await User.update(
        { username: 'jozef' },
        {
          where: {
            id: 1,
          },
        },
      );

      // https://github.com/sequelize/sequelize/issues/7184
      await affectedCount.should.equal(1);
    });

    it('should acquire a valid connection when keepDefaultTimezone is true', async () => {
      const sequelize = Support.createSingleTestSequelizeInstance({
        keepDefaultTimezone: true,
        pool: { min: 1, max: 1, handleDisconnects: true, idle: 5000 },
      });

      await sequelize.sync();

      const connection = await sequelize.pool.acquire();
      expect(sequelize.dialect.connectionManager.validate(connection)).to.be.ok;
      sequelize.pool.release(connection);
    });
  });
}
