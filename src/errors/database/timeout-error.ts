import DatabaseError, { SQLError } from './../database-error';

/**
 * Thrown when a database query times out because of a deadlock
 */
class TimeoutError extends DatabaseError {
  constructor(parent: SQLError) {
    super(parent);
    this.name = 'SequelizeTimeoutError';
  }
}

export default TimeoutError;
