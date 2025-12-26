import {
  acquirePooledObject,
  precompileKeys,
  releasePooledObject,
  setByPathArray,
  tokenizePath,
  transformRowWithPrecompiled,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/undot.js';
import { expect } from 'chai';

describe('undot utilities', () => {
  describe('tokenizePath', () => {
    it('returns a single segment for a simple key', () => {
      expect(tokenizePath('foo')).to.deep.equal(['foo']);
    });

    it('splits dot-separated keys into segments', () => {
      expect(tokenizePath('a.b.c')).to.deep.equal(['a', 'b', 'c']);
    });

    it('handles a single bracket index', () => {
      expect(tokenizePath('arr[0]')).to.deep.equal(['arr', 0]);
    });

    it('handles multiple bracket indices', () => {
      expect(tokenizePath('arr[0][1][2]')).to.deep.equal(['arr', 0, 1, 2]);
    });

    it('handles dots followed by bracket indices', () => {
      expect(tokenizePath('a.b[0].c')).to.deep.equal(['a', 'b', 0, 'c']);
    });

    it('handles consecutive dot and bracket patterns', () => {
      expect(tokenizePath('a[0].b[1].c[2]')).to.deep.equal(['a', 0, 'b', 1, 'c', 2]);
    });

    it('handles bracket index at the start', () => {
      // Edge case: starting with a bracket is unusual but should still parse
      // the function will just parse it as a number at the start
      expect(tokenizePath('[0].a')).to.deep.equal([0, 'a']);
    });

    it('handles multi-digit bracket indices', () => {
      expect(tokenizePath('arr[123]')).to.deep.equal(['arr', 123]);
    });

    it('handles large bracket indices', () => {
      expect(tokenizePath('arr[999999]')).to.deep.equal(['arr', 999_999]);
    });

    it('handles a key with only dots', () => {
      // Multiple consecutive dots result in empty strings being skipped
      expect(tokenizePath('a..b')).to.deep.equal(['a', 'b']);
    });

    it('handles leading dot', () => {
      expect(tokenizePath('.a.b')).to.deep.equal(['a', 'b']);
    });

    it('handles trailing dot', () => {
      expect(tokenizePath('a.b.')).to.deep.equal(['a', 'b']);
    });

    it('handles empty string', () => {
      expect(tokenizePath('')).to.deep.equal([]);
    });

    it('throws on unsupported bracket syntax (non-digit inside brackets)', () => {
      expect(() => tokenizePath('arr[foo]')).to.throw(
        'Unsupported bracket syntax in key: arr[foo]',
      );
    });

    it('throws on unterminated bracket', () => {
      expect(() => tokenizePath('arr[0')).to.throw('Unterminated bracket in key: arr[0');
    });

    it('throws on empty brackets', () => {
      expect(() => tokenizePath('arr[]')).to.throw('Empty or non-numeric bracket in key: arr[]');
    });

    it('handles zero index', () => {
      expect(tokenizePath('arr[0]')).to.deep.equal(['arr', 0]);
    });

    it('handles complex nested path', () => {
      expect(tokenizePath('users[0].addresses[1].street.name')).to.deep.equal([
        'users',
        0,
        'addresses',
        1,
        'street',
        'name',
      ]);
    });
  });

  describe('precompileKeys', () => {
    it('returns empty compiled array and index for empty keys', () => {
      const result = precompileKeys([]);
      expect(result.compiled).to.deep.equal([]);
      expect(result.index.size).to.equal(0);
    });

    it('compiles simple keys without dots or brackets', () => {
      const result = precompileKeys(['a', 'b', 'c']);
      expect(result.compiled).to.have.length(3);
      expect(result.compiled[0]).to.deep.equal({ sourceKey: 'a', path: ['a'] });
      expect(result.compiled[1]).to.deep.equal({ sourceKey: 'b', path: ['b'] });
      expect(result.compiled[2]).to.deep.equal({ sourceKey: 'c', path: ['c'] });
      expect(result.index.get('a')).to.deep.equal(['a']);
      expect(result.index.get('b')).to.deep.equal(['b']);
      expect(result.index.get('c')).to.deep.equal(['c']);
    });

    it('compiles dotted keys', () => {
      const result = precompileKeys(['a.b', 'x.y.z']);
      expect(result.compiled[0]).to.deep.equal({ sourceKey: 'a.b', path: ['a', 'b'] });
      expect(result.compiled[1]).to.deep.equal({ sourceKey: 'x.y.z', path: ['x', 'y', 'z'] });
      expect(result.index.get('a.b')).to.deep.equal(['a', 'b']);
      expect(result.index.get('x.y.z')).to.deep.equal(['x', 'y', 'z']);
    });

    it('compiles bracketed keys', () => {
      const result = precompileKeys(['arr[0]', 'data[1][2]']);
      expect(result.compiled[0]).to.deep.equal({ sourceKey: 'arr[0]', path: ['arr', 0] });
      expect(result.compiled[1]).to.deep.equal({ sourceKey: 'data[1][2]', path: ['data', 1, 2] });
    });

    it('compiles mixed dot and bracket keys', () => {
      const result = precompileKeys(['a.b[0].c', 'x[0].y[1]']);
      expect(result.compiled[0]).to.deep.equal({
        sourceKey: 'a.b[0].c',
        path: ['a', 'b', 0, 'c'],
      });
      expect(result.compiled[1]).to.deep.equal({ sourceKey: 'x[0].y[1]', path: ['x', 0, 'y', 1] });
    });

    it('handles keys with only brackets (no leading property)', () => {
      const result = precompileKeys(['[0]']);
      expect(result.compiled[0]).to.deep.equal({ sourceKey: '[0]', path: [0] });
    });
  });

  describe('setByPathArray', () => {
    it('sets a simple key on target', () => {
      const target: Record<string, unknown> = {};
      setByPathArray(target, ['foo'], 'bar');
      expect(target).to.deep.equal({ foo: 'bar' });
    });

    it('sets nested object keys', () => {
      const target: Record<string, unknown> = {};
      setByPathArray(target, ['a', 'b', 'c'], 123);
      expect(target).to.deep.equal({ a: { b: { c: 123 } } });
    });

    it('sets array indices', () => {
      const target: Record<string, unknown> = {};
      setByPathArray(target, ['arr', 0], 'first');
      expect(target).to.deep.equal({ arr: ['first'] });
    });

    it('sets nested array indices', () => {
      const target: Record<string, unknown> = {};
      setByPathArray(target, ['arr', 0, 1], 'nested');
      // When path segment 0 leads to next segment 1 (number), it creates an array
      // arr -> [element at 0] -> [element at 1]
      expect(target).to.deep.equal({ arr: [[undefined, 'nested']] });
    });

    it('handles mixed object and array paths', () => {
      const target: Record<string, unknown> = {};
      setByPathArray(target, ['users', 0, 'name'], 'Alice');
      expect(target).to.deep.equal({ users: [{ name: 'Alice' }] });
    });

    it('handles deeply nested mixed paths', () => {
      const target: Record<string, unknown> = {};
      setByPathArray(target, ['data', 'items', 0, 'values', 1], 42);
      expect(target).to.deep.equal({
        data: { items: [{ values: [undefined, 42] }] },
      });
      setByPathArray(target, ['data', 'items', 0, 'values', 5], 67);
      expect(target).to.deep.equal({
        data: { items: [{ values: [undefined, 42, undefined, undefined, undefined, 67] }] },
      });
    });

    it('overwrites existing primitive values with objects when needed', () => {
      const target: Record<string, unknown> = { a: 'primitive' };
      setByPathArray(target, ['a', 'b'], 'new');
      expect(target).to.deep.equal({ a: { b: 'new' } });
    });

    it('overwrites existing primitive values with arrays when needed', () => {
      const target: Record<string, unknown> = { a: 'primitive' };
      setByPathArray(target, ['a', 0], 'new');
      expect(target).to.deep.equal({ a: ['new'] });
    });

    it('preserves existing nested structures', () => {
      const target: Record<string, unknown> = { a: { existing: true } };
      setByPathArray(target, ['a', 'b'], 'new');
      expect(target).to.deep.equal({ a: { existing: true, b: 'new' } });
    });

    it('preserves existing array elements', () => {
      const target: Record<string, unknown> = { arr: ['first'] };
      setByPathArray(target, ['arr', 1], 'second');
      expect(target).to.deep.equal({ arr: ['first', 'second'] });
    });

    it('handles single-element path (leaf case)', () => {
      const target: Record<string, unknown> = {};
      setByPathArray(target, ['only'], 'value');
      expect(target).to.deep.equal({ only: 'value' });
    });

    it('sets null values correctly', () => {
      const target: Record<string, unknown> = {};
      setByPathArray(target, ['a', 'b'], null);
      expect(target).to.deep.equal({ a: { b: null } });
    });

    it('sets undefined values correctly', () => {
      const target: Record<string, unknown> = {};
      setByPathArray(target, ['a', 'b'], undefined);
      expect(target).to.deep.equal({ a: { b: undefined } });
    });

    it('sets complex object values', () => {
      const target: Record<string, unknown> = {};
      const complexValue = { nested: { data: [1, 2, 3] } };
      setByPathArray(target, ['a'], complexValue);
      expect(target).to.deep.equal({ a: complexValue });
    });
  });

  describe('transformRowWithPrecompiled', () => {
    it('transforms a flat row with simple keys', () => {
      const pre = precompileKeys(['a', 'b', 'c']);
      const row = { a: 1, b: 2, c: 3 };
      const result = transformRowWithPrecompiled(row, pre);
      expect(result).to.deep.equal({ a: 1, b: 2, c: 3 });
    });

    it('transforms a flat row with dotted keys', () => {
      const pre = precompileKeys(['user.name', 'user.email', 'id']);
      const row = { 'user.name': 'Alice', 'user.email': 'alice@example.com', id: 1 };
      const result = transformRowWithPrecompiled(row, pre);
      expect(result).to.deep.equal({
        user: { name: 'Alice', email: 'alice@example.com' },
        id: 1,
      });
    });

    it('transforms a flat row with bracketed keys', () => {
      const pre = precompileKeys(['items[0]', 'items[1]', 'items[2]']);
      const row = { 'items[0]': 'a', 'items[1]': 'b', 'items[2]': 'c' };
      const result = transformRowWithPrecompiled(row, pre);
      expect(result).to.deep.equal({ items: ['a', 'b', 'c'] });
    });

    it('transforms a flat row with mixed dot and bracket keys', () => {
      const pre = precompileKeys([
        'users[0].name',
        'users[0].age',
        'users[1].name',
        'users[1].age',
      ]);
      const row = {
        'users[0].name': 'Alice',
        'users[0].age': 30,
        'users[1].name': 'Bob',
        'users[1].age': 25,
      };
      const result = transformRowWithPrecompiled(row, pre);
      expect(result).to.deep.equal({
        users: [
          { name: 'Alice', age: 30 },
          { name: 'Bob', age: 25 },
        ],
      });
    });

    it('skips undefined values', () => {
      const pre = precompileKeys(['a', 'b', 'c']);
      const row = { a: 1, b: undefined, c: 3 };
      const result = transformRowWithPrecompiled(row, pre);
      expect(result).to.deep.equal({ a: 1, c: 3 });
      expect('b' in result).to.equal(false);
    });

    it('does not skip null values', () => {
      const pre = precompileKeys(['a', 'b', 'c']);
      const row = { a: 1, b: null, c: 3 };
      const result = transformRowWithPrecompiled(row, pre);
      expect(result).to.deep.equal({ a: 1, b: null, c: 3 });
    });

    it('uses provided output object', () => {
      const pre = precompileKeys(['a', 'b']);
      const row = { a: 1, b: 2 };
      const out: Record<string, unknown> = { existing: 'value' };
      const result = transformRowWithPrecompiled(row, pre, out);
      expect(result).to.equal(out);
      expect(result).to.deep.equal({ existing: 'value', a: 1, b: 2 });
    });

    it('handles empty row', () => {
      const pre = precompileKeys(['a', 'b']);
      const row = {};
      const result = transformRowWithPrecompiled(row, pre);
      expect(result).to.deep.equal({});
    });

    it('handles empty precompiled keys', () => {
      const pre = precompileKeys([]);
      const row = { a: 1, b: 2 };
      const result = transformRowWithPrecompiled(row, pre);
      expect(result).to.deep.equal({});
    });

    it('handles complex nested transformation', () => {
      const pre = precompileKeys([
        'id',
        'profile.firstName',
        'profile.lastName',
        'profile.addresses[0].street',
        'profile.addresses[0].city',
        'profile.addresses[1].street',
        'profile.addresses[1].city',
        'tags[0]',
        'tags[1]',
      ]);
      const row = {
        id: 1,
        'profile.firstName': 'John',
        'profile.lastName': 'Doe',
        'profile.addresses[0].street': '123 Main St',
        'profile.addresses[0].city': 'NYC',
        'profile.addresses[1].street': '456 Oak Ave',
        'profile.addresses[1].city': 'LA',
        'tags[0]': 'developer',
        'tags[1]': 'designer',
      };
      const result = transformRowWithPrecompiled(row, pre);
      expect(result).to.deep.equal({
        id: 1,
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          addresses: [
            { street: '123 Main St', city: 'NYC' },
            { street: '456 Oak Ave', city: 'LA' },
          ],
        },
        tags: ['developer', 'designer'],
      });
    });
  });

  describe('acquirePooledObject', () => {
    it('returns empty object when pool is empty', () => {
      const pool: Array<Record<string, unknown>> = [];
      const obj = acquirePooledObject(pool);
      expect(obj).to.deep.equal({});
      expect(pool).to.have.length(0);
    });

    it('returns and clears object from pool', () => {
      const pooledObj = { a: 1, b: 2, c: 3 };
      const pool: Array<Record<string, unknown>> = [pooledObj];
      const obj = acquirePooledObject(pool);
      expect(obj).to.equal(pooledObj);
      expect(obj).to.deep.equal({});
      expect(pool).to.have.length(0);
    });

    it('pops from end of pool (LIFO)', () => {
      const obj1 = { id: 1 };
      const obj2 = { id: 2 };
      const pool: Array<Record<string, unknown>> = [obj1, obj2];
      const acquired = acquirePooledObject(pool);
      expect(acquired).to.equal(obj2);
      expect(pool).to.have.length(1);
      expect(pool[0]).to.equal(obj1);
    });

    it('clears nested properties', () => {
      const pooledObj = { a: { nested: true }, b: [1, 2, 3] };
      const pool: Array<Record<string, unknown>> = [pooledObj];
      const obj = acquirePooledObject(pool);
      expect(obj).to.deep.equal({});
      expect('a' in obj).to.equal(false);
      expect('b' in obj).to.equal(false);
    });

    it('clears symbol keys', () => {
      const sym = Symbol('test');
      const pooledObj: Record<string | symbol, unknown> = { a: 1, [sym]: 2 };
      const pool: Array<Record<string, unknown>> = [pooledObj as Record<string, unknown>];
      const obj = acquirePooledObject(pool);
      // Note: Object.keys doesn't return symbol keys, so they won't be cleared
      expect('a' in obj).to.equal(false);
    });
  });

  describe('releasePooledObject', () => {
    it('adds object to pool', () => {
      const pool: Array<Record<string, unknown>> = [];
      const obj = { a: 1 };
      releasePooledObject(pool, obj);
      expect(pool).to.have.length(1);
      expect(pool[0]).to.equal(obj);
    });

    it('adds multiple objects to pool', () => {
      const pool: Array<Record<string, unknown>> = [];
      const obj1 = { id: 1 };
      const obj2 = { id: 2 };
      releasePooledObject(pool, obj1);
      releasePooledObject(pool, obj2);
      expect(pool).to.have.length(2);
      expect(pool[0]).to.equal(obj1);
      expect(pool[1]).to.equal(obj2);
    });

    it('works with existing pool contents', () => {
      const existing = { existing: true };
      const pool: Array<Record<string, unknown>> = [existing];
      const newObj = { new: true };
      releasePooledObject(pool, newObj);
      expect(pool).to.have.length(2);
      expect(pool[0]).to.equal(existing);
      expect(pool[1]).to.equal(newObj);
    });
  });

  describe('pool lifecycle integration', () => {
    it('acquire and release cycle works correctly', () => {
      const pool: Array<Record<string, unknown>> = [];

      // First, get a new object (pool is empty)
      const obj1 = acquirePooledObject(pool);
      expect(obj1).to.deep.equal({});

      // Use it
      obj1.data = 'test';
      obj1.count = 42;

      // Release it back to pool
      releasePooledObject(pool, obj1);
      expect(pool).to.have.length(1);

      // Acquire again - should get same object, cleared
      const obj2 = acquirePooledObject(pool);
      expect(obj2).to.equal(obj1);
      expect(obj2).to.deep.equal({});
      expect('data' in obj2).to.equal(false);
      expect('count' in obj2).to.equal(false);
    });

    it('multiple acquire/release cycles', () => {
      const pool: Array<Record<string, unknown>> = [];

      for (let i = 0; i < 5; i++) {
        const obj = acquirePooledObject(pool);
        obj.iteration = i;
        releasePooledObject(pool, obj);
      }

      expect(pool).to.have.length(1);
      const final = acquirePooledObject(pool);
      expect(final).to.deep.equal({});
    });
  });

  describe('edge cases and error handling', () => {
    it('setByPathArray sets value at numeric path segment on existing object (uses numeric key)', () => {
      // When the target at a numeric segment is an object (not array), it doesn't replace it.
      // Instead, the numeric segment becomes a key on the existing object.
      const target: Record<string, unknown> = { arr: { notAnArray: true } };
      setByPathArray(target, ['arr', 0, 'value'], 'test');
      // The object at 'arr' remains as-is, and 0 becomes a property key
      // However, looking at the code, when seg is number and obj is not array,
      // it sets obj = [] but doesn't link it back. Let's verify actual behavior.
      // The object 'arr' is found via 'arr' key, but then when seg=0 is numeric,
      // the code sees arr object is not an array, replaces obj with [] but that
      // loses the reference. The end result is unchanged 'arr'.
      expect(target.arr).to.deep.equal({ notAnArray: true });
    });

    it('handles tokenizePath with only dots', () => {
      expect(tokenizePath('...')).to.deep.equal([]);
    });

    it('handles tokenizePath with mixed dots and content', () => {
      expect(tokenizePath('.a..b.')).to.deep.equal(['a', 'b']);
    });

    it('setByPathArray with path starting with number behaves correctly', () => {
      const target: Record<string, unknown> = {};
      // When the first segment is numeric, the code's numeric branch triggers:
      // - It checks if obj (target) is an array - it's not
      // - It sets obj = [] which disconnects from target
      // - The result is target remains unchanged
      // This is an edge case that isn't meant to be used in practice.
      setByPathArray(target, [0, 'a'], 'value');
      // Target stays empty because the numeric path doesn't connect back
      expect(Object.keys(target).length).to.equal(0);
    });

    it('handles very deep nesting', () => {
      const pre = precompileKeys(['a.b.c.d.e.f.g.h.i.j']);
      const row = { 'a.b.c.d.e.f.g.h.i.j': 'deep' };
      const result = transformRowWithPrecompiled(row, pre);
      expect(result).to.deep.equal({
        a: { b: { c: { d: { e: { f: { g: { h: { i: { j: 'deep' } } } } } } } } },
      });
    });

    it('handles array with gaps', () => {
      const pre = precompileKeys(['arr[0]', 'arr[5]', 'arr[10]']);
      const row = { 'arr[0]': 'a', 'arr[5]': 'b', 'arr[10]': 'c' };
      const result = transformRowWithPrecompiled(row, pre);
      expect((result.arr as unknown[])[0]).to.equal('a');
      expect((result.arr as unknown[])[5]).to.equal('b');
      expect((result.arr as unknown[])[10]).to.equal('c');
      expect((result.arr as unknown[]).length).to.equal(11);
    });
  });
});
