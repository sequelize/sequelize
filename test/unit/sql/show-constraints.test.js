'use strict';

const Support   = require(__dirname + '/../support');
const current   = Support.sequelize;
const expectsql = Support.expectsql;
const sql = current.dialect.QueryGenerator;

describe(Support.getTestDialectTeaser('SQL'), () => {
  describe('showConstraint', () => {
    it('naming', () => {
      expectsql(sql.showConstraintsQuery('myTable'), {
        mssql: "EXEC sp_helpconstraint @objname = N'[myTable]';",
        postgres: 'SELECT constraint_catalog AS "constraintCatalog", constraint_schema AS "constraintSchema", constraint_name AS "constraintName", table_catalog AS "tableCatalog", table_schema AS "tableSchema", table_name AS "tableName", constraint_type AS "constraintType", is_deferrable AS "isDeferrable", initially_deferred AS "initiallyDeferred" from INFORMATION_SCHEMA.table_constraints WHERE table_name=\'myTable\';',
        mysql: "SELECT CONSTRAINT_CATALOG AS constraintCatalog, CONSTRAINT_NAME AS constraintName, CONSTRAINT_SCHEMA AS constraintSchema, CONSTRAINT_TYPE AS constraintType, TABLE_NAME AS tableName, TABLE_SCHEMA AS tableSchema from INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE table_name='myTable';",
        default: "SELECT sql FROM sqlite_master WHERE tbl_name='myTable';"
      });
    });

    it('should add constraint_name to where clause if passed in case of mysql', () => {
      expectsql(sql.showConstraintsQuery('myTable', 'myConstraintName'), {
        mssql: "EXEC sp_helpconstraint @objname = N'[myTable]';",
        postgres: 'SELECT constraint_catalog AS "constraintCatalog", constraint_schema AS "constraintSchema", constraint_name AS "constraintName", table_catalog AS "tableCatalog", table_schema AS "tableSchema", table_name AS "tableName", constraint_type AS "constraintType", is_deferrable AS "isDeferrable", initially_deferred AS "initiallyDeferred" from INFORMATION_SCHEMA.table_constraints WHERE table_name=\'myTable\';',
        mysql: "SELECT CONSTRAINT_CATALOG AS constraintCatalog, CONSTRAINT_NAME AS constraintName, CONSTRAINT_SCHEMA AS constraintSchema, CONSTRAINT_TYPE AS constraintType, TABLE_NAME AS tableName, TABLE_SCHEMA AS tableSchema from INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE table_name='myTable' AND constraint_name = 'myConstraintName';",
        default: "SELECT sql FROM sqlite_master WHERE tbl_name='myTable' AND sql LIKE '%myConstraintName%';"
      });
    });
  });
});
