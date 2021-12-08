import Pkg from './index.js';

export default Pkg;

// export * from './lib/sequelize';
export const Sequelize = Pkg.Sequelize;
export const fn = Pkg.fn;
export const col = Pkg.col;
export const cast = Pkg.cast;
export const literal = Pkg.literal;
export const and = Pkg.and;
export const or = Pkg.or;
export const json = Pkg.json;
export const where = Pkg.where;

// export * from './lib/query-interface';
export const QueryInterface = Pkg.QueryInterface;

// export * from './lib/data-types';
// 'DOUBLE PRECISION' is missing because its name is not a valid export identifier.
export const ABSTRACT = Pkg.ABSTRACT;
export const STRING = Pkg.STRING;
export const CHAR = Pkg.CHAR;
export const TEXT = Pkg.TEXT;
export const NUMBER = Pkg.NUMBER;
export const TINYINT = Pkg.TINYINT;
export const SMALLINT = Pkg.SMALLINT;
export const MEDIUMINT = Pkg.MEDIUMINT;
export const INTEGER = Pkg.INTEGER;
export const BIGINT = Pkg.BIGINT;
export const FLOAT = Pkg.FLOAT;
export const TIME = Pkg.TIME;
export const DATE = Pkg.DATE;
export const DATEONLY = Pkg.DATEONLY;
export const BOOLEAN = Pkg.BOOLEAN;
export const NOW = Pkg.NOW;
export const BLOB = Pkg.BLOB;
export const DECIMAL = Pkg.DECIMAL;
export const NUMERIC = Pkg.NUMERIC;
export const UUID = Pkg.UUID;
export const UUIDV1 = Pkg.UUIDV1;
export const UUIDV4 = Pkg.UUIDV4;
export const HSTORE = Pkg.HSTORE;
export const JSON = Pkg.JSON;
export const JSONB = Pkg.JSONB;
export const VIRTUAL = Pkg.VIRTUAL;
export const ARRAY = Pkg.ARRAY;
export const ENUM = Pkg.ENUM;
export const RANGE = Pkg.RANGE;
export const REAL = Pkg.REAL;
export const DOUBLE = Pkg.DOUBLE;
export const GEOMETRY = Pkg.GEOMETRY;
export const GEOGRAPHY = Pkg.GEOGRAPHY;
export const CIDR = Pkg.CIDR;
export const INET = Pkg.INET;
export const MACADDR = Pkg.MACADDR;
export const CITEXT = Pkg.CITEXT;
export const TSVECTOR = Pkg.TSVECTOR;

// export * from './lib/model';
export const Model = Pkg.Model;

// export * from './lib/transaction';
export const Transaction = Pkg.Transaction;

// export * from './lib/associations/index';
export const Association = Pkg.Association;
export const BelongsTo = Pkg.BelongsTo;
export const HasOne = Pkg.HasOne;
export const HasMany = Pkg.HasMany;
export const BelongsToMany = Pkg.BelongsToMany;

// export * from './lib/errors';
export const BaseError = Pkg.BaseError;

export const AggregateError = Pkg.AggregateError;
export const AsyncQueueError = Pkg.AsyncQueueError;
export const AssociationError = Pkg.AssociationError;
export const BulkRecordError = Pkg.BulkRecordError;
export const ConnectionError = Pkg.ConnectionError;
export const DatabaseError = Pkg.DatabaseError;
export const EagerLoadingError = Pkg.EagerLoadingError;
export const EmptyResultError = Pkg.EmptyResultError;
export const InstanceError = Pkg.InstanceError;
export const OptimisticLockError = Pkg.OptimisticLockError;
export const QueryError = Pkg.QueryError;
export const SequelizeScopeError = Pkg.SequelizeScopeError;
export const ValidationError = Pkg.ValidationError;
export const ValidationErrorItem = Pkg.ValidationErrorItem;

export const AccessDeniedError = Pkg.AccessDeniedError;
export const ConnectionAcquireTimeoutError = Pkg.ConnectionAcquireTimeoutError;
export const ConnectionRefusedError = Pkg.ConnectionRefusedError;
export const ConnectionTimedOutError = Pkg.ConnectionTimedOutError;
export const HostNotFoundError = Pkg.HostNotFoundError;
export const HostNotReachableError = Pkg.HostNotReachableError;
export const InvalidConnectionError = Pkg.InvalidConnectionError;

export const ExclusionConstraintError = Pkg.ExclusionConstraintError;
export const ForeignKeyConstraintError = Pkg.ForeignKeyConstraintError;
export const TimeoutError = Pkg.TimeoutError;
export const UnknownConstraintError = Pkg.UnknownConstraintError;

export const UniqueConstraintError = Pkg.UniqueConstraintError;

// export { BaseError as Error } from './lib/errors';
export const Error = Pkg.Error;

// export { useInflection } from './lib/utils';
export const useInflection = Pkg.useInflection;

// export { Utils, QueryTypes, Op, TableHints, IndexHints, DataTypes, Deferrable };
export const Utils = Pkg.Utils;
export const QueryTypes = Pkg.QueryTypes;
export const Op = Pkg.Op;
export const TableHints = Pkg.TableHints;
export const IndexHints = Pkg.IndexHints;
export const DataTypes = Pkg.DataTypes;
export const Deferrable = Pkg.Deferrable;

// export { Validator as validator } from './lib/utils/validator-extras';
export const Validator = Pkg.Validator;

export const ValidationErrorItemOrigin = Pkg.ValidationErrorItemOrigin;
export const ValidationErrorItemType = Pkg.ValidationErrorItemType;
