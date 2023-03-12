export { BIGINT, DATE, BOOLEAN, DECIMAL, DOUBLE, FLOAT, ENUM, INTEGER, GEOMETRY, MEDIUMINT, SMALLINT, UUID, TINYINT, REAL } from '../mysql/data-types.js';

// Unlike MySQL, MariaDB does not need to cast JSON values when comparing them to other values,
// so we do not need that override.
export { JSON } from '../abstract/data-types.js';
