import type { AbstractDataType } from './abstract-dialect/data-types.js';
import type { AbstractDialect } from './abstract-dialect/dialect.js';
import * as DataTypes from './data-types';
import { logger } from './utils/logger';

const textDataTypeMap = new Map<string, AbstractDataType<any>>();
export function getTextDataTypeForDialect(dialect: AbstractDialect): AbstractDataType<any> {
  let type = textDataTypeMap.get(dialect.name);
  if (type == null) {
    type = new DataTypes.STRING().toDialectDataType(dialect);
    textDataTypeMap.set(dialect.name, type);
  }

  return type;
}

export function bestGuessDataTypeOfVal(
  val: unknown,
  dialect: AbstractDialect,
): AbstractDataType<any> {
  // TODO: cache simple types
  switch (typeof val) {
    case 'bigint':
      return new DataTypes.BIGINT().toDialectDataType(dialect);

    case 'number': {
      if (Number.isSafeInteger(val)) {
        return new DataTypes.INTEGER().toDialectDataType(dialect);
      }

      return new DataTypes.FLOAT().toDialectDataType(dialect);
    }

    case 'boolean':
      return new DataTypes.BOOLEAN().toDialectDataType(dialect);

    case 'object':
      if (Array.isArray(val)) {
        if (val.length === 0) {
          throw new Error(
            `Could not guess type of value ${logger.inspect(val)} because it is an empty array`,
          );
        }

        return new DataTypes.ARRAY(bestGuessDataTypeOfVal(val[0], dialect)).toDialectDataType(
          dialect,
        );
      }

      if (val instanceof Date) {
        return new DataTypes.DATE(3).toDialectDataType(dialect);
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
