import { AbstractQueryGenerator } from '../abstract/query-generator';
import type { TableNameWithSchema } from '../abstract/query-interface';

/**
 * Temporary class to ease the TypeScript migration
 */
export class SnowflakeQueryGeneratorTypeScript extends AbstractQueryGenerator {
  describeTableQuery(table: TableNameWithSchema) {
    return `SHOW FULL COLUMNS FROM ${this.quoteTable(table)};`;
  }

  showIndexesQuery() {
    // TODO [+snowflake-sdk]: check if this is the correct implementation
    return `SELECT '' FROM DUAL`;
  }
}
