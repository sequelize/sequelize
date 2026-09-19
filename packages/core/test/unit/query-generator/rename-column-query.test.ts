import { expectsql, sequelize } from '../../support';

// Contains the identifier delimiter of every dialect, to ensure neither the old nor the new column
// name can break out of the identifier (or, for mssql, the string literal) it is quoted with.
const injectedColumn = 'my`Col"umn]';
const injectedNewColumn = `${injectedColumn}X`;

describe('QueryGenerator#renameColumnQuery', () => {
  // sqlite3 does not support renaming columns through this method
  if (sequelize.dialect.name === 'sqlite3') {
    return;
  }

  const queryGenerator = sequelize.queryGenerator;

  it('produces a query that renames a column', () => {
    expectsql(
      () => queryGenerator.renameColumnQuery('myTable', 'oldName', { newName: 'INTEGER' }),
      {
        'mariadb mysql': 'ALTER TABLE `myTable` CHANGE `oldName` `newName` INTEGER;',
        mssql: `EXEC sp_rename N'[myTable].[oldName]', N'newName', 'COLUMN';`,
        'db2 ibmi postgres snowflake':
          'ALTER TABLE "myTable" RENAME COLUMN "oldName" TO "newName";',
        oracle: 'ALTER TABLE "myTable" RENAME COLUMN "oldName" TO "newName"',
      },
    );
  });

  it('escapes both the old and the new column name', () => {
    expectsql(
      () =>
        queryGenerator.renameColumnQuery('myTable', injectedColumn, {
          [injectedNewColumn]: 'INTEGER',
        }),
      {
        'mariadb mysql': 'ALTER TABLE `myTable` CHANGE `my``Col"umn]` `my``Col"umn]X` INTEGER;',
        mssql: "EXEC sp_rename N'[myTable].[my`Col\"umn]]]', N'my`Col\"umn]X', 'COLUMN';",
        'db2 ibmi postgres snowflake':
          'ALTER TABLE "myTable" RENAME COLUMN "my`Col""umn]" TO "my`Col""umn]X";',
        oracle: 'ALTER TABLE "myTable" RENAME COLUMN "my`Col""umn]" TO "my`Col""umn]X"',
      },
    );
  });
});
