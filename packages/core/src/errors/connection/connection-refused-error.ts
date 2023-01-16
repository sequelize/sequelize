import ConnectionError from '../connection-error';

/**
 * Thrown when a connection to a database is refused
 */
class ConnectionRefusedError extends ConnectionError {
  constructor(cause: Error) {
    super(cause);
    this.name = 'SequelizeConnectionRefusedError';
  }
}

export default ConnectionRefusedError;
