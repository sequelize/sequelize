export { default as BaseError } from './base-error';

export { default as DatabaseError } from './database-error';
export { default as AggregateError } from './aggregate-error';
export { default as AssociationError } from './association-error';
export { default as BulkRecordError } from './bulk-record-error';
export { default as ConnectionError } from './connection-error';
export { default as EagerLoadingError } from './eager-loading-error';
export { default as EmptyResultError } from './empty-result-error';
export { default as InstanceError } from './instance-error';
export { default as OptimisticLockError } from './optimistic-lock-error';
export { default as QueryError } from './query-error';
export { default as SequelizeScopeError } from './sequelize-scope-error';
export {
  default as ValidationError,
  ValidationErrorItem,
  ValidationErrorItemOrigin,
  ValidationErrorItemType
} from './validation-error';

export { default as AccessDeniedError } from './connection/access-denied-error';
export { default as ConnectionAcquireTimeoutError } from './connection/connection-acquire-timeout-error';
export { default as ConnectionRefusedError } from './connection/connection-refused-error';
export { default as ConnectionTimedOutError } from './connection/connection-timed-out-error';
export { default as HostNotFoundError } from './connection/host-not-found-error';
export { default as HostNotReachableError } from './connection/host-not-reachable-error';
export { default as InvalidConnectionError } from './connection/invalid-connection-error';

export { default as ExclusionConstraintError } from './database/exclusion-constraint-error';
export { default as ForeignKeyConstraintError } from './database/foreign-key-constraint-error';
export { default as TimeoutError } from './database/timeout-error';
export { default as UnknownConstraintError } from './database/unknown-constraint-error';

export { default as UniqueConstraintError } from './validation/unique-constraint-error';

export { AsyncQueueError } from '../dialects/mssql/async-queue';
