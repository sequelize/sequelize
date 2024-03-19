import type { PostgresDialect } from '../dialect.js';
/**
 * First pass of DB value parsing: Parses based on the Postgres Type ID.
 * If a Sequelize DataType is specified, the value is then passed to {@link DataTypes.ABSTRACT#parseDatabaseValue}.
 *
 * @param dialect
 */
export declare function registerPostgresDbDataTypeParsers(dialect: PostgresDialect): void;
