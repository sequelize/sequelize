'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require('../../support')
  , dialect = Support.getTestDialect();

if (dialect.match(/^mssql/)) {
  describe('[MSSQL Specific] Query Queue', function () {
    it('should work with handleDisconnects', function() {
      var sequelize = Support.createSequelizeInstance({pool: {min: 1, max: 1, idle: 5000}})
        , cm = sequelize.connectionManager
        , conn;

      return sequelize.sync()
        .then(function() {
          return cm.getConnection();
        })
        .then(function(connection) {
          // Save current connection
          conn = connection;

          // simulate a unexpected end
          // connection removed from pool by MSSQL Conn Manager
          conn.unwrap().emit('error', {code: 'ECONNRESET'});
        })
        .then(function() {
          // Get next available connection
          return cm.getConnection();
        })
        .then(function(connection) {
          expect(conn).to.not.be.equal(connection);
          expect(cm.validate(conn)).to.not.be.ok;

          return cm.releaseConnection(connection);
        });
    });
  });
}
