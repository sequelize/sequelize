import Pkg from './index.js';

// export * from './lib/sequelize';
export const Sequelize = Pkg.Sequelize;
export const fn = Pkg.fn;
export const Fn = Pkg.Fn;
export const col = Pkg.col;
export const Col = Pkg.Col;
export const cast = Pkg.cast;
export const Cast = Pkg.Cast;
export const literal = Pkg.literal;
export const Literal = Pkg.Literal;
export const json = Pkg.json;
export const where = Pkg.where;
export const Where = Pkg.Where;
export const List = Pkg.List;
export const Identifier = Pkg.Identifier;
export const JsonPath = Pkg.JsonPath;
export const AssociationPath = Pkg.AssociationPath;
export const Attribute = Pkg.Attribute;
export const Value = Pkg.Value;
export const sql = Pkg.sql;
export const and = Pkg.and;
export const or = Pkg.or;
export const SQL_NULL = Pkg.SQL_NULL;
export const JSON_NULL = Pkg.JSON_NULL;

export const AbstractQueryInterface = Pkg.AbstractQueryInterface;
export const AbstractConnectionManager = Pkg.AbstractConnectionManager;
export const AbstractQueryGenerator = Pkg.AbstractQueryGenerator;
export const AbstractQuery = Pkg.AbstractQuery;
export const AbstractDialect = Pkg.AbstractDialect;

// export * from './lib/model';
export const Model = Pkg.Model;

// export * from './lib/transaction';
export const Transaction = Pkg.Transaction;
export const TransactionNestMode = Pkg.TransactionNestMode;
export const TransactionType = Pkg.TransactionType;
export const Lock = Pkg.Lock;
export const IsolationLevel = Pkg.IsolationLevel;

// export * from './lib/associations/index';
export const Association = Pkg.Association;
export const BelongsToAssociation = Pkg.BelongsToAssociation;
export const HasOneAssociation = Pkg.HasOneAssociation;
export const HasManyAssociation = Pkg.HasManyAssociation;
export const BelongsToManyAssociation = Pkg.BelongsToManyAssociation;

// export * from './lib/errors';
export const BaseError = Pkg.BaseError;

export const AggregateError = Pkg.AggregateError;
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

// export { useInflection } from './lib/utils';
export const useInflection = Pkg.useInflection;

// export { QueryTypes, Op, TableHints, IndexHints, DataTypes, Deferrable, ConstraintChecking };
export const QueryTypes = Pkg.QueryTypes;
export const Op = Pkg.Op;
export const TableHints = Pkg.TableHints;
export const IndexHints = Pkg.IndexHints;
export const DataTypes = Pkg.DataTypes;
export const GeoJsonType = Pkg.GeoJsonType;
export const Deferrable = Pkg.Deferrable;
export const ConstraintChecking = Pkg.ConstraintChecking;

// export { Validator as validator } from './lib/utils/validator-extras';
export const Validator = Pkg.Validator;

export const ValidationErrorItemOrigin = Pkg.ValidationErrorItemOrigin;
export const ValidationErrorItemType = Pkg.ValidationErrorItemType;

export const isModelStatic = Pkg.isModelStatic;
export const isSameInitialModel = Pkg.isSameInitialModel;
export const importModels = Pkg.importModels;
export const ManualOnDelete = Pkg.ManualOnDelete;

// eslint-disable-next-line import/no-default-export -- legacy, will be removed in the future
export { default } from './index.js';
