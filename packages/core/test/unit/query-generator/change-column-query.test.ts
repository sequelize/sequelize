import { expectsql, sequelize } from '../../support';

// Contains the identifier delimiter of every dialect, to ensure the column name cannot break out
// of the identifier it is quoted with.
const injectedColumn = 'my`Col"umn]';

describe('QueryGenerator#changeColumnQuery', () => {
  // sqlite3 does not support altering columns
  if (sequelize.dialect.name === 'sqlite3') {
    return;
  }

  const queryGenerator = sequelize.queryGenerator;

  it('produces a query that changes a column', () => {
    expectsql(() => queryGenerator.changeColumnQuery('myTable', { level_id: 'INTEGER' }), {
      'mariadb mysql': 'ALTER TABLE `myTable` CHANGE `level_id` `level_id` INTEGER;',
      mssql: 'ALTER TABLE [myTable] ALTER COLUMN [level_id] INTEGER;',
      db2: 'ALTER TABLE "myTable" ALTER COLUMN "level_id" SET INTEGER;',
      ibmi: 'ALTER TABLE "myTable" ALTER COLUMN "level_id" SET DATA TYPE INTEGER',
      'postgres snowflake':
        'ALTER TABLE "myTable" ALTER COLUMN "level_id" DROP NOT NULL;ALTER TABLE "myTable" ALTER COLUMN "level_id" DROP DEFAULT;ALTER TABLE "myTable" ALTER COLUMN "level_id" TYPE INTEGER;',
      oracle: `DECLARE CONS_NAME VARCHAR2(200); BEGIN BEGIN EXECUTE IMMEDIATE 'ALTER TABLE "myTable" MODIFY "level_id" INTEGER'; EXCEPTION WHEN OTHERS THEN  IF SQLCODE = -1442 OR SQLCODE = -1451 THEN    EXECUTE IMMEDIATE 'ALTER TABLE "myTable" MODIFY "level_id" INTEGER';  ELSE    RAISE;  END IF; END; END;`,
    });
  });

  it('escapes the column name', () => {
    expectsql(() => queryGenerator.changeColumnQuery('myTable', { [injectedColumn]: 'INTEGER' }), {
      'mariadb mysql': 'ALTER TABLE `myTable` CHANGE `my``Col"umn]` `my``Col"umn]` INTEGER;',
      mssql: 'ALTER TABLE [myTable] ALTER COLUMN [my`Col"umn]]] INTEGER;',
      db2: 'ALTER TABLE "myTable" ALTER COLUMN "my`Col""umn]" SET INTEGER;',
      ibmi: 'ALTER TABLE "myTable" ALTER COLUMN "my`Col""umn]" SET DATA TYPE INTEGER',
      'postgres snowflake':
        'ALTER TABLE "myTable" ALTER COLUMN "my`Col""umn]" DROP NOT NULL;ALTER TABLE "myTable" ALTER COLUMN "my`Col""umn]" DROP DEFAULT;ALTER TABLE "myTable" ALTER COLUMN "my`Col""umn]" TYPE INTEGER;',
      oracle: `DECLARE CONS_NAME VARCHAR2(200); BEGIN BEGIN EXECUTE IMMEDIATE 'ALTER TABLE "myTable" MODIFY "my\`Col""umn]" INTEGER'; EXCEPTION WHEN OTHERS THEN  IF SQLCODE = -1442 OR SQLCODE = -1451 THEN    EXECUTE IMMEDIATE 'ALTER TABLE "myTable" MODIFY "my\`Col""umn]" INTEGER';  ELSE    RAISE;  END IF; END; END;`,
    });
  });
});
