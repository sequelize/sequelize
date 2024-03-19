/// <reference types="node" />
import type { Sequelize } from '@sequelize/core';
import { AbstractDialect } from '@sequelize/core';
import { PostgresConnectionManager } from './connection-manager.js';
import { PostgresQueryGenerator } from './query-generator.js';
import { PostgresQueryInterface } from './query-interface.js';
import { PostgresQuery } from './query.js';
export interface PostgresDialectOptions {
    /**
     * Defines whether the native library shall be used or not.
     * If true, you need to have `pg-native` installed.
     *
     * @default false
     */
    native?: boolean;
}
export declare class PostgresDialect extends AbstractDialect {
    static readonly supports: import("packages/core/lib/dialects/abstract/index.js").DialectSupports;
    readonly connectionManager: PostgresConnectionManager;
    readonly queryGenerator: PostgresQueryGenerator;
    readonly queryInterface: PostgresQueryInterface;
    readonly Query: typeof PostgresQuery;
    readonly dataTypesDocumentationUrl = "https://www.postgresql.org/docs/current/datatype.html";
    readonly defaultVersion = "11.0.0";
    readonly TICK_CHAR_LEFT = "\"";
    readonly TICK_CHAR_RIGHT = "\"";
    readonly options: PostgresDialectOptions;
    constructor(sequelize: Sequelize, options?: PostgresDialectOptions | undefined);
    createBindCollector(): import("packages/core/lib/dialects/abstract/index.js").BindCollector;
    escapeBuffer(buffer: Buffer): string;
    escapeString(value: string): string;
    canBackslashEscape(): boolean;
    getDefaultSchema(): string;
    static getDefaultPort(): number;
}
