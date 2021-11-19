import Model from "./model";

/**
 * The Base Error all Sequelize Errors inherit from.
 */
export class BaseError extends Error {
  public name: string;
}

/**
 * Scope Error. Thrown when the sequelize cannot query the specified scope.
 */
export class SequelizeScopeError extends BaseError {}

export class ValidationError extends BaseError {
  /** Array of ValidationErrorItem objects describing the validation errors */
  public readonly  errors: ValidationErrorItem[];

  /**
   * Validation Error. Thrown when the sequelize validation has failed. The error contains an `errors`
   * property, which is an array with 1 or more ValidationErrorItems, one for each validation that failed.
   *
   * @param message Error message
   * @param errors  Array of ValidationErrorItem objects describing the validation errors
   */
  constructor(message: string, errors?: ValidationErrorItem[]);

  /**
   * Gets all validation error items for the path / field specified.
   *
   * @param path The path to be checked for error items
   */
  public get(path: string): ValidationErrorItem[];
}

export class ValidationErrorItem {
  /** An error message */
  public readonly message: string;

  /** The type/origin of the validation error */
  public readonly type: string | null;

  /** The field that triggered the validation error */
  public readonly path: string | null;

  /** The value that generated the error */
  public readonly value: string | null;

  /** The DAO instance that caused the validation error */
  public readonly instance: Model | null;

  /** A validation "key", used for identification */
  public readonly validatorKey: string | null;

  /** Property name of the BUILT-IN validator function that caused the validation error (e.g. "in" or "len"), if applicable */
  public readonly validatorName: string | null;

  /** Parameters used with the BUILT-IN validator function, if applicable */
  public readonly validatorArgs: unknown[];

  public readonly original: Error;

  /**
   * Creates a new ValidationError item. Instances of this class are included in the `ValidationError.errors` property.
   *
   * @param message An error message
   * @param type The type/origin of the validation error
   * @param path The field that triggered the validation error
   * @param value The value that generated the error
   * @param instance the DAO instance that caused the validation error
   * @param validatorKey a validation "key", used for identification
   * @param fnName property name of the BUILT-IN validator function that caused the validation error (e.g. "in" or "len"), if applicable
   * @param fnArgs parameters used with the BUILT-IN validator function, if applicable
   */
  constructor(
    message?: string,
    type?: string,
    path?: string,
    value?: string,
    instance?: object,
    validatorKey?: string,
    fnName?: string,
    fnArgs?: unknown[]
  );
}

export interface CommonErrorProperties {
  /** The database specific error which triggered this one */
  readonly parent: Error;

  /** The database specific error which triggered this one */
  readonly original: Error;

  /** The SQL that triggered the error */
  readonly sql: string;
}

/**
 * Thrown when a record was not found, Usually used with rejectOnEmpty mode (see message for details)
 */
export class EmptyResultError extends BaseError {
}

export class DatabaseError extends BaseError implements CommonErrorProperties {
  public readonly parent: Error;
  public readonly original: Error;
  public readonly sql: string;
  public readonly parameters: Array<any>;
  /**
   * A base class for all database related errors.
   * @param parent The database specific error which triggered this one
   */
  constructor(parent: Error);
}

/** Thrown when a database query times out because of a deadlock */
export class TimeoutError extends DatabaseError {}

export interface UniqueConstraintErrorOptions {
  parent?: Error;
  message?: string;
  errors?: ValidationErrorItem[];
  fields?: { [key: string]: unknown };
  original?: Error;
}

/**
 * Thrown when a unique constraint is violated in the database
 */
export class UniqueConstraintError extends ValidationError implements CommonErrorProperties {
  public readonly parent: Error;
  public readonly original: Error;
  public readonly sql: string;
  public readonly fields: { [key: string]: unknown };
  constructor(options?: UniqueConstraintErrorOptions);
}

/**
 * Thrown when a foreign key constraint is violated in the database
 */
export class ForeignKeyConstraintError extends DatabaseError {
  public table: string;
  public fields: { [field: string]: string };
  public value: unknown;
  public index: string;
  constructor(options: { parent?: Error; message?: string; index?: string; fields?: string[]; table?: string });
}

/**
 * Thrown when an exclusion constraint is violated in the database
 */
export class ExclusionConstraintError extends DatabaseError {
  public constraint: string;
  public fields: { [field: string]: string };
  public table: string;
  constructor(options: { parent?: Error; message?: string; constraint?: string; fields?: string[]; table?: string });
}

/**
 * Thrown when constraint name is not found in the database
 */
export class UnknownConstraintError extends DatabaseError {
  public constraint: string;
  public fields: { [field: string]: string };
  public table: string;
  constructor(options: { parent?: Error; message?: string; constraint?: string; fields?: string[]; table?: string });
}

/**
 * Thrown when attempting to update a stale model instance
 */
export class OptimisticLockError extends BaseError {
  constructor(options: { message?: string, modelName?: string, values?: { [key: string]: any }, where?: { [key: string]: any } });
}

/**
 * A base class for all connection related errors.
 */
export class ConnectionError extends BaseError {
  public parent: Error;
  public original: Error;
  constructor(parent: Error);
}

/**
 * Thrown when a connection to a database is refused
 */
export class ConnectionRefusedError extends ConnectionError {}

/**
 * Thrown when a connection to a database is refused due to insufficient privileges
 */
export class AccessDeniedError extends ConnectionError {}

/**
 * Thrown when a connection to a database has a hostname that was not found
 */
export class HostNotFoundError extends ConnectionError {}

/**
 * Thrown when a connection to a database has a hostname that was not reachable
 */
export class HostNotReachableError extends ConnectionError {}

/**
 * Thrown when a connection to a database has invalid values for any of the connection parameters
 */
export class InvalidConnectionError extends ConnectionError {}

/**
 * Thrown when a connection to a database times out
 */
export class ConnectionTimedOutError extends ConnectionError {}

/**
 * Thrown when queued operations were aborted because a connection was closed
 */
export class AsyncQueueError extends BaseError {}

export class AggregateError extends BaseError {
  /**
   * AggregateError. A wrapper for multiple errors.
   *
   * @param {Error[]} errors  The aggregated errors that occurred
   */
  constructor(errors: Error[]);

  /** the aggregated errors that occurred */
  public readonly  errors: Error[];
}
