import { rejectInvalidOptions } from '../../utils/check';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { generateIndexName } from '../../utils/string';
import { REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS } from '../abstract/query-generator-typescript';
import type { RemoveIndexQueryOptions, TableNameOrModel } from '../abstract/query-generator-typescript';
import { MySqlQueryGenerator } from '../mysql/query-generator.js';

const REMOVE_INDEX_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveIndexQueryOptions>(['ifExists']);

/**
 * Temporary class to ease the TypeScript migration
 */
export class MariaDbQueryGeneratorTypeScript extends MySqlQueryGenerator {
  removeIndexQuery(
    tableName: TableNameOrModel,
    indexNameOrAttributes: string | string[],
    options?: RemoveIndexQueryOptions,
  ) {
    if (options) {
      rejectInvalidOptions(
        'removeIndexQuery',
        this.dialect.name,
        REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS,
        REMOVE_INDEX_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    let indexName;
    if (Array.isArray(indexNameOrAttributes)) {
      const table = this.extractTableDetails(tableName);
      indexName = generateIndexName(table, { fields: indexNameOrAttributes });
    } else {
      indexName = indexNameOrAttributes;
    }

    return joinSQLFragments([
      'DROP INDEX',
      options?.ifExists ? 'IF EXISTS' : '',
      this.quoteIdentifier(indexName),
      'ON',
      this.quoteTable(tableName),
    ]);
  }

  jsonPathExtractionQuery(sqlExpression: string, path: ReadonlyArray<number | string>, unquote: boolean): string {
    const sql = super.jsonPathExtractionQuery(sqlExpression, path, unquote);

    if (unquote) {
      return sql;
    }

    // MariaDB has a very annoying behavior with json_extract: It returns the JSON value as a proper JSON string (e.g. "true" or "null" instead true or null)
    // Except if the value is going to be used in a comparison, in which case it unquotes it automatically (even if we did not call JSON_UNQUOTE).
    // This is a problem because it makes it impossible to distinguish between a JSON text "true" and a JSON boolean true.
    // This useless function call is here to make mariadb not think the value will be used in a comparison, and thus not unquote it.
    // We could replace it with a custom function that does nothing, but this would require a custom function to be created on the database ahead of time.
    return `json_compact(${sql})`;
  }
}
