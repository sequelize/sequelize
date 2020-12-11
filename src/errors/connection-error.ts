import BaseError from './base-error';

/**
 * A base class for all connection related parents.
 */
class ConnectionError extends BaseError {
  parent: Error | undefined;
  original: Error | undefined;

  constructor(parent?: Error) {
    super(parent ? parent.message : '');
    this.name = 'SequelizeConnectionError';

    if (parent) {
      this.parent = parent;
      this.original = parent;
    }
  }
}

export default ConnectionError;
