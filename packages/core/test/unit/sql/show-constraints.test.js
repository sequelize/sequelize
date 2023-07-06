'use strict';

const Support = require('../../support');

const current = Support.sequelize;
const expectsql = Support.expectsql;
const sql = current.dialect.queryGenerator;

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('showConstraint', () => {
    it('naming', () => {
      expectsql(sql.showConstraintsQuery('myTable'), {
        mssql: 'EXEC sp_helpconstraint @objname = N\'[myTable]\';',
        postgres: 'SELECT constraint_catalog AS "constraintCatalog", constraint_schema AS "constraintSchema", constraint_name AS "constraintName", table_catalog AS "tableCatalog", table_schema AS "tableSchema", table_name AS "tableName", constraint_type AS "constraintType", is_deferrable AS "isDeferrable", initially_deferred AS "initiallyDeferred" from INFORMATION_SCHEMA.table_constraints WHERE table_name=\'myTable\';',
        mariadb: 'SELECT CONSTRAINT_CATALOG AS constraintCatalog, CONSTRAINT_NAME AS constraintName, CONSTRAINT_SCHEMA AS constraintSchema, CONSTRAINT_TYPE AS constraintType, TABLE_NAME AS tableName, TABLE_SCHEMA AS tableSchema from INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE table_name=\'myTable\';',
        mysql: 'SELECT CONSTRAINT_CATALOG AS constraintCatalog, CONSTRAINT_NAME AS constraintName, CONSTRAINT_SCHEMA AS constraintSchema, CONSTRAINT_TYPE AS constraintType, TABLE_NAME AS tableName, TABLE_SCHEMA AS tableSchema from INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE table_name=\'myTable\';',
        db2: 'SELECT CONSTNAME AS "constraintName", TRIM(TABSCHEMA) AS "schemaName", TABNAME AS "tableName" FROM SYSCAT.TABCONST WHERE TABNAME = \'myTable\' ORDER BY CONSTNAME;',
        snowflake: 'SELECT CONSTRAINT_CATALOG AS constraintCatalog, CONSTRAINT_NAME AS constraintName, CONSTRAINT_SCHEMA AS constraintSchema, CONSTRAINT_TYPE AS constraintType, TABLE_NAME AS tableName, TABLE_SCHEMA AS tableSchema from INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE table_name=\'myTable\';',
        ibmi: 'SELECT CONSTRAINT_NAME AS "constraintName", CONSTRAINT_SCHEMA AS "constraintSchema", CONSTRAINT_TYPE AS "constraintType", TABLE_NAME AS "tableName", TABLE_SCHEMA AS "tableSchema" from QSYS2.SYSCST WHERE table_name=\'myTable\'',
        cockroachdb: `SELECT c.constraint_catalog AS "constraintCatalog", c.constraint_schema AS "constraintSchema", c.constraint_name AS "constraintName", c.constraint_type AS "constraintType", c.table_catalog AS "tableCatalog", c.table_schema AS "tableSchema", c.table_name AS "tableName", kcu.column_name AS "columnNames", ccu.table_schema AS "referencedTableSchema", ccu.table_name AS "referencedTableName", ccu.column_name AS "referencedColumnNames", r.delete_rule AS "deleteAction", r.update_rule AS "updateAction", ch.check_clause AS "definition", c.is_deferrable AS "isDeferrable", c.initially_deferred AS "initiallyDeferred" FROM INFORMATION_SCHEMA.table_constraints c LEFT JOIN INFORMATION_SCHEMA.referential_constraints r ON c.constraint_catalog = r.constraint_catalog AND c.constraint_schema = r.constraint_schema AND c.constraint_name = r.constraint_name LEFT JOIN INFORMATION_SCHEMA.key_column_usage kcu ON r.constraint_catalog = kcu.constraint_catalog AND r.constraint_schema = kcu.constraint_schema AND r.constraint_name = kcu.constraint_name LEFT JOIN information_schema.constraint_column_usage AS ccu ON r.constraint_catalog = ccu.constraint_catalog AND r.constraint_schema = ccu.constraint_schema AND r.constraint_name = ccu.constraint_name LEFT JOIN INFORMATION_SCHEMA.check_constraints ch ON c.constraint_catalog = ch.constraint_catalog AND c.constraint_schema = ch.constraint_schema AND c.constraint_name = ch.constraint_name WHERE c.table_name = 'myTable' AND c.table_schema = 'public' ORDER BY c.constraint_name, kcu.ordinal_position`,
        default: 'SELECT sql FROM sqlite_master WHERE tbl_name=\'myTable\';',
      });
    });

    it('should add constraint_name to where clause if passed in case of mysql', () => {
      expectsql(sql.showConstraintsQuery('myTable', 'myConstraintName'), {
        mssql: 'EXEC sp_helpconstraint @objname = N\'[myTable]\';',
        postgres: 'SELECT constraint_catalog AS "constraintCatalog", constraint_schema AS "constraintSchema", constraint_name AS "constraintName", table_catalog AS "tableCatalog", table_schema AS "tableSchema", table_name AS "tableName", constraint_type AS "constraintType", is_deferrable AS "isDeferrable", initially_deferred AS "initiallyDeferred" from INFORMATION_SCHEMA.table_constraints WHERE table_name=\'myTable\';',
        mariadb: 'SELECT CONSTRAINT_CATALOG AS constraintCatalog, CONSTRAINT_NAME AS constraintName, CONSTRAINT_SCHEMA AS constraintSchema, CONSTRAINT_TYPE AS constraintType, TABLE_NAME AS tableName, TABLE_SCHEMA AS tableSchema from INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE table_name=\'myTable\' AND constraint_name = \'myConstraintName\';',
        mysql: 'SELECT CONSTRAINT_CATALOG AS constraintCatalog, CONSTRAINT_NAME AS constraintName, CONSTRAINT_SCHEMA AS constraintSchema, CONSTRAINT_TYPE AS constraintType, TABLE_NAME AS tableName, TABLE_SCHEMA AS tableSchema from INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE table_name=\'myTable\' AND constraint_name = \'myConstraintName\';',
        db2: 'SELECT CONSTNAME AS "constraintName", TRIM(TABSCHEMA) AS "schemaName", TABNAME AS "tableName" FROM SYSCAT.TABCONST WHERE TABNAME = \'myTable\' AND CONSTNAME LIKE \'%myConstraintName%\' ORDER BY CONSTNAME;',
        snowflake: 'SELECT CONSTRAINT_CATALOG AS constraintCatalog, CONSTRAINT_NAME AS constraintName, CONSTRAINT_SCHEMA AS constraintSchema, CONSTRAINT_TYPE AS constraintType, TABLE_NAME AS tableName, TABLE_SCHEMA AS tableSchema from INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE table_name=\'myTable\' AND constraint_name = \'myConstraintName\';',
        ibmi: 'SELECT CONSTRAINT_NAME AS "constraintName", CONSTRAINT_SCHEMA AS "constraintSchema", CONSTRAINT_TYPE AS "constraintType", TABLE_NAME AS "tableName", TABLE_SCHEMA AS "tableSchema" from QSYS2.SYSCST WHERE table_name=\'myTable\' AND CONSTRAINT_NAME = \'myConstraintName\'',
        cockroachdb: `SELECT c.constraint_catalog AS "constraintCatalog", c.constraint_schema AS "constraintSchema", c.constraint_name AS "constraintName", c.constraint_type AS "constraintType", c.table_catalog AS "tableCatalog", c.table_schema AS "tableSchema", c.table_name AS "tableName", kcu.column_name AS "columnNames", ccu.table_schema AS "referencedTableSchema", ccu.table_name AS "referencedTableName", ccu.column_name AS "referencedColumnNames", r.delete_rule AS "deleteAction", r.update_rule AS "updateAction", ch.check_clause AS "definition", c.is_deferrable AS "isDeferrable", c.initially_deferred AS "initiallyDeferred" FROM INFORMATION_SCHEMA.table_constraints c LEFT JOIN INFORMATION_SCHEMA.referential_constraints r ON c.constraint_catalog = r.constraint_catalog AND c.constraint_schema = r.constraint_schema AND c.constraint_name = r.constraint_name LEFT JOIN INFORMATION_SCHEMA.key_column_usage kcu ON r.constraint_catalog = kcu.constraint_catalog AND r.constraint_schema = kcu.constraint_schema AND r.constraint_name = kcu.constraint_name LEFT JOIN information_schema.constraint_column_usage AS ccu ON r.constraint_catalog = ccu.constraint_catalog AND r.constraint_schema = ccu.constraint_schema AND r.constraint_name = ccu.constraint_name LEFT JOIN INFORMATION_SCHEMA.check_constraints ch ON c.constraint_catalog = ch.constraint_catalog AND c.constraint_schema = ch.constraint_schema AND c.constraint_name = ch.constraint_name WHERE c.table_name = 'myTable' AND c.table_schema = 'public' ORDER BY c.constraint_name, kcu.ordinal_position`,
        default: 'SELECT sql FROM sqlite_master WHERE tbl_name=\'myTable\' AND sql LIKE \'%myConstraintName%\';',
      });
    });
  });
});
