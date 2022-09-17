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
      this.stack = mergeStacks(this.stack, options.stack);
    }
  }
}

function mergeStacks(stackWithMessage: string | undefined, stackWithTrace: string): string {
  if (!stackWithMessage) {
    return stackWithTrace;
  }

  const messageEndIndex = stackWithMessage.indexOf('    at ');
  if (messageEndIndex === -1) {
    return stackWithTrace;
  }

  const traceStartIndex = stackWithTrace.indexOf('    at ');
  if (traceStartIndex === -1) {
    return stackWithTrace;
  }

  const message: string = stackWithMessage.slice(0, messageEndIndex);
  const trace: string = stackWithTrace.slice(traceStartIndex);

  return message + trace;
}

export default DatabaseError;
