import { ErrorOptions, stackWithHeader } from '../base-error';
import DatabaseError, { DatabaseErrorParent } from '../database-error';

/**
 * Thrown when a database query times out because of a deadlock
 */
class TimeoutError extends DatabaseError {
  constructor(parent: DatabaseErrorParent, options: ErrorOptions = {}) {
    super(parent, options);
    this.name = 'SequelizeTimeoutError';

    if (options.stack) {
      this.stack = stackWithHeader(this, options.stack);
    }
  }
}

export default TimeoutError;
