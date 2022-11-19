import { AbstractQueryGenerator } from '../abstract/query-generator';
import type { TableNameWithSchema } from '../abstract/query-interface';

/**
 * Temporary class to ease the TypeScript migration
 */
export class MySqlQueryGeneratorTypeScript extends AbstractQueryGenerator {
  describeTableQuery(table: TableNameWithSchema) {
    return `SHOW FULL COLUMNS FROM ${this.quoteTable(table)};`;
  }

  showIndexesQuery(table: TableNameWithSchema) {
    return `SHOW INDEX FROM ${this.quoteTable(table)}`;
  }
}
