'use strict';

class AsyncQueue {
  constructor() {
    this.previous = Promise.resolve();
    this.closed = false;
    this.rejectCurrent = () => {};
  }
  close() {
    this.closed = true;
    this.rejectCurrent(new Error('the connection was closed before this query could finish executing'));
  }
  enqueue(callback) {
    // This outer promise might seems superflous since down below we return callback().then(resolve, reject).
    // However, this ensures that this.previous will never be a rejected promise so the queue will
    // always keep going, while still communicating rejection from callback to the user.
    return new Promise((resolve, reject) => {
      this.previous = this.previous.then(
        () => {
          this.rejectCurrent = reject;
          if (this.closed) {
            return reject(new Error('the connection was closed before this query could be executed'));
          }
          return callback().then(resolve, reject);
        }
      );
    });
  }
}

module.exports = AsyncQueue;
