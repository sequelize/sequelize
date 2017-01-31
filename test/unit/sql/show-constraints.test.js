'use strict';

/* jshint -W030, -W110 */
const Support   = require(__dirname + '/../support');
const current   = Support.sequelize;
const expectsql = Support.expectsql;
const sql = current.dialect.QueryGenerator;

describe(Support.getTestDialectTeaser('SQL'), function() {
  describe('showConstraint', function() {
    it('naming', function() {
      expectsql(sql.showConstraintsQuery('myTable'), {
        mssql: "EXEC sp_helpconstraint @objname = N'[myTable]';",
        postgres: "SELECT * from INFORMATION_SCHEMA.table_constraints WHERE table_name='myTable';",
        mysql: "SELECT CONSTRAINT_CATALOG AS constraint_catalog, CONSTRAINT_NAME AS constraint_name, CONSTRAINT_SCHEMA AS constraint_schema, CONSTRAINT_TYPE AS constraint_type, TABLE_NAME AS table_name, TABLE_SCHEMA AS table_schema from INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE table_name='myTable';",
        default: "SELECT sql FROM sqlite_master WHERE tbl_name='myTable';"
      });
    });

    it('should add constraint_name to where clause if passed in case of mysql', function() {
      expectsql(sql.showConstraintsQuery('myTable', 'myConstraintName'), {
        mssql: "EXEC sp_helpconstraint @objname = N'[myTable]';",
        postgres: "SELECT * from INFORMATION_SCHEMA.table_constraints WHERE table_name='myTable';",
        mysql: "SELECT CONSTRAINT_CATALOG AS constraint_catalog, CONSTRAINT_NAME AS constraint_name, CONSTRAINT_SCHEMA AS constraint_schema, CONSTRAINT_TYPE AS constraint_type, TABLE_NAME AS table_name, TABLE_SCHEMA AS table_schema from INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE table_name='myTable' AND constraint_name = 'myConstraintName';",
        default: "SELECT sql FROM sqlite_master WHERE tbl_name='myTable' AND sql LIKE '%myConstraintName%';"        
      });      
    });
  });
});