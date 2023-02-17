import { ConnectionError } from '../connection-error';

/**
 * Thrown when a connection to a database has a hostname that was not reachable
 */
export class HostNotReachableError extends ConnectionError {
  constructor(cause: Error) {
    super(cause);
    this.name = 'SequelizeHostNotReachableError';
  }
}
