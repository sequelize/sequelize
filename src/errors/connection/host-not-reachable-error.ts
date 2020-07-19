import ConnectionError from '../connection-error';

/**
 * Thrown when a connection to a database has a hostname that was not reachable
 */
class HostNotReachableError extends ConnectionError {
  constructor(parent: Error) {
    super(parent);
    this.name = 'SequelizeHostNotReachableError';
  }
}

export default HostNotReachableError;
