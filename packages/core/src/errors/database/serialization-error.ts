import type { DatabaseErrorParent } from '../database-error';
import { DatabaseError } from '../database-error';

/**
 * Thrown when a query fails because a concurrent transaction changed the rows it relied on,
 * and the database could not serialize the two transactions. The transaction has to be retried.
 */
export class SerializationError extends DatabaseError {
  constructor(parent: DatabaseErrorParent) {
    super(parent);
    this.name = 'SequelizeSerializationError';
  }
}
