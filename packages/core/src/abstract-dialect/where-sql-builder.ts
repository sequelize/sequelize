import type { Nullish } from '@sequelize/utils';
import { EMPTY_ARRAY, EMPTY_OBJECT, isPlainObject, isString } from '@sequelize/utils';
import NodeUtil from 'node:util';
import { BaseError } from '../errors/base-error.js';
import { AssociationPath } from '../expression-builders/association-path.js';
import { Attribute } from '../expression-builders/attribute.js';
import { BaseSqlExpression } from '../expression-builders/base-sql-expression.js';
import { Cast } from '../expression-builders/cast.js';
import { Col } from '../expression-builders/col.js';
import { JsonPath } from '../expression-builders/json-path.js';
import { SQL_NULL } from '../expression-builders/json-sql-null.js';
import { Literal } from '../expression-builders/literal.js';
import { Value } from '../expression-builders/value.js';
import { Where } from '../expression-builders/where.js';
import type { AbstractDialect, Expression, ModelDefinition, WhereOptions } from '../index.js';
import { Op } from '../operators';
import type { ParsedJsonPropertyKey } from '../utils/attribute-syntax.js';
import { parseAttributeSyntax, parseNestedJsonKeySyntax } from '../utils/attribute-syntax.js';
import { noOpCol } from '../utils/deprecations.js';
import { extractModelDefinition } from '../utils/model-utils.js';
import { getComplexKeys, getOperators } from '../utils/where.js';
import type { NormalizedDataType } from './data-types.js';
import * as DataTypes from './data-types.js';
import type { FormatWhereOptions } from './query-generator-typescript.js';
import type { AbstractQueryGenerator } from './query-generator.js';
import type { WhereAttributeHashValue } from './where-sql-builder-types.js';

export class PojoWhere {
  declare leftOperand: Expression;
  declare whereValue: WhereAttributeHashValue<any>;

  static create(
    leftOperand: Expression,
    whereAttributeHashValue: WhereAttributeHashValue<any>,
  ): PojoWhere {
    const pojoWhere = new PojoWhere();
    pojoWhere.leftOperand = leftOperand;
    pojoWhere.whereValue = whereAttributeHashValue;

    return pojoWhere;
  }
}

class ObjectPool<T> {
  #freeItems: T[];
  readonly #factory: () => T;
  #lastOccupiedIndex: number;
  constructor(factory: () => T, initialSize: number) {
    this.#freeItems = Array.from({ length: initialSize }).map(factory);
    this.#lastOccupiedIndex = initialSize - 1;
    this.#factory = factory;
  }

  getObject(): T {
    if (this.#lastOccupiedIndex < 0) {
      return this.#factory();
    }

    return this.#freeItems[this.#lastOccupiedIndex--];
  }

  free(val: T): void {
    if (this.#lastOccupiedIndex >= this.#freeItems.length - 1) {
      this.#freeItems.push(val);

      return;
    }

    this.#freeItems[++this.#lastOccupiedIndex] = val;
  }
}

const pojoWherePool = new ObjectPool<PojoWhere>(() => new PojoWhere(), 20);

export class WhereSqlBuilder {
  readonly #dialect: AbstractDialect;

  #operatorMap: Record<symbol, string> = {
    [Op.eq]: '=',
    [Op.ne]: '!=',
    [Op.gte]: '>=',
    [Op.gt]: '>',
    [Op.lte]: '<=',
    [Op.lt]: '<',
    [Op.is]: 'IS',
    [Op.isNot]: 'IS NOT',
    [Op.in]: 'IN',
    [Op.notIn]: 'NOT IN',
    [Op.like]: 'LIKE',
    [Op.notLike]: 'NOT LIKE',
    [Op.iLike]: 'ILIKE',
    [Op.notILike]: 'NOT ILIKE',
    [Op.regexp]: '~',
    [Op.notRegexp]: '!~',
    [Op.iRegexp]: '~*',
    [Op.notIRegexp]: '!~*',
    [Op.between]: 'BETWEEN',
    [Op.notBetween]: 'NOT BETWEEN',
    [Op.overlap]: '&&',
    [Op.contains]: '@>',
    [Op.contained]: '<@',
    [Op.adjacent]: '-|-',
    [Op.strictLeft]: '<<',
    [Op.strictRight]: '>>',
    [Op.noExtendRight]: '&<',
    [Op.noExtendLeft]: '&>',
    [Op.any]: 'ANY',
    [Op.all]: 'ALL',
    [Op.match]: '@@',
    [Op.anyKeyExists]: '?|',
    [Op.allKeysExist]: '?&',
  };

  readonly #jsonType: NormalizedDataType | undefined;
  readonly #arrayOfTextType: NormalizedDataType | undefined;

  constructor(dialect: AbstractDialect) {
    this.#dialect = dialect;

    this.#jsonType = dialect.supports.dataTypes.JSON
      ? new DataTypes.JSON().toDialectDataType(dialect)
      : undefined;

    this.#arrayOfTextType = dialect.supports.dataTypes.ARRAY
      ? new DataTypes.ARRAY(new DataTypes.TEXT()).toDialectDataType(dialect)
      : undefined;
  }

  get #queryGenerator(): AbstractQueryGenerator {
    return this.#dialect.queryGenerator;
  }

  setOperatorKeyword(op: symbol, keyword: string): void {
    this.#operatorMap[op] = keyword;
  }

  /**
   * Transforms any value accepted by {@link WhereOptions} into a SQL string.
   *
   * @param where
   * @param options
   */
  formatWhereOptions(where: WhereOptions, options: FormatWhereOptions = EMPTY_OBJECT): string {
    if (typeof where === 'string') {
      throw new TypeError(
        "Support for `{ where: 'raw query' }` has been removed. Use `{ where: literal('raw query') }` instead",
      );
    }

    if (where === undefined) {
      return '';
    }

    try {
      return this.#handleRecursiveNotOrAndWithImplicitAndArray(
        where,
        (piece: PojoWhere | BaseSqlExpression) => {
          if (piece instanceof BaseSqlExpression) {
            return this.#queryGenerator.formatSqlExpression(piece, options);
          }

          return this.formatPojoWhere(piece, options);
        },
      );
    } catch (error) {
      throw new BaseError(
        `Invalid value received for the "where" option. Refer to the sequelize documentation to learn which values the "where" option accepts.\nValue: ${NodeUtil.inspect(where)}`,
        {
          cause: error,
        },
      );
    }
  }

  /**
   * This is the recursive "and", "or" and "not" handler of the first level of {@link WhereOptions} (the level *before* encountering an attribute name).
   * Unlike handleRecursiveNotOrAndNestedPathRecursive, this method accepts arrays at the top level, which are implicitly converted to "and" groups.
   * and does not handle nested JSON paths.
   *
   * @param input
   * @param handlePart
   * @param logicalOperator AND / OR
   */
  #handleRecursiveNotOrAndWithImplicitAndArray<TAttributes>(
    input: WhereOptions<TAttributes>,
    handlePart: (part: BaseSqlExpression | PojoWhere) => string,
    logicalOperator: typeof Op.and | typeof Op.or = Op.and,
  ): string {
    // Arrays in this method are treated as an implicit "AND" operator
    if (Array.isArray(input)) {
      return joinWithLogicalOperator(
        input.map(part => {
          if (part === undefined) {
            return '';
          }

          return this.#handleRecursiveNotOrAndWithImplicitAndArray(part, handlePart);
        }),
        logicalOperator,
      );
    }

    // if the input is not a plan object, then it can't include Operators.
    if (!isPlainObject(input)) {
      // @ts-expect-error -- This catches a scenario where the user did not respect the typing
      if (!(input instanceof BaseSqlExpression)) {
        throw new TypeError(
          `Invalid Query: expected a plain object, an array or a sequelize SQL method but got ${NodeUtil.inspect(input)} `,
        );
      }

      return handlePart(input);
    }

    const keys = getComplexKeys(input);

    const sqlArray = keys.map(operatorOrAttribute => {
      if (operatorOrAttribute === Op.not) {
        const generatedResult = this.#handleRecursiveNotOrAndWithImplicitAndArray(
          // @ts-expect-error -- This is a recursive type, which TS does not handle well
          input[Op.not],
          handlePart,
        );

        return wrapWithNot(generatedResult);
      }

      if (operatorOrAttribute === Op.and || operatorOrAttribute === Op.or) {
        return this.#handleRecursiveNotOrAndWithImplicitAndArray(
          // @ts-expect-error -- This is a recursive type, which TS does not handle well
          input[operatorOrAttribute],
          handlePart,
          operatorOrAttribute as typeof Op.and | typeof Op.or,
        );
      }

      // it *has* to be an attribute now
      if (typeof operatorOrAttribute === 'symbol') {
        throw new TypeError(
          `Invalid Query: ${NodeUtil.inspect(input)} includes the Symbol Operator Op.${operatorOrAttribute.description} but only attributes, Op.and, Op.or, and Op.not are allowed.`,
        );
      }

      let pojoWhereObject;
      try {
        pojoWhereObject = pojoWherePool.getObject();

        pojoWhereObject.leftOperand = parseAttributeSyntax(operatorOrAttribute);

        // @ts-expect-error -- The type of "operatorOrAttribute" is too dynamic for TS
        pojoWhereObject.whereValue = input[operatorOrAttribute];

        return handlePart(pojoWhereObject);
      } finally {
        if (pojoWhereObject) {
          pojoWherePool.free(pojoWhereObject);
        }
      }
    });

    return joinWithLogicalOperator(sqlArray, logicalOperator);
  }

  /**
   * This method is responsible for transforming a group "left operand" + "operators, right operands" (multiple) into a SQL string.
   *
   * @param pojoWhere The representation of the group.
   * @param options Option bag.
   */
  formatPojoWhere(pojoWhere: PojoWhere, options: FormatWhereOptions = EMPTY_OBJECT): string {
    const modelDefinition = options?.model ? extractModelDefinition(options.model) : null;

    // we need to parse the left operand early to determine the data type of the right operand
    let leftDataType = this.#getOperandType(pojoWhere.leftOperand, modelDefinition);
    const operandIsJsonColumn = leftDataType == null || leftDataType instanceof DataTypes.JSON;

    return this.#handleRecursiveNotOrAndNestedPathRecursive(
      pojoWhere.leftOperand,
      pojoWhere.whereValue,
      operandIsJsonColumn,
      (left: Expression, operator: symbol | undefined, right: Expression) => {
        // "left" could have been wrapped in a JSON path. If we still don't know its data type, it's very likely a JSON column
        // if the user used a JSON path in the where clause.
        if (leftDataType == null && left instanceof JsonPath) {
          leftDataType = this.#jsonType;
        } else if (left !== pojoWhere.leftOperand) {
          // if "left" was wrapped in a JSON path, we need to get its data type again as it might have been cast
          leftDataType = this.#getOperandType(left, modelDefinition);
        }

        if (operator === Op.col) {
          noOpCol();

          right = new Col(right as string);
          operator = Op.eq;
        }

        // This happens when the user does something like `where: { id: { [Op.any]: { id: 1 } } }`
        if (operator === Op.any || operator === Op.all) {
          right = { [operator]: right };
          operator = Op.eq;
        }

        if (operator == null) {
          if (right === null && leftDataType instanceof DataTypes.JSON) {
            throw new Error(
              `When comparing against a JSON column, the JavaScript null value can be represented using either the JSON 'null', or the SQL NULL. You must be explicit about which one you mean by using Op.is or SQL_NULL for the SQL NULL; or Op.eq or JSON_NULL for the JSON 'null'. Learn more at https://sequelize.org/docs/v7/querying/json/`,
            );
          }

          operator =
            Array.isArray(right) && !(leftDataType instanceof DataTypes.ARRAY)
              ? Op.in
              : right === null || right === SQL_NULL
                ? Op.is
                : Op.eq;
        }

        // backwards compatibility
        if (right === null && !(leftDataType instanceof DataTypes.JSON)) {
          if (operator === Op.eq) {
            operator = Op.is;
          }

          if (operator === Op.ne) {
            operator = Op.isNot;
          }
        }

        const rightDataType = this.#getOperandType(right, modelDefinition);

        if (operator in this) {
          // @ts-expect-error -- TS does not know that this is a method
          return this[operator](left, leftDataType, operator, right, rightDataType, options);
        }

        return this.formatBinaryOperation(
          left,
          leftDataType,
          operator,
          right,
          rightDataType,
          options,
        );
      },
    );
  }

  protected [Op.notIn](...args: Parameters<WhereSqlBuilder[typeof Op.in]>): string {
    return this[Op.in](...args);
  }

  protected [Op.in](
    left: Expression,
    leftDataType: NormalizedDataType | undefined,
    operator: symbol,
    right: Expression,
    rightDataType: NormalizedDataType | undefined,
    options: FormatWhereOptions,
  ): string {
    const rightEscapeOptions = { ...options, type: rightDataType ?? leftDataType };
    const leftEscapeOptions = { ...options, type: leftDataType ?? rightDataType };

    let rightSql: string;
    if (right instanceof Literal) {
      rightSql = this.#queryGenerator.escape(right, rightEscapeOptions);
    } else if (Array.isArray(right)) {
      if (right.length === 0) {
        // NOT IN () does not exist in SQL, so we need to return a condition that is:
        // - always false if the operator is IN
        // - always true if the operator is NOT IN
        if (operator === Op.notIn) {
          return '';
        }

        rightSql = '(NULL)';
      } else {
        rightSql = this.#queryGenerator.escapeList(right, rightEscapeOptions);
      }
    } else {
      throw new TypeError(
        'Operators Op.in and Op.notIn must be called with an array of values, or a literal',
      );
    }

    const leftSql = this.#queryGenerator.escape(left, leftEscapeOptions);

    return `${leftSql} ${this.#operatorMap[operator]} ${rightSql}`;
  }

  protected [Op.isNot](...args: Parameters<WhereSqlBuilder[typeof Op.is]>): string {
    return this[Op.is](...args);
  }

  protected [Op.is](
    left: Expression,
    leftDataType: NormalizedDataType | undefined,
    operator: symbol,
    right: Expression,
    rightDataType: NormalizedDataType | undefined,
    options: FormatWhereOptions,
  ): string {
    if (right !== null && typeof right !== 'boolean' && !(right instanceof Literal)) {
      throw new Error(
        'Operators Op.is and Op.isNot can only be used with null, true, false or a literal.',
      );
    }

    // "IS" operator does not accept bind parameters, only literals
    if (options.bindParam) {
      delete options.bindParam;
    }

    return this.formatBinaryOperation(left, undefined, operator, right, undefined, options);
  }

  protected [Op.notBetween](...args: Parameters<WhereSqlBuilder[typeof Op.between]>): string {
    return this[Op.between](...args);
  }

  protected [Op.between](
    left: Expression,
    leftDataType: NormalizedDataType | undefined,
    operator: symbol,
    right: Expression,
    rightDataType: NormalizedDataType | undefined,
    options: FormatWhereOptions,
  ): string {
    const rightEscapeOptions = { ...options, type: rightDataType ?? leftDataType };
    const leftEscapeOptions = { ...options, type: leftDataType ?? rightDataType };

    const leftSql = this.#queryGenerator.escape(left, leftEscapeOptions);

    let rightSql: string;
    if (right instanceof BaseSqlExpression) {
      rightSql = this.#queryGenerator.escape(right, rightEscapeOptions);
    } else if (Array.isArray(right) && right.length === 2) {
      rightSql = `${this.#queryGenerator.escape(right[0], rightEscapeOptions)} AND ${this.#queryGenerator.escape(right[1], rightEscapeOptions)}`;
    } else {
      throw new Error(
        'Operators Op.between and Op.notBetween must be used with an array of two values, or a literal.',
      );
    }

    return `${leftSql} ${this.#operatorMap[operator]} ${rightSql}`;
  }

  protected [Op.contains](
    left: Expression,
    leftDataType: NormalizedDataType | undefined,
    operator: symbol,
    right: Expression,
    rightDataType: NormalizedDataType | undefined,
    options: FormatWhereOptions,
  ): string {
    // In postgres, Op.contains has multiple signatures:
    // - RANGE<VALUE> Op.contains RANGE<VALUE> (both represented by fixed-size arrays in JS)
    // - RANGE<VALUE> Op.contains VALUE
    // - ARRAY<VALUE> Op.contains ARRAY<VALUE>
    // When the left operand is a range RANGE, we must be able to serialize the right operand as either a RANGE or a VALUE.
    if (!rightDataType && leftDataType instanceof DataTypes.RANGE && !Array.isArray(right)) {
      // This serializes the right operand as a VALUE
      return this.formatBinaryOperation(
        left,
        leftDataType,
        operator,
        right,
        leftDataType.options.subtype,
        options,
      );
    }

    // This serializes the right operand as a RANGE (or an array for ARRAY contains ARRAY)
    return this.formatBinaryOperation(left, leftDataType, operator, right, rightDataType, options);
  }

  protected [Op.contained](
    left: Expression,
    leftDataType: NormalizedDataType | undefined,
    operator: symbol,
    right: Expression,
    rightDataType: NormalizedDataType | undefined,
    options: FormatWhereOptions,
  ): string {
    // This function has the opposite semantics of Op.contains. It has the following signatures:
    // - RANGE<VALUE> Op.contained RANGE<VALUE> (both represented by fixed-size arrays in JS)
    // - VALUE Op.contained RANGE<VALUE>
    // - ARRAY<VALUE> Op.contained ARRAY<VALUE>

    // This serializes VALUE contained RANGE
    if (
      leftDataType instanceof DataTypes.AbstractDataType &&
      !(leftDataType instanceof DataTypes.RANGE) &&
      !(leftDataType instanceof DataTypes.ARRAY) &&
      Array.isArray(right)
    ) {
      return this.formatBinaryOperation(
        left,
        leftDataType,
        operator,
        right,
        new DataTypes.RANGE(leftDataType).toDialectDataType(this.#dialect),
        options,
      );
    }

    // This serializes:
    // RANGE contained RANGE
    // ARRAY contained ARRAY
    return this.formatBinaryOperation(left, leftDataType, operator, right, rightDataType, options);
  }

  protected [Op.startsWith](
    left: Expression,
    leftDataType: NormalizedDataType | undefined,
    operator: symbol,
    right: Expression,
    rightDataType: NormalizedDataType | undefined,
    options: FormatWhereOptions,
  ): string {
    return this.formatSubstring(
      left,
      leftDataType,
      Op.like,
      right,
      rightDataType,
      options,
      false,
      true,
    );
  }

  protected [Op.notStartsWith](
    left: Expression,
    leftDataType: NormalizedDataType | undefined,
    operator: symbol,
    right: Expression,
    rightDataType: NormalizedDataType | undefined,
    options: FormatWhereOptions,
  ): string {
    return this.formatSubstring(
      left,
      leftDataType,
      Op.notLike,
      right,
      rightDataType,
      options,
      false,
      true,
    );
  }

  protected [Op.endsWith](
    left: Expression,
    leftDataType: NormalizedDataType | undefined,
    operator: symbol,
    right: Expression,
    rightDataType: NormalizedDataType | undefined,
    options: FormatWhereOptions,
  ): string {
    return this.formatSubstring(
      left,
      leftDataType,
      Op.like,
      right,
      rightDataType,
      options,
      true,
      false,
    );
  }

  protected [Op.notEndsWith](
    left: Expression,
    leftDataType: NormalizedDataType | undefined,
    operator: symbol,
    right: Expression,
    rightDataType: NormalizedDataType | undefined,
    options: FormatWhereOptions,
  ): string {
    return this.formatSubstring(
      left,
      leftDataType,
      Op.notLike,
      right,
      rightDataType,
      options,
      true,
      false,
    );
  }

  protected [Op.substring](
    left: Expression,
    leftDataType: NormalizedDataType | undefined,
    operator: symbol,
    right: Expression,
    rightDataType: NormalizedDataType | undefined,
    options: FormatWhereOptions,
  ): string {
    return this.formatSubstring(
      left,
      leftDataType,
      Op.like,
      right,
      rightDataType,
      options,
      true,
      true,
    );
  }

  protected [Op.notSubstring](
    left: Expression,
    leftDataType: NormalizedDataType | undefined,
    operator: symbol,
    right: Expression,
    rightDataType: NormalizedDataType | undefined,
    options: FormatWhereOptions,
  ): string {
    return this.formatSubstring(
      left,
      leftDataType,
      Op.notLike,
      right,
      rightDataType,
      options,
      true,
      true,
    );
  }

  protected formatSubstring(
    left: Expression,
    leftDataType: NormalizedDataType | undefined,
    operator: symbol,
    right: Expression,
    rightDataType: NormalizedDataType | undefined,
    options: FormatWhereOptions,
    start: boolean,
    end: boolean,
  ) {
    if (typeof right === 'string') {
      const startToken = start ? '%' : '';
      const endToken = end ? '%' : '';

      return this.formatBinaryOperation(
        left,
        leftDataType,
        operator,
        startToken + right + endToken,
        rightDataType,
        options,
      );
    }

    const escapedPercent = this.#dialect.escapeString('%');
    const literalBuilder: Array<string | BaseSqlExpression> = [`CONCAT(`];
    if (start) {
      literalBuilder.push(escapedPercent, ', ');
    }

    literalBuilder.push(new Value(right));

    if (end) {
      literalBuilder.push(', ', escapedPercent);
    }

    literalBuilder.push(')');

    return this.formatBinaryOperation(
      left,
      leftDataType,
      operator,
      new Literal(literalBuilder),
      rightDataType,
      options,
    );
  }

  [Op.anyKeyExists](
    left: Expression,
    leftDataType: NormalizedDataType | undefined,
    operator: symbol,
    right: Expression,
    rightDataType: NormalizedDataType | undefined,
    options: FormatWhereOptions,
  ): string {
    if (!this.#arrayOfTextType) {
      throw new Error('This dialect does not support Op.anyKeyExists');
    }

    return this.formatBinaryOperation(
      left,
      leftDataType,
      operator,
      right,
      this.#arrayOfTextType,
      options,
    );
  }

  [Op.allKeysExist](
    left: Expression,
    leftDataType: NormalizedDataType | undefined,
    operator: symbol,
    right: Expression,
    rightDataType: NormalizedDataType | undefined,
    options: FormatWhereOptions,
  ): string {
    if (!this.#arrayOfTextType) {
      throw new Error('This dialect does not support Op.allKeysExist');
    }

    return this.formatBinaryOperation(
      left,
      leftDataType,
      operator,
      right,
      this.#arrayOfTextType,
      options,
    );
  }

  protected formatBinaryOperation(
    left: Expression,
    leftDataType: NormalizedDataType | undefined,
    operator: symbol,
    right: Expression,
    rightDataType: NormalizedDataType | undefined,
    options: FormatWhereOptions,
  ) {
    const operatorSql = this.#operatorMap[operator];
    if (!operatorSql) {
      throw new TypeError(
        `Operator Op.${operator.description} does not exist or is not supported by this dialect.`,
      );
    }

    const leftSql = this.#queryGenerator.escape(left, {
      ...options,
      type: leftDataType ?? rightDataType,
    });
    const rightSql =
      this.#formatOpAnyAll(right, rightDataType ?? leftDataType) ||
      this.#queryGenerator.escape(right, { ...options, type: rightDataType ?? leftDataType });

    return `${wrapAmbiguousWhere(left, leftSql)} ${this.#operatorMap[operator]} ${wrapAmbiguousWhere(right, rightSql)}`;
  }

  #formatOpAnyAll(value: unknown, type: NormalizedDataType | undefined): string {
    if (!isPlainObject(value)) {
      return '';
    }

    if (Op.any in value) {
      return `ANY (${this.#formatOpValues(value[Op.any], type)})`;
    }

    if (Op.all in value) {
      return `ALL (${this.#formatOpValues(value[Op.all], type)})`;
    }

    return '';
  }

  #formatOpValues(value: unknown, type: NormalizedDataType | undefined): string {
    if (isPlainObject(value) && Op.values in value) {
      const options = { type };

      const operand: unknown[] = Array.isArray(value[Op.values])
        ? (value[Op.values] as unknown[])
        : [value[Op.values]];

      const valueSql = operand.map(v => `(${this.#queryGenerator.escape(v, options)})`).join(', ');

      return `VALUES ${valueSql}`;
    }

    return this.#queryGenerator.escape(value, { type: type && new DataTypes.ARRAY(type) });
  }

  /**
   * This is the recursive "and", "or" and "not" handler of {@link WhereAttributeHashValue} (the level *after* encountering an attribute name).
   * Unlike handleRecursiveNotOrAndWithImplicitAndArray, arrays at the top level have an implicit "IN" operator, instead of an implicit "AND" operator,
   * and this method handles nested JSON paths.
   *
   * @param leftOperand
   * @param whereValue
   * @param allowJsonPath
   * @param handlePart
   * @param operator
   * @param parentJsonPath
   */
  #handleRecursiveNotOrAndNestedPathRecursive(
    leftOperand: Expression,
    whereValue: WhereAttributeHashValue<any>,
    allowJsonPath: boolean,
    handlePart: (left: Expression, operator: symbol | undefined, right: Expression) => string,
    operator: typeof Op.and | typeof Op.or = Op.and,
    parentJsonPath: ReadonlyArray<string | number> = EMPTY_ARRAY,
  ): string {
    if (!isPlainObject(whereValue)) {
      return handlePart(
        this.#wrapSimpleJsonPath(leftOperand, parentJsonPath),
        undefined,
        whereValue,
      );
    }

    const stringKeys = Object.keys(whereValue);
    if (!allowJsonPath && stringKeys.length > 0) {
      return handlePart(
        this.#wrapSimpleJsonPath(leftOperand, parentJsonPath),
        undefined,
        whereValue as Expression,
      );
    }

    const keys = [...stringKeys, ...getOperators(whereValue)];

    const parts: string[] = keys.map(key => {
      const value = whereValue[key];

      // nested JSON path
      if (typeof key === 'string') {
        // parse path segments & cast syntax
        const parsedKey = parseNestedJsonKeySyntax(key);

        // optimization for common simple scenario (to skip replacing leftOperand on every iteration)
        if (parsedKey.castsAndModifiers.length === 0) {
          return this.#handleRecursiveNotOrAndNestedPathRecursive(
            leftOperand,
            value,
            allowJsonPath,
            handlePart,
            operator,
            [...parentJsonPath, ...parsedKey.pathSegments],
          );
        }

        // less optimized scenario: happens when we leave the JSON path (cast to another type or unquote),
        // we need to replace leftOperand with the casted value or the unquote operation
        const newOperand = this.#wrapComplexJsonPath(leftOperand, parentJsonPath, parsedKey);

        return this.#handleRecursiveNotOrAndNestedPathRecursive(
          newOperand,
          value,
          // TODO: allow JSON if last cast is JSON?
          //  needs a mechanism to get JS DataType from SQL DataType first. To get last cast:
          //  newOperand instanceof Cast && isString(newOperand.type) && newOperand.type.toLowerCase();
          false,
          handlePart,
          operator,
          // reset json path
          EMPTY_ARRAY,
        );
      }

      if (key === Op.not) {
        return wrapWithNot(
          this.#handleRecursiveNotOrAndNestedPathRecursive(
            leftOperand,
            value,
            allowJsonPath,
            handlePart,
            Op.and,
          ),
        );
      }

      if (key === Op.and || key === Op.or) {
        if (Array.isArray(value)) {
          const sqlParts = value.map(v =>
            this.#handleRecursiveNotOrAndNestedPathRecursive(
              leftOperand,
              v,
              allowJsonPath,
              handlePart,
              Op.and,
            ),
          );

          return joinWithLogicalOperator(sqlParts, key as typeof Op.and | typeof Op.or);
        }

        return this.#handleRecursiveNotOrAndNestedPathRecursive(
          leftOperand,
          value,
          allowJsonPath,
          handlePart,
          key as typeof Op.and | typeof Op.or,
        );
      }

      return handlePart(this.#wrapSimpleJsonPath(leftOperand, parentJsonPath), key, value);
    });

    return joinWithLogicalOperator(parts, operator);
  }

  #wrapSimpleJsonPath(
    operand: Expression,
    pathSegments: ReadonlyArray<string | number>,
  ): Expression {
    if (pathSegments.length === 0) {
      return operand;
    }

    // merge JSON paths
    if (operand instanceof JsonPath) {
      return new JsonPath(operand.expression, [...operand.path, ...pathSegments]);
    }

    return new JsonPath(operand, pathSegments);
  }

  #wrapComplexJsonPath(
    operand: Expression,
    parentJsonPath: ReadonlyArray<string | number>,
    parsedPath: ParsedJsonPropertyKey,
  ): Expression {
    const finalPathSegments =
      parentJsonPath.length > 0
        ? [...parentJsonPath, ...parsedPath.pathSegments]
        : parsedPath.pathSegments;

    operand = this.#wrapSimpleJsonPath(operand, finalPathSegments);

    for (const castOrModifier of parsedPath.castsAndModifiers) {
      if (isString(castOrModifier)) {
        // casts are always strings
        operand = new Cast(operand, castOrModifier);
      } else {
        // modifiers are always classes
        operand = new castOrModifier(operand);
      }
    }

    return operand;
  }

  #getOperandType(
    operand: Expression,
    modelDefinition: ModelDefinition | Nullish,
  ): NormalizedDataType | undefined {
    if (operand instanceof Cast) {
      // TODO: if operand.type is a string (= SQL Type), look up a per-dialect mapping of SQL types to Sequelize types?
      return this.#dialect.sequelize.normalizeDataType(operand.type);
    }

    if (operand instanceof JsonPath) {
      // JsonPath can wrap Attributes
      return this.#jsonType;
    }

    if (!modelDefinition) {
      return undefined;
    }

    if (operand instanceof AssociationPath) {
      const association = modelDefinition.getAssociation(operand.associationPath);

      if (!association) {
        return undefined;
      }

      return this.#getOperandType(operand.attributeName, association.target.modelDefinition);
    }

    if (operand instanceof Attribute) {
      return modelDefinition.attributes.get(operand.attributeName)?.type;
    }

    return undefined;
  }
}

export function joinWithLogicalOperator(
  sqlArray: string[],
  operator: typeof Op.and | typeof Op.or,
): string {
  const operatorSql = operator === Op.and ? ' AND ' : ' OR ';

  sqlArray = sqlArray.filter(val => Boolean(val));

  if (sqlArray.length === 0) {
    return '';
  }

  if (sqlArray.length === 1) {
    return sqlArray[0];
  }

  return sqlArray
    .map(sql => {
      if (/ AND | OR /i.test(sql)) {
        return `(${sql})`;
      }

      return sql;
    })
    .join(operatorSql);
}

function wrapWithNot(sql: string): string {
  if (!sql) {
    return '';
  }

  return `NOT (${sql})`;
}

export function wrapAmbiguousWhere(operand: Expression, sql: string): string {
  // where() can produce ambiguous SQL when used as an operand:
  //
  // { booleanAttr: where(fn('lower', col('name')), Op.is, null) }
  // produces the ambiguous SQL:
  //   [booleanAttr] = lower([name]) IS NULL
  // which is better written as:
  //   [booleanAttr] = (lower([name]) IS NULL)
  if (operand instanceof Where && sql.includes(' ')) {
    return `(${sql})`;
  }

  return sql;
}
