import ConnectionError from '../connection-error';

/**
 * Thrown when a connection to a database times out
 */
class ConnectionTimedOutError extends ConnectionError {
  constructor(parent: Error) {
    super(parent);
    this.name = 'SequelizeConnectionTimedOutError';
  }
}

export default ConnectionTimedOutError;
