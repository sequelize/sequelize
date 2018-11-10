'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('../../support');
const dialect = Support.getTestDialect();

if (dialect.match(/^mssql/)) {
  describe('[MSSQL Specific] Query Queue', () => {
    it('should work with handleDisconnects', () => {
      const sequelize = Support.createSequelizeInstance({ pool: { min: 1, max: 1, idle: 5000 } });
      const cm = sequelize.connectionManager;
      let conn;

      return sequelize
        .sync()
        .then(() => cm.getConnection())
        .then(connection => {
          // Save current connection
          conn = connection;

          // simulate a unexpected end
          // connection removed from pool by MSSQL Conn Manager
          conn.unwrap().emit('error', {code: 'ECONNRESET'});
        })
        .then(() => cm.getConnection())
        .then(connection => {
          expect(conn).to.not.be.equal(connection);
          expect(cm.validate(conn)).to.not.be.ok;

          return cm.releaseConnection(connection);
        });
    });

    it('should handle double disconnect', () => {
      const sequelize = Support.createSequelizeInstance({ pool: { min: 1, max: 1, idle: 5000 } });
      const cm = sequelize.connectionManager;
      let count = 0;
      let conn = null;

      return sequelize
        .sync()
        .then(() => cm.getConnection())
        .then(connection => {
          conn = connection;
          const unwrapConn = conn.unwrap();
          unwrapConn.on('end', () => {
            count++;
          });

          return cm.disconnect(conn);
        })
        .then(() => cm.disconnect(conn))
        .then(() => {
          expect(count).to.be.eql(1);
        });
    });

    it('should not throw when non pooled connection is unexpectedly closed', () => {
      const sequelize = Support.createSequelizeInstance({ pool: { min: 1, max: 1, idle: 5000 } });
      const cm = sequelize.connectionManager;

      let conn;

      return sequelize
        .sync()
        .then(() => cm.getConnection())
        .then(connection => {
          conn = connection;

          // remove from pool
          return cm.pool.destroy(connection);
        })
        .then(() => {
          // unexpected disconnect
          const unwrapConn = conn.unwrap();
          unwrapConn.emit('error', {
            code: 'ESOCKET'
          });
        });
    });

    describe('Errors', () => {
      it('ECONNREFUSED', () => {
        const sequelize = Support.createSequelizeInstance({ port: 34237 });
        return expect(sequelize.connectionManager.getConnection()).to.have.been.rejectedWith(sequelize.ConnectionRefusedError);
      });

      it('ENOTFOUND', () => {
        const sequelize = Support.createSequelizeInstance({ host: 'http://wowow.example.com' });
        return expect(sequelize.connectionManager.getConnection()).to.have.been.rejectedWith(sequelize.HostNotFoundError);
      });

      it('EHOSTUNREACH', () => {
        const sequelize = Support.createSequelizeInstance({ host: '255.255.255.255' });
        return expect(sequelize.connectionManager.getConnection()).to.have.been.rejectedWith(sequelize.HostNotReachableError);
      });

      it('ER_ACCESS_DENIED_ERROR | ELOGIN', () => {
        const sequelize = new Support.Sequelize('localhost', 'was', 'ddsd', Support.sequelize.options);
        return expect(sequelize.connectionManager.getConnection()).to.have.been.rejectedWith(sequelize.AccessDeniedError);
      });
    });
  });
}
