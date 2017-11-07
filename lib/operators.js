
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
  $eq: Op.eq,
  $ne: Op.ne,
  $gte: Op.gte,
  $gt: Op.gt,
  $lte: Op.lte,
  $lt: Op.lt,
  $not: Op.not,
  $in: Op.in,
  $notIn: Op.notIn,
  $is: Op.is,
  $like: Op.like,
  $notLike: Op.notLike,
  $iLike: Op.iLike,
  $notILike: Op.notILike,
  $regexp: Op.regexp,
  $notRegexp: Op.notRegexp,
  $iRegexp: Op.iRegexp,
  $notIRegexp: Op.notIRegexp,
  $between: Op.between,
  $notBetween: Op.notBetween,
  $overlap: Op.overlap,
  $contains: Op.contains,
  $contained: Op.contained,
  $adjacent: Op.adjacent,
  $strictLeft: Op.strictLeft,
  $strictRight: Op.strictRight,
  $noExtendRight: Op.noExtendRight,
  $noExtendLeft: Op.noExtendLeft,
  $and: Op.and,
  $or: Op.or,
  $any: Op.any,
  $all: Op.all,
  $values: Op.values,
  $col: Op.col,
  $raw: Op.raw  //deprecated remove by v5.0
};

const LegacyAliases = { //deprecated remove by v5.0
  'ne': Op.ne,
  'not': Op.not,
  'in': Op.in,
  'notIn': Op.notIn,
  'gte': Op.gte,
  'gt': Op.gt,
  'lte': Op.lte,
  'lt': Op.lt,
  'like': Op.like,
  'ilike': Op.iLike,
  '$ilike': Op.iLike,
  'nlike': Op.notLike,
  '$notlike': Op.notLike,
  'notilike': Op.notILike,
  '..': Op.between,
  'between': Op.between,
  '!..': Op.notBetween,
  'notbetween': Op.notBetween,
  'nbetween': Op.notBetween,
  'overlap': Op.overlap,
  '&&': Op.overlap,
  '@>': Op.contains,
  '<@': Op.contained
};

Op.Aliases = Aliases;
Op.LegacyAliases = Object.assign({}, LegacyAliases, Aliases);
module.exports = Op;