import { ConnectionError } from '../connection-error';

/**
 * Thrown when acquiring a connection from the Sequelize Pool times out.
 */
export class ConnectionAcquireTimeoutError extends ConnectionError {
  constructor(_message: string, cause: Error) {
    super(cause);
    this.name = 'SequelizeConnectionAcquireTimeoutError';
  }
}
