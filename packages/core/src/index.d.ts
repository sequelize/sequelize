/**
 * This package contains the core functionality of Sequelize.
 * Values can be imported as follows:
 *
 * ```js
 * import { Model, DataTypes } from '@sequelize/core';
 * ```
 *
 * The documentation is available at https://sequelize.org/docs/v7/
 *
 * @module
 */

export * as DataTypes from './data-types';
export type {
  DataType,
  DataTypeClassOrInstance,
  DataTypeClass,
  DataTypeInstance,
  NumberOptions,
  ArrayOptions,
  BlobOptions,
  DateOptions,
  DecimalNumberOptions,
  EnumOptions,
  GeometryOptions,
  IntegerOptions,
  TextOptions,
  TimeOptions,
  VirtualOptions,
  RangeOptions,
} from './dialects/abstract/data-types.js';
export type {
  GeoJson,
  GeoJsonPoint,
  GeoJsonMultiPoint,
  GeoJsonLineString,
  GeoJsonMultiLineString,
  GeoJsonPolygon,
  GeoJsonMultiPolygon,
  GeoJsonGeometryCollection,
  PositionPosition,
} from './geo-json.js';
export { GeoJsonType } from './geo-json.js';
export { QueryTypes } from './query-types';
export { IndexHints } from './index-hints';
export { TableHints } from './table-hints';
export { Op, type OpTypes } from './operators';
export * from './transaction';

export type { Connection } from './dialects/abstract/connection-manager';
export * from './associations/index';
export * from './errors';
export * from './model';
export * from './dialects/abstract/query-interface';
export * from './sequelize';

// TODO [>=8]: remove this alias
export { Sequelize as default } from './sequelize';
export { useInflection } from './utils/string';
export { isModelStatic, isSameInitialModel } from './utils/model-utils';
export type { Validator } from './utils/validator-extras';
export { Deferrable } from './deferrable';
export { Cast, cast, Col, col, Fn, fn, Json, json, Literal, literal, sql, Where, where, Identifier, identifier, JsonPath, jsonPath, List, list, Attribute, attribute, SequelizeMethod } from './utils/sequelize-method';

export { AbstractQueryGenerator } from './dialects/abstract/query-generator.js';
export { importModels } from './import-models.js';
export { ModelDefinition } from './model-definition.js';
export type { WhereOptions } from './dialects/abstract/where-sql-builder-types.js';
