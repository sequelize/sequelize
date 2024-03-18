import { arrayFromAsync } from '@sequelize/utils';
import { expect } from 'chai';

describe('arrayFromAsync', () => {
  it('returns an array from an async iterable', async () => {
    async function* asyncGenerator() {
      yield 1;
      yield 2;
      // eslint-disable-next-line -- redundant but still needs to be tested
      yield Promise.resolve(3);
    }

    const result = await arrayFromAsync(asyncGenerator());

    expect(result).to.deep.eq([1, 2, 3]);
  });
});
