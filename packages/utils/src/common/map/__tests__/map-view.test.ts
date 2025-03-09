import { MapView } from '@sequelize/utils';
import { expect } from 'chai';
import NodeUtils from 'node:util';

describe('MapView', () => {
  const view = new MapView(new Map([['key', 'value']]));

  describe('size', () => {
    it('returns the number of elements in the Map', () => {
      expect(view.size).to.eq(1);
    });
  });

  describe('get', () => {
    it('returns the element associated with the specified key', () => {
      expect(view.get('key')).to.eq('value');
    });

    it('returns undefined if no element is associated with the specified key', () => {
      expect(view.get('unknown')).to.be.undefined;
    });
  });

  describe('getOrThrow', () => {
    it('returns the element associated with the specified key', () => {
      expect(view.getOrThrow('key')).to.eq('value');
    });

    it('throws an error if no element is associated with the specified key', () => {
      expect(() => view.getOrThrow('unknown')).to.throw('No value found for key: unknown');
    });
  });

  describe('has', () => {
    it('returns a boolean indicating whether an element with the specified key exists or not', () => {
      expect(view.has('key')).to.be.true;
      expect(view.has('unknown')).to.be.false;
    });
  });

  describe('Symbol.iterator', () => {
    it('returns an iterator', () => {
      expect([...view]).to.eql([['key', 'value']]);
    });
  });

  describe('entries', () => {
    it('returns an iterator', () => {
      expect([...view.entries()]).to.eql([['key', 'value']]);
    });
  });

  describe('keys', () => {
    it('returns an iterator', () => {
      expect([...view.keys()]).to.eql(['key']);
    });
  });

  describe('values', () => {
    it('returns an iterator', () => {
      expect([...view.values()]).to.eql(['value']);
    });
  });

  describe('toMutableMap', () => {
    it('returns a new Map', () => {
      const map = view.toMutableMap();
      expect(map).to.be.an.instanceOf(Map);

      expect([...map.entries()]).to.deep.eq([...view.entries()]);
    });
  });

  it('reflects mutations done to the original map', () => {
    const original = new Map([['key', 'value']]);
    const newView = new MapView(original);

    original.set('newKey', 'newValue');

    expect(newView.get('newKey')).to.eq('newValue');
  });

  it('is inspectable', () => {
    expect(NodeUtils.inspect(view)).to.eq("MapView(1) { 'key' => 'value' }");
  });
});
