import { AbstractQueryGenerator } from '../abstract/query-generator';
import type { TableName, TableNameWithSchema } from '../abstract/query-interface';

/**
 * Temporary class to ease the TypeScript migration
 */
export class MySqlQueryGeneratorTypeScript extends AbstractQueryGenerator {
  describeTableQuery(table: TableNameWithSchema) {
    return `SHOW FULL COLUMNS FROM ${this.quoteTable(table)};`;
  }

  showIndexesQuery(tableName: TableName) {
    return `SHOW INDEX FROM ${this.quoteTable(tableName)}`;
  }
}
