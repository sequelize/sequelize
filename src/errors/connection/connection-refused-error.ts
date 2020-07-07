import ConnectionError from '../connection-error';

/**
 * Thrown when a connection to a database is refused
 */
class ConnectionRefusedError extends ConnectionError {
  constructor(parent: Error) {
    super(parent);
    this.name = 'SequelizeConnectionRefusedError';
  }
}

export default ConnectionRefusedError;
