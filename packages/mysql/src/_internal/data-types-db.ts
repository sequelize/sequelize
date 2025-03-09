import { isValidTimeZone } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/dayjs.js';
import dayjs from 'dayjs';
import type { TypeCastField } from 'mysql2';
import wkx from 'wkx';
import type { MySqlDialect } from '../dialect.js';

/**
 * First pass of DB value parsing: Parses based on the MySQL Type ID.
 * If a Sequelize DataType is specified, the value is then passed to {@link DataTypes.ABSTRACT#parseDatabaseValue}.
 *
 * @param dialect
 */
export function registerMySqlDbDataTypeParsers(dialect: MySqlDialect) {
  /*
   * @see buffer_type here https://dev.mysql.com/doc/refman/5.7/en/c-api-prepared-statement-type-codes.html
   * @see hex here https://github.com/sidorares/node-mysql2/blob/master/lib/constants/types.js
   */
  dialect.registerDataTypeParser(['DATETIME'], (value: TypeCastField) => {
    const valueStr: string | null = value.string();
    if (valueStr === null) {
      return null;
    }

    const timeZone: string = dialect.sequelize.options.timezone;
    if (timeZone === '+00:00') {
      // default value
      // mysql returns a UTC date string that looks like the following:
      // 2022-01-01 00:00:00
      // The above does not specify a time zone offset, so Date.parse will try to parse it as a local time.
      // Adding +00 fixes this.
      return `${valueStr}+00`;
    }

    if (isValidTimeZone(timeZone)) {
      return dayjs.tz(valueStr, timeZone).toISOString();
    }

    // offset format, we can just append.
    // "2022-09-22 20:03:06" with timeZone "-04:00"
    // becomes "2022-09-22 20:03:06-04:00"
    return valueStr + timeZone;
  });

  // dateonly
  dialect.registerDataTypeParser(['DATE'], (value: TypeCastField) => {
    return value.string();
  });

  // bigint
  dialect.registerDataTypeParser(['LONGLONG'], (value: TypeCastField) => {
    return value.string();
  });

  dialect.registerDataTypeParser(['GEOMETRY'], (value: TypeCastField) => {
    let buffer = value.buffer();
    // Empty buffer, MySQL doesn't support POINT EMPTY
    // check, https://dev.mysql.com/worklog/task/?id=2381
    if (!buffer || buffer.length === 0) {
      return null;
    }

    // For some reason, discard the first 4 bytes
    buffer = buffer.subarray(4);

    return wkx.Geometry.parse(buffer).toGeoJSON({ shortCrs: true });
  });
}
