import {
  combinedIterator,
  count,
  every,
  find,
  isIterable,
  join,
  map,
  some,
} from '@sequelize/utils';
import { expect } from 'chai';

describe('combinedIterator', () => {
  it('chains iterables', () => {
    const iter1 = [1, 2, 3];
    const iter2 = new Set([4, 5, 6]);

    const combined = combinedIterator(iter1, iter2);

    isIterable.assert(combined);

    const result = [...combined];
    expect(result).to.deep.eq([1, 2, 3, 4, 5, 6]);
  });
});

describe('count', () => {
  it('returns the number of elements that match the predicate', () => {
    const iter = [1, 2, 3, 4, 5, 6];

    const result = count(iter, x => x % 2 === 0);

    expect(result).to.eq(3);
  });
});

describe('every', () => {
  it('returns true if all elements match the predicate', () => {
    const iter = [1, 2, 3, 4, 5, 6];

    const areAllEven = every(iter, x => x % 2 === 0);
    const areAllPositive = every(iter, x => x > 0);

    expect(areAllEven).to.be.false;
    expect(areAllPositive).to.be.true;
  });

  it('always returns true if the iterable is empty', () => {
    const result = every([], () => false);

    expect(result).to.be.true;
  });
});

describe('find', () => {
  it('returns the first element that matches the predicate', () => {
    const iter = [1, 2, 3, 4, 5, 6];

    const result = find(iter, x => x % 2 === 0);

    expect(result).to.eq(2);
  });
});

describe('join', () => {
  it('joins the strings of an iterable into a string', () => {
    expect(join(['a', 'b', 'c'], '-')).to.eq('a-b-c');
    expect(join([], '-')).to.eq('');
  });
});

describe('map', () => {
  it('maps the iterable', () => {
    const iter = [1, 2, 3, 4, 5, 6];

    const result = map(iter, x => x * 2);

    isIterable.assert(result);

    expect([...result]).to.deep.eq([2, 4, 6, 8, 10, 12]);
  });
});

describe('some', () => {
  it('returns true if at least one element matches the predicate', () => {
    const iter = [1, 2, 3, 4, 5, 6];

    const hasAnEven = some(iter, x => x % 2 === 0);
    const hasANegative = some(iter, x => x < 0);

    expect(hasAnEven).to.be.true;
    expect(hasANegative).to.be.false;
  });

  it('always returns false if the iterable is empty', () => {
    const result = some([], () => true);

    expect(result).to.be.false;
  });
});
