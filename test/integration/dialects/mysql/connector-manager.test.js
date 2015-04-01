'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , sinon = require('sinon')
  , DataTypes = require(__dirname + '/../../../../lib/data-types');

chai.config.includeStack = true;

if (Support.dialectIsMySQL()) {
  describe('[MYSQL Specific] Connector Manager', function() {
    it('works correctly after being idle', function(done) {
      var User = this.sequelize.define('User', { username: DataTypes.STRING })
        , spy = sinon.spy();

      User.sync({force: true}).then(function() {
        User.create({username: 'user1'}).then(function() {
          User.count().then(function(count) {
            expect(count).to.equal(1);
            spy();

            setTimeout(function() {
              User.count().then(function(count) {
                expect(count).to.equal(1);
                spy();
                if (spy.calledTwice) {
                  done();
                }
              });
            }, 1000);
          });
        });
      });
    });

    it('accepts new queries after shutting down a connection', function() {
      // Create a sequelize instance with pooling disabled
      var sequelize = Support.createSequelizeInstance({ pool: false });
      var User = sequelize.define('User', { username: DataTypes.STRING });

      return User.sync({force: true}).then(function() {
        return User.create({username: 'user1'});
      }).then(function() {
        // After 100 ms the DB connection will be disconnected for inactivity
        return sequelize.Promise.delay(100);
      }).then(function () {
        // This query will be queued just after the `client.end` is executed and before its callback is called
        return sequelize.query('SELECT COUNT(*) AS count FROM Users', { type: sequelize.QueryTypes.SELECT });
      }).then(function(count) {
        expect(count[0].count).to.equal(1);
      });
    });

    // This should run only on direct mysql
    if (Support.dialectIsMySQL(true)) {
      it('should maintain connection', function() {
        var sequelize = Support.createSequelizeInstance({pool: {min: 1, max: 1, handleDisconnects: true, idle: 5000}})
          , cm = sequelize.connectionManager
          , conn;

        return sequelize.sync()
          .then(function() {
            return cm.getConnection();
          })
          .then(function(connection) {
            // Save current connection
            conn = connection;
          })
          .then(function() {
            return cm.releaseConnection(conn);
          })
          .then(function() {
            // Get next available connection
            return cm.getConnection();
          })
          .then(function(connection) {
            // Old threadId should be different from current new one
            expect(conn.threadId).to.be.equal(connection.threadId);
            expect(cm.validate(conn)).to.be.ok;

            return cm.releaseConnection(connection);
          });
      });

      it('should work with handleDisconnects', function() {
        var sequelize = Support.createSequelizeInstance({pool: {min: 1, max: 1, handleDisconnects: true, idle: 5000}})
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
            connection._protocol.end();
          })
          .then(function() {
            return cm.releaseConnection(conn);
          })
          .then(function() {
            // Get next available connection
            return cm.getConnection();
          })
          .then(function(connection) {
            // Old threadId should be different from current new one
            expect(conn.threadId).to.not.be.equal(connection.threadId);
            expect(cm.validate(conn)).to.not.be.ok;

            return cm.releaseConnection(connection);
          });
      });
    }

  });
}
