'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('../../support');
const dialect = Support.getTestDialect();
const DataTypes = require('../../../../lib/data-types');

if (dialect === 'mysql') {
  describe('[MYSQL Specific] Connection Manager', () => {
    it('-FOUND_ROWS can be suppressed to get back legacy behavior', () => {
      const sequelize = Support.createSequelizeInstance({ dialectOptions: { flags: '' } });
      const User = sequelize.define('User', { username: DataTypes.STRING });

      return User.sync({ force: true })
        .then(() => User.create({ id: 1, username: 'jozef' }))
        .then(() => User.update({ username: 'jozef' }, {
          where: {
            id: 1
          }
        }))
        // https://github.com/sequelize/sequelize/issues/7184
        .then(([affectedCount]) => affectedCount.should.equal(1));
    });

    it('should acquire a valid connection when keepDefaultTimezone is true', () => {
      const sequelize = Support.createSequelizeInstance({ keepDefaultTimezone: true, pool: { min: 1, max: 1, handleDisconnects: true, idle: 5000 } });
      const cm = sequelize.connectionManager;
      return sequelize
        .sync()
        .then(() => cm.getConnection())
        .then(connection => {
          expect(cm.validate(connection)).to.be.ok;
          return cm.releaseConnection(connection);
        });
    });
  });
}
