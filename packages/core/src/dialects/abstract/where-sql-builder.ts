import NodeUtil from 'node:util';
import type {
  ModelStatic,
  WhereOptions,
  DataType,
  WhereLeftOperand,
} from '../../index.js';
import { Op } from '../../operators';
import { isPlainObject } from '../../utils/check.js';
import { noOpCol } from '../../utils/deprecations.js';
import { EMPTY_ARRAY, EMPTY_OBJECT } from '../../utils/object.js';
import { Attribute, JsonPath, SequelizeMethod, Col, Literal } from '../../utils/sequelize-method.js';
import type { Nullish } from '../../utils/types.js';
import { getComplexKeys, getOperators } from '../../utils/where.js';
import type { NormalizedDataType } from './data-types.js';
import * as DataTypes from './data-types.js';
import { AbstractDataType } from './data-types.js';
import type { Bindable } from './query-generator-typescript.js';
import type { AbstractQueryGenerator } from './query-generator.js';
import type { WhereAttributeHashValue } from './where-sql-builder-types.js';

export class PojoWhere {
  declare leftOperand: WhereLeftOperand;
  declare whereValue: WhereAttributeHashValue<any>;

  static create(
    leftOperand: WhereLeftOperand,
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
  #factory: () => T;
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
    if (this.#lastOccupiedIndex >= (this.#freeItems.length - 1)) {
      this.#freeItems.push(val);

      return;
    }

    this.#freeItems[++this.#lastOccupiedIndex] = val;
  }
}

const pojoWherePool = new ObjectPool<PojoWhere>(() => new PojoWhere(), 20);

export interface WhereBuilderOptions extends Bindable {
  model?: ModelStatic;
  type?: DataType;
}

export class WhereSqlBuilder {
  readonly operatorMap: Record<symbol, string> = {
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

  constructor(private readonly queryGenerator: AbstractQueryGenerator) {}

  get dialect() {
    return this.queryGenerator.dialect;
  }

  /**
   * Transforms any value accepted by {@link WhereOptions} into a SQL string.
   *
   * @param where
   * @param options
   */
  formatWhereOptions(
    where: WhereOptions,
    options: WhereBuilderOptions = EMPTY_OBJECT,
  ): string {
    if (typeof where === 'string') {
      throw new TypeError('Support for `{ where: \'raw query\' }` has been removed. Use `{ where: literal(\'raw query\') }` instead');
    }

    try {
      return this.#handleRecursiveNotOrAndWithImplicitAndArray(where, (piece: PojoWhere | SequelizeMethod) => {
        if (piece instanceof SequelizeMethod) {
          return this.queryGenerator.formatSequelizeMethod(piece, options);
        }

        return this.formatPojoWhere(piece, options);
      });
    } catch (error) {
      throw new TypeError(`Invalid value received for the "where" option. Refer to the sequelize documentation to learn which values the "where" option accepts.\nValue: ${NodeUtil.inspect(where)}`, {
        cause: error,
      });
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
    handlePart: (part: SequelizeMethod | PojoWhere) => string,
    logicalOperator: typeof Op.and | typeof Op.or = Op.and,
  ): string {
    // Arrays in this method are treated as an implicit "AND" operator
    if (Array.isArray(input)) {
      return joinWithLogicalOperator(
        input.map(part => this.#handleRecursiveNotOrAndWithImplicitAndArray(part, handlePart)),
        logicalOperator,
      );
    }

    // if the input is not a plan object, then it can't include Operators.
    if (!isPlainObject(input)) {
      return handlePart(input as SequelizeMethod);
    }

    const keys = getComplexKeys(input);

    const sqlArray = keys.map(operatorOrAttribute => {
      if (operatorOrAttribute === Op.not) {
        const generatedResult = this.#handleRecursiveNotOrAndWithImplicitAndArray(
          // @ts-expect-error -- This is a recursive type, which TS does not handle well
          input[Op.not] as WhereOptions<TAttributes>,
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
        throw new TypeError(`Invalid Query: ${NodeUtil.inspect(input)} includes the Symbol Operator Op.${operatorOrAttribute.description} but only attributes, Op.and, Op.or, and Op.not are allowed.`);
      }

      let pojoWhereObject;
      try {
        pojoWhereObject = pojoWherePool.getObject();

        pojoWhereObject.leftOperand = new Attribute(operatorOrAttribute);

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
  formatPojoWhere(
    pojoWhere: PojoWhere,
    options: WhereBuilderOptions = EMPTY_OBJECT,
  ): string {
    const dataType = this.#getOperandType(pojoWhere.leftOperand, options.model);
    const operandIsJsonColumn = dataType == null || dataType instanceof DataTypes.JSON;

    return this.#handleRecursiveNotOrAndNestedPathRecursive(
      pojoWhere.leftOperand,
      pojoWhere.whereValue,
      operandIsJsonColumn,
      (left: WhereLeftOperand, operator: symbol | undefined, right: WhereLeftOperand) => {
        if (operator === Op.col) {
          noOpCol();

          right = new Col(right as unknown as string);
          operator = Op.eq;
        }

        // This happens when the user does something like `where: { id: { [Op.any]: { id: 1 } } }`
        if (operator === Op.any || operator === Op.all) {
          // @ts-expect-error -- The type will be checked during runtime
          right = { [operator]: right };
          operator = Op.eq;
        }

        if (operator == null) {
          // TODO: except if left is array too
          operator = Array.isArray(right) && !(dataType instanceof DataTypes.ARRAY) ? Op.in
            : right === null ? Op.is
            : Op.eq;
        }

        // backwards compatibility
        if (right === null) {
          if (operator === Op.eq) {
            operator = Op.is;
          }

          if (operator === Op.ne) {
            operator = Op.isNot;
          }
        }

        if (operator in this) {
          // @ts-expect-error -- TS does not know that this is a method
          return this[operator](left, operator, right, dataType, options);
        }

        return this.formatBinaryOperation(left, operator, right, dataType, options);
      },
    );
  }

  protected [Op.notIn](...args: Parameters<WhereSqlBuilder[typeof Op.in]>): string {
    return this[Op.in](...args);
  }

  protected [Op.in](
    left: WhereLeftOperand,
    operator: symbol,
    right: WhereLeftOperand,
    dataType: NormalizedDataType | undefined,
    options: WhereBuilderOptions,
  ): string {
    const escapeOptions = { ...options, type: dataType };

    let rightSql: string;
    if (right instanceof Literal) {
      rightSql = this.queryGenerator.escape(right, escapeOptions);
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
        rightSql = this.queryGenerator.escapeList(right, escapeOptions);
      }
    } else {
      throw new TypeError('Operators Op.in and Op.notIn must be called with an array of values, or a literal');
    }

    const leftSql = this.queryGenerator.escape(left, escapeOptions);

    return `${leftSql} ${this.operatorMap[operator]} ${rightSql}`;
  }

  protected [Op.isNot](...args: Parameters<WhereSqlBuilder[typeof Op.is]>): string {
    return this[Op.is](...args);
  }

  protected [Op.is](
    left: WhereLeftOperand,
    operator: symbol,
    right: WhereLeftOperand,
    dataType: NormalizedDataType | undefined,
    options: WhereBuilderOptions,
  ): string {
    if (right !== null && typeof right !== 'boolean' && !(right instanceof Literal)) {
      throw new Error('Operators Op.is and Op.isNot can only be used with null, true, false or a literal.');
    }

    return this.formatBinaryOperation(left, operator, right, dataType, options);
  }

  protected [Op.notBetween](...args: Parameters<WhereSqlBuilder[typeof Op.between]>): string {
    return this[Op.between](...args);
  }

  protected [Op.between](
    left: WhereLeftOperand,
    operator: symbol,
    right: WhereLeftOperand,
    dataType: NormalizedDataType | undefined,
    options: WhereBuilderOptions,
  ): string {
    const escapeOptions = { ...options, type: dataType };
    const leftSql = this.queryGenerator.escape(left, escapeOptions);

    let rightSql: string;
    if (right instanceof SequelizeMethod) {
      rightSql = this.queryGenerator.escape(right, escapeOptions);
    } else if (Array.isArray(right) && right.length === 2) {
      rightSql = `${this.queryGenerator.escape(right[0], escapeOptions)} AND ${this.queryGenerator.escape(right[1], escapeOptions)}`;
    } else {
      throw new Error('Operators Op.between and Op.notBetween must be used with an array of two values, or a literal.');
    }

    return `${leftSql} ${this.operatorMap[operator]} ${rightSql}`;
  }

  protected [Op.contains](
    left: WhereLeftOperand,
    operator: symbol,
    right: WhereLeftOperand,
    dataType: NormalizedDataType | undefined,
    options: WhereBuilderOptions,
  ): string {
    // In postgres, Op.contains has multiple signatures:
    // - RANGE<VALUE> Op.contains RANGE<VALUE> (both represented by fixed-size arrays in JS)
    // - RANGE<VALUE> Op.contains VALUE
    // - ARRAY<VALUE> Op.contains ARRAY<VALUE>
    // When the left operand is a range RANGE, we must be able to serialize the right operand as either a RANGE or a VALUE.
    if (dataType instanceof DataTypes.RANGE && !Array.isArray(right)) {
      // This serializes the right operand as a VALUE
      return this.formatBinaryOperation(left, operator, right, dataType.options.subtype, options);
    }

    // This serializes the right operand as a RANGE (or an array for ARRAY contains ARRAY)
    return this.formatBinaryOperation(left, operator, right, dataType, options);
  }

  protected [Op.contained](
    left: WhereLeftOperand,
    operator: symbol,
    right: WhereLeftOperand,
    leftDataType: NormalizedDataType | undefined,
    options: WhereBuilderOptions,
  ): string {
    // This function has the opposite semantics of Op.contains. It has the following signatures:
    // - RANGE<VALUE> Op.contained RANGE<VALUE> (both represented by fixed-size arrays in JS)
    // - VALUE Op.contained RANGE<VALUE>
    // - ARRAY<VALUE> Op.contained ARRAY<VALUE>

    // This serializes VALUE contained RANGE
    if (
      leftDataType instanceof AbstractDataType
      && !(leftDataType instanceof DataTypes.RANGE)
      && !(leftDataType instanceof DataTypes.ARRAY)
      && Array.isArray(right)
    ) {
      return this.formatBinaryOperation(
        left,
        operator,
        right,
        new DataTypes.RANGE(leftDataType).toDialectDataType(this.dialect),
        options,
      );
    }

    // This serializes:
    // RANGE contained RANGE
    // ARRAY contained ARRAY
    return this.formatBinaryOperation(left, operator, right, leftDataType, options);
  }

  protected [Op.startsWith](
    left: WhereLeftOperand,
    operator: symbol,
    right: WhereLeftOperand,
    leftDataType: NormalizedDataType | undefined,
    options: WhereBuilderOptions,
  ): string {
    return this.formatSubstring(left, right, leftDataType, options, Op.like, false, true);
  }

  protected [Op.notStartsWith](
    left: WhereLeftOperand,
    operator: symbol,
    right: WhereLeftOperand,
    leftDataType: NormalizedDataType | undefined,
    options: WhereBuilderOptions,
  ): string {
    return this.formatSubstring(left, right, leftDataType, options, Op.notLike, false, true);
  }

  protected [Op.endsWith](
    left: WhereLeftOperand,
    operator: symbol,
    right: WhereLeftOperand,
    leftDataType: NormalizedDataType | undefined,
    options: WhereBuilderOptions,
  ): string {
    return this.formatSubstring(left, right, leftDataType, options, Op.like, true, false);
  }

  protected [Op.notEndsWith](
    left: WhereLeftOperand,
    operator: symbol,
    right: WhereLeftOperand,
    leftDataType: NormalizedDataType | undefined,
    options: WhereBuilderOptions,
  ): string {
    return this.formatSubstring(left, right, leftDataType, options, Op.notLike, true, false);
  }

  protected [Op.substring](
    left: WhereLeftOperand,
    operator: symbol,
    right: WhereLeftOperand,
    leftDataType: NormalizedDataType | undefined,
    options: WhereBuilderOptions,
  ): string {
    return this.formatSubstring(left, right, leftDataType, options, Op.like, true, true);
  }

  protected [Op.notSubstring](
    left: WhereLeftOperand,
    operator: symbol,
    right: WhereLeftOperand,
    leftDataType: NormalizedDataType | undefined,
    options: WhereBuilderOptions,
  ): string {
    return this.formatSubstring(left, right, leftDataType, options, Op.notLike, true, true);
  }

  protected formatSubstring(
    left: WhereLeftOperand,
    right: WhereLeftOperand,
    leftDataType: NormalizedDataType | undefined,
    options: WhereBuilderOptions,
    operator: symbol,
    start: boolean,
    end: boolean,
  ) {
    if (typeof right === 'string') {
      const startToken = start ? '%' : '';
      const endToken = end ? '%' : '';

      return this.formatBinaryOperation(left, operator, startToken + right + endToken, leftDataType, options);
    }

    const escapedPercent = this.dialect.escapeString('%');
    const literalBuilder: Array<string | SequelizeMethod> = [`CONCAT(`];
    if (start) {
      literalBuilder.push(escapedPercent, ', ');
    }

    literalBuilder.push(new Value(right));

    if (end) {
      literalBuilder.push(', ', escapedPercent);
    }

    literalBuilder.push(')');

    return this.formatBinaryOperation(left, operator, new Literal(literalBuilder), leftDataType, options);
  }

  protected formatBinaryOperation(
    left: WhereLeftOperand,
    operator: symbol,
    right: WhereLeftOperand,
    leftDataType: NormalizedDataType | undefined,
    options: WhereBuilderOptions,
  ) {
    const operatorSql = this.operatorMap[operator];
    if (!operatorSql) {
      throw new TypeError(`Operator Op.${operator.description} does not exist or is not supported by this dialect.`);
    }

    const leftSql = this.queryGenerator.escape(left, options);
    const rightSql = this.#formatOpAnyAll(right, leftDataType)
      || this.queryGenerator.escape(right, { ...options, type: leftDataType });

    return `${leftSql} ${this.operatorMap[operator]} ${rightSql}`;
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
        ? value[Op.values] as unknown[]
        : [value[Op.values]];

      const valueSql = operand.map(v => `(${this.queryGenerator.escape(v, options)})`).join(', ');

      return `VALUES ${valueSql}`;
    }

    return this.queryGenerator.escape(value, { type: type && new DataTypes.ARRAY(type) });
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
    leftOperand: WhereLeftOperand,
    whereValue: WhereAttributeHashValue<any>,
    allowJsonPath: boolean,
    handlePart: (
      left: WhereLeftOperand,
      operator: symbol | undefined,
      right: WhereLeftOperand,
    ) => string,
    operator: typeof Op.and | typeof Op.or = Op.and,
    parentJsonPath: readonly string[] = EMPTY_ARRAY,
  ): string {
    if (!isPlainObject(whereValue)) {
      return handlePart(this.#wrapJsonPath(leftOperand, parentJsonPath), undefined, whereValue);
    }

    const stringKeys = Object.keys(whereValue);
    if (!allowJsonPath && stringKeys.length > 0) {
      return handlePart(this.#wrapJsonPath(leftOperand, parentJsonPath), undefined, whereValue as WhereLeftOperand);
    }

    const keys = [...stringKeys, ...getOperators(whereValue)];

    const parts: string[] = keys.map(key => {
      // @ts-expect-error -- this recursive type is too difficult for TS to handle
      const value = whereValue[key];

      // nested JSON path
      if (typeof key === 'string') {
        return this.#handleRecursiveNotOrAndNestedPathRecursive(
          leftOperand,
          value,
          allowJsonPath,
          handlePart,
          operator,
          [...parentJsonPath, key],
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
            parentJsonPath,
          ),
        );
      }

      if (key === Op.and || key === Op.or) {
        if (Array.isArray(value)) {
          const sqlParts = value
            .map(v => this.#handleRecursiveNotOrAndNestedPathRecursive(
              leftOperand,
              v,
              allowJsonPath,
              handlePart,
              Op.and,
              parentJsonPath,
            ));

          return joinWithLogicalOperator(sqlParts, key as typeof Op.and | typeof Op.or);
        }

        return this.#handleRecursiveNotOrAndNestedPathRecursive(
          leftOperand,
          value,
          allowJsonPath,
          handlePart,
          key as typeof Op.and | typeof Op.or,
          parentJsonPath,
        );
      }

      return handlePart(this.#wrapJsonPath(leftOperand, parentJsonPath), key, value);
    });

    return joinWithLogicalOperator(parts, operator);
  }

  #wrapJsonPath(operand: WhereLeftOperand, jsonPath: readonly string[]): WhereLeftOperand {
    if (jsonPath.length === 0) {
      return operand;
    }

    return new JsonPath(operand, jsonPath);
  }

  #getOperandType(operand: WhereLeftOperand, model: Nullish<ModelStatic>): NormalizedDataType | undefined {
    if (!(operand instanceof Attribute) || !model) {
      return undefined;
    }

    const attribute = model.modelDefinition.attributes.get(operand.attributeName);

    return attribute?.type;
  }
}

function joinWithLogicalOperator(sqlArray: string[], operator: typeof Op.and | typeof Op.or): string {
  const operatorSql = operator === Op.and ? ' AND ' : ' OR ';

  sqlArray = sqlArray.filter(val => Boolean(val));

  if (sqlArray.length === 0) {
    return '';
  }

  if (sqlArray.length === 1) {
    return sqlArray[0];
  }

  return sqlArray.map(sql => {
    if (/ AND | OR /i.test(sql)) {
      return `(${sql})`;
    }

    return sql;
  }).join(operatorSql);
}

function wrapWithNot(sql: string): string {
  if (!sql) {
    return '0 = 1';
  }

  if (sql.startsWith('(') && sql.endsWith(')')) {
    return `NOT ${sql}`;
  }

  return `NOT (${sql})`;
}
