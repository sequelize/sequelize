import { expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;
const notSupportedError = new Error(
  `rollbackTransactionQuery is not supported by the ${dialect.name} dialect.`,
);

describe('QueryGenerator#rollbackTransactionQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('should generate a query for rolling back a transaction', () => {
    expectsql(() => queryGenerator.rollbackTransactionQuery(), {
      default: 'ROLLBACK',
      'db2 ibmi mssql': notSupportedError,
    });
  });
});
