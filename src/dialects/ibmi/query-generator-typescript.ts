import { noSchemaParameter } from '../../utils/deprecations';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { AbstractQueryGenerator } from '../abstract/query-generator';
import type { TableName } from '../abstract/query-interface';

/**
 * Temporary class to ease the TypeScript migration
 */
export class IBMiQueryGeneratorTypeScript extends AbstractQueryGenerator {
  // TODO [>7]: remove schema and schemaDelimiter parameter
  describeTableQuery(tableName: TableName, schema?: string) {
    const table = this.extractTableDetails(tableName);

    if (schema) {
      noSchemaParameter();
      table.schema = schema;
    }

    return joinSQLFragments([
      'SELECT',
      'QSYS2.SYSCOLUMNS.*,',
      'QSYS2.SYSCST.CONSTRAINT_NAME,',
      'QSYS2.SYSCST.CONSTRAINT_TYPE',
      'FROM QSYS2.SYSCOLUMNS',
      'LEFT OUTER JOIN QSYS2.SYSCSTCOL',
      'ON QSYS2.SYSCOLUMNS.TABLE_SCHEMA = QSYS2.SYSCSTCOL.TABLE_SCHEMA',
      'AND QSYS2.SYSCOLUMNS.TABLE_NAME = QSYS2.SYSCSTCOL.TABLE_NAME',
      'AND QSYS2.SYSCOLUMNS.COLUMN_NAME = QSYS2.SYSCSTCOL.COLUMN_NAME',
      'LEFT JOIN QSYS2.SYSCST',
      'ON QSYS2.SYSCSTCOL.CONSTRAINT_NAME = QSYS2.SYSCST.CONSTRAINT_NAME',
      'WHERE QSYS2.SYSCOLUMNS.TABLE_SCHEMA =',
      table.schema !== this.dialect.getDefaultSchema() ? `${this.escape(table.schema)}` : 'CURRENT SCHEMA',
      'AND QSYS2.SYSCOLUMNS.TABLE_NAME =',
      `${this.escape(table.tableName)}`,
    ]);
  }
}
