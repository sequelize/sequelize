import { isValidTimeZone } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/dayjs.js';
import dayjs from 'dayjs';
import type { FieldInfo } from 'mariadb';
import type { MariaDbDialect } from '../dialect.js';

/**
 * First pass of DB value parsing: Parses based on the MariaDB Type ID.
 * If a Sequelize DataType is specified, the value is then passed to {@link DataTypes.ABSTRACT#parseDatabaseValue}.
 *
 * @param dialect
 */
export function registerMariaDbDbDataTypeParsers(dialect: MariaDbDialect) {
  dialect.registerDataTypeParser(['DATETIME'], (value: FieldInfo) => {
    const valueStr: string | null = value.string();
    if (valueStr === null) {
      return null;
    }

    const timeZone: string = dialect.sequelize.options.timezone;
    if (timeZone === '+00:00') {
      // default value
      // mariadb returns a UTC date string that looks like the following:
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
  dialect.registerDataTypeParser(['DATE'], (value: FieldInfo) => {
    return value.string();
  });

  // bigint
  dialect.registerDataTypeParser(['LONGLONG'], (value: FieldInfo) => {
    return value.string();
  });

  dialect.registerDataTypeParser(['GEOMETRY'], (value: FieldInfo) => {
    return value.geometry();
  });

  // For backwards compatibility, we currently return BIGINTs as strings. We will implement bigint support for all
  // dialects in the future: https://github.com/sequelize/sequelize/issues/10468
  dialect.registerDataTypeParser(['BIGINT'], (value: FieldInfo) => {
    return value.string();
  });
}
