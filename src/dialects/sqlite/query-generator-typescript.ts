import type { TableNameOrModel } from '../abstract/query-generator-typescript';
import type { TableNameWithSchema } from '../abstract/query-interface';
import { MySqlQueryGenerator } from '../mysql/query-generator';

/**
 * Temporary class to ease the TypeScript migration
 */
export class SqliteQueryGeneratorTypeScript extends MySqlQueryGenerator {
  describeTableQuery(table: TableNameWithSchema) {
    return `PRAGMA TABLE_INFO(${this.quoteTable(table)});`;
  }

  showIndexesQuery(tableName: TableNameOrModel) {
    const table = this.extractTableDetails(tableName);

    return `PRAGMA INDEX_LIST(${this.quoteTable(table)})`;
  }
}
