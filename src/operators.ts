interface OpTypes {
  /**
   * Operator -|- (PG range is adjacent to operator)
   *
   * ```js
   * [Op.adjacent]: [1, 2]
   * ```
   * In SQL
   * ```sql
   * -|- [1, 2)
   * ```
   */
  readonly adjacent: unique symbol;
  /**
   * Operator ALL
   *
   * ```js
   * [Op.gt]: {
   *  [Op.all]: literal('SELECT 1')
   * }
   * ```
   * In SQL
   * ```sql
   * > ALL (SELECT 1)
   * ```
   */
  readonly all: unique symbol;
  /**
   * Operator AND
   *
   * ```js
   * [Op.and]: {a: 5}
   * ```
   * In SQL
   * ```sql
   * AND (a = 5)
   * ```
   */
  readonly and: unique symbol;
  /**
   * Operator ANY ARRAY (PG only)
   *
   * ```js
   * [Op.any]: [2,3]
   * ```
   * In SQL
   * ```sql
   * ANY ARRAY[2, 3]::INTEGER
   * ```
   *
   * Operator LIKE ANY ARRAY (also works for iLike and notLike)
   *
   * ```js
   * [Op.like]: { [Op.any]: ['cat', 'hat']}
   * ```
   * In SQL
   * ```sql
   * LIKE ANY ARRAY['cat', 'hat']
   * ```
   */
  readonly any: unique symbol;
  /**
   * Operator BETWEEN
   *
   * ```js
   * [Op.between]: [6, 10]
   * ```
   * In SQL
   * ```sql
   * BETWEEN 6 AND 10
   * ```
   */
  readonly between: unique symbol;
  /**
   * With dialect specific column identifiers (PG in this example)
   *
   * ```js
   * [Op.col]: 'user.organization_id'
   * ```
   * In SQL
   * ```sql
   * = "user"."organization_id"
   * ```
   */
  readonly col: unique symbol;
  /**
   * Operator <@ (PG array contained by operator)
   *
   * ```js
   * [Op.contained]: [1, 2]
   * ```
   * In SQL
   * ```sql
   * <@ [1, 2)
   * ```
   */
  readonly contained: unique symbol;
  /**
   * Operator @> (PG array contains operator)
   *
   * ```js
   * [Op.contains]: [1, 2]
   * ```
   * In SQL
   * ```sql
   * @> [1, 2)
   * ```
   */
  readonly contains: unique symbol;
  /**
   * Operator LIKE
   *
   * ```js
   * [Op.endsWith]: 'hat'
   * ```
   * In SQL
   * ```sql
   * LIKE '%hat'
   * ```
   */
  readonly endsWith: unique symbol;
  /**
   * Operator =
   *
   * ```js
   * [Op.eq]: 3
   * ```
   * In SQL
   * ```sql
   * = 3
   * ```
   */
  readonly eq: unique symbol;
  /**
   * Operator >
   *
   * ```js
   * [Op.gt]: 6
   * ```
   * In SQL
   * ```sql
   * > 6
   * ```
   */
  readonly gt: unique symbol;
  /**
   * Operator >=
   *
   * ```js
   * [Op.gte]: 6
   * ```
   * In SQL
   * ```sql
   * >= 6
   * ```
   */
  readonly gte: unique symbol;

  /**
   * Operator ILIKE (case insensitive) (PG only)
   *
   * ```js
   * [Op.iLike]: '%hat'
   * ```
   * In SQL
   * ```sql
   * ILIKE '%hat'
   * ```
   */
  readonly iLike: unique symbol;
  /**
   * Operator IN
   *
   * ```js
   * [Op.in]: [1, 2]
   * ```
   * In SQL
   * ```sql
   * IN [1, 2]
   * ```
   */
  readonly in: unique symbol;
  /**
   * Operator ~* (PG only)
   *
   * ```js
   * [Op.iRegexp]: '^[h|a|t]'
   * ```
   * In SQL
   * ```sql
   * ~* '^[h|a|t]'
   * ```
   */
  readonly iRegexp: unique symbol;
  /**
   * Operator IS
   *
   * ```js
   * [Op.is]: null
   * ```
   * In SQL
   * ```sql
   * IS null
   * ```
   */
  readonly is: unique symbol;
  /**
   * Operator LIKE
   *
   * ```js
   * [Op.like]: '%hat'
   * ```
   * In SQL
   * ```sql
   * LIKE '%hat'
   * ```
   */
  readonly like: unique symbol;
  /**
   * Operator <
   *
   * ```js
   * [Op.lt]: 10
   * ```
   * In SQL
   * ```sql
   * < 10
   * ```
   */
  readonly lt: unique symbol;
  /**
   * Operator <=
   *
   * ```js
   * [Op.lte]: 10
   * ```
   * In SQL
   * ```sql
   * <= 10
   * ```
   */
  readonly lte: unique symbol;
  /**
   * Operator @@
   *
   * ```js
   * [Op.match]: Sequelize.fn('to_tsquery', 'fat & rat')`
   * ```
   * In SQL
   * ```sql
   * @@ to_tsquery('fat & rat')
   * ```
   */
  readonly match: unique symbol;
  /**
   * Operator !=
   *
   * ```js
   * [Op.ne]: 20
   * ```
   * In SQL
   * ```sql
   * != 20
   * ```
   */
  readonly ne: unique symbol;
  /**
   * Operator &> (PG range does not extend to the left of operator)
   *
   * ```js
   * [Op.noExtendLeft]: [1, 2]
   * ```
   * In SQL
   * ```sql
   * &> [1, 2)
   * ```
   */
  readonly noExtendLeft: unique symbol;
  /**
   * Operator &< (PG range does not extend to the right of operator)
   *
   * ```js
   * [Op.noExtendRight]: [1, 2]
   * ```
   * In SQL
   * ```sql
   * &< [1, 2)
   * ```
   */
  readonly noExtendRight: unique symbol;
  /**
   * Operator NOT
   *
   * ```js
   * [Op.not]: true
   * ```
   * In SQL
   * ```sql
   * IS NOT TRUE
   * ```
   */
  readonly not: unique symbol;
  /**
   * Operator NOT BETWEEN
   *
   * ```js
   * [Op.notBetween]: [11, 15]
   * ```
   * In SQL
   * ```sql
   * NOT BETWEEN 11 AND 15
   * ```
   */
  readonly notBetween: unique symbol;
  /**
   * Operator NOT ILIKE (case insensitive) (PG only)
   *
   * ```js
   * [Op.notILike]: '%hat'
   * ```
   * In SQL
   * ```sql
   * NOT ILIKE '%hat'
   * ```
   */
  readonly notILike: unique symbol;
  /**
   * Operator NOT IN
   *
   * ```js
   * [Op.notIn]: [1, 2]
   * ```
   * In SQL
   * ```sql
   * NOT IN [1, 2]
   * ```
   */
  readonly notIn: unique symbol;
  /**
   * Operator !~* (PG only)
   *
   * ```js
   * [Op.notIRegexp]: '^[h|a|t]'
   * ```
   * In SQL
   * ```sql
   * !~* '^[h|a|t]'
   * ```
   */
  readonly notIRegexp: unique symbol;
  /**
   * Operator NOT LIKE
   *
   * ```js
   * [Op.notLike]: '%hat'
   * ```
   * In SQL
   * ```sql
   * NOT LIKE '%hat'
   * ```
   */
  readonly notLike: unique symbol;
  /**
   * Operator NOT REGEXP (MySQL/PG only)
   *
   * ```js
   * [Op.notRegexp]: '^[h|a|t]'
   * ```
   * In SQL
   * ```sql
   * NOT REGEXP/!~ '^[h|a|t]'
   * ```
   */
  readonly notRegexp: unique symbol;
  /**
   * Operator OR
   *
   * ```js
   * [Op.or]: [{a: 5}, {a: 6}]
   * ```
   * In SQL
   * ```sql
   * (a = 5 OR a = 6)
   * ```
   */
  readonly or: unique symbol;
  /**
   * Operator && (PG array overlap operator)
   *
   * ```js
   * [Op.overlap]: [1, 2]
   * ```
   * In SQL
   * ```sql
   * && [1, 2)
   * ```
   */
  readonly overlap: unique symbol;
  /**
   * Internal placeholder
   *
   * ```js
   * [Op.placeholder]: true
   * ```
   */
  readonly placeholder: unique symbol;
  /**
   * Operator REGEXP (MySQL/PG only)
   *
   * ```js
   * [Op.regexp]: '^[h|a|t]'
   * ```
   * In SQL
   * ```sql
   * REGEXP/~ '^[h|a|t]'
   * ```
   */
  readonly regexp: unique symbol;
  /**
   * Operator LIKE
   *
   * ```js
   * [Op.startsWith]: 'hat'
   * ```
   * In SQL
   * ```sql
   * LIKE 'hat%'
   * ```
   */
  readonly startsWith: unique symbol;
  /**
   * Operator << (PG range strictly left of operator)
   *
   * ```js
   * [Op.strictLeft]: [1, 2]
   * ```
   * In SQL
   * ```sql
   * << [1, 2)
   * ```
   */
  readonly strictLeft: unique symbol;
  /**
   * Operator >> (PG range strictly right of operator)
   *
   * ```js
   * [Op.strictRight]: [1, 2]
   * ```
   * In SQL
   * ```sql
   * >> [1, 2)
   * ```
   */
  readonly strictRight: unique symbol;
  /**
   * Operator LIKE
   *
   * ```js
   * [Op.substring]: 'hat'
   * ```
   * In SQL
   * ```sql
   * LIKE '%hat%'
   * ```
   */
  readonly substring: unique symbol;
  /**
   * Operator VALUES
   *
   * ```js
   * [Op.values]: [4, 5, 6]
   * ```
   * In SQL
   * ```sql
   * VALUES (4), (5), (6)
   * ```
   */
  readonly values: unique symbol;
}

// Note: These symbols are registered in the Global Symbol Registry
//  to counter bugs when two different versions of this library are loaded
//  Source issue: https://github.com/sequelize/sequelize/issues/8663
// This is not an endorsement of having two different versions of the library loaded at the same time,
//  a lot more is going to silently break if you do this.
export const Op: OpTypes = {
  eq: Symbol.for('eq'),
  ne: Symbol.for('ne'),
  gte: Symbol.for('gte'),
  gt: Symbol.for('gt'),
  lte: Symbol.for('lte'),
  lt: Symbol.for('lt'),
  not: Symbol.for('not'),
  is: Symbol.for('is'),
  in: Symbol.for('in'),
  notIn: Symbol.for('notIn'),
  like: Symbol.for('like'),
  notLike: Symbol.for('notLike'),
  iLike: Symbol.for('iLike'),
  notILike: Symbol.for('notILike'),
  startsWith: Symbol.for('startsWith'),
  endsWith: Symbol.for('endsWith'),
  substring: Symbol.for('substring'),
  regexp: Symbol.for('regexp'),
  notRegexp: Symbol.for('notRegexp'),
  iRegexp: Symbol.for('iRegexp'),
  notIRegexp: Symbol.for('notIRegexp'),
  between: Symbol.for('between'),
  notBetween: Symbol.for('notBetween'),
  overlap: Symbol.for('overlap'),
  contains: Symbol.for('contains'),
  contained: Symbol.for('contained'),
  adjacent: Symbol.for('adjacent'),
  strictLeft: Symbol.for('strictLeft'),
  strictRight: Symbol.for('strictRight'),
  noExtendRight: Symbol.for('noExtendRight'),
  noExtendLeft: Symbol.for('noExtendLeft'),
  and: Symbol.for('and'),
  or: Symbol.for('or'),
  any: Symbol.for('any'),
  all: Symbol.for('all'),
  values: Symbol.for('values'),
  col: Symbol.for('col'),
  placeholder: Symbol.for('placeholder'),
  join: Symbol.for('join'),
  match: Symbol.for('match')
} as OpTypes;

export default Op;

// https://github.com/sequelize/sequelize/issues/13791
// remove me in v7: kept for backward compatibility as `export default Op` is
// transpiled to `module.exports.default` instead of `module.exports`
module.exports = Op;
