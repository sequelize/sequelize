import * as DataTypes from './data-types';
import type { AbstractDataType } from './dialects/abstract/data-types.js';
import type { AbstractDialect } from './dialects/abstract/index.js';
import { logger } from './utils/logger';

function arrayToList(array: unknown[], dialect: AbstractDialect, format: boolean) {
  // TODO: rewrite
  // eslint-disable-next-line unicorn/no-array-reduce
  return array.reduce((sql: string, val, i) => {
    if (i !== 0) {
      sql += ', ';
    }

    if (Array.isArray(val)) {
      sql += `(${arrayToList(val, dialect, format)})`;
    } else {
      sql += escape(val, dialect, format);
    }

    return sql;
  }, '');
}

const textDataTypeMap = new Map<string, AbstractDataType<any>>();
export function getTextDataTypeForDialect(dialect: AbstractDialect): AbstractDataType<any> {
  let type = textDataTypeMap.get(dialect.name);
  if (type == null) {
    type = new DataTypes.STRING().toDialectDataType(dialect);
    textDataTypeMap.set(dialect.name, type);
  }

  return type;
}

function bestGuessDataTypeOfVal(val: unknown, dialect: AbstractDialect): AbstractDataType<any> {
  // TODO: cache simple types
  switch (typeof val) {
    case 'bigint':
      return new DataTypes.BIGINT().toDialectDataType(dialect);

    case 'number': {
      if (Number.isSafeInteger(val)) {
        return new DataTypes.INTEGER().toDialectDataType(dialect);
      }

      return new DataTypes.REAL().toDialectDataType(dialect);
    }

    case 'boolean':
      return new DataTypes.BOOLEAN().toDialectDataType(dialect);

    case 'object':
      if (Array.isArray(val)) {
        if (val.length === 0) {
          throw new Error(`Could not guess type of value ${logger.inspect(val)} because it is an empty array`);
        }

        return new DataTypes.ARRAY(bestGuessDataTypeOfVal(val[0], dialect)).toDialectDataType(dialect);
      }

      if (val instanceof Date) {
        return new DataTypes.DATE().toDialectDataType(dialect);
      }

      if (Buffer.isBuffer(val)) {
        // TODO: remove dialect-specific hack
        if (dialect.name === 'ibmi') {
          return new DataTypes.STRING().toDialectDataType(dialect);
        }

        return new DataTypes.BLOB().toDialectDataType(dialect);
      }

      break;

    case 'string':
      return getTextDataTypeForDialect(dialect);

    default:
  }

  throw new TypeError(`Could not guess type of value ${logger.inspect(val)}`);
}

export function escape(
  val: unknown,
  dialect: AbstractDialect,
  format: boolean = false,
): string {
  const dialectName = dialect.name;

  if (val == null) {
    // There are cases in Db2 for i where 'NULL' isn't accepted, such as
    // comparison with a WHERE() statement. In those cases, we have to cast.
    if (dialectName === 'ibmi' && format) {
      return 'cast(NULL as int)';
    }

    return 'NULL';
  }

  if (Array.isArray(val) && (dialectName !== 'postgres' || format)) {
    return arrayToList(val, dialect, format);
  }

  const dataType = bestGuessDataTypeOfVal(val, dialect);

  return dataType.escape(val);
}
