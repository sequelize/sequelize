'use strict';

exports.BaseError = require('./base-error');

exports.AggregateError = require('./aggregate-error');
exports.AsyncQueueError = require('../dialects/mssql/async-queue').AsyncQueueError;
exports.AssociationError = require('./association-error');
exports.BulkRecordError = require('./bulk-record-error');
exports.ConnectionError = require('./connection-error');
exports.DatabaseError = require('./database-error');
exports.EagerLoadingError = require('./eager-loading-error');
exports.EmptyResultError = require('./empty-result-error');
exports.InstanceError = require('./instance-error');
exports.OptimisticLockError = require('./optimistic-lock-error');
exports.QueryError = require('./query-error');
exports.SequelizeScopeError = require('./sequelize-scope-error');
exports.ValidationError = require('./validation-error');
exports.ValidationErrorItem = exports.ValidationError.ValidationErrorItem;

exports.AccessDeniedError = require('./connection/access-denied-error');
exports.ConnectionAcquireTimeoutError = require('./connection/connection-acquire-timeout-error');
exports.ConnectionRefusedError = require('./connection/connection-refused-error');
exports.ConnectionTimedOutError = require('./connection/connection-timed-out-error');
exports.HostNotFoundError = require('./connection/host-not-found-error');
exports.HostNotReachableError = require('./connection/host-not-reachable-error');
exports.InvalidConnectionError = require('./connection/invalid-connection-error');

exports.ExclusionConstraintError = require('./database/exclusion-constraint-error');
exports.ForeignKeyConstraintError = require('./database/foreign-key-constraint-error');
exports.TimeoutError = require('./database/timeout-error');
exports.UnknownConstraintError = require('./database/unknown-constraint-error');

exports.UniqueConstraintError = require('./validation/unique-constraint-error');
