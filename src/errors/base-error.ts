import { useErrorCause } from '../utils/deprecations.js';

export interface SequelizeErrorOptions {
  stack?: string;
}

export interface CommonErrorProperties {
  /** The SQL that triggered the error */
  readonly sql: string;
}

const supportsErrorCause = (() => {
  const err = new Error('Dummy 1', { cause: new Error('Dummy 2') });

  return 'cause' in err;
})();

/**
 * The Base Error all Sequelize Errors inherit from.
 *
 * Sequelize provides a host of custom error classes, to allow you to do easier debugging. All of these errors are exposed on the sequelize object and the sequelize constructor.
 * All sequelize errors inherit from the base JS error object.
 *
 * This means that errors can be accessed using `Sequelize.ValidationError`
 */
abstract class BaseError extends Error {
  get parent(): this['cause'] {
    useErrorCause();

    return this.cause;
  }

  get original(): this['cause'] {
    useErrorCause();

    return this.cause;
  }

  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SequelizeBaseError';

    if (!supportsErrorCause) {
      // TODO [>=2023-04-30]:
      //  Once all supported node versions have support for Error.cause (added in node 16), delete this line:
      //  This is a breaking change and must be done in a MAJOR release.
      this.cause = options?.cause;
    }
  }
}

export default BaseError;
