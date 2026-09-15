import { getDataTypeParser } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types-utils.js';
import * as BaseTypes from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import type { HanaDialect } from '../dialect.js';

/**
 * First pass of DB value parsing: Parses based on the HANA Type ID.
 * If a Sequelize DataType is specified, the value is then passed to {@link DataTypes.ABSTRACT#parseDatabaseValue}.
 *
 * @param dialect
 */
export function registerHanaDbDataTypeParsers(dialect: HanaDialect) {
  // LONGDATE is a synonym of TIMESTAMP. ResultSet.getColumnInfo() returns LONGDATE, not TIMESTAMP.
  dialect.registerDataTypeParser(['LONGDATE'], (value: unknown) => {
    // values are returned as UTC, but the UTC Offset is left unspecified.
    return `${value}+00`;
  });

  const parseBigInt = getDataTypeParser(dialect, BaseTypes.BIGINT);
  dialect.registerDataTypeParser(['BIGINT'], parseBigInt);
}
