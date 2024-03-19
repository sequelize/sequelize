import { AbstractQueryGeneratorInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/query-generator-internal.js';
import type { AddLimitOffsetOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/query-generator.internal-types.js';
import type { PostgresDialect } from './dialect.js';
export declare class PostgresQueryGeneratorInternal<Dialect extends PostgresDialect = PostgresDialect> extends AbstractQueryGeneratorInternal<Dialect> {
    getTechnicalDatabaseNames(): readonly string[];
    getTechnicalSchemaNames(): readonly string[];
    addLimitAndOffset(options: AddLimitOffsetOptions): string;
}
