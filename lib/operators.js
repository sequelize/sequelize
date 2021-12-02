
'use strict';
/**
 * Operator symbols to be used when querying data
 *
 * @see {@link Model#where}
 *
 * @property eq
 * @property ne
 * @property gte
 * @property gt
 * @property lte
 * @property lt
 * @property not
 * @property is
 * @property in
 * @property notIn
 * @property like
 * @property notLike
 * @property iLike
 * @property notILike
 * @property startsWith
 * @property endsWith
 * @property substring
 * @property regexp
 * @property notRegexp
 * @property iRegexp
 * @property notIRegexp
 * @property between
 * @property notBetween
 * @property overlap
 * @property contains
 * @property contained
 * @property adjacent
 * @property strictLeft
 * @property strictRight
 * @property noExtendRight
 * @property noExtendLeft
 * @property and
 * @property or
 * @property any
 * @property all
 * @property values
 * @property col
 * @property placeholder
 * @property join
 */
const Op = {
  eq: Symbol.for('op.eq'),
  ne: Symbol.for('op.ne'),
  gte: Symbol.for('op.gte'),
  gt: Symbol.for('op.gt'),
  lte: Symbol.for('op.lte'),
  lt: Symbol.for('op.lt'),
  not: Symbol.for('op.not'),
  is: Symbol.for('op.is'),
  in: Symbol.for('op.in'),
  notIn: Symbol.for('op.notIn'),
  like: Symbol.for('op.like'),
  notLike: Symbol.for('op.notLike'),
  iLike: Symbol.for('op.iLike'),
  notILike: Symbol.for('op.notILike'),
  startsWith: Symbol.for('op.startsWith'),
  endsWith: Symbol.for('op.endsWith'),
  substring: Symbol.for('op.substring'),
  regexp: Symbol.for('op.regexp'),
  notRegexp: Symbol.for('op.notRegexp'),
  iRegexp: Symbol.for('op.iRegexp'),
  notIRegexp: Symbol.for('op.notIRegexp'),
  between: Symbol.for('op.between'),
  notBetween: Symbol.for('op.notBetween'),
  overlap: Symbol.for('op.overlap'),
  contains: Symbol.for('op.contains'),
  contained: Symbol.for('op.contained'),
  adjacent: Symbol.for('op.adjacent'),
  strictLeft: Symbol.for('op.strictLeft'),
  strictRight: Symbol.for('op.strictRight'),
  noExtendRight: Symbol.for('op.noExtendRight'),
  noExtendLeft: Symbol.for('op.noExtendLeft'),
  and: Symbol.for('op.and'),
  or: Symbol.for('op.or'),
  any: Symbol.for('op.any'),
  all: Symbol.for('op.all'),
  values: Symbol.for('op.values'),
  col: Symbol.for('op.col'),
  placeholder: Symbol.for('op.placeholder'),
  join: Symbol.for('op.join'),
  match: Symbol.for('op.match')
};

module.exports = Op;
