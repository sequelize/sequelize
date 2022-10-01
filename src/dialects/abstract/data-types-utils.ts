import NodeUtils from 'util';
import { BaseError, ValidationErrorItem } from '../../errors/index.js';
import type { Model } from '../../model.js';
import type { DataType, DataTypeClass, DataTypeClassOrInstance, DataTypeInstance, ToSqlOptions } from './data-types.js';
import { AbstractDataType } from './data-types.js';
import type { AbstractDialect } from './index.js';

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

export function normalizeDataType(Type: DataTypeClassOrInstance, dialect: AbstractDialect): AbstractDataType<unknown>;
export function normalizeDataType(Type: string, dialect: AbstractDialect): string;
export function normalizeDataType(
  Type: DataTypeClassOrInstance | string,
  dialect: AbstractDialect,
): AbstractDataType<unknown> | string {
  if (typeof Type === 'string') {
    return Type;
  }

  if (typeof Type !== 'function' && !(Type instanceof AbstractDataType)) {
    throw new TypeError(`Expected type to be a string, a DataType class, or a DataType instance, but got ${NodeUtils.inspect(Type)}.`);
  }

  const type = dataTypeClassOrInstanceToInstance(Type);

  return type.toDialectDataType(dialect);
}

export function dataTypeClassOrInstanceToInstance(Type: DataTypeClassOrInstance): DataTypeInstance {
  return typeof Type === 'function'
    // TODO [2022-12-01]: Remove this eslint-disable once we drop support for TypeScript 4.5
    // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error -- typescript 4.5 narrows Class to "never" here, but typescript 4.6 handles it correctly
    // @ts-ignore
    ? new Type()
    : Type;
}

export function validateDataType(
  type: AbstractDataType<any>,
  attributeName: string,
  modelInstance: Model<any> | null,
  value: unknown,
): ValidationErrorItem | null {
  try {
    type.validate(value);

    return null;
  } catch (error) {
    if (!(error instanceof ValidationErrorItem)) {
      throw new BaseError(`Validation encountered an unexpected error while validating attribute ${attributeName}. (Note: If this error is intended, ${type.constructor.name}#validate must throw an instance of ValidationErrorItem instead)`, {
        cause: error,
      });
    }

    error.path = attributeName;
    error.value = value;
    error.instance = modelInstance;
    // @ts-expect-error -- untyped constructor
    error.validatorKey = `${type.constructor.getDataTypeId()} validator`;

    return error;
  }
}

export function attributeTypeToSql(type: AbstractDataType<any> | string, options: ToSqlOptions): string {
  if (typeof type === 'string') {
    return type;
  }

  return type.toSql(options);
}

export function getDataTypeParser(dialect: AbstractDialect, dataType: DataTypeClassOrInstance): (value: unknown) => unknown {
  const type = normalizeDataType(dataType, dialect);

  return (value: unknown) => {
    return type.parseDatabaseValue(value);
  };
}

export function throwUnsupportedDataType(dialect: AbstractDialect, typeName: string): never {
  throw new Error(`${dialect.name} does not support the ${typeName} data type.
See https://sequelize.org/docs/v7/other-topics/other-data-types/ for a list of supported data types.`);
}
