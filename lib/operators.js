
'use strict';
/**
 * Operator symbols to be used when querying data
 *
 * @see {@link Model#where}
 */
const Operators = {
  eq: Symbol('eq'),
  ne: Symbol('ne'),
  gte: Symbol('gte'),
  gt: Symbol('gt'),
  lte: Symbol('lte'),
  lt: Symbol('lt'),
  not: Symbol('not'),
  is: Symbol('is'),
  in: Symbol('in'),
  notIn: Symbol('notIn'),
  like: Symbol('like'),
  notLike: Symbol('notLike'),
  iLike: Symbol('iLike'),
  notILike: Symbol('notILike'),
  regexp: Symbol('regexp'),
  notRegexp: Symbol('notRegexp'),
  iRegexp: Symbol('iRegexp'),
  notIRegexp: Symbol('notIRegexp'),
  between: Symbol('between'),
  notBetween: Symbol('notBetween'),
  overlap: Symbol('overlap'),
  contains: Symbol('contains'),
  contained: Symbol('contained'),
  adjacent: Symbol('adjacent'),
  strictLeft: Symbol('strictLeft'),
  strictRight: Symbol('strictRight'),
  noExtendRight: Symbol('noExtendRight'),
  noExtendLeft: Symbol('noExtendLeft'),
  and: Symbol('and'),
  or: Symbol('or'),
  any: Symbol('any'),
  all: Symbol('all'),
  values: Symbol('values'),
  col: Symbol('col'),
  placeholder: Symbol('placeholder'),
  join: Symbol('join'),
  raw: Symbol('raw') //deprecated remove by v5.0
};

const Aliases = {
  $eq: Operators.eq,
  $ne: Operators.ne,
  $gte: Operators.gte,
  $gt: Operators.gt,
  $lte: Operators.lte,
  $lt: Operators.lt,
  $not: Operators.not,
  $in: Operators.in,
  $notIn: Operators.notIn,
  $is: Operators.is,
  $like: Operators.like,
  $notLike: Operators.notLike,
  $iLike: Operators.iLike,
  $notILike: Operators.notILike,
  $regexp: Operators.regexp,
  $notRegexp: Operators.notRegexp,
  $iRegexp: Operators.iRegexp,
  $notIRegexp: Operators.notIRegexp,
  $between: Operators.between,
  $notBetween: Operators.notBetween,
  $overlap: Operators.overlap,
  $contains: Operators.contains,
  $contained: Operators.contained,
  $adjacent: Operators.adjacent,
  $strictLeft: Operators.strictLeft,
  $strictRight: Operators.strictRight,
  $noExtendRight: Operators.noExtendRight,
  $noExtendLeft: Operators.noExtendLeft,
  $and: Operators.and,
  $or: Operators.or,
  $any: Operators.any,
  $all: Operators.all,
  $values: Operators.values,
  $col: Operators.col,
  $raw: Operators.raw  //deprecated remove by v5.0
};

const LegacyAliases = { //deprecated remove by v5.0
  'ne': Operators.ne,
  'not': Operators.not,
  'in': Operators.in,
  'notIn': Operators.notIn,
  'gte': Operators.gte,
  'gt': Operators.gt,
  'lte': Operators.lte,
  'lt': Operators.lt,
  'like': Operators.like,
  'ilike': Operators.iLike,
  '$ilike': Operators.iLike,
  'nlike': Operators.notLike,
  '$notlike': Operators.notLike,
  'notilike': Operators.notILike,
  '..': Operators.between,
  'between': Operators.between,
  '!..': Operators.notBetween,
  'notbetween': Operators.notBetween,
  'nbetween': Operators.notBetween,
  'overlap': Operators.overlap,
  '&&': Operators.overlap,
  '@>': Operators.contains,
  '<@': Operators.contained
};

Operators.Aliases = Aliases;
Operators.LegacyAliases = Object.assign({}, LegacyAliases, Aliases);
module.exports = Operators;