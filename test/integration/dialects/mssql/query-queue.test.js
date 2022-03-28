'use strict';

const chai = require('chai');
const Support = require('../../support');
const { Sequelize, DataTypes } = require('@sequelize/core');
const ConnectionError = require('@sequelize/core/lib/errors/connection-error');
const { AsyncQueueError } = require('@sequelize/core/lib/dialects/mssql/async-queue');

const expect = chai.expect;
const dialect = Support.getTestDialect();

if (dialect.startsWith('mssql')) {
  describe('[MSSQL Specific] Query Queue', () => {
    beforeEach(async function () {
      const User = this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
      });

      await this.sequelize.sync({ force: true });

      await User.create({ username: 'John' });
    });

    it('should queue concurrent requests to a connection', async function () {
      const User = this.User;

      await expect(this.sequelize.transaction(async t => {
        return Promise.all([
          User.findOne({
            transaction: t,
          }),
          User.findOne({
            transaction: t,
          }),
        ]);
      })).not.to.be.rejected;
    });

    it('requests that reject should not affect future requests', async function () {
      const User = this.User;

      await expect(this.sequelize.transaction(async t => {
        await expect(User.create({
          username: new Date(),
        })).to.be.rejected;
        await expect(User.findOne({
          transaction: t,
        })).not.to.be.rejected;
      })).not.to.be.rejected;
    });

    it('closing the connection should reject pending requests', async function () {
      const User = this.User;

      let promise;

      await expect(this.sequelize.transaction(transaction => {
        promise = Promise.all([
          expect(this.sequelize.dialect.connectionManager.disconnect(transaction.connection)).to.be.fulfilled,
          expect(User.findOne({ transaction })).to.be.eventually.rejectedWith(ConnectionError, 'the connection was closed before this query could be executed')
            .and.have.property('parent').that.instanceOf(AsyncQueueError),
          expect(User.findOne({ transaction })).to.be.eventually.rejectedWith(ConnectionError, 'the connection was closed before this query could be executed')
            .and.have.property('parent').that.instanceOf(AsyncQueueError),
        ]);

        return promise;
      })).to.be.rejectedWith(ConnectionError, 'the connection was closed before this query could be executed');

      await expect(promise).not.to.be.rejected;
    });

    it('closing the connection should reject in-progress requests', async function () {
      const { User, sequelize } = this;

      let promise;

      await expect(sequelize.transaction(async transaction => {
        const wrappedExecSql = transaction.connection.execSql;
        transaction.connection.execSql = async function execSql(...args) {
          await sequelize.dialect.connectionManager.disconnect(transaction.connection);

          return wrappedExecSql.call(this, ...args);
        };

        promise = expect(User.findOne({ transaction }))
          .to.be.eventually.rejectedWith(ConnectionError, 'the connection was closed before this query could finish executing')
          .and.have.property('parent').that.instanceOf(AsyncQueueError);

        return promise;
      })).to.be.eventually.rejectedWith(ConnectionError, 'the connection was closed before this query could be executed')
        .and.have.property('parent').that.instanceOf(AsyncQueueError);

      await expect(promise).not.to.be.rejected;
    });
  });
}
