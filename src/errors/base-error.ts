import { useErrorCause } from '../utils/deprecations.js';
import type { Nullish } from '../utils/types.js';

export interface SequelizeErrorOptions {
  stack?: Nullish<string>;
}

export interface CommonErrorProperties {
  /** The SQL that triggered the error */
  readonly sql: string;
}

// TODO [>=2023-04-30]:
//  Remove me in Sequelize 8, where this is added natively by TypeScript (>= 4.6):
//  This is a breaking change and must be done in a MAJOR release.
export interface ErrorOptions {
  cause?: unknown;
}

const supportsErrorCause = (() => {
  // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error -- Supported in TS 4.6, not before
  // @ts-ignore
  const err = new Error('Dummy 1', { cause: new Error('Dummy 2') });

  return 'cause' in err;
})();

/**
 * The Base Error all Sequelize Errors inherit from.
 *
 * Sequelize provides a host of custom error classes, to allow you to do easier debugging.
 * All of these errors are exported by the `@sequelize/core` package.
 * All sequelize errors inherit from the base JS error object.
 */
export class BaseError extends Error {
  // 'cause' is incorrectly typed as Error instead of unknown in TypeScript <= 4.7.
  // TODO [20223-05-24]: Change this type to unknown once we drop support for TypeScript <= 4.7
  declare cause?: any;

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
    // TODO [>=2023-04-30]: remove this ts-ignore (Sequelize 8)
    // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error -- Supported in TS 4.6, not before
    // @ts-ignore
    super(supportsErrorCause ? message : addCause(message, options?.cause), options);
    this.name = 'SequelizeBaseError';

    if (!supportsErrorCause && options?.cause) {
      // TODO [>=2023-04-30]:
      //  Once all supported node versions have support for Error.cause (added in Node 16.9.0), delete this line:
      //  This is a breaking change and must be done in a MAJOR release.
      this.cause = options.cause;
    }
  }
}

const indentation = '  ';

function addCause(message: string = '', cause?: unknown) {
  let out = message;

  if (cause) {
    out += `\n\n${indentation}Caused by:\n${indentation}${getErrorMessage(cause).replace(/\n/g, `\n${indentation}`)}`;
  }

  return out;
}

function getErrorMessage(error: unknown) {

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
