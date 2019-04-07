'use strict';

const { CompositionError } = require('../../../errors');
const Utils = require('../../../utils');

/*
 * Self contained value representation
 *
 * It can be converted to an escaped sql string or to a binded param. It also
 * must be self contained, the escaper or binder should be part of the slot. It
 * is identified for being an instace of this class, otherwise reject (reflects
 * unsafe handling)
 *
 */
class Slot {
  constructor(value, field, options) {
    this.value = value;
    this.field = field;
    this.options = options || {};
  }
}

/*
 * It is a placeholder in a QueryItems instance
 *
 */
class Placeholder {
  constructor(name) {
    this.name = name;
  }
}

/*
  Buildind block for queries of any dialect

  Should be simple, secure and composable. It can hold three items: (sql) strings,
  value *slots* or placeholders. Keep this class simple, for higher abstractions
  build something else. This should not depend on dialect or db version.

  @private
 */
const composableMixin = BaseClass => class extends BaseClass {
  constructor(...items) {
    super();
    // Should clone *items* array. Should not copy *items* array by reference.
    this.items = this.constructor._processArgs(items);
  }
  get length() {
    return this.items.length;
  }
  static _processArgs(items) {
    // Should return new array
    return items.reduce((a, item) => {
      if (typeof item === 'string' || item instanceof Slot ||
        item instanceof Placeholder) {
        a.push(item);
        return a;
      }
      if (item instanceof this) {
        a.push(...item.items);
        return a;
      }

      throw new CompositionError('Invalid query item', item);
    }, []);
  }
  add(...items) {
    this.items.push(...this.constructor._processArgs(items));

    return this;
  }
  prepend(...items) {
    this.items.unshift(...this.constructor._processArgs(items));

    return this;
  }
  set(...items) {
    this.items = this.constructor._processArgs(items);

    return this;
  }
  clone() {
    const clone = new this.constructor();
    clone.items = this.items.slice(0);
    return clone;
  }
  static from(array) {
    const composition = new this();
    composition.items = this._processArgs(array);

    return composition;
  }
};

class Composition extends composableMixin(Object) {}

/*
 * Holds multiple compositions or objects cohercible to compositions
 *
 * Useful for grouping and manipulating anonymous compositions. It
 * holds compositions or single composition items.
 *
 * Concatenable methods.
 */

class CompositionGroup {
  constructor(...args) {
    this.compositions = args;
  }
  get length() {
    return this.compositions.length;
  }
  add(...compositions) {
    this.compositions.push(...compositions);

    return this;
  }
  // Inserts a new composition(*spacer*) between existing compositions
  space(spacer) {
    if (this.compositions.length === 0) return this;

    this.compositions = Utils.interleave(this.compositions, spacer);

    return this;
  }
  merge(group) {
    this.compositions = this.compositions.concat(group.compositions);

    return this;
  }
  slice(...args) {
    const compositions = this.compositions.slice.apply(this.compositions, args);

    return this.constructor.from(compositions);
  }
  toComposition() {
    return Composition.from(this.compositions);
  }
  static from(array) {
    const group = new this();
    group.compositions = array.slice(0);

    return group;
  }
}

exports.composableMixin = composableMixin;
exports.Slot = Slot;
exports.Placeholder = Placeholder;
exports.Composition = Composition;
exports.CompositionGroup = CompositionGroup;
