import { expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;
const notSupportedError = new Error(`Savepoints are not supported by ${dialect.name}.`);

describe('QueryGenerator#createSavepointQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('should generate a query for creating a savepoint', () => {
    expectsql(() => queryGenerator.createSavepointQuery('mySavePoint'), {
      default: 'SAVEPOINT [mySavePoint]',
      mssql: 'SAVE TRANSACTION [mySavePoint]',
      snowflake: notSupportedError,
      'db2 ibmi': 'SAVEPOINT "mySavePoint" ON ROLLBACK RETAIN CURSORS',
    });
  });
});
