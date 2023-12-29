import type { Falsy } from '../../generic/falsy.js';
import * as BaseTypes from '../abstract/data-types.js';

export class UUID extends BaseTypes.UUID {
  toSql() {
    return 'CHAR(36)';
  }
}

export class BOOLEAN extends BaseTypes.BOOLEAN {
  escape(value: boolean | Falsy): string {
    return this._getDialect().sequelize.options.databaseVersion?.startsWith('7.5') ? super.escape(value) : value ? '1' : '0';
  }

  toBindableValue(value: boolean | Falsy): unknown {
    return this._getDialect().sequelize.options.databaseVersion?.startsWith('7.5') ? super.toBindableValue(value) : value ? 1 : 0;
  }

  toSql() {
    return this._getDialect().sequelize.options.databaseVersion?.startsWith('7.5') ? super.toSql() : 'SMALLINT';
  }
}

export { STRING, CHAR, TEXT, TINYINT, SMALLINT, MEDIUMINT, INTEGER, BIGINT, FLOAT, DOUBLE, BLOB, DECIMAL, DATE, ENUM } from '../db2/data-types.js';
