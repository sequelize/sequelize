import type {
  WhereAttributeHashValue,
  WhereOptions,
} from '../abstract-dialect/where-sql-builder-types.js';
import { PojoWhere } from '../abstract-dialect/where-sql-builder.js';
import type { WhereOperators } from '../model.js';
import type { Op } from '../operators.js';
import type { Expression } from '../sequelize.js';
import { BaseSqlExpression, SQL_IDENTIFIER } from './base-sql-expression.js';

/**
 * Do not use me directly. Use {@link sql.where}
 */
export class Where<Operator extends keyof WhereOperators = typeof Op.eq> extends BaseSqlExpression {
  declare protected readonly [SQL_IDENTIFIER]: 'where';

  readonly where: PojoWhere | WhereOptions;

  /**
   * @example
   * ```ts
   * where({ id: 1 })
   * ```
   *
   * @param whereOptions
   */
  constructor(whereOptions: WhereOptions);

  /**
   * @example
   * ```ts
   * where(col('id'), { [Op.eq]: 1 })
   * ```
   *
   * @param leftOperand
   * @param whereAttributeHashValue
   */
  constructor(leftOperand: Expression, whereAttributeHashValue: WhereAttributeHashValue<any>);

  /**
   * @example
   * ```ts
   * where(col('id'), Op.eq, 1)
   * ```
   *
   * @param leftOperand
   * @param operator
   * @param rightOperand
   */
  constructor(leftOperand: Expression, operator: Operator, rightOperand: WhereOperators[Operator]);

  constructor(
    ...args:
      | [whereOptions: WhereOptions]
      | [leftOperand: Expression, whereAttributeHashValue: WhereAttributeHashValue<any>]
      | [leftOperand: Expression, operator: Operator, rightOperand: WhereOperators[Operator]]
  ) {
    super();

    if (args.length === 1) {
      this.where = args[0];
    } else if (args.length === 2) {
      this.where = PojoWhere.create(args[0], args[1]);
    } else {
      if (typeof args[1] === 'string') {
        throw new TypeError(`where(left, operator, right) does not accept a string as the operator. Use one of the operators available in the Op object.
If you wish to use custom operators not provided by Sequelize, you can use the "sql" template literal tag. Refer to the documentation on custom operators on https://sequelize.org/docs/v7/querying/operators/#custom-operators for more details.`);
      }

      // normalize where(col, op, val)
      // to where(col, { [op]: val })
      this.where = PojoWhere.create(args[0], { [args[1]]: args[2] });
    }
  }
}

/**
 * A way of writing an SQL binary operator, or more complex where conditions.
 *
 * This solution is slightly more verbose than the POJO syntax, but allows any value on the left hand side of the operator (unlike the POJO syntax which only accepts attribute names).
 * For instance, either the left or right hand side of the operator can be {@link sql.fn}, {@link sql.col}, {@link sql.literal} etc.
 *
 * If your left operand is an attribute name, using the regular POJO syntax (`{ where: { attrName: value }}`) syntax is usually more convenient.
 *
 * ⚠️ Unlike the POJO syntax, if the left operand is a string, it will be treated as a _value_, not an attribute name. If you wish to refer to an attribute, use {@link Attribute} instead.
 *
 * @example
 * ```ts
 * where(attribute('id'), { [Op.eq]: 1 });
 * where(attribute('id'), {
 *   [Op.or]: {
 *     [Op.eq]: 1,
 *     [Op.gt]: 10,
 *   },
 * });
 * ```
 *
 * @param leftOperand The left operand
 * @param whereAttributeHashValue The POJO containing the operators and the right operands
 */
export function where(
  leftOperand: Expression,
  whereAttributeHashValue: WhereAttributeHashValue<any>,
): Where;
/**
 * This version of `where` is used to opt back into the POJO syntax. Useful in combination with {@link sql}.
 *
 * @example
 * ```ts
 * sequelize.query(sql`
 *   SELECT * FROM users WHERE ${where({ id: 1 })};
 * `)
 * ```
 *
 * produces
 *
 * ```sql
 * SELECT * FROM users WHERE "id" = 1;
 * ```
 *
 * @param whereOptions
 */
export function where(whereOptions: WhereOptions): Where;
/**
 * @example
 * ```ts
 * where(col('id'), Op.eq, 1)
 * ```
 *
 * @example
 * // Using a column name as the left operand.
 * // Equal to: WHERE first_name = 'Lily'
 * where(col('first_name'), Op.eq, 'Lily');
 *
 * @example
 * // Using a SQL function on the left operand.
 * // Equal to: WHERE LOWER(first_name) = 'lily'
 * where(fn('LOWER', col('first_name')), Op.eq, 'lily');
 *
 * @example
 * // Using raw SQL as the left operand.
 * // Equal to: WHERE 'Lily' = 'Lily'
 * where(literal(`'Lily'`), Op.eq, 'Lily');
 *
 * @param leftOperand The left operand
 * @param operator The operator to use (one of the different values available in the {@link Op} object)
 * @param rightOperand The right operand
 */
export function where(
  leftOperand: Expression,
  operator: keyof WhereOperators,
  rightOperand: Expression,
): Where;
export function where(
  ...args:
    | [whereOptions: WhereOptions]
    | [leftOperand: Expression, whereAttributeHashValue: WhereAttributeHashValue<any>]
    | [leftOperand: Expression, operator: keyof WhereOperators, rightOperand: Expression]
): Where {
  // @ts-expect-error -- they are the same type but this overload is internal
  return new Where(...args);
}
