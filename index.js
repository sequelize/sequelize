/**
 * The entry point.
 *
 * @module Sequelize
 */
import Sequelize from './lib/sequelize.js';

export default Sequelize;

// Named exports mirror the statics hung off `Sequelize` in lib/sequelize.js, and
// must stay in sync with the named exports declared in index.d.ts.
export const {
  DataTypes,
  Op,
  QueryTypes,
  Utils,
  Validator,
  Deferrable,
  Transaction,
  Model,
  fn,
  col,
  cast,
  literal,
  asIs,
  and,
  or,
  json,
  where,
  condition,
  Error,
  ValidationError,
  ValidationErrorItem,
  DatabaseError,
  TimeoutError,
  UniqueConstraintError,
  ExclusionConstraintError,
  ForeignKeyConstraintError,
  ConnectionError,
  ConnectionRefusedError,
  AccessDeniedError,
  HostNotFoundError,
  HostNotReachableError,
  InvalidConnectionError,
  ConnectionTimedOutError,
  EmptyResultError
} = Sequelize;

export { Sequelize };
