import type { Connection, ConnectionOptions } from '@sequelize/core';
import { AbstractConnectionManager } from '@sequelize/core';
import * as Pg from 'pg';
import type { TypeId, TypeParser } from 'pg-types';
import type { PostgresDialect } from './dialect.js';
type TypeFormat = 'text' | 'binary';
export interface PostgresConnection extends Connection, Pg.Client {
    _invalid?: boolean;
    standard_conforming_strings?: boolean;
    _ending?: boolean;
}
export declare class PostgresConnectionManager extends AbstractConnectionManager<PostgresDialect, PostgresConnection> {
    #private;
    constructor(dialect: PostgresDialect);
    connect(config: ConnectionOptions): Promise<PostgresConnection>;
    disconnect(connection: PostgresConnection): Promise<void>;
    validate(connection: PostgresConnection): boolean;
    getTypeParser(oid: TypeId, format?: TypeFormat): TypeParser<any, any>;
    /**
     * Refreshes the local registry of Custom Types (e.g. enum) OIDs
     */
    refreshDynamicOids(): Promise<void>;
}
export {};
