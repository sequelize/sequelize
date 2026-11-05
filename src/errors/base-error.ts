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

interface ErrorHeader {
  name: string;
  message: string;
}

/**
 * Replaces the header of a stack captured before an error existed (usually "Error")
 * with the error's own "name: message", so test runners that print `.stack` show the message.
 *
 * @param error The error the stack is for
 * @param stack The captured stack trace
 * @returns the stack, headed by the error's name and message
 */
export function stackWithHeader(error: ErrorHeader, stack: string): string {
  const firstFrame = stack.search(/^\s+at /m);
  const frames = firstFrame === -1 ? '' : stack.slice(firstFrame);
  const header = error.message ? `${error.name}: ${error.message}` : error.name;

  return frames ? `${header}\n${frames}` : header;
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
