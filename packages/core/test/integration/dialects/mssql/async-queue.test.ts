import { ConnectionError, DataTypes, Model } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import type { MsSqlConnection } from '@sequelize/mssql';
import { AsyncQueueError } from '@sequelize/mssql';
import { expect } from 'chai';
import { beforeAll2, sequelize, setResetMode } from '../../support';

describe('[MSSQL Specific] Async Queue', () => {
  if (!sequelize.dialect.name.startsWith('mssql')) {
    return;
  }

  setResetMode('none');
  const vars = beforeAll2(async () => {
    class User extends Model {
      @Attribute(DataTypes.STRING)
      @NotNull
      declare username: string;
    }

    sequelize.addModels([User]);
    await sequelize.sync({ force: true });
    await User.create({ username: 'John' });

    return { User };
  });

  it('should queue concurrent requests to a connection', async () => {
    await expect(
      sequelize.transaction(async transaction => {
        return Promise.all([
          vars.User.findOne({ transaction }),
          vars.User.findOne({ transaction }),
        ]);
      }),
    ).not.to.be.rejected;
  });

  it('requests that reject should not affect future requests', async () => {
    await expect(
      sequelize.transaction(async transaction => {
        await expect(vars.User.create({ username: new Date() })).to.be.rejected;
        await expect(vars.User.findOne({ transaction })).not.to.be.rejected;
      }),
    ).not.to.be.rejected;
  });

  it('closing the connection should reject pending requests', async () => {
    let promise;

    await expect(
      sequelize.transaction(async transaction => {
        promise = Promise.all([
          expect(sequelize.dialect.connectionManager.disconnect(transaction.getConnection())).to.be
            .fulfilled,
          expect(vars.User.findOne({ transaction }))
            .to.be.eventually.rejectedWith(
              ConnectionError,
              'the connection was closed before this query could be executed',
            )
            .and.have.property('cause')
            .that.instanceOf(AsyncQueueError),
          expect(vars.User.findOne({ transaction }))
            .to.be.eventually.rejectedWith(
              ConnectionError,
              'the connection was closed before this query could be executed',
            )
            .and.have.property('cause')
            .that.instanceOf(AsyncQueueError),
        ]);

        return promise;
      }),
    ).to.be.rejectedWith(
      ConnectionError,
      'the connection was closed before this query could be executed',
    );

    await expect(promise).not.to.be.rejected;
  });

  it('closing the connection should reject in-progress requests', async () => {
    let promise;

    await expect(
      sequelize.transaction(async transaction => {
        const connection = transaction.getConnection() as MsSqlConnection;
        const wrappedExecSql = connection.execSql;
        connection.execSql = async function execSql(...args) {
          await sequelize.dialect.connectionManager.disconnect(connection);

          return wrappedExecSql.call(this, ...args);
        };

        promise = expect(vars.User.findOne({ transaction }))
          .to.be.eventually.rejectedWith(
            ConnectionError,
            'the connection was closed before this query could finish executing',
          )
          .and.have.property('cause')
          .that.instanceOf(AsyncQueueError);

        return promise;
      }),
    )
      .to.be.eventually.rejectedWith(
        ConnectionError,
        'the connection was closed before this query could be executed',
      )
      .and.have.property('cause')
      .that.instanceOf(AsyncQueueError);

    await expect(promise).not.to.be.rejected;
  });
});
