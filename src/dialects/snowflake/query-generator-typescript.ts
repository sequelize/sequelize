import { noSchemaParameter, noSchemaDelimiterParameter } from '../../utils/deprecations';
import { AbstractQueryGenerator } from '../abstract/query-generator';
import type { TableName } from '../abstract/query-interface';

/**
 * Temporary class to ease the TypeScript migration
 */
export class SnowflakeQueryGeneratorTypeScript extends AbstractQueryGenerator {
  // TODO [>7]: remove schema and schemaDelimiter parameter
  describeTableQuery(tableName: TableName, schema?: string, schemaDelimiter?: string) {
    const table = this.extractTableDetails(tableName);

    if (schema) {
      noSchemaParameter();
      table.schema = schema;
    }

    if (schemaDelimiter) {
      noSchemaDelimiterParameter();
      table.delimiter = schemaDelimiter;
    }

    return `SHOW FULL COLUMNS FROM ${this.quoteTable(table)};`;
  }

  showIndexesQuery() {
    // TODO [+snowflake-sdk]: check if this is the correct implementation
    return `SELECT '' FROM DUAL`;
  }
}
