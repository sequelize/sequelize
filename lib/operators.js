
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
  eq: Symbol.for('sequelize.operator.eq'),
  ne: Symbol.for('sequelize.operator.ne'),
  gte: Symbol.for('sequelize.operator.gte'),
  gt: Symbol.for('sequelize.operator.gt'),
  lte: Symbol.for('sequelize.operator.lte'),
  lt: Symbol.for('sequelize.operator.lt'),
  not: Symbol.for('sequelize.operator.not'),
  is: Symbol.for('sequelize.operator.is'),
  in: Symbol.for('sequelize.operator.in'),
  notIn: Symbol.for('sequelize.operator.notIn'),
  like: Symbol.for('sequelize.operator.like'),
  notLike: Symbol.for('sequelize.operator.notLike'),
  iLike: Symbol.for('sequelize.operator.iLike'),
  notILike: Symbol.for('sequelize.operator.notILike'),
  startsWith: Symbol.for('sequelize.operator.startsWith'),
  endsWith: Symbol.for('sequelize.operator.endsWith'),
  substring: Symbol.for('sequelize.operator.substring'),
  regexp: Symbol.for('sequelize.operator.regexp'),
  notRegexp: Symbol.for('sequelize.operator.notRegexp'),
  iRegexp: Symbol.for('sequelize.operator.iRegexp'),
  notIRegexp: Symbol.for('sequelize.operator.notIRegexp'),
  between: Symbol.for('sequelize.operator.between'),
  notBetween: Symbol.for('sequelize.operator.notBetween'),
  overlap: Symbol.for('sequelize.operator.overlap'),
  contains: Symbol.for('sequelize.operator.contains'),
  contained: Symbol.for('sequelize.operator.contained'),
  adjacent: Symbol.for('sequelize.operator.adjacent'),
  strictLeft: Symbol.for('sequelize.operator.strictLeft'),
  strictRight: Symbol.for('sequelize.operator.strictRight'),
  noExtendRight: Symbol.for('sequelize.operator.noExtendRight'),
  noExtendLeft: Symbol.for('sequelize.operator.noExtendLeft'),
  and: Symbol.for('sequelize.operator.and'),
  or: Symbol.for('sequelize.operator.or'),
  any: Symbol.for('sequelize.operator.any'),
  all: Symbol.for('sequelize.operator.all'),
  values: Symbol.for('sequelize.operator.values'),
  col: Symbol.for('sequelize.operator.col'),
  placeholder: Symbol.for('sequelize.operator.placeholder'),
  join: Symbol.for('sequelize.operator.join')
};

module.exports = Op;
