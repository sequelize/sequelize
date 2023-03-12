import { rejectInvalidOptions } from '../../utils/check';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { generateIndexName } from '../../utils/string';
import { REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS } from '../abstract/query-generator-typescript';
import type { RemoveIndexQueryOptions, TableNameOrModel } from '../abstract/query-generator-typescript';
import { MySqlQueryGenerator } from '../mysql/query-generator';

const REMOVE_INDEX_QUERY_SUPPORTED_OPTIONS = new Set<keyof RemoveIndexQueryOptions>(['ifExists']);

/**
 * Temporary class to ease the TypeScript migration
 */
export class SqliteQueryGeneratorTypeScript extends MySqlQueryGenerator {
  describeTableQuery(tableName: TableNameOrModel) {
    return `PRAGMA TABLE_INFO(${this.quoteTable(tableName)})`;
  }

  showIndexesQuery(tableName: TableNameOrModel) {
    return `PRAGMA INDEX_LIST(${this.quoteTable(tableName)})`;
  }

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

    let indexName: string;
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
    ]);
  }

  getForeignKeyQuery(tableName: TableNameOrModel, columnName?: string) {
    if (columnName) {
      throw new Error(`Providing a columnName in getForeignKeyQuery is not supported by ${this.dialect.name}.`);
    }

    const quotedTable = this.quoteTable(tableName);

    return joinSQLFragments([
      'SELECT id as `constraintName`,',
      `${quotedTable} as \`tableName\`,`,
      'pragma.`from` AS `columnName`,',
      'pragma.`table` AS `referencedTableName`,',
      'pragma.`to` AS `referencedColumnName`',
      `FROM pragma_foreign_key_list(${quotedTable}) AS pragma;`,
    ]);
  }
}
