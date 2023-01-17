import { ConnectionError } from '../connection-error';

/**
 * Thrown when a connection to a database is refused due to insufficient privileges
 */
export class AccessDeniedError extends ConnectionError {
  constructor(cause: Error) {
    super(cause);
    this.name = 'SequelizeAccessDeniedError';
  }
}
