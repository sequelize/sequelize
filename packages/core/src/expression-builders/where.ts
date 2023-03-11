import type { WhereAttributeHashValue, WhereOperators, AttributeOptions, ColumnReference } from '../model.js';
import type { Op } from '../operators.js';
import { BaseSqlExpression } from './base-sql-expression.js';
import type { Cast } from './cast.js';
import type { Fn } from './fn.js';
import type { Literal } from './literal.js';

export type WhereLeftOperand = Fn | ColumnReference | Literal | Cast | AttributeOptions;

/**
 * Do not use me directly. Use {@link where}
 */
export class Where<Operator extends keyof WhereOperators = typeof Op.eq> extends BaseSqlExpression {
  // TODO [=7]: rename to leftOperand after typescript migration
  private readonly attribute: WhereLeftOperand;
  // TODO [=7]: rename to operator after typescript migration
  private readonly comparator: string | Operator;
  // TODO [=7]: rename to rightOperand after typescript migration
  private readonly logic: WhereOperators[Operator] | WhereAttributeHashValue<any> | any;

  constructor(leftOperand: WhereLeftOperand, operator: Operator, rightOperand: WhereOperators[Operator]);
  constructor(leftOperand: WhereLeftOperand, operator: string, rightOperand: any);
  constructor(leftOperand: WhereLeftOperand, rightOperand: WhereAttributeHashValue<any>);
  constructor(
    leftOperand: WhereLeftOperand,
    operatorOrRightOperand: string | Operator | WhereAttributeHashValue<any>,
    rightOperand?: WhereOperators[Operator] | any,
  ) {
    super();

    this.attribute = leftOperand;

    if (rightOperand !== undefined) {
      this.logic = rightOperand;
      this.comparator = operatorOrRightOperand;
    } else {
      this.logic = operatorOrRightOperand;
      this.comparator = '=';
    }
  }
}

/**
 * A way of specifying "attr = condition".
 * Can be used as a replacement for the POJO syntax (e.g. `where: { name: 'Lily' }`) when you need to compare a column that the POJO syntax cannot represent.
 *
 * @param leftOperand The left side of the comparison.
 *  - A value taken from YourModel.rawAttributes, to reference an attribute.
 *    The attribute must be defined in your model definition.
 *  - A Literal (using {@link literal})
 *  - A SQL Function (using {@link fn})
 *  - A Column name (using {@link col})
 *  Note that simple strings to reference an attribute are not supported. You can use the POJO syntax instead.
 * @param operator The comparison operator to use. If unspecified, defaults to {@link OpTypes.eq}.
 * @param rightOperand The right side of the comparison. Its value depends on the used operator.
 *  See {@link WhereOperators} for information about what value is valid for each operator.
 *
 * @example
 * // Using an attribute as the left operand.
 * // Equal to: WHERE first_name = 'Lily'
 * where(User.rawAttributes.firstName, Op.eq, 'Lily');
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
 */
export function where<OpSymbol extends keyof WhereOperators>(
  leftOperand: WhereLeftOperand | Where,
  operator: OpSymbol,
  rightOperand: WhereOperators[OpSymbol]
): Where;
export function where(leftOperand: any, operator: string, rightOperand: any): Where;
export function where(leftOperand: WhereLeftOperand, rightOperand: WhereAttributeHashValue<any>): Where;

export function where<OpSymbol extends keyof WhereOperators>(
  ...args:
    | [leftOperand: WhereLeftOperand | Where, operator: OpSymbol, rightOperand: WhereOperators[OpSymbol]]
    | [leftOperand: any, operator: string, rightOperand: any]
    | [leftOperand: WhereLeftOperand, rightOperand: WhereAttributeHashValue<any>]
): Where {
  // @ts-expect-error -- they are the same type but this overload is internal
  return new Where(...args);
}
