import type { Falsy } from '../../generic/falsy.js';
import * as BaseTypes from '../abstract/data-types.js';

export class UUID extends BaseTypes.UUID {
  toSql() {
    return 'CHAR(36)';
  }
}

export class BOOLEAN extends BaseTypes.BOOLEAN {
  protected supportsNativeBooleans() {
    const databaseVersion
      = Number.parseFloat(this._getDialect().sequelize.options.databaseVersion || this._getDialect().defaultVersion);

    return databaseVersion >= 7.5;
  }

  escape(value: boolean | Falsy): string {
    return this.supportsNativeBooleans() ? super.escape(value) : value ? '1' : '0';
  }

  toBindableValue(value: boolean | Falsy): unknown {
    return this.supportsNativeBooleans() ? super.toBindableValue(value) : value ? 1 : 0;
  }

  toSql() {
    return this.supportsNativeBooleans() ? super.toSql() : 'SMALLINT';
  }
}

export { STRING, CHAR, TEXT, TINYINT, SMALLINT, MEDIUMINT, INTEGER, BIGINT, FLOAT, DOUBLE, BLOB, DECIMAL, DATE, ENUM } from '../db2/data-types.js';
