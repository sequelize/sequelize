import dayjs from 'dayjs';
import wkx from 'wkx';
import type { MySqlTypeCastValue } from './connection-manager.js';
import type { MysqlDialect } from './index.js';
import { isValidTimeZone } from '../../utils/dayjs.js';
import type { MariaDbDialect } from '../mariadb/index.js';

/**
 * First pass of DB value parsing: Parses based on the MySQL Type ID.
 * If a Sequelize DataType is specified, the value is then passed to {@link AbstractDataType#parseDatabaseValue}.
 *
 * @param dialect
 */
export function registerMySqlDbDataTypeParsers(dialect: MysqlDialect | MariaDbDialect) {
  /*
  * @see buffer_type here https://dev.mysql.com/doc/refman/5.7/en/c-api-prepared-statement-type-codes.html
  * @see hex here https://github.com/sidorares/node-mysql2/blob/master/lib/constants/types.js
  */
  dialect.registerDataTypeParser(['DATETIME'], (value: MySqlTypeCastValue) => {
    const valueStr = value.string();
    if (valueStr === null) {
      return null;
    }

    const timeZone = dialect.sequelize.options.timezone;
    if (timeZone === '+00:00') { // default value
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
  dialect.registerDataTypeParser(['DATE'], (value: MySqlTypeCastValue) => {
    return value.string();
  });

  // bigint
  dialect.registerDataTypeParser(['LONGLONG'], (value: MySqlTypeCastValue) => {
    return value.string();
  });

  dialect.registerDataTypeParser(['GEOMETRY'], (value: MySqlTypeCastValue) => {
    let buffer = value.buffer();
    // Empty buffer, MySQL doesn't support POINT EMPTY
    // check, https://dev.mysql.com/worklog/task/?id=2381
    if (!buffer || buffer.length === 0) {
      return null;
    }

    // For some reason, discard the first 4 bytes
    buffer = buffer.slice(4);

    return wkx.Geometry.parse(buffer).toGeoJSON({ shortCrs: true });
  });
}
