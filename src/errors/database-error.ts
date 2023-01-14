import type { CommonErrorProperties, SequelizeErrorOptions } from './base-error';
import BaseError from './base-error';

export interface DatabaseErrorParent extends Error, Pick<CommonErrorProperties, 'sql'> {
  /** The parameters for the sql that triggered the error */
  readonly parameters?: object;
}

export interface DatabaseErrorSubclassOptions extends SequelizeErrorOptions {
  cause?: DatabaseErrorParent;

  /**
   * @deprecated use {@link DatabaseErrorSubclassOptions.cause}
   */
  parent?: DatabaseErrorParent;
  message?: string;
}

/**
 * A base class for all database related errors.
 */
class DatabaseError
  extends BaseError
  implements DatabaseErrorParent, CommonErrorProperties {
  sql: string;
  parameters: object;

  declare cause: DatabaseErrorParent;

  /**
   * @param parent The database specific error which triggered this one
   * @param options
   */
  constructor(parent: DatabaseErrorParent, options: SequelizeErrorOptions = {}) {
    super(parent.message, { cause: parent });
    this.name = 'SequelizeDatabaseError';

    this.sql = parent.sql;
    this.parameters = parent.parameters ?? {};

    if (options.stack) {
      this.stack = [
        this.stack,
        'From original error:',
        options.stack.split('\n').slice(1).join('\n'),
      ].join('\n');
    }
  }
}

export default DatabaseError;
