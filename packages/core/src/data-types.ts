/**
 * The classes declared in this files are the DataTypes available on the `DataTypes` namespace.
 * You can access them as follows:
 *
 * ```ts
 * import { DataTypes } from '@sequelize/core';
 *
 * DataTypes.STRING;
 * ```
 *
 * @module DataTypes
 */

import * as DataTypes from './abstract-dialect/data-types.js';
import { classToInvokable } from './utils/class-to-invokable.js';

export { AbstractDataType as ABSTRACT } from './abstract-dialect/data-types.js';

/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const STRING = classToInvokable(DataTypes.STRING);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const CHAR = classToInvokable(DataTypes.CHAR);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const TEXT = classToInvokable(DataTypes.TEXT);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const TINYINT = classToInvokable(DataTypes.TINYINT);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const SMALLINT = classToInvokable(DataTypes.SMALLINT);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const MEDIUMINT = classToInvokable(DataTypes.MEDIUMINT);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const INTEGER = classToInvokable(DataTypes.INTEGER);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const BIGINT = classToInvokable(DataTypes.BIGINT);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const FLOAT = classToInvokable(DataTypes.FLOAT);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const TIME = classToInvokable(DataTypes.TIME);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const DATE = classToInvokable(DataTypes.DATE);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const DATEONLY = classToInvokable(DataTypes.DATEONLY);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const BOOLEAN = classToInvokable(DataTypes.BOOLEAN);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const NOW = classToInvokable(DataTypes.NOW);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const BLOB = classToInvokable(DataTypes.BLOB);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const DECIMAL = classToInvokable(DataTypes.DECIMAL);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const UUID = classToInvokable(DataTypes.UUID);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const UUIDV1 = classToInvokable(DataTypes.UUIDV1);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const UUIDV4 = classToInvokable(DataTypes.UUIDV4);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const HSTORE = classToInvokable(DataTypes.HSTORE);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const JSON = classToInvokable(DataTypes.JSON);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const JSONB = classToInvokable(DataTypes.JSONB);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const VIRTUAL = classToInvokable(DataTypes.VIRTUAL);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const ARRAY = classToInvokable(DataTypes.ARRAY);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const ENUM = classToInvokable(DataTypes.ENUM);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const RANGE = classToInvokable(DataTypes.RANGE);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const REAL = classToInvokable(DataTypes.REAL);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const DOUBLE = classToInvokable(DataTypes.DOUBLE);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const GEOMETRY = classToInvokable(DataTypes.GEOMETRY);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const GEOGRAPHY = classToInvokable(DataTypes.GEOGRAPHY);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const CIDR = classToInvokable(DataTypes.CIDR);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const INET = classToInvokable(DataTypes.INET);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const MACADDR = classToInvokable(DataTypes.MACADDR);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const MACADDR8 = classToInvokable(DataTypes.MACADDR8);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const CITEXT = classToInvokable(DataTypes.CITEXT);
/** This is a simple wrapper to make the DataType constructable without `new`. See the return type for all available options. */
export const TSVECTOR = classToInvokable(DataTypes.TSVECTOR);
