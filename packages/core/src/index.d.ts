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
  BindParamOptions,
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
export {
  TransactionType,
  Lock,
  IsolationLevel,
  TransactionNestMode,
  Transaction,
  type ManagedTransactionOptions,
  type TransactionOptions,
  type NormalizedTransactionOptions,
} from './transaction';

export type { Connection } from './dialects/abstract/connection-manager';
export * from './associations/index';
export * from './errors';
export * from './model';
export * from './dialects/abstract/query-generator.types';
export * from './dialects/abstract/query-interface';
export * from './dialects/abstract/query-interface.types';
export * from './sequelize';

// TODO [>=8]: remove this alias
export { Sequelize as default } from './sequelize';
export { useInflection } from './utils/string';
export { isModelStatic, isSameInitialModel } from './utils/model-utils';
export type { Validator } from './utils/validator-extras';
export { ConstraintChecking, Deferrable } from './deferrable';
export { AbstractDialect } from './dialects/abstract/index.js';
export { AbstractQueryGenerator } from './dialects/abstract/query-generator.js';
export { importModels } from './import-models.js';
export { ModelDefinition } from './model-definition.js';
export type { WhereOptions } from './dialects/abstract/where-sql-builder-types.js';

export { BaseSqlExpression } from './expression-builders/base-sql-expression.js';
export { sql } from './expression-builders/sql.js';
export { List } from './expression-builders/list.js';
export { Value } from './expression-builders/value.js';
export { Identifier } from './expression-builders/identifier.js';
export { Attribute } from './expression-builders/attribute.js';
export { JsonPath, jsonPath } from './expression-builders/json-path.js';
export { AssociationPath } from './expression-builders/association-path.js';

// All functions are available on sql.x, but these are exported for backwards compatibility
export { literal, Literal } from './expression-builders/literal.js';
export { fn, Fn } from './expression-builders/fn.js';
export { col, Col } from './expression-builders/col.js';
export { cast, Cast } from './expression-builders/cast.js';
export { json } from './expression-builders/json.js';
export { where, Where } from './expression-builders/where.js';
export { JSON_NULL } from './expression-builders/json-sql-null.js';
export { SQL_NULL } from './expression-builders/json-sql-null.js';
