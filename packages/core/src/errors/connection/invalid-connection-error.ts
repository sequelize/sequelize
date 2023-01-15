import { ConnectionError } from '../connection-error';

/**
 * Thrown when a connection to a database has invalid values for any of the connection parameters
 */
export class InvalidConnectionError extends ConnectionError {
  constructor(cause: Error) {
    super(cause);
    this.name = 'SequelizeInvalidConnectionError';
  }
}
