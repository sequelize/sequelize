import { AbstractQueryGenerator } from '../abstract/query-generator';
import type { TableNameOrModel } from '../abstract/query-generator-typescript';
import type { TableNameWithSchema } from '../abstract/query-interface';

/**
 * Temporary class to ease the TypeScript migration
 */
export class MySqlQueryGeneratorTypeScript extends AbstractQueryGenerator {
  describeTableQuery(table: TableNameWithSchema) {
    return `SHOW FULL COLUMNS FROM ${this.quoteTable(table)};`;
  }

  showIndexesQuery(tableName: TableNameOrModel) {
    return `SHOW INDEX FROM ${this.quoteTable(tableName)}`;
  }
}
