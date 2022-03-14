import assert from 'assert';
import nodeUtil from 'util';
import isPlainObject from 'lodash/isPlainObject';
import type { ModelStatic, WhereOperators, WhereOptions, WhereAttributeHash, ModelAttributeMeta } from '../../..';
import { DataTypes, Utils } from '../../..';
import { Op } from '../../operators';

const EMPTY_OBJECT = Object.freeze(Object.create(null));

// TODO (@ephys): remove once https://github.com/sequelize/sequelize/pull/14018 has been merged
//  but add "string" in parent typing
type WhereLeftOperand = Utils.Fn | Utils.Col | Utils.Literal | ModelAttributeMeta | string;

type LeftOperand = Utils.Fn | Utils.Col | Utils.Literal | string;

type Options = {
  model: ModelStatic<any>,
  prefix: string,
  type: unknown,
  /**
   * Pass the value to bind, and this will return its identifier in the query.
   *
   * @param value
   */
  bindParam?(value: any): string,
};

type Field = ModelAttributeMeta;

type RightOperands = Required<WhereOperators>;

function isModelAttributeMeta(val: any): val is ModelAttributeMeta {
  return 'type' in val && 'fieldName' in val && val.type instanceof DataTypes.ABSTRACT;
}

class WhereSqlBuilder {
  constructor(private readonly queryGenerator: any) {}

  /**
   * Transforms any value accepted by {@link WhereOptions} into a SQL string.
   *
   * @param where
   * @param options
   */
  whereOptionsToSql(where: WhereOptions, options: Options = EMPTY_OBJECT): string {
    if (typeof where === 'string') {
      throw new TypeError('Support for `{where: \'raw query\'}` has been removed. Use `{ where: Sequelize.literal(\'raw query\') }` instead');
    }

    return this.#whereOptionsToSql(undefined, where, options);
  }

  /**
   *
   * @param inheritedLeftOperand TODO DOCUMENT
   * @param where
   * @param options
   * @private
   */
  #whereOptionsToSql(inheritedLeftOperand: LeftOperand | undefined, where: WhereOptions, options: Options): string {
    if (where == null) {
      // NO OP
      return '';
    }

    if (where instanceof Utils.Where) {
      return this.#whereInstanceToSql(where, options);
    }

    if (where instanceof Utils.Literal || where instanceof Utils.Fn) {
      return this.queryGenerator.handleSequelizeMethod(where);
    }

    if (isPlainObject(where)) {
      return this.#whereAttributeHashToSql(inheritedLeftOperand, where, options);
    }

    throw new TypeError('Received invalid value for `where` option');
  }

  /**
   * Transforms any value accepted by {@link WhereAttributeHash} into a SQL string.
   *
   * @param inheritedLeftOperand
   * @param where
   * @param options
   */
  #whereAttributeHashToSql(
    inheritedLeftOperand: LeftOperand | undefined,
    where: WhereAttributeHash,
    options: Options,
  ): string {
    // @ts-expect-error - missing typings
    if (Utils.getComplexSize(where) === 0) {
      // NO OP
      return '';
    }

    return this.buildComparison(
      inheritedLeftOperand,
      typeof inheritedLeftOperand === 'string'
        ? this.queryGenerator._findField(inheritedLeftOperand, options)
        : undefined,
      Op.and,
      where,
      options,
    );
  }

  /**
   * Transforms an instance of {@link Utils.Where} (obtained from {@link Sequelize.where}) into a SQL string.
   *
   * @param where
   * @param options
   */
  #whereInstanceToSql(where: Utils.Where, options: Options): string {
    // TODO (@ephys): Once Util has been migrated to TS
    //  rename Utils.Where fields
    //  attribute -> leftOperand
    //  comparator -> operator
    //  logic -> rightOperand

    const key = where.attribute as WhereLeftOperand;

    return this.buildComparison(
      isModelAttributeMeta(key) ? key.fieldName : key,
      isModelAttributeMeta(key) ? key : undefined,
      // TODO (@ephys): fix where.comparator once https://github.com/sequelize/sequelize/pull/14018 has been merged
      // @ts-expect-error
      where.comparator as keyof RightOperands,
      where.logic,
      options,
    );
  }

  buildComparison<Operator extends keyof RightOperands>(
    leftOperand: LeftOperand | undefined,
    leftOperandAttr: Field | undefined,
    operator: Operator,
    rightOperand: RightOperands[Operator],
    options: Options = EMPTY_OBJECT,
  ): string {
    if (!(operator in this)) {
      return this.#buildSimpleOperator(leftOperand, leftOperandAttr, operator, rightOperand, options);
      // throw new Error(`${this.constructor.name}#[${String(operator)}] has not been implemented.`);
    }

    // @ts-expect-error
    return this[operator](leftOperand, leftOperandAttr, rightOperand, options);
  }

  #buildSimpleOperator<Operator extends keyof RightOperands>(
    leftOperand: LeftOperand | undefined,
    leftOperandAttr: Field | undefined,
    operatorSymbol: Operator,
    rightOperand: RightOperands[Operator],
    options: Options,
  ): string {
    const operator = this.queryGenerator.OperatorMap[operatorSymbol];
    if (!operator) {
      throw new Error(`Operator ${String(operatorSymbol)} is not supported in this dialect.`);
    }

    assert(leftOperand != null, 'key must be provided');

    const escapeOptions = {
      // iLike, like, notILike, notLike
      acceptStrings: operator.includes(this.queryGenerator.OperatorMap[Op.like]),
    };

    return this.queryGenerator._joinKeyValue(
      leftOperand,
      this.#escapeOrBindLeaf(rightOperand, leftOperandAttr, {
        ...options,
        ...escapeOptions,
      }),
      operator,
      options.prefix,
    );
  }

  [Op.eq](key: LeftOperand | undefined, field: Field, value: RightOperands[typeof Op.eq], options: Options): string {
    // alias "= NULL" to "IS NULL"
    if (value === null) {
      return this.#buildSimpleOperator(key, field, Op.is, value, options);
    }

    // 'eq' is a bit of a special case. It is both used as comparison (=),
    // and as the default 'do nothing' operator in Sequelize.where()
    // @ts-expect-error - getOperators has no typings yet
    if (isPlainObject(value) && Utils.getOperators(value).length > 0) {
      return this.buildComparison(key, field, Op.and, value, options);
    }

    return this.#buildSimpleOperator(key, field, Op.eq, value, options);
  }

  [Op.ne](key: LeftOperand | undefined, field: Field, value: RightOperands[typeof Op.ne], options: Options): string {
    // alias "!= NULL" to "IS NOT NULL"
    if (value === null) {
      return this.#buildSimpleOperator(key, field, Op.isNot, value, options);
    }

    return this.#buildSimpleOperator(key, field, Op.ne, value, options);
  }

  [Op.not](key: LeftOperand | undefined, field: Field, value: RightOperands[typeof Op.not], options: Options): string {
    // Legacy: `{ [Op.not]: null }` used to mean "IS NOT NULL", which is now the role of `{ [Op.isNot]: null }`
    if (value === null || typeof value === 'boolean') {
      return this.#buildSimpleOperator(key, field, Op.isNot, value, options);
    }

    if (typeof value === 'number' || typeof value === 'string') {
      return this.#buildSimpleOperator(key, field, Op.ne, value, options);
    }

    // TODO (@ephys): check NOT support for different dialects
    const notOperator: string = this.queryGenerator.OperatorMap[Op.not];

    return `${notOperator} (${this.#whereOptionsToSql(key, value, options)})`;
  }

  [Op.and](key: LeftOperand | undefined, field: Field, value: RightOperands[typeof Op.and], options: Options): string {
    return this.#andOr(key, field, value, options, Op.and);
  }

  [Op.or](key: LeftOperand | undefined, field: Field, value: RightOperands[typeof Op.or], options: Options): string {
    return this.#andOr(key, field, value, options, Op.or);
  }

  #andOr(
    key: LeftOperand | undefined,
    field: Field,
    valueCollection: RightOperands[typeof Op.or],
    options: Options,
    operatorSymbol: typeof Op.or | typeof Op.and,
  ) {
    const operator: string = this.queryGenerator.OperatorMap[operatorSymbol];

    if (Array.isArray(valueCollection)) {
      // Sequelize.or([
      //   { /* group1 */ },
      //   { /* group2 */ },
      // ])
      // -> (group1) OR (group2)
      return valueCollection.map(part => this.whereOptionsToSql(part, options))
        .join(operator);
    } else if (isPlainObject(valueCollection)) {
      // Sequelize.or({
      //   /* value 1 */,
      //   /* value 2 */,
      // })
      // -> (value1) OR (value2)

      // @ts-expect-error - typings not yet added
      return Utils.getComplexKeys(valueCollection)
        .map((attributeOrOperator: string | symbol) => {
          // TODO (@ephys): FIX ME - once Utils has been migrated to TS, add a isPlainObject that tells TS this is an object.
          // @ts-expect-error
          const value = valueCollection[attributeOrOperator];

          if (typeof attributeOrOperator === 'symbol') {
            return this.buildComparison(key, field, attributeOrOperator as keyof RightOperands, value, options);
          }

          const newKey = attributeOrOperator;
          const newField = this.queryGenerator._findField(newKey, options);

          return this.buildComparison(newKey, newField, Op.eq, value, options);
        })
        .join(operator);
    }

    throw new TypeError(`Unsupported value used in with Operator ${String(operatorSymbol)}.\nExpected a POJO or an Array. Got ${nodeUtil.inspect(valueCollection)}`);
  }

  [Op.between](key: LeftOperand | undefined, field: Field,
    value: RightOperands[typeof Op.between], options: Options): string {

    return this.#between(key, field, value, options, Op.between);
  }

  [Op.notBetween](key: LeftOperand | undefined, field: Field,
    value: RightOperands[typeof Op.notBetween], options: Options): string {

    return this.#between(key, field, value, options, Op.notBetween);
  }

  /**
   * Common implementation for Op.notBetween and Op.between
   *
   * @param key
   * @param field
   * @param value
   * @param options
   * @param operatorSymbol
   */
  #between(
    key: LeftOperand | undefined,
    field: Field,
    value: RightOperands[typeof Op.notBetween],
    options: Options,
    operatorSymbol: typeof Op.notBetween | typeof Op.between,
  ) {
    let rightOperand: string;

    if (value instanceof Utils.Literal) {
      rightOperand = this.queryGenerator.escape(value);
    } else if (Array.isArray(value) && value.length === 2) {
      rightOperand = `${this.#escapeOrBindLeaf(value[0], field, options)} AND ${this.#escapeOrBindLeaf(value[1], field, options)}`;
    } else {
      throw new TypeError('Op.between / Op.notBetween expect an array of length 2 or Sequelize.literal()');
    }

    const operator: string = this.queryGenerator.OperatorMap[operatorSymbol];

    return this.queryGenerator._joinKeyValue(
      key,
      rightOperand,
      operator,
      options.prefix,
    );
  }

  [Op.in](
    leftOperand: LeftOperand | undefined,
    leftAttr: Field | undefined,
    rightOperand: RightOperands[typeof Op.in],
    options: Options,
  ): string {
    return this.#in(leftOperand, leftAttr, rightOperand, options, Op.in);
  }

  [Op.notIn](
    leftOperand: LeftOperand | undefined,
    leftAttr: Field | undefined,
    rightOperand: RightOperands[typeof Op.notIn],
    options: Options,
  ): string {
    return this.#in(leftOperand, leftAttr, rightOperand, options, Op.notIn);
  }

  #in(leftOperand: LeftOperand | undefined, leftAttr: Field | undefined,
    rightOperandRaw: RightOperands[typeof Op.in], options: Options, opSymbol: typeof Op.in | typeof Op.notIn): string {

    const operator: string = this.queryGenerator.OperatorMap[opSymbol];

    let rightOperand;
    if (rightOperandRaw instanceof Utils.Literal) {
      rightOperand = this.queryGenerator.escape(rightOperandRaw);
    } else if (Array.isArray(rightOperandRaw)) {
      if (rightOperandRaw.length === 0) {
        if (opSymbol === Op.in) {
          return '1 = 2'; // IN () is always false
        }

        return '1 = 1'; // NOT IN () is always true
      }

      // TODO (@ephys): Test options.bindParam with IN
      rightOperand = `(${rightOperandRaw.map(item => this.queryGenerator.escape(item, leftAttr)).join(', ')})`;
    }

    return this.queryGenerator._joinKeyValue(leftOperand, rightOperand, operator, options.prefix);
  }

  [Op.all](leftOperand: LeftOperand | undefined, leftAttr: Field | undefined,
    rightOperandRaw: RightOperands[typeof Op.all], options: Options): string {
    return this.#allAny(leftOperand, leftAttr, rightOperandRaw, options, Op.all);
  }

  [Op.any](leftOperand: LeftOperand | undefined, leftAttr: Field | undefined,
    rightOperandRaw: RightOperands[typeof Op.any], options: Options): string {
    return this.#allAny(leftOperand, leftAttr, rightOperandRaw, options, Op.any);
  }

  #allAny(leftOperand: LeftOperand | undefined, leftAttr: Field | undefined,
    rightOperandRaw: RightOperands[typeof Op.all], options: Options, operatorSymbol: typeof Op.any | typeof Op.all) {

    const operator = `${this.queryGenerator.OperatorMap[Op.eq]} ${this.queryGenerator.OperatorMap[operatorSymbol]}`;

    let rightOperand: string;

    // TODO (@ephys): Test options.bindParam with ALL / ANY / ALL VALUES / ANY VALUES

    if (rightOperandRaw instanceof Utils.Literal) {
      rightOperand = `(${this.#escape(rightOperandRaw, leftAttr)})`;
    } else if (Array.isArray(rightOperandRaw)) {
      rightOperand = `(${rightOperandRaw.map(part => this.#escape(part, leftAttr)).join(', ')})`;
    } else if (rightOperandRaw[Op.values]) {
      const values = rightOperandRaw[Op.values];

      if (values instanceof Utils.Literal) {
        rightOperand = `(VALUES (${this.#escape(rightOperandRaw, leftAttr)}))`;
      } else if (Array.isArray(rightOperandRaw)) {
        rightOperand = `(VALUES ${rightOperandRaw.map(part => `${this.#escape(part, leftAttr)}`).join(', ')})`;
      } else {
        throw new TypeError(`[${String(operator)}][${String(Op.values)}] expected a literal or an array, but received ${nodeUtil.inspect(values)}`);
      }
    } else {
      throw new TypeError(`[${String(operator)}] expected a literal, an array, or a POJO with Op.values, but received ${nodeUtil.inspect(rightOperandRaw)}`);
    }

    return this.queryGenerator._joinKeyValue(leftOperand, rightOperand, operator, options.prefix);
  }

  [Op.like](leftOperand: LeftOperand | undefined, leftAttr: Field | undefined,
    rightOperandRaw: RightOperands[typeof Op.like], options: Options): string {
    return this.#like(leftOperand, leftAttr, rightOperandRaw, options, Op.like);
  }

  [Op.iLike](leftOperand: LeftOperand | undefined, leftAttr: Field | undefined,
    rightOperandRaw: RightOperands[typeof Op.iLike], options: Options): string {
    return this.#like(leftOperand, leftAttr, rightOperandRaw, options, Op.iLike);
  }

  [Op.notLike](leftOperand: LeftOperand | undefined, leftAttr: Field | undefined,
    rightOperandRaw: RightOperands[typeof Op.notLike], options: Options): string {
    return this.#like(leftOperand, leftAttr, rightOperandRaw, options, Op.notLike);
  }

  [Op.notILike](leftOperand: LeftOperand | undefined, leftAttr: Field | undefined,
    rightOperandRaw: RightOperands[typeof Op.notILike], options: Options): string {
    return this.#like(leftOperand, leftAttr, rightOperandRaw, options, Op.notILike);
  }

  #like(
    leftOperand: LeftOperand | undefined,
    leftAttr: Field | undefined,
    rightOperandRaw: RightOperands[typeof Op.like],
    options: Options,
    operatorSymbol: typeof Op.like | typeof Op.iLike | typeof Op.notLike | typeof Op.notILike,
  ) {
    const operator = this.queryGenerator.OperatorMap[operatorSymbol];

    let rightOperand: string;

    if (isPlainObject(rightOperandRaw)) {
      // support for `{ like: { any: [] } }` and `{ like: { all: [] } }`

      // TODO (@ephys): remove ts-expect-error once isPlainObject is properly typed

      // @ts-expect-error
      assertSingleKeyObject(rightOperandRaw, [Op.any, Op.all]);

      // @ts-expect-error
      if (Op.any in rightOperandRaw) {
        // @ts-expect-error
        rightOperand = this[Op.any](leftOperand, leftAttr, rightOperandRaw[Op.any], options);
        // @ts-expect-error
      } else if (Op.all in rightOperandRaw) {
        // @ts-expect-error
        rightOperand = this[Op.all](leftOperand, leftAttr, rightOperandRaw[Op.all], options);
      } else {
        throw new Error('This code should not execute due to the preceding assert');
      }
    } else {
      // support for `{ like: literalOrString }`

      rightOperand = this.#escapeOrBindLeaf(rightOperandRaw, leftAttr, {
        ...options,
        acceptStrings: true,
      });
    }

    return this.queryGenerator._joinKeyValue(
      leftOperand,
      rightOperand,
      operator,
      options.prefix,
    );
  }

  // ========================================== UTILITIES ==========================================

  #escape(value: any, attributeField: Field | undefined) {
    return this.queryGenerator.escape(value, attributeField);
  }

  #escapeOrBindLeaf(value: any, attributeField: Field | undefined, options: Options & { acceptStrings?: boolean }): string {
    if (options.bindParam) {
      return this.queryGenerator.format(value, attributeField, options, options.bindParam);
    }

    return this.queryGenerator.escape(value, attributeField);
  }
}

function assertSingleKeyObject(obj: object, keyAllowList: Array<string | symbol>): void {
  // @ts-expect-error - no typings yet
  const keys = Utils.getComplexKeys(obj);

  if (keys.length !== 1 || !keyAllowList.includes(keys[0])) {
    throw new TypeError(`Object ${nodeUtil.inspect(obj)} can only include one key, which must be one of "${keyAllowList.join(', ')}"`);
  }
}

export { WhereSqlBuilder };
