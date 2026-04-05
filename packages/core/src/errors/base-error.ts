import { useErrorCause } from '../utils/deprecations.js';

export interface CommonErrorProperties {
  /** The SQL that triggered the error */
  readonly sql: string;
}

/**
 * The Base Error all Sequelize Errors inherit from.
 *
 * Sequelize provides a host of custom error classes, to allow you to do easier debugging.
 * All of these errors are exported by the `@sequelize/core` package.
 * All sequelize errors inherit from the base JS error object.
 */
export class BaseError extends Error {
  /**
   * @deprecated use {@link cause}.
   */
  get parent(): this['cause'] {
    useErrorCause();

    return this.cause;
  }

  /**
   * @deprecated use {@link cause}.
   */
  get original(): this['cause'] {
    useErrorCause();

    return this.cause;
  }

  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SequelizeBaseError';
  }
}
