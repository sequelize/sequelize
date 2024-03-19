import type { Sequelize } from '@sequelize/core';
import type { PostgresDialectOptions } from './dialect.js';
import { PostgresDialect } from './dialect.js';
export declare class PostgresAdapter {
    #private;
    constructor(options?: PostgresDialectOptions | undefined);
    getDialect(sequelize: Sequelize): PostgresDialect;
}
