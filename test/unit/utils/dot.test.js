'use strict';

const chai = require('chai');
const expect = chai.expect;
const Dot = require(__dirname + '/../../../lib/utils/dot');

describe('Utils.dot', () => {
  describe('get', () => {
    it('reads a nested path', () => {
      expect(Dot.get({ a: { b: { c: 1 } } }, 'a.b.c')).to.equal(1);
    });

    it('reads a single segment path', () => {
      expect(Dot.get({ a: 1 }, 'a')).to.equal(1);
    });

    it('returns the value by reference', () => {
      const leaf = { c: 1 };
      expect(Dot.get({ a: { b: leaf } }, 'a.b')).to.equal(leaf);
    });

    it('returns undefined for an unreachable path', () => {
      expect(Dot.get({ a: { b: 1 } }, 'a.b.c')).to.be.undefined;
      expect(Dot.get({ a: null }, 'a.b')).to.be.undefined;
      expect(Dot.get({}, 'a.b.c')).to.be.undefined;
      expect(Dot.get({ a: undefined }, 'a.b')).to.be.undefined;
    });

    it('returns undefined for a null or undefined object', () => {
      expect(Dot.get(null, 'a.b')).to.be.undefined;
      expect(Dot.get(undefined, 'a.b')).to.be.undefined;
    });

    it('distinguishes a null leaf from an unreachable path', () => {
      expect(Dot.get({ a: { b: null } }, 'a.b')).to.be.null;
    });

    it('reads empty path segments', () => {
      expect(Dot.get({ a: { '': { b: 1 } } }, 'a..b')).to.equal(1);
    });

    it('reads numeric segments without treating them as array indexes', () => {
      expect(Dot.get({ a: { 0: 'x' } }, 'a.0')).to.equal('x');
      expect(Dot.get({ a: ['x'] }, 'a.0')).to.equal('x');
    });

    it('does not parse bracket notation', () => {
      expect(Dot.get({ a: { 0: 'x' } }, 'a[0]')).to.be.undefined;
    });
  });

  describe('set', () => {
    it('writes a nested path, creating namespaces', () => {
      const target = {};
      Dot.set(target, 'a.b.c', 1);
      expect(target).to.deep.equal({ a: { b: { c: 1 } } });
    });

    it('accepts a pre-split path', () => {
      const target = {};
      Dot.set(target, ['a', 'b'], 1);
      expect(target).to.deep.equal({ a: { b: 1 } });
    });

    it('writes a single segment path', () => {
      const target = {};
      Dot.set(target, 'a', 1);
      expect(target).to.deep.equal({ a: 1 });
    });

    it('preserves sibling keys and existing namespaces', () => {
      const existing = { b: 1 };
      const target = { a: existing, z: 9 };
      Dot.set(target, 'a.c', 2);
      expect(target).to.deep.equal({ a: { b: 1, c: 2 }, z: 9 });
      expect(target.a).to.equal(existing);
    });

    it('overwrites an existing leaf', () => {
      const target = { a: { b: 1 } };
      Dot.set(target, 'a.b', 2);
      expect(target).to.deep.equal({ a: { b: 2 } });
    });

    it('replaces an undefined segment with a namespace', () => {
      const target = { a: undefined };
      Dot.set(target, 'a.b', 1);
      expect(target).to.deep.equal({ a: { b: 1 } });
    });

    it('creates plain objects for numeric segments, not arrays', () => {
      const target = {};
      Dot.set(target, 'meta.items.0.name', 'x');
      expect(target).to.deep.equal({ meta: { items: { 0: { name: 'x' } } } });
      expect(Array.isArray(target.meta.items)).to.be.false;
    });

    it('writes empty path segments', () => {
      const target = {};
      Dot.set(target, 'a..b', 1);
      expect(target).to.deep.equal({ a: { '': { b: 1 } } });
    });

    it('throws when a non-object occupies part of the path', () => {
      expect(() => Dot.set({ a: 1 }, 'a.b', 2)).to.throw(/not suitable for a nested value/);
      expect(() => Dot.set({ a: null }, 'a.b', 2)).to.throw(/not suitable for a nested value/);
      expect(() => Dot.set({ a: 'str' }, 'a.b.c', 2)).to.throw(/not suitable for a nested value/);
    });

    it('ignores paths with a prototype-reaching segment', () => {
      for (const path of [
        '__proto__.polluted',
        'constructor.prototype.polluted',
        'a.__proto__.polluted',
        'a.b.prototype',
        'a.constructor.b'
      ]) {
        const target = {};
        Dot.set(target, path, true);
        expect(target).to.deep.equal({});
      }

      expect({}.polluted).to.be.undefined;
      expect(Object.prototype.polluted).to.be.undefined;
    });

    it('ignores a prototype-reaching segment given as a pre-split path', () => {
      const target = {};
      Dot.set(target, ['a', '__proto__', 'polluted'], true);
      expect(target).to.deep.equal({});
      expect({}.polluted).to.be.undefined;
    });
  });
});
