import type { CreateDatabaseQueryOptions, ListDatabasesQueryOptions, ListSchemasQueryOptions, ListTablesQueryOptions, RemoveIndexQueryOptions, RenameTableQueryOptions, ShowConstraintsQueryOptions, TableOrModel, TruncateTableQueryOptions } from '@sequelize/core';
import { AbstractQueryGenerator } from '@sequelize/core';
import type { EscapeOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/query-generator-typescript.js';
import type { Expression } from '@sequelize/core/_non-semver-use-at-your-own-risk_/sequelize.js';
import type { PostgresDialect } from './dialect.js';
import { PostgresQueryGeneratorInternal } from './query-generator.internal.js';
/**
 * Temporary class to ease the TypeScript migration
 */
export declare class PostgresQueryGeneratorTypeScript extends AbstractQueryGenerator {
    #private;
    constructor(dialect: PostgresDialect, internals?: PostgresQueryGeneratorInternal);
    listDatabasesQuery(options?: ListDatabasesQueryOptions): string;
    createDatabaseQuery(database: string, options?: CreateDatabaseQueryOptions): string;
    listSchemasQuery(options?: ListSchemasQueryOptions): string;
    describeTableQuery(tableName: TableOrModel): string;
    listTablesQuery(options?: ListTablesQueryOptions): string;
    renameTableQuery(beforeTableName: TableOrModel, afterTableName: TableOrModel, options?: RenameTableQueryOptions): string;
    truncateTableQuery(tableName: TableOrModel, options?: TruncateTableQueryOptions): string;
    showConstraintsQuery(tableName: TableOrModel, options?: ShowConstraintsQueryOptions): string;
    showIndexesQuery(tableName: TableOrModel): string;
    removeIndexQuery(tableName: TableOrModel, indexNameOrAttributes: string | string[], options?: RemoveIndexQueryOptions): string;
    jsonPathExtractionQuery(sqlExpression: string, path: ReadonlyArray<number | string>, unquote: boolean): string;
    formatUnquoteJson(arg: Expression, options?: EscapeOptions): string;
    getUuidV1FunctionCall(): string;
    getUuidV4FunctionCall(): string;
    versionQuery(): string;
}
