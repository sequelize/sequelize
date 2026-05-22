import { getDataTypeParser } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types-utils.js';
import * as BaseTypes from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import identity from 'lodash/identity';
import assert from 'node:assert';
import wkx from 'wkx';
import type { PostgresDialect } from '../dialect.js';
import { parseHstore } from './hstore.js';
import { buildRangeParser } from './range.js';

/**
 * First pass of DB value parsing: Parses based on the Postgres Type ID.
 * If a Sequelize DataType is specified, the value is then passed to {@link DataTypes.ABSTRACT#parseDatabaseValue}.
 *
 * @param dialect
 */
export function registerPostgresDbDataTypeParsers(dialect: PostgresDialect) {
  // types & OIDs listed here https://github.com/lib/pq/blob/master/oid/types.go
  // range & enum are also supported, but use a special path as they are custom types

  // dateonly
  dialect.registerDataTypeParser(['date'], (value: unknown) => {
    if (value === 'infinity') {
      return Number.POSITIVE_INFINITY;
    }

    if (value === '-infinity') {
      return Number.NEGATIVE_INFINITY;
    }

    return value;
  });

  dialect.registerDataTypeParser(['timestamptz', 'timestamp'], (value: unknown) => {
    // override default parser to prevent returning a Date object (which is the default behavior in pg).
    // return dates as string, not Date objects. Different implementations could be used instead (such as Temporal, dayjs)
    return value;
  });

  dialect.registerDataTypeParser(['numeric', 'decimal'], (value: unknown) => {
    if (value === 'NaN') {
      return Number.NaN;
    }

    return value;
  });

  // dialect.registerDataTypeParser(['bool'], (value: unknown) => {
  //   return value;
  // });

  dialect.registerDataTypeParser(['geometry'], (value: unknown) => {
    assert(typeof value === 'string', 'Expected geometry value to be a string');

    const b = Buffer.from(value, 'hex');

    return wkx.Geometry.parse(b).toGeoJSON({ shortCrs: true });
  });

  dialect.registerDataTypeParser(['geography'], (value: unknown) => {
    assert(typeof value === 'string', 'Expected geography value to be a string');

    const b = Buffer.from(value, 'hex');

    return wkx.Geometry.parse(b).toGeoJSON({ shortCrs: true });
  });

  dialect.registerDataTypeParser(['hstore'], (value: unknown) => {
    assert(typeof value === 'string', 'Expected hstore value to be a string');

    return parseHstore(value);
  });

  const parseInteger = getDataTypeParser(dialect, BaseTypes.INTEGER);
  dialect.registerDataTypeParser(['int4range'], buildRangeParser(parseInteger));

  const parseBigInt = getDataTypeParser(dialect, BaseTypes.BIGINT);
  dialect.registerDataTypeParser(['int8range'], buildRangeParser(parseBigInt));

  const parseDecimal = getDataTypeParser(dialect, BaseTypes.DECIMAL);
  dialect.registerDataTypeParser(['numrange'], buildRangeParser(parseDecimal));

  // the following ranges are returned as an array of strings in raw queries:
  // - datetime with time zone
  // - datetime without time zone
  // - dateonly
  // The Sequelize DataType specified by the user will do further parsing of the arrays of strings (like convert values to Date objects).
  dialect.registerDataTypeParser(['tstzrange', 'tsrange', 'daterange'], buildRangeParser(identity));
}
