import type { Falsy } from '../../generic/falsy.js';
import * as BaseTypes from '../abstract/data-types.js';

export class UUID extends BaseTypes.UUID {
  toSql() {
    return 'CHAR(36)';
  }
}

export class BOOLEAN extends BaseTypes.BOOLEAN {
  escape(value: boolean | Falsy): string {
    return value ? '1' : '0';
  }

  toBindableValue(value: boolean | Falsy): unknown {
    return value ? 1 : 0;
  }

  toSql() {
    return 'SMALLINT';
  }
}

export {
  BIGINT,
  BLOB,
  CHAR,
  DATE,
  DECIMAL,
  DOUBLE,
  ENUM,
  FLOAT,
  INTEGER,
  MEDIUMINT,
  SMALLINT,
  STRING,
  TEXT,
  TINYINT,
} from '../db2/data-types.js';
