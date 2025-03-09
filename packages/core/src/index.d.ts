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

export * from './abstract-dialect/connection-manager.js';
export type {
  ArrayOptions,
  BindParamOptions,
  BlobOptions,
  DataType,
  DataTypeClass,
  DataTypeClassOrInstance,
  DataTypeInstance,
  DateOptions,
  DecimalNumberOptions,
  EnumOptions,
  GeometryOptions,
  IntegerOptions,
  NumberOptions,
  RangeOptions,
  TextOptions,
  TimeOptions,
  VirtualOptions,
} from './abstract-dialect/data-types.js';
export {
  AbstractDialect,
  type ConnectionOptions,
  type DialectOptions,
} from './abstract-dialect/dialect.js';
export { AbstractQueryGenerator } from './abstract-dialect/query-generator.js';
export * from './abstract-dialect/query-generator.types.js';
export * from './abstract-dialect/query-interface.js';
export * from './abstract-dialect/query-interface.types.js';
export * from './abstract-dialect/query.js';
export type { AcquireConnectionOptions } from './abstract-dialect/replication-pool.js';
export type { WhereOptions } from './abstract-dialect/where-sql-builder-types.js';
export * from './associations/index.js';
export * as DataTypes from './data-types.js';
export { ConstraintChecking, Deferrable } from './deferrable.js';
export * from './errors/index.js';
export { AssociationPath } from './expression-builders/association-path.js';
export { Attribute } from './expression-builders/attribute.js';
export { BaseSqlExpression } from './expression-builders/base-sql-expression.js';
export { Identifier } from './expression-builders/identifier.js';
export { JsonPath } from './expression-builders/json-path.js';
export { JSON_NULL, SQL_NULL } from './expression-builders/json-sql-null.js';
export { List } from './expression-builders/list.js';
export { sql } from './expression-builders/sql.js';
export { Value } from './expression-builders/value.js';
export { GeoJsonType } from './geo-json.js';
export type {
  GeoJson,
  GeoJsonGeometryCollection,
  GeoJsonLineString,
  GeoJsonMultiLineString,
  GeoJsonMultiPoint,
  GeoJsonMultiPolygon,
  GeoJsonPoint,
  GeoJsonPolygon,
  PositionPosition,
} from './geo-json.js';
export { importModels } from './import-models.js';
export { IndexHints } from './index-hints.js';
export { ModelDefinition } from './model-definition.js';
export { ModelRepository } from './model-repository.js';
export * from './model-repository.types.js';
export * from './model.js';
export { Op, type OpTypes } from './operators.js';
export { QueryTypes } from './query-types.js';
export * from './sequelize.js';
export { TableHints } from './table-hints.js';
export {
  IsolationLevel,
  Lock,
  Transaction,
  TransactionNestMode,
  TransactionType,
  type ManagedTransactionOptions,
  type NormalizedTransactionOptions,
  type TransactionOptions,
} from './transaction.js';
// eslint-disable-next-line import/no-default-export -- legacy, will be removed in the future | TODO [>=8]: remove this alias
export { Sequelize as default } from './sequelize.js';
export type { NormalizedOptions, Options, PoolOptions } from './sequelize.types.js';
export { isModelStatic, isSameInitialModel } from './utils/model-utils.js';
export { useInflection } from './utils/string.js';
export type { Validator } from './utils/validator-extras.js';

// All functions are available on sql.x, but these are exported for backwards compatibility
export { Cast, cast } from './expression-builders/cast.js';
export { Col, col } from './expression-builders/col.js';
export { Fn, fn } from './expression-builders/fn.js';
export { json } from './expression-builders/json.js';
export { Literal, literal } from './expression-builders/literal.js';
export { Where, where } from './expression-builders/where.js';
