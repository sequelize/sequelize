import { noSchemaParameter, noSchemaDelimiterParameter } from '../../utils/deprecations';
import type { TableName } from '../abstract/query-interface';
import { MySqlQueryGenerator } from '../mysql/query-generator';

/**
 * Temporary class to ease the TypeScript migration
 */
export class SqliteQueryGeneratorTypeScript extends MySqlQueryGenerator {
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

    return `PRAGMA TABLE_INFO(${this.quoteTable(table)});`;
  }

  showIndexesQuery(tableName: TableName) {
    return `PRAGMA INDEX_LIST(${this.quoteTable(tableName)})`;
  }
}
