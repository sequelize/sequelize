import { expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;
const notSupportedError = new Error(
  `commitTransactionQuery is not supported by the ${dialect.name} dialect.`,
);

describe('QueryGenerator#commitTransactionQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('should generate a query for committing a transaction', () => {
    expectsql(() => queryGenerator.commitTransactionQuery(), {
      default: 'COMMIT',
      'db2 ibmi mssql': notSupportedError,
    });
  });
});
