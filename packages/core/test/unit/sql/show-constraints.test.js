'use strict';

const Support   = require('../../support');

const current   = Support.sequelize;
const expectsql = Support.expectsql;
const sql = current.dialect.queryGenerator;

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('showConstraint', () => {
    it('naming', () => {
      expectsql(sql.showConstraintsQuery('myTable'), {
        default: `SELECT CONSTRAINT_CATALOG AS constraintCatalog, CONSTRAINT_NAME AS constraintName, CONSTRAINT_SCHEMA AS constraintSchema, CONSTRAINT_TYPE AS constraintType, TABLE_NAME AS tableName, TABLE_SCHEMA AS tableSchema from INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE table_name='myTable';`,
        postgres: 'SELECT constraint_catalog AS "constraintCatalog", constraint_schema AS "constraintSchema", constraint_name AS "constraintName", table_catalog AS "tableCatalog", table_schema AS "tableSchema", table_name AS "tableName", constraint_type AS "constraintType", is_deferrable AS "isDeferrable", initially_deferred AS "initiallyDeferred" from INFORMATION_SCHEMA.table_constraints WHERE table_name=\'myTable\';',
        mssql: 'EXEC sp_helpconstraint @objname = N\'[myTable]\';',
        sqlite: 'SELECT sql FROM sqlite_master WHERE tbl_name=\'myTable\';',
        db2: 'SELECT CONSTNAME AS "constraintName", TRIM(TABSCHEMA) AS "schemaName", TABNAME AS "tableName" FROM SYSCAT.TABCONST WHERE TABNAME = \'myTable\' ORDER BY CONSTNAME;',
        ibmi: 'SELECT CONSTRAINT_NAME AS "constraintName", CONSTRAINT_SCHEMA AS "constraintSchema", CONSTRAINT_TYPE AS "constraintType", TABLE_NAME AS "tableName", TABLE_SCHEMA AS "tableSchema" from QSYS2.SYSCST WHERE table_name=\'myTable\'',
      });
    });

    it('should add constraint_name to where clause if passed in case of mysql', () => {
      expectsql(sql.showConstraintsQuery('myTable', 'myConstraintName'), {
        default: `SELECT CONSTRAINT_CATALOG AS constraintCatalog, CONSTRAINT_NAME AS constraintName, CONSTRAINT_SCHEMA AS constraintSchema, CONSTRAINT_TYPE AS constraintType, TABLE_NAME AS tableName, TABLE_SCHEMA AS tableSchema from INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE table_name='myTable' AND constraint_name = 'myConstraintName';`,
        postgres: 'SELECT constraint_catalog AS "constraintCatalog", constraint_schema AS "constraintSchema", constraint_name AS "constraintName", table_catalog AS "tableCatalog", table_schema AS "tableSchema", table_name AS "tableName", constraint_type AS "constraintType", is_deferrable AS "isDeferrable", initially_deferred AS "initiallyDeferred" from INFORMATION_SCHEMA.table_constraints WHERE table_name=\'myTable\';',
        mssql: 'EXEC sp_helpconstraint @objname = N\'[myTable]\';',
        sqlite: 'SELECT sql FROM sqlite_master WHERE tbl_name=\'myTable\' AND sql LIKE \'%myConstraintName%\';',
        db2: 'SELECT CONSTNAME AS "constraintName", TRIM(TABSCHEMA) AS "schemaName", TABNAME AS "tableName" FROM SYSCAT.TABCONST WHERE TABNAME = \'myTable\' AND CONSTNAME LIKE \'%myConstraintName%\' ORDER BY CONSTNAME;',
        ibmi: 'SELECT CONSTRAINT_NAME AS "constraintName", CONSTRAINT_SCHEMA AS "constraintSchema", CONSTRAINT_TYPE AS "constraintType", TABLE_NAME AS "tableName", TABLE_SCHEMA AS "tableSchema" from QSYS2.SYSCST WHERE table_name=\'myTable\' AND CONSTRAINT_NAME = \'myConstraintName\'',
      });
    });
  });
});
