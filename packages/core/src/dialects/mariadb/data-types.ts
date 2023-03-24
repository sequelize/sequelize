import { GEOMETRY as MySqlGeometry } from '../mysql/data-types.js';

export class GEOMETRY extends MySqlGeometry {
  toSql() {
    const sql = this.options.type?.toUpperCase() || 'GEOMETRY';

    if (this.options.srid) {
      return `${sql} REF_SYSTEM_ID=${this.options.srid}`;
    }

    return sql;
  }
}

export { BIGINT, DATE, BOOLEAN, DECIMAL, DOUBLE, FLOAT, ENUM, INTEGER, MEDIUMINT, SMALLINT, UUID, TINYINT, REAL } from '../mysql/data-types.js';

// Unlike MySQL, MariaDB does not need to cast JSON values when comparing them to other values,
// so we do not need that override.
export { JSON } from '../abstract/data-types.js';
