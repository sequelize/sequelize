import BaseError from './base-error';

/**
 * A base class for all connection related errors.
 */
class ConnectionError extends BaseError {
  /** The connection specific error which triggered this one */
  parent: Error;
  original: Error;

  constructor(parent: Error) {
    super(parent ? parent.message : '');
    this.name = 'SequelizeConnectionError';
    this.parent = parent;
    this.original = parent;
  }
}

export default ConnectionError;
