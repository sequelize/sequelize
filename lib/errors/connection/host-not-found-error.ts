import ConnectionError from '../connection-error';

/**
 * Thrown when a connection to a database has a hostname that was not found
 */
class HostNotFoundError extends ConnectionError {
  constructor(parent: Error) {
    super(parent);
    this.name = 'SequelizeHostNotFoundError';
  }
}

export default HostNotFoundError;
