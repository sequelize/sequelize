'use strict';

const chai = require('chai'),
  expect = chai.expect,
  DataTypes = require('sequelize/lib/data-types'),
  Support = require('../../support'),
  Sequelize = require('sequelize/lib/sequelize'),
  ConnectionError = require('sequelize/lib/errors/connection-error'),
  { AsyncQueueError } = require('sequelize/lib/dialects/mssql/async-queue'),
  dialect = Support.getTestDialect();

if (dialect.match(/^mssql/)) {
  describe('[MSSQL Specific] Query Queue', () => {
    beforeEach(async function() {
      const User = this.User = this.sequelize.define('User', {
        username: DataTypes.STRING
      });

      await this.sequelize.sync({ force: true });

      await User.create({ username: 'John' });
    });

    it('should queue concurrent requests to a connection', async function() {
      const User = this.User;

      await expect(this.sequelize.transaction(async t => {
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
          })).to.be.eventually.rejectedWith(ConnectionError, 'the connection was closed before this query could be executed')
            .and.have.property('parent').that.instanceOf(AsyncQueueError),
          expect(User.findOne({
            transaction: t
          })).to.be.eventually.rejectedWith(ConnectionError, 'the connection was closed before this query could be executed')
            .and.have.property('parent').that.instanceOf(AsyncQueueError)
        ])
      )).to.be.rejectedWith(ConnectionError, 'the connection was closed before this query could be executed');

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
        return promise = expect(User.findOne({
          transaction: t
        })).to.be.eventually.rejectedWith(ConnectionError, 'the connection was closed before this query could finish executing')
          .and.have.property('parent').that.instanceOf(AsyncQueueError);
      })).to.be.eventually.rejectedWith(ConnectionError, 'the connection was closed before this query could be executed')
        .and.have.property('parent').that.instanceOf(AsyncQueueError);

      await expect(promise).not.to.be.rejected;
    });

    describe('unhandled rejections', () => {
      it("unhandled rejection should occur if user doesn't catch promise returned from query", async function() {
        const User = this.User;
        const rejectionPromise = Support.nextUnhandledRejection();
        User.create({
          username: new Date()
        });
        await expect(rejectionPromise).to.be.rejectedWith(
          Sequelize.ValidationError, 'string violation: username cannot be an array or an object');
      });

      it('no unhandled rejections should occur as long as user catches promise returned from query', async function() {
        const User = this.User;
        const unhandledRejections = Support.captureUnhandledRejections();
        await expect(User.create({
          username: new Date()
        })).to.be.rejectedWith(Sequelize.ValidationError);
        expect(unhandledRejections).to.deep.equal([]);
      });
    });
  });
}
