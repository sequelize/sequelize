import ConnectionError from '../connection-error';

/**
 * Thrown when connection is not acquired due to timeout
 */
class ConnectionAcquireTimeoutError extends ConnectionError {
  constructor(cause: Error) {
    super(cause);
    this.name = 'SequelizeConnectionAcquireTimeoutError';
  }
}

export default ConnectionAcquireTimeoutError;
