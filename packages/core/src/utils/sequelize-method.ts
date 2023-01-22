import isObject from 'lodash/isObject';
import type { Op, WhereOperators, WhereLeftOperand, DataType, WhereOptions } from '..';
import type { WhereAttributeHashValue } from '../dialects/abstract/where-sql-builder-types.js';
import { PojoWhere } from '../dialects/abstract/where-sql-builder.js';

/**
 * Utility functions for representing SQL functions, and columns that should be escaped.
 * Please do not use these functions directly, use Sequelize.fn and Sequelize.col instead.
 *
 * @private
 */
export class SequelizeMethod {}

// TODO: JSON?
export type QueryParts = List | Value | Identifier | Attribute | Fn | Col | Cast | Literal | Where | JsonPath | AssociationPath;

/**
 * Used to represent an SQL list of values, e.g. `WHERE id IN (1, 2, 3)`
 */
export class List extends SequelizeMethod {
  declare private readonly brand: 'list';

  constructor(readonly values: unknown[]) {
    super();
  }
}

/**
 * Used to represent a value that will either be escaped to a literal, or a bind parameter.
 */
export class Value extends SequelizeMethod {
  declare private readonly brand: 'value';

  constructor(readonly value: unknown) {
    super();
  }
}

/**
 * Used to represent a value that will either be escaped to a literal, or a bind parameter.
 */
export class Identifier extends SequelizeMethod {
  declare private readonly brand: 'identifier';

  constructor(readonly value: string) {
    super();
  }
}

/**
 * Used to represent the attribute of a model. You should use the attribute name, which will be mapped to the correct column name.
 *
 * If you want to use a database name, without mapping, you can use {@link Identifier}.
 */
export class Attribute extends SequelizeMethod {
  declare private readonly brand: 'attribute';

  constructor(readonly attributeName: string) {
    super();
  }
}

/**
 * Do not use me directly. Use {@link fn}
 */
export class Fn extends SequelizeMethod {
  declare private readonly brand: 'fn';

  readonly fn: string;

  // unknown already covers the other two types, but they've been added explicitly to document
  // passing WhereAttributeHash generates a condition inside the function.
  readonly args: ReadonlyArray<unknown | SequelizeMethod>;

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
 * Do not use me directly. Use {@link col}
 *
 * Col works similarly to {@link Identifier}, but "*" has special meaning, for backwards compatibility.
 *
 * We recommend using {@link Identifier}, or {@link Attribute} instead.
 */
export class Col extends SequelizeMethod {
  declare private readonly brand: 'col';

  readonly identifiers: string[];

  constructor(...identifiers: string[]) {
    super();

    this.identifiers = identifiers;
  }
}

/**
 * Do not use me directly. Use {@link cast}
 */
export class Cast extends SequelizeMethod {
  declare private readonly brand: 'cast';

  constructor(
    readonly val: unknown,
    readonly type: DataType,
  ) {
    super();
  }
}

/**
 * Do not use me directly. Use {@link literal}
 */
export class Literal extends SequelizeMethod {
  /** this (type-only) brand prevents TypeScript from thinking Cast is assignable to Literal because they share the same shape */
  declare private readonly brand: 'literal';

  readonly val: ReadonlyArray<string | SequelizeMethod>;

  constructor(val: string | Array<string | SequelizeMethod>) {
    super();

    this.val = Array.isArray(val) ? val : [val];
  }
}

/**
 * The template tag function used to easily create {@link literal}.
 *
 * @param rawSql
 * @param values
 * @example
 * ```ts
 * literal`SELECT * FROM ${identifier(table)} WHERE ${identifier(column)} = ${value}`
 * ```
 */
export function sql(rawSql: TemplateStringsArray, ...values: unknown[]): Literal {
  const arg: Array<string | SequelizeMethod> = [];

  for (const [i, element] of rawSql.entries()) {
    arg.push(element);

    if (i < values.length) {
      const value = values[i];

      arg.push(value instanceof SequelizeMethod ? value : new Value(value));
    }
  }

  return new Literal(arg);
}

/**
 * Do not use me directly. Use {@link json}
 *
 * @deprecated
 */
export class Json extends SequelizeMethod {
  declare private readonly brand: 'json';

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

export class JsonPath extends SequelizeMethod {
  declare private readonly brand: 'jsonPath';

  constructor(
    readonly value: WhereLeftOperand,
    readonly jsonPath: readonly string[],
  ) {
    super();
  }
}

export class AssociationPath extends SequelizeMethod {
  declare private readonly brand: 'associationPath';

  constructor(
    readonly associationPath: readonly string[],
    readonly attribute: string,
  ) {
    super();
  }
}

/**
 * Do not use me directly. Use {@link where}
 */
export class Where<Operator extends keyof WhereOperators = typeof Op.eq> extends SequelizeMethod {
  declare private readonly brand: 'where';

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
  constructor(leftOperand: WhereLeftOperand, whereAttributeHashValue: WhereAttributeHashValue<any>);

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
  constructor(leftOperand: WhereLeftOperand, operator: Operator, rightOperand: WhereOperators[Operator]);

  constructor(
    ...args:
      | [whereOptions: WhereOptions]
      | [leftOperand: WhereLeftOperand, whereAttributeHashValue: WhereAttributeHashValue<any>]
      | [leftOperand: WhereLeftOperand, operator: Operator, rightOperand: WhereOperators[Operator]]
  ) {
    super();

    if (args.length === 1) {
      this.where = args[0];
    } else if (args.length === 2) {
      this.where = PojoWhere.create(args[0], args[1]);
    } else {
      // normalize where(col, op, val)
      // to where(col, { [op]: val })
      this.where = PojoWhere.create(args[0], { [args[1]]: args[2] });
    }
  }
}
