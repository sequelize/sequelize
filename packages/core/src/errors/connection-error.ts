import { BaseError } from './base-error';

/**
 * A base class for all connection-related errors.
 *
 * The connection-specific error which triggered this one is available as {@link BaseError#cause}
 */
export class ConnectionError extends BaseError {
  constructor(parent?: Error) {
    super(parent ? parent.message : '', { cause: parent });
    this.name = 'SequelizeConnectionError';
  }
}
