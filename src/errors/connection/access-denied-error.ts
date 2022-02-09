import ConnectionError from '../connection-error';

/**
 * Thrown when a connection to a database is refused due to insufficient privileges
 */
class AccessDeniedError extends ConnectionError {
  constructor(parent: Error) {
    super(parent);
    this.name = 'SequelizeAccessDeniedError';
  }
}

export default AccessDeniedError;
