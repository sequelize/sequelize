import { expect } from 'chai';
import { combinedIterator } from '../combined-iterator.js';

describe('combinedIterator', () => {
  it('chains iterables', () => {
    const iter1 = [1, 2, 3];
    const iter2 = new Set([4, 5, 6]);

    const combined = combinedIterator(iter1, iter2);

    const result = [...combined];
    expect(result).to.deep.eq([1, 2, 3, 4, 5, 6]);
  });
});
