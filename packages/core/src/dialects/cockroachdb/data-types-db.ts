import assert from 'node:assert';
import wkx from 'wkx';
import * as BaseTypes from '../abstract/data-types';
import { getDataTypeParser } from '../abstract/data-types-utils';
import { buildRangeParser } from '../postgres/range';
import type { CockroachDbDialect } from './index';

export function registerCockroachDbDataTypeParsers(dialect: CockroachDbDialect) {
  // dateonly
  dialect.registerDataTypeParser(['date'], (value: unknown) => {
    return value;
  });

  dialect.registerDataTypeParser(['timestamptz', 'timestamp'], (value: unknown) => {
    // override default parser to prevent returning a Date object (which is the default behavior in pg).
    // return dates as string, not Date objects. Different implementations could be used instead (such as Temporal, dayjs)
    return value;
  });

  dialect.registerDataTypeParser(['decimal', 'numeric'], (value: string) => {
    if (value === null) {
      return null;
    }

    if (value === 'NaN') {
      return Number.NaN;
    }

    return value;
  });

  /**
   * Cockroachdb's ALIAS for INTEGER and BIGINT defaults to int(64-bit value). So while retreiving the values from the database both values are
   * returned as int8. While parsing them we cannot be sure if the expected behavior is of INTEGER or BIGINT so we make sure if the number is
   * < than Number.MAX_SAFE_INTEGER --> Parse it as a number
   * > than Number.MAX_SAFE_INTEGER --> Parse it as a string
   * Note: Storing INTEGERS as INT4 and BIGINT as int8 would result in an anti-pattern since Cockroachdb uses unique_row_id() to generate a unique ID for
   * each row by default to ensure global uniqueness, reseliency and consistency.
   */
  dialect.registerDataTypeParser(['int8'], (value: string) => {
    if (value === null) {
      return null;
    }

    const parsedValue = BigInt(value);

    if (parsedValue > Number.MAX_SAFE_INTEGER || parsedValue < Number.MIN_SAFE_INTEGER) {
      return String(value);
    } else if (Number(value) >= Number.MIN_SAFE_INTEGER) {
      return Number(value);
    }

    return String(value);

  });

  dialect.registerDataTypeParser(['geography'], (value: unknown) => {
    assert(typeof value === 'string', 'Expected geography value to be a string');

    const b = Buffer.from(value, 'hex');

    return wkx.Geometry.parse(b).toGeoJSON({ shortCrs: true });
  });

  dialect.registerDataTypeParser(['geometry'], (value: unknown) => {
    assert(typeof value === 'string', 'Expected geometry value to be a string');

    const b = Buffer.from(value, 'hex');

    return wkx.Geometry.parse(b).toGeoJSON({ shortCrs: true });
  });

  const parseInteger = getDataTypeParser(dialect, BaseTypes.INTEGER);
  dialect.registerDataTypeParser(['int4range'], buildRangeParser(parseInteger));

  const parseBigInt = getDataTypeParser(dialect, BaseTypes.BIGINT);
  dialect.registerDataTypeParser(['int8range'], buildRangeParser(parseBigInt));

  const parseDecimal = getDataTypeParser(dialect, BaseTypes.DECIMAL);
  dialect.registerDataTypeParser(['numrange'], buildRangeParser(parseDecimal));
}
