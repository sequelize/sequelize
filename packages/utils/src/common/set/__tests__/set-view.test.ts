import { SetView } from '@sequelize/utils';
import { expect } from 'chai';

describe('SetView', () => {
  const view = new SetView(new Set(['value']));

  describe('size', () => {
    it('returns the number of unique elements in the Set', () => {
      expect(view.size).to.eq(1);
    });
  });

  describe('has', () => {
    it('returns a boolean indicating whether an element with the specified value exists in the Set or not', () => {
      expect(view.has('value')).to.be.true;
      expect(view.has('unknown')).to.be.false;
    });
  });

  describe('find', () => {
    it('returns the element if the callback function returns true', () => {
      expect(view.find(value => value === 'value')).to.eq('value');
    });

    it('returns undefined if the callback function does not return true for any element', () => {
      expect(view.find(value => value === 'unknown')).to.be.undefined;
    });
  });

  describe('Symbol.iterator', () => {
    it('returns an iterator', () => {
      expect([...view]).to.eql(['value']);
    });
  });

  describe('values', () => {
    it('returns an iterator', () => {
      expect([...view.values()]).to.eql(['value']);
    });
  });

  describe('toMutableSet', () => {
    it('returns a new Set', () => {
      const set = view.toMutableSet();
      expect(set).to.be.an.instanceOf(Set);

      expect([...set.values()]).to.deep.eq([...view.values()]);
    });
  });
});
