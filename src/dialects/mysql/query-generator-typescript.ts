import { rejectInvalidOptions } from '../../utils/check';
import { generateIndexName } from '../../utils/string';
import { AbstractQueryGenerator } from '../abstract/query-generator';
import { REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS } from '../abstract/query-generator-typescript';
import type { RemoveIndexQueryOptions, TableNameOrModel } from '../abstract/query-generator-typescript';

/**
 * Temporary class to ease the TypeScript migration
 */
export class MySqlQueryGeneratorTypeScript extends AbstractQueryGenerator {
  describeTableQuery(tableName: TableNameOrModel) {
    return `SHOW FULL COLUMNS FROM ${this.quoteTable(tableName)};`;
  }

  showIndexesQuery(tableName: TableNameOrModel) {
    return `SHOW INDEX FROM ${this.quoteTable(tableName)}`;
  }

  removeIndexQuery(tableName: TableNameOrModel, indexNameOrAttributes: string | string[], options: RemoveIndexQueryOptions) {
    if (options) {
      rejectInvalidOptions(
        'removeIndexQuery',
        this.dialect.name,
        REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS,
        new Set(),
        options,
      );
    }

    let indexName: string;
    if (Array.isArray(indexNameOrAttributes)) {
      const table = this.extractTableDetails(tableName);
      indexName = generateIndexName(table, { fields: indexNameOrAttributes });
    } else {
      indexName = indexNameOrAttributes;
    }

    return `DROP INDEX ${this.quoteIdentifier(indexName)} ON ${this.quoteTable(tableName)}`;
  }
}
