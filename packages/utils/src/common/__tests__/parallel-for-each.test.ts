import { parallelForEach } from '@sequelize/utils';
import { expect } from 'chai';
import { setTimeout } from 'node:timers/promises';

describe('parallelForEach', () => {
  it('executes the callbacks in parallel', async () => {
    const array = [1, 2, 3];
    const order: number[] = [];

    await parallelForEach(array, async (value, index) => {
      await setTimeout((3 - index) * 100);
      order.push(value);
    });

    expect(order).to.deep.equal([3, 2, 1]);
  });

  it('treats holes as undefined', async () => {
    // eslint-disable-next-line no-sparse-arrays -- Testing sparse arrays
    const array = [1, , 3];
    const values: Array<number | undefined> = [];
    await parallelForEach(array, async value => {
      values.push(value);
    });

    expect(values).to.deep.equal([1, undefined, 3]);
  });

  it('should pass the correct index to the callback', async () => {
    const array = ['a', 'b', 'c'];
    const indices: number[] = [];
    await parallelForEach(array, async (_, index) => {
      indices.push(index);
    });

    expect(indices).to.deep.equal([0, 1, 2]);
  });
});
