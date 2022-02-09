import ConnectionError from '../connection-error';

/**
 * Thrown when connection is not acquired due to timeout
 */
class ConnectionAcquireTimeoutError extends ConnectionError {
  constructor(parent: Error) {
    super(parent);
    this.name = 'SequelizeConnectionAcquireTimeoutError';
  }
}

export default ConnectionAcquireTimeoutError;
