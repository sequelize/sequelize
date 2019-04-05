'use strict';

const { Composition } = require('./composition');

/*
 * Named collections of Composition elements.
 *
 * Useful for organizing and manipulating the different parts of a query.
 * Allow disordered query building and easy substitution of query parts. Flexible,
 * non-nested and non-exahustive organization.
 */

class QueryProto {
  constructor(proto) {
    if (proto) {
      this.set(proto);
    } else {
      // Should clone Composition, NOT copy shallow references
      for (const key of this.constructor.partNames) {
        this[key] = new Composition();
      }
    }
  }
  static get partNames() {
    return [];
  }
  set(proto) {
    // Should clone proto into this object, NOT copy shallow references

    for (const key of this.constructor.partNames) {
      this[key] = new Composition();

      if (proto[key] && proto[key].length) {
        this[key] = proto[key].clone();
      } else {
        this[key] = new Composition();
      }
    }

    return this;
  }
  clone() {
    // Should clone Composition, NOT copy shallow references
    const clone = new this.constructor();

    for (const key of this.constructor.partNames) {
      clone[key] = this[key].clone();
    }

    return clone;
  }
  toComposition() {
    throw new Error(`Class ${this.constructor.name} has not implemented toComposition method`);
  }
}

module.exports.QueryProto = QueryProto;

class SelectProto extends QueryProto {
  static get partNames() {
    return ['attributes', 'from', 'join', 'where', 'group',
      'having', 'order', 'page', 'lock'];
  }
  toComposition() {
    const composition = new Composition();
    composition.add('SELECT');

    if (this.attributes.length) {
      composition.add(' ', this.attributes);
    } else {
      composition.add(' *');
    }

    if (! (this.from && this.from.length)) {
      throw new Error('Missing FROM clause in select proto query');
    }

    composition.add(' FROM ', this.from);

    // Each join should come with its own join linker
    if (this.join.length) composition.add(' ', this.join);
    if (this.where.length) composition.add(' WHERE ', this.where);
    if (this.group.length) composition.add(' GROUP BY ', this.group);
    if (this.having.length) composition.add(' HAVING ', this.having);
    if (this.order.length) composition.add(' ORDER BY ', this.order);
    // Each dialect has its own pagination and lock syntax
    if (this.page.length) composition.add(' ', this.page);
    if (this.lock.length) composition.add(' ', this.lock);

    return composition;
  }
}

module.exports.SelectProto = SelectProto;

class InsertProto extends QueryProto {
  static get partNames() {
    return ['preQuery', 'flags', 'table', 'ignoreDups', 'attributes',
      'output', 'values', 'onConflict', 'return', 'postQuery'];
  }
  toComposition() {
    if (!this.table || !this.table.length) {
      throw new Error('Missing table in INSERT query');
    }
    if (!this.values || !this.values.length) {
      throw new Error('Missing values in INSERT query');
    }

    const composition = new Composition();

    if (this.preQuery.length) composition.add(this.preQuery);
    composition.add('INSERT');
    if (this.flags.length) composition.add(' ', this.flags);
    composition.add(' INTO ', this.table);
    if (this.attributes.length) composition.add(' (', this.attributes, ')');
    if (this.output.length) composition.add(' ', this.output);
    // Can be VALUES (...) or a query
    composition.add(' ', this.values);
    if (this.onConflict.length) composition.add(' ', this.onConflict);
    if (this.return.length) composition.add(' ', this.return);
    if (this.postQuery.length) composition.add(this.postQuery);

    return composition;
  }
}

module.exports.InsertProto = InsertProto;

class UpdateProto extends QueryProto {
  static get partNames() {
    return ['preQuery', 'flags', 'table', 'output',
      'values', 'where', 'limit', 'return', 'postQuery'];
  }
  toComposition() {
    if (! (this.table && this.table.length)) {
      throw new Error('Missing table in UPDATE query');
    }
    if (! (this.values && this.values.length)) {
      throw new Error('Missing values in UPDATE query');
    }

    const composition = new Composition();

    if (this.preQuery.length) composition.add(this.preQuery);
    composition.add('UPDATE');
    if (this.flags.length) composition.add(' ', this.flags);
    composition.add(' ', this.table);
    // Can be VALUES or a SELECT statement
    composition.add(' SET ', this.values);
    if (this.output.length) composition.add(' ', this.output);
    if (this.where.length) composition.add(' WHERE ', this.where);
    if (this.limit.length) composition.add(' ', this.limit);
    if (this.return.length) composition.add(' ', this.return);
    if (this.postQuery.length) composition.add(this.postQuery);

    return composition;
  }
}

module.exports.UpdateProto = UpdateProto;
