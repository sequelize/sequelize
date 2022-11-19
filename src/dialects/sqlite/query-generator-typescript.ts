import type { TableName, TableNameWithSchema } from '../abstract/query-interface';
import { MySqlQueryGenerator } from '../mysql/query-generator';

/**
 * Temporary class to ease the TypeScript migration
 */
export class SqliteQueryGeneratorTypeScript extends MySqlQueryGenerator {
  describeTableQuery(table: TableNameWithSchema) {
    return `PRAGMA TABLE_INFO(${this.quoteTable(table)});`;
  }

  showIndexesQuery(tableName: TableName) {
    return `PRAGMA INDEX_LIST(${this.quoteTable(tableName)})`;
  }
}
