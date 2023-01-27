import type { WhereOperators, WhereLeftOperand, DataType, WhereOptions } from '..';
import type { WhereAttributeHashValue } from '../dialects/abstract/where-sql-builder-types.js';
import { PojoWhere } from '../dialects/abstract/where-sql-builder.js';
import { Op } from '../operators.js';
import { isPlainObject } from './check.js';
import { noSqlJson } from './deprecations.js';

/**
 * Utility functions for representing SQL functions, and columns that should be escaped.
 * Please do not use these functions directly, use Sequelize.fn and Sequelize.col instead.
 *
 * @private
 */
export class SequelizeMethod {}

// TODO: JSON?
export type QueryParts =
  | List
  | Value
  | Identifier
  | Attribute
  | Fn
  | Col
  | Cast
  | Literal
  | Where
  | JsonPath
  | AssociationPath;

/**
 * Use {@link list} instead.
 */
export class List extends SequelizeMethod {
  declare private readonly brand: 'list';

  constructor(readonly values: unknown[]) {
    super();
  }
}

/**
 * Used to represent an SQL list of values, e.g. `WHERE id IN (1, 2, 3)`. This ensure that the array is interpreted
 * as an SQL list, and not as an SQL Array.
 *
 * @example
 * ```ts
 * sequelize.query(sql`SELECT * FROM users WHERE id IN ${list([1, 2, 3])}`);
 * ```
 *
 * Will generate:
 *
 * ```sql
 * SELECT * FROM users WHERE id IN (1, 2, 3)
 * ```
 *
 * @param values The members of the list.
 */
export function list(values: unknown[]): List {
  return new List(values);
}

/**
 * Used to represent a value that will either be escaped to a literal, or a bind parameter.
 * You do not need to use this function directly, it will be used automatically when you interpolate parameters
 * in a template string tagged with {@link sql}.
 */
export class Value extends SequelizeMethod {
  declare private readonly brand: 'value';

  constructor(readonly value: unknown) {
    super();
  }
}

/**
 * Use {@link identifier} instead.
 */
export class Identifier extends SequelizeMethod {
  declare private readonly brand: 'identifier';

  constructor(readonly value: string) {
    super();
  }
}

/**
 * Used to represent a value that will either be escaped to a literal, or a bind parameter.
 * Unlike {@link attribute} and {@link col}, this identifier will be escaped as-is,
 * without mapping to a column name or any other transformation.
 *
 * @param value
 * @example
 * ```ts
 * sequelize.query(sql`SELECT * FROM users WHERE ${identifier('firstName')} = 'John'`);
 * ```
 *
 * Will generate (identifier quoting depending on the dialect):
 *
 * ```sql
 * SELECT * FROM users WHERE "firstName" = 'John'
 * ```
 */
export function identifier(value: string): Identifier {
  return new Identifier(value);
}

/**
 * Use {@link attribute} instead.
 */
export class Attribute extends SequelizeMethod {
  declare private readonly brand: 'attribute';

  constructor(readonly attributeName: string) {
    super();
  }
}

/**
 * Used to represent the attribute of a model. You should use the attribute name, which will be mapped to the correct column name.
 * This attribute name follows the same rules as the attribute names in POJO where options.
 * As such, you can use dot notation to access nested JSON properties, and you can reference included associations.
 *
 * If you want to use a database name, without mapping, you can use {@link Identifier}.
 *
 * @example
 * Let's say the class User has an attribute `firstName`, which maps to the column `first_name`.
 *
 * ```ts
 * User.findAll({
 *  where: sql`${attribute('firstName')} = 'John'`
 * });
 * ```
 *
 * Will generate:
 *
 * ```sql
 * SELECT * FROM users WHERE first_name = 'John'
 * ```
 *
 * @example
 * Let's say the class User has an attribute `data`, which is a JSON column.
 *
 * ```ts
 * User.findAll({
 *  where: sql`${attribute('data.registered')} = 'true'`
 * });
 * ```
 *
 * Will generate (assuming the dialect supports JSON operators):
 *
 * ```sql
 * SELECT * FROM users WHERE data->'registered' = 'true'
 * ```
 *
 * @param attributeName
 */
export function attribute(attributeName: string): Attribute {
  return new Attribute(attributeName);
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

  constructor(fnName: string, args: Fn['args']) {
    super();
    this.fn = fnName;
    this.args = args;
  }

  clone(): Fn {
    return new Fn(this.fn, this.args);
  }
}

/**
 * Creates an object representing a database function. This can be used in search queries, both in where and order parts, and as default values in column definitions.
 * If you want to refer to columns in your function, you should use {@link attribute} (recommended), {@link identifier}, or {@link col} (discouraged)
 * otherwise the value will be interpreted as a string.
 *
 * ℹ️ This method is usually verbose and we recommend using the {@link sql} template string tag instead.
 *
 * @param fnName The SQL function you want to call
 * @param args All further arguments will be passed as arguments to the function
 *
 * @example Convert a user's username to upper case
 * ```ts
 * instance.update({
 *   username: fn('upper', col('username'))
 * });
 * ```
 */
export function fn(fnName: string, ...args: Fn['args']): Fn {
  for (let i = 0; i < args.length; i++) {
    // Users should wrap this parameter with `where` themselves, but we do it to ensure backwards compatibility
    // with https://github.com/sequelize/sequelize/issues/6666
    // @ts-expect-error -- backwards compatibility hack
    if (isPlainObject(args[i]) && !(Op.col in args[i])) {
      // @ts-expect-error -- backwards compatibility hack
      args[i] = where(args[i]);
    }
  }

  return new Fn(fnName, args);
}

/**
 * Do not use me directly. Use {@link col}
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
 * Creates an object which represents a column in the DB, this allows referencing another column in your query.
 * This is often useful in conjunction with {@link fn}, {@link where} and {@link sql} which interpret strings as values and not column names.
 *
 * Col works similarly to {@link Identifier}, but "*" has special meaning, for backwards compatibility.
 *
 * ⚠️ We recommend using {@link Identifier}, or {@link Attribute} instead.
 *
 * @param identifiers The name of the column
 */
export function col(...identifiers: string[]): Col {
  return new Col(...identifiers);
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
 * Creates an object representing a call to the cast function.
 *
 * @param val The value to cast
 * @param type The type to cast it to
 */
export function cast(val: unknown, type: DataType): Cast {
  if (isPlainObject(val) && !(Op.col in val)) {
    // Users should wrap this parameter with `where` themselves, but we do it to ensure backwards compatibility
    // with https://github.com/sequelize/sequelize/issues/6666
    // @ts-expect-error -- backwards compatibility hack
    val = where(val);
  }

  return new Cast(val, type);
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
 * Creates an object representing a literal, i.e. something that will not be escaped.
 * We recommend using {@link sql} for a better DX.
 *
 * @param val literal value
 */
export function literal(val: string | Array<string | SequelizeMethod>): Literal {
  return new Literal(val);
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
 * Creates an object representing nested where conditions for postgres/sqlite/mysql json data-type.
 *
 * @param conditionsOrPath A hash containing strings/numbers or other nested hash, a string using dot notation or a string using postgres/sqlite/mysql json syntax.
 * @param value An optional value to compare against. Produces a string of the form "<json path> = '<value>'".
 *
 * @deprecated use {@link where}, {@link attribute}, and/or {@link jsonPath} instead.
 */
export function json(
  conditionsOrPath: { [key: string]: any } | string,
  value?: string | number | boolean | null,
) {
  noSqlJson();

  if (typeof conditionsOrPath === 'string') {
    const attr = attribute(conditionsOrPath);

    // json('profile.id') is identical to attribute('profile.id')
    if (value === undefined) {
      return attr;
    }

    // json('profile.id', value) is identical to where(attribute('profile.id'), value)
    return where(attr, value);
  }

  if (value === undefined && typeof conditionsOrPath === 'string') {
    return attribute(conditionsOrPath);
  }

  // json({ key: value }) is identical to where({ key: value })

  return where(conditionsOrPath);
}

/**
 * Do not use me directly. Use {@link jsonPath}.
 */
export class JsonPath extends SequelizeMethod {
  declare private readonly brand: 'jsonPath';

  constructor(
    readonly value: WhereLeftOperand,
    readonly path: readonly string[],
  ) {
    super();
  }
}

/**
 * Use this to access nested properties in a JSON column.
 * You can also use the dot notation with {@link attribute}, but this works with any values, not just attributes.
 *
 * @param value
 * @param path
 *
 * @example
 * ```ts
 * sql`${jsonPath('data', ['name'])} = '"John"'`
 * ```
 *
 * will produce
 *
 * ```sql
 * "data"->'name' = '"John"'
 * ```
 */
export function jsonPath(value: WhereLeftOperand, path: readonly string[]): JsonPath {
  return new JsonPath(value, path);
}

export class AssociationPath extends SequelizeMethod {
  declare private readonly brand: 'associationPath';

  constructor(
    readonly associationPath: readonly string[],
    readonly attributeName: string,
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
      if (typeof args[1] === 'string') {
        // TODO: link to actual page
        throw new TypeError(`where(left, operator, right) does not accept a string as the operator. Use one of the operators available in the Op object.
If you wish to use custom operators not provided by Sequelize, you can use the "sql" template literal tag. Refer to the documentation on custom operators on https://sequelize.org/ for more details.`);
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
 * For instance, either the left or right hand side of the operator can be {@link fn}, {@link col}, {@link literal} etc.
 *
 * If your left operand is an attribute name, using the regular POJO syntax (`{ where: { attrName: value }}`) syntax is usually more convenient.
 *
 * ⚠️ Unlike the POJO syntax, if the left operand is a string, it will be treated as a _value_, not an attribute name. If you wish to refer to an attribute, use {@link attribute} instead.
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
export function where(leftOperand: WhereLeftOperand, whereAttributeHashValue: WhereAttributeHashValue<any>): Where;

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
export function where(leftOperand: WhereLeftOperand, operator: keyof WhereOperators, rightOperand: WhereLeftOperand): Where;
export function where(
  ...args:
    | [whereOptions: WhereOptions]
    | [leftOperand: WhereLeftOperand, whereAttributeHashValue: WhereAttributeHashValue<any>]
    | [leftOperand: WhereLeftOperand, operator: keyof WhereOperators, rightOperand: WhereLeftOperand]
): Where {
  // @ts-expect-error -- they are the same type but this overload is internal
  return new Where(...args);
}
