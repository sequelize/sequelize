import NodeUtils from 'node:util';
import { BaseError, ValidationErrorItem } from '../errors/index.js';
import type { Model } from '../model.js';
import type {
  DataType,
  DataTypeClass,
  DataTypeClassOrInstance,
  DataTypeInstance,
} from './data-types.js';
import { AbstractDataType } from './data-types.js';
import type { AbstractDialect } from './dialect.js';

export function isDataType(value: any): value is DataType {
  return isDataTypeClass(value) || value instanceof AbstractDataType;
}

export function isDataTypeClass(value: any): value is DataTypeClass {
  return typeof value === 'function' && value.prototype instanceof AbstractDataType;
}

export function cloneDataType(value: DataTypeInstance | string): DataTypeInstance | string {
  if (typeof value === 'string') {
    return value;
  }

  return value.clone();
}

export function normalizeDataType(
  Type: DataTypeClassOrInstance,
  dialect: AbstractDialect,
): AbstractDataType<unknown>;
export function normalizeDataType(Type: string, dialect: AbstractDialect): string;
export function normalizeDataType(
  Type: DataTypeClassOrInstance | string,
  dialect: AbstractDialect,
): AbstractDataType<unknown> | string;
export function normalizeDataType(
  Type: DataTypeClassOrInstance | string,
  dialect: AbstractDialect,
): AbstractDataType<unknown> | string {
  if (typeof Type === 'string') {
    return Type;
  }

  if (typeof Type !== 'function' && !(Type instanceof AbstractDataType)) {
    throw new TypeError(
      `Expected type to be a string, a DataType class, or a DataType instance, but got ${NodeUtils.inspect(Type)}.`,
    );
  }

  const type = dataTypeClassOrInstanceToInstance(Type);

  if (!type.belongsToDialect(dialect)) {
    return type.toDialectDataType(dialect);
  }

  return type;
}

export function dataTypeClassOrInstanceToInstance(Type: DataTypeClassOrInstance): DataTypeInstance {
  return typeof Type === 'function' ? new Type() : Type;
}

export function validateDataType(
  value: unknown,
  type: AbstractDataType<any>,
  attributeName: string = '[unnamed]',
  modelInstance: Model<any> | null = null,
): ValidationErrorItem | null {
  try {
    type.validate(value);

    return null;
  } catch (error) {
    if (!(error instanceof ValidationErrorItem)) {
      throw new BaseError(
        `Validation encountered an unexpected error while validating attribute ${attributeName}. (Note: If this error is intended, ${type.constructor.name}#validate must throw an instance of ValidationErrorItem instead)`,
        {
          cause: error,
        },
      );
    }

    error.path = attributeName;
    error.value = value;
    error.instance = modelInstance;
    // @ts-expect-error -- untyped constructor
    error.validatorKey = `${type.constructor.getDataTypeId()} validator`;

    return error;
  }
}

export function attributeTypeToSql(type: AbstractDataType<any> | string): string {
  if (typeof type === 'string') {
    return type;
  }

  if (type instanceof AbstractDataType) {
    return type.toSql();
  }

  throw new Error(
    'attributeTypeToSql received a type that is neither a string or an instance of AbstractDataType',
  );
}

export function getDataTypeParser(
  dialect: AbstractDialect,
  dataType: DataTypeClassOrInstance,
): (value: unknown) => unknown {
  const type = normalizeDataType(dataType, dialect);

  return (value: unknown) => {
    return type.parseDatabaseValue(value);
  };
}

export function throwUnsupportedDataType(dialect: AbstractDialect, typeName: string): never {
  throw new Error(`${dialect.name} does not support the ${typeName} data type.
See https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`);
}
