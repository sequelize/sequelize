import BaseError from '../../errors/base-error';
import ConnectionError from '../../errors/connection-error';

/**
 * Thrown when a connection to a database is closed while an operation is in progress
 */
export class AsyncQueueError extends BaseError {
  constructor(message: string) {
    super(message);
    this.name = 'SequelizeAsyncQueueError';
  }
}

class AsyncQueue {
  previous: Promise<unknown>;
  closed: boolean;
  rejectCurrent: (reason?: any) => void;

  constructor() {
    this.previous = Promise.resolve();
    this.closed = false;
    this.rejectCurrent = () => {
      /** do nothing */
    };
  }

  close() {
    this.closed = true;
    this.rejectCurrent(
      new ConnectionError(
        new AsyncQueueError(
          'the connection was closed before this query could finish executing'
        )
      )
    );
  }

  enqueue(asyncFunction: (...args: any[]) => Promise<unknown>) {
    // This outer promise might seems superflous since down below we return asyncFunction().then(resolve, reject).
    // However, this ensures that this.previous will never be a rejected promise so the queue will
    // always keep going, while still communicating rejection from asyncFunction to the user.
    return new Promise((resolve, reject) => {
      this.previous = this.previous.then(() => {
        this.rejectCurrent = reject;
        if (this.closed) {
          return reject(
            new ConnectionError(
              new AsyncQueueError(
                'the connection was closed before this query could be executed'
              )
            )
          );
        }
        return asyncFunction().then(resolve, reject);
      });
    });
  }
}

export default AsyncQueue;
