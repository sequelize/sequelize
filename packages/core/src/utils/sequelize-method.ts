import isObject from 'lodash/isObject';
import type { Op, WhereOperators, WhereLeftOperand, WhereAttributeHash, WhereAttributeHashValue } from '..';

/**
 * Utility functions for representing SQL functions, and columns that should be escaped.
 * Please do not use these functions directly, use Sequelize.fn and Sequelize.col instead.
 *
 * @private
 */
export class SequelizeMethod {}

/**
 * Do not use me directly. Use {@link Sequelize.fn}
 */
export class Fn extends SequelizeMethod {
  private readonly fn: string;

  // unknown already covers the other two types, but they've been added explicitly to document
  // passing WhereAttributeHash generates a condition inside the function.
  private readonly args: Array<unknown | SequelizeMethod | WhereAttributeHash>;

  constructor(fn: string, args: Fn['args']) {
    super();
    this.fn = fn;
    this.args = args;
  }

  clone(): Fn {
    return new Fn(this.fn, this.args);
  }
}

/**
 * Do not use me directly. Use {@link Sequelize.col}
 */
export class Col extends SequelizeMethod {
  private readonly col: string[] | string;

  constructor(col: string[] | string, ...args: string[]) {
    super();
    // TODO(ephys): this does not look right. First parameter is ignored if a second parameter is provided.
    //  should we change the signature to `constructor(...cols: string[])`
    if (args.length > 0) {
      col = args;
    }

    this.col = col;
  }
}

/**
 * Do not use me directly. Use {@link Sequelize.cast}
 */
export class Cast extends SequelizeMethod {
  private readonly val: any;
  private readonly type: string;
  private readonly json: boolean;

  constructor(val: unknown, type: string = '', json: boolean = false) {
    super();
    this.val = val;
    this.type = type.trim();
    this.json = json;
  }
}

/**
 * Do not use me directly. Use {@link Sequelize.literal}
 */
export class Literal extends SequelizeMethod {
  /** this (type-only) brand prevents TypeScript from thinking Cast is assignable to Literal because they share the same shape */
  declare private readonly brand: 'literal';

  private readonly val: unknown;

  constructor(val: unknown) {
    super();
    this.val = val;
  }
}

/**
 * Do not use me directly. Use {@link Sequelize.json}
 */
export class Json extends SequelizeMethod {
  private readonly conditions?: { [key: string]: any };
  private readonly path?: string;
  private readonly value?: string | number | boolean | null;

  constructor(
    conditionsOrPath: { [key: string]: any } | string,
    value?: string | number | boolean | null,
  ) {
    super();

    if (typeof conditionsOrPath === 'string') {
      this.path = conditionsOrPath;

      if (value) {
        this.value = value;
      }
    } else if (isObject(conditionsOrPath)) {
      this.conditions = conditionsOrPath;
    }
  }
}

/**
 * Do not use me directly. Use {@link Sequelize.where}
 */
export class Where<Operator extends keyof WhereOperators = typeof Op.eq> extends SequelizeMethod {
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
