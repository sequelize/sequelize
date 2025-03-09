import { expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();
const queryGenerator = sequelize.queryGenerator;
const notSupportedError = new Error(`${dialectName} does not support toggling foreign key checks`);

describe('QueryGenerator#getToggleForeignKeyChecksQuery', () => {
  it('produces a query that disables foreign key checks', () => {
    expectsql(() => queryGenerator.getToggleForeignKeyChecksQuery(false), {
      default: notSupportedError,
      'mysql mariadb': 'SET FOREIGN_KEY_CHECKS=0',
      sqlite3: 'PRAGMA foreign_keys = OFF',
    });
  });

  it('produces a query that enables foreign key checks', () => {
    expectsql(() => queryGenerator.getToggleForeignKeyChecksQuery(true), {
      default: notSupportedError,
      'mysql mariadb': 'SET FOREIGN_KEY_CHECKS=1',
      sqlite3: 'PRAGMA foreign_keys = ON',
    });
  });
});
