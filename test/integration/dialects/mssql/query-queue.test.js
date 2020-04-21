'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Promise = require('../../../../lib/promise'),
  DataTypes = require('../../../../lib/data-types'),
  Support = require('../../support'),
  Sequelize = require('../../../../lib/sequelize'),
  ConnectionClosedError = require('../../../../lib/errors/connection/connection-closed-error'),
  dialect = Support.getTestDialect();

if (dialect.match(/^mssql/)) {
  describe('[MSSQL Specific] Query Queue', () => {
    beforeEach(function() {
      const User = this.User = this.sequelize.define('User', {
        username: DataTypes.STRING
      });

      return this.sequelize.sync({ force: true }).then(() => {
        return User.create({ username: 'John' });
      });
    });

    it('should queue concurrent requests to a connection', function() {
      const User = this.User;

      return expect(this.sequelize.transaction(t => {
        return Promise.all([
          User.findOne({
            transaction: t
          }),
          User.findOne({
            transaction: t
          })
        ]);
      })).not.to.be.rejected;
    });

    it('requests that reject should not affect future requests', async function() {
      const User = this.User;

      await expect(this.sequelize.transaction(async t => {
        await expect(User.create({
          username: new Date()
        })).to.be.rejected;
        await expect(User.findOne({
          transaction: t
        })).not.to.be.rejected;
      })).not.to.be.rejected;     
    });

    it('closing the connection should reject pending requests', async function() {
      const User = this.User;

      let promise;

      await expect(this.sequelize.transaction(t =>
        promise = Promise.all([
          expect(this.sequelize.dialect.connectionManager.disconnect(t.connection)).to.be.fulfilled,
          expect(User.findOne({
            transaction: t
          })).to.be.rejectedWith(ConnectionClosedError, 'the connection was closed before this query could be executed'),
          expect(User.findOne({
            transaction: t
          })).to.be.rejectedWith(ConnectionClosedError, 'the connection was closed before this query could be executed')
        ])
      )).to.be.rejectedWith(ConnectionClosedError, 'the connection was closed before this query could be executed');     

      await expect(promise).not.to.be.rejected;
    });

    it('closing the connection should reject in-progress requests', async function() {
      const User = this.User;

      let promise;

      await expect(this.sequelize.transaction(async t => {
        const wrappedExecSql = t.connection.execSql;
        t.connection.execSql = (...args) => {
          this.sequelize.dialect.connectionManager.disconnect(t.connection);
          return wrappedExecSql(...args);
        };
        return promise = Promise.all([
          expect(User.findOne({
            transaction: t
          })).to.be.rejectedWith(ConnectionClosedError, 'the connection was closed before this query could finish executing')
        ]);
      })).to.be.rejectedWith(ConnectionClosedError, 'the connection was closed before this query could be executed');     

      await expect(promise).not.to.be.rejected;
    });

    describe('unhandled rejections', () => {
      let onUnhandledRejection;

      afterEach(() => {
        process.removeListener('unhandledRejection', onUnhandledRejection);
      });

      it("unhandled rejection should occur if user doesn't catch promise returned from query", async function() {
        const User = this.User;
        const rejectionPromise = new Promise((resolve, reject) => {
          onUnhandledRejection = reject;
        });
        process.on('unhandledRejection', onUnhandledRejection);
        User.create({
          username: new Date()
        });
        await expect(rejectionPromise).to.be.rejectedWith(
          Sequelize.ValidationError, 'string violation: username cannot be an array or an object');
      });

      it('no unhandled rejections should occur as long as user catches promise returned from query', async function() {
        const User = this.User;
        const unhandledRejections = [];
        onUnhandledRejection = error => unhandledRejections.push(error);
        process.on('unhandledRejection', onUnhandledRejection);
        await expect(User.create({
          username: new Date()
        })).to.be.rejectedWith(Sequelize.ValidationError);
        expect(unhandledRejections).to.deep.equal([]);
      });
    });
  });
}
