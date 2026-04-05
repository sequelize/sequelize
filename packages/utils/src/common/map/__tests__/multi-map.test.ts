import { MultiMap } from '@sequelize/utils';
import { expect } from 'chai';

describe('MultiMap', () => {
  describe('constructor', () => {
    it('ignores duplicate values', () => {
      const multiMap = new MultiMap([['key', ['value', 'value']]]);
      expect(multiMap.get('key')).to.deep.eq(['value']);
    });

    it('does not store empty values', () => {
      const multiMap = new MultiMap([['key', []]]);
      expect(multiMap.has('key')).to.eq(false);
      expect(multiMap.size).to.eq(0);
    });
  });

  describe('size', () => {
    it('returns the number of keys in the Map', () => {
      const multiMap = new MultiMap();
      expect(multiMap.size).to.eq(0);

      multiMap.append('key', 'value1');
      expect(multiMap.size).to.eq(1);

      multiMap.append('key', 'value2');
      expect(multiMap.size).to.eq(1);

      multiMap.append('key2', 'value');
      expect(multiMap.size).to.eq(2);
    });
  });

  describe('clear', () => {
    it('clears all the keys in the Map', () => {
      const multiMap = new MultiMap([['key', ['value']]]);

      multiMap.clear();

      expect(multiMap.size).to.eq(0);
    });
  });

  describe('append', () => {
    it('appends a value to the key', () => {
      const multiMap = new MultiMap();

      multiMap.append('key', 'value1');
      expect(multiMap.get('key')).to.deep.eq(['value1']);

      multiMap.append('key', 'value2');
      expect(multiMap.get('key')).to.deep.eq(['value1', 'value2']);

      // ignores duplicate values
      multiMap.append('key', 'value1');
      expect(multiMap.get('key')).to.deep.eq(['value1', 'value2']);
    });
  });

  describe('deleteValue', () => {
    it('deletes a value from the key', () => {
      const multiMap = new MultiMap([['key', ['value']]]);

      multiMap.deleteValue('key', 'value');
      expect(multiMap.get('key')).to.deep.eq([]);
      expect(multiMap.has('key')).to.eq(false);
      expect(multiMap.size).to.eq(0);
    });
  });

  describe('delete', () => {
    it('deletes a key from the Map', () => {
      const multiMap = new MultiMap([['key', ['value']]]);

      multiMap.delete('key');
      expect(multiMap.size).to.eq(0);
      expect(multiMap.get('key')).to.deep.eq([]);
    });
  });

  describe('keys', () => {
    it('returns the keys of the Map', () => {
      const multiMap = new MultiMap([['key', ['value']]]);

      expect([...multiMap.keys()]).to.deep.eq(['key']);
    });
  });

  describe('count', () => {
    it('returns the number of values for the key', () => {
      const multiMap = new MultiMap([['key', ['value1', 'value2']]]);

      expect(multiMap.count('key')).to.eq(2);
    });

    it('returns 0 if the key does not exist', () => {
      const multiMap = new MultiMap();

      expect(multiMap.count('key')).to.eq(0);
    });
  });

  describe('values', () => {
    it('returns the values of the Map', () => {
      const multiMap = new MultiMap([['key', ['value1', 'value2']]]);

      expect([...multiMap.values()]).to.deep.eq([['value1', 'value2']]);
    });
  });

  describe('entries', () => {
    it('returns the entries of the Map', () => {
      const multiMap = new MultiMap([['key', ['value1', 'value2']]]);

      expect([...multiMap.entries()]).to.deep.eq([['key', ['value1', 'value2']]]);
    });
  });

  describe('has', () => {
    it('returns true if the key exists', () => {
      const multiMap = new MultiMap([['key', ['value']]]);

      expect(multiMap.has('key')).to.eq(true);
    });

    it('returns false if the key does not exist', () => {
      const multiMap = new MultiMap();

      expect(multiMap.has('key')).to.eq(false);
    });
  });

  describe('Symbol.iterator', () => {
    it('returns the iterator of the Map', () => {
      const multiMap = new MultiMap([['key', ['value1', 'value2']]]);

      expect([...multiMap[Symbol.iterator]()]).to.deep.eq([['key', ['value1', 'value2']]]);
    });
  });

  describe('get', () => {
    it('returns the values of the key', () => {
      const multiMap = new MultiMap([['key', ['value1', 'value2']]]);

      expect(multiMap.get('key')).to.deep.eq(['value1', 'value2']);
    });

    it('returns an empty array if the key does not exist', () => {
      const multiMap = new MultiMap();

      expect(multiMap.get('key')).to.deep.eq([]);
    });
  });

  describe('set', () => {
    it('sets the values of the key', () => {
      const multiMap = new MultiMap();

      multiMap.set('key', ['value1', 'value2']);
      expect(multiMap.get('key')).to.deep.eq(['value1', 'value2']);
    });

    it('ignores duplicate values', () => {
      const multiMap = new MultiMap();

      multiMap.set('key', ['value', 'value']);
      expect(multiMap.get('key')).to.deep.eq(['value']);
    });

    it('deletes empty values', () => {
      const multiMap = new MultiMap();

      multiMap.set('key', ['value']);
      multiMap.set('key', []);

      expect(multiMap.has('key')).to.eq(false);
      expect(multiMap.size).to.eq(0);
    });

    it('ignores mutations done after setting the value', () => {
      const multiMap = new MultiMap();
      const values = ['value1', 'value2'];

      multiMap.set('key', values);
      values.push('value3');

      expect(multiMap.get('key')).to.deep.eq(['value1', 'value2']);
    });
  });
});
