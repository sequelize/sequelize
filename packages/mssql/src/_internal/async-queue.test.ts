import { ConnectionError } from '@sequelize/core';
import { assert, expect } from 'chai';
import sinon from 'sinon';
import { AsyncQueueError } from '../async-queue-error';
import { AsyncQueue } from './async-queue';

const asyncFunction = async () => 'test';

describe('AsyncQueue', () => {
  let queue: AsyncQueue;

  beforeEach(() => {
    queue = new AsyncQueue();
  });

  it('should initialize correctly', () => {
    assert(queue instanceof AsyncQueue);
    expect(queue.closed).to.be.false;
  });

  it('should close correctly', () => {
    queue.close();
    expect(queue.closed).to.be.true;
  });

  it('should enqueue and execute function correctly', async () => {
    const mockAsyncFunction = sinon.stub().resolves('test');
    const result = await queue.enqueue(mockAsyncFunction);
    expect(result).to.equal('test');
    expect(mockAsyncFunction.calledOnce).to.be.true;
  });

  it('should reject if closed before execution', async () => {
    queue.close();
    try {
      await queue.enqueue(asyncFunction);
    } catch (error) {
      assert(error instanceof ConnectionError);
      expect(error.cause).to.be.instanceOf(
        AsyncQueueError,
        'the connection was closed before this query could be executed',
      );
    }
  });

  it('should reject if closed during execution', async () => {
    const promise = queue.enqueue(asyncFunction);
    queue.close();
    try {
      await promise;
    } catch (error) {
      assert(error instanceof ConnectionError);
      expect(error.cause).to.be.instanceOf(
        AsyncQueueError,
        'the connection was closed before this query could finish executing',
      );
    }
  });
});
