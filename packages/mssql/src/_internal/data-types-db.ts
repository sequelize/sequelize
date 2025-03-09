import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import type { MsSqlDialect } from '../dialect.js';

dayjs.extend(utc);

/**
 * First pass of DB value parsing: Parses based on the MSSQL Type ID.
 * If a Sequelize DataType is specified, the value is then passed to {@link DataTypes.ABSTRACT#parseDatabaseValue}.
 *
 * @param dialect
 */
export function registerMsSqlDbDataTypeParsers(dialect: MsSqlDialect) {
  dialect.registerDataTypeParser(['GUIDN'], (value: unknown) => {
    if (typeof value !== 'string') {
      return value;
    }

    // unify with other dialects by forcing lowercase on UUID strings.
    return value.toLowerCase();
  });

  dialect.registerDataTypeParser(['TIMEN'], (value: unknown) => {
    if (value instanceof Date) {
      // We lose precision past the millisecond because Tedious pre-parses the value.
      // This could be fixed by https://github.com/tediousjs/tedious/issues/678
      return dayjs.utc(value).format('HH:mm:ss.SSS');
    }

    return value;
  });

  dialect.registerDataTypeParser(['DATETIMEOFFSETN'], (value: unknown) => {
    if (value instanceof Date) {
      // Tedious pre-parses the value as a Date, but we want
      // to provide a string in raw queries and let the user decide on which date library to use.
      // As a result, Tedious parses the date, then we serialize it, then our Date data type parses it again.
      // This is inefficient but could be fixed by https://github.com/tediousjs/tedious/issues/678
      // We also lose precision past the millisecond because Tedious pre-parses the value.
      return dayjs.utc(value).format('YYYY-MM-DD HH:mm:ss.SSS+00');
    }

    return value;
  });

  dialect.registerDataTypeParser(['DATEN'], (value: unknown) => {
    if (value instanceof Date) {
      return dayjs.utc(value).format('YYYY-MM-DD');
    }

    return value;
  });

  dialect.registerDataTypeParser(['DECIMAL', 'DECIMALN'], (value: unknown) => {
    // Tedious returns DECIMAL as a JS number, which is not an appropriate type for a decimal.
    return String(value);
  });
}
