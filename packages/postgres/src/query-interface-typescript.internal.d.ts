import type { FetchDatabaseVersionOptions } from '@sequelize/core';
import { AbstractQueryInterface } from '@sequelize/core';
import { AbstractQueryInterfaceInternal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/abstract/query-interface-internal.js';
import type { PostgresDialect } from './dialect.js';
export declare class PostgresQueryInterfaceTypescript<Dialect extends PostgresDialect = PostgresDialect> extends AbstractQueryInterface<Dialect> {
    #private;
    constructor(dialect: Dialect, internalQueryInterface?: AbstractQueryInterfaceInternal);
    fetchDatabaseVersion(options?: FetchDatabaseVersionOptions): Promise<string>;
}
