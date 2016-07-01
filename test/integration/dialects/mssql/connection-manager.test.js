'use strict';

/* jshint -W030 */
const chai = require('chai');
const expect = chai.expect;
const Support = require('../../support');
const dialect = Support.getTestDialect();

if (dialect.match(/^mssql/)) {
  describe('[MSSQL Specific] Query Queue', () => {
    it('should work with handleDisconnects', () => {
      const sequelize = Support.createSequelizeInstance({pool: {min: 1, max: 1, idle: 5000}});
      const cm = sequelize.connectionManager;
      let conn;

      return sequelize.sync()
        .then(() => cm.getConnection())
        .then(connection => {
          // Save current connection
          conn = connection;

          // simulate a unexpected end
          connection.unwrap().emit('error', {code: 'ECONNRESET'});
        })
        .then(() => cm.releaseConnection(conn))
        .then(() => cm.getConnection())
        .then(connection => {
          expect(conn).to.not.be.equal(connection);
          expect(cm.validate(conn)).to.not.be.ok;

          return cm.releaseConnection(connection);
        });
    });
  });
}
