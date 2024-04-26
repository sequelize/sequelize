import type { HanaDialect } from '../dialect.js';

/**
 * First pass of DB value parsing: Parses based on the HANA Type ID.
 * If a Sequelize DataType is specified, the value is then passed to {@link DataTypes.ABSTRACT#parseDatabaseValue}.
 *
 * @param dialect
 */
export function registerHanaDbDataTypeParsers(dialect: HanaDialect) {
  //todo dazhuang
}
