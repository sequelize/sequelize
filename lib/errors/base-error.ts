export interface ErrorOptions {
  stack?: string;
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
 * The Base Error all Sequelize Errors inherit from.
 *
 * Sequelize provides a host of custom error classes, to allow you to do easier debugging. All of these errors are exposed on the sequelize object and the sequelize constructor.
 * All sequelize errors inherit from the base JS error object.
 *
 * This means that errors can be accessed using `Sequelize.ValidationError`
 */
abstract class BaseError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'SequelizeBaseError';
  }
}

export default BaseError;
