import nodeUtil from 'util';
import isPlainObject_ from 'lodash/isPlainObject';
import type {
  ModelStatic,
  WhereOptions,
  Attributes,
  AllowNotOrAndWithImplicitAndArrayRecursive,
  Model, WhereAttributeHashValue,
} from '../../index.js';
import { Op } from '../../operators';
import { getComplexKeys } from '../../utils/index.js';

class PojoWhere {
  declare leftOperand: string;
  declare whereValue: WhereAttributeHashValue<any>;
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

const EMPTY_OBJECT = Object.freeze(Object.create(null));

// export type ModelAttributeMeta = ModelAttributeColumnOptions & { fieldName: string };

// TODO: update
//  export type WhereLeftOperand = Fn | ColumnReference | Literal | Cast | ModelAttributeColumnOptions;
//  to
//  export type WhereLeftOperand = Fn | ColumnReference | Literal | Cast | ModelAttributeMeta;

// type LeftOperand = Fn | Col | Literal | ModelAttributeColumnOptions;

/*
TODO: add this test:

        testSql({
          [Op.or]: {
            [Op.and]: { intAttr1: 1, intAttr2: 2 },
            [Op.or]: { intAttr1: 1, intAttr2: 2 },
          },
        })

 */

type Options<M extends Model> = {
  model: ModelStatic<M>,
  prefix: string,
  type: unknown,
  /**
   * Pass the value to bind, and this will return its identifier in the query.
   *
   * @param value
   */
  bindParam?(value: any): string,
};

// type Field = ModelAttributeColumnOptions;
//
// type RightOperands = Required<WhereOperators>;
//
// function isModelAttributeMeta(val: any): val is ModelAttributeMeta {
//   return 'type' in val && 'fieldName' in val && val.type instanceof DataTypes.ABSTRACT;
// }

function isPlainObject(val: any): val is object {
  return isPlainObject_(val);
}

type UnpackAllowNotOrAndWithImplicitAndArrayRecursive<T> = T extends AllowNotOrAndWithImplicitAndArrayRecursive<infer Part>
  ? Part
  : never;

class WhereSqlBuilder {
  constructor(private readonly queryGenerator: any) {}

  /**
   * Transforms any value accepted by {@link WhereOptions} into a SQL string.
   *
   * @param where
   * @param _options
   */
  whereOptionsToSql<M extends Model>(where: WhereOptions<Attributes<M>>, _options: Options<M> = EMPTY_OBJECT): string {
    if (typeof where === 'string') {
      throw new TypeError('Support for `{ where: \'raw query\' }` has been removed. Use `{ where: literal(\'raw query\') }` instead');
    }

    try {
      return this.#handleRecursiveNotOrAndWithImplicitAndArray(where, piece => {
        // TODO: handle Literal, Fn, Where, JSON, PojoWhere
        // Literal | Fn | Where<symbol> | Json | WhereAttributeHash<any>

        // TODO: handle Where/Or in WhereAttributeHash
        return nodeUtil.inspect(piece);
      });
    } catch (error) {
      throw new TypeError(`Could not process the following 'where' configuration:\n${nodeUtil.inspect(where)}`, {
        // @ts-expect-error -- typings are not up-to-date for 'cause'
        cause: error,
      });
    }
  }

  /**
   * See {@link AllowNotOrAndWithImplicitAndArrayRecursive}
   *
   * @param input
   * @param handlePart
   * @param logicalOperator AND / OR
   */
  #handleRecursiveNotOrAndWithImplicitAndArray<T extends AllowNotOrAndWithImplicitAndArrayRecursive<any>>(
    input: T,
    handlePart: (part: UnpackAllowNotOrAndWithImplicitAndArrayRecursive<T> | PojoWhere) => string,
    logicalOperator: typeof Op.and | typeof Op.or = Op.and,
  ): string {

    const logicalOperatorSql = logicalOperator === Op.and ? ' AND ' : ' OR ';

    // Arrays in this method are treated as an implicit "AND" operator
    if (Array.isArray(input)) {
      return joinWithLogicalOperator(
        input.map(part => this.#handleRecursiveNotOrAndWithImplicitAndArray(part, handlePart)),
        logicalOperatorSql,
      );
    }

    // if the input is not a plan object, then it can't include Operators.
    if (!isPlainObject(input)) {
      // @ts-expect-error
      return handlePart(input);
    }

    const keys = getComplexKeys(input);

    const sqlArray = keys.map(operatorOrAttribute => {
      if (operatorOrAttribute === Op.not) {
        const generatedResult = this.#handleRecursiveNotOrAndWithImplicitAndArray(
          // @ts-expect-error
          input[Op.not],
          handlePart,
        );

        if (!generatedResult) {
          return '';
        }

        if (generatedResult.startsWith('(') && generatedResult.endsWith(')')) {
          return `NOT ${generatedResult}`;
        }

        return `NOT (${generatedResult})`;
      }

      if (operatorOrAttribute === Op.and || operatorOrAttribute === Op.or) {
        return this.#handleRecursiveNotOrAndWithImplicitAndArray(
          // @ts-expect-error
          input[operatorOrAttribute],
          handlePart,
          // @ts-expect-error
          operatorOrAttribute, // it's Op.and or Op.or
        );
      }

      // it *has* to be an attribute now
      if (typeof operatorOrAttribute === 'symbol') {
        throw new TypeError(`Invalid Query: ${nodeUtil.inspect(input)} includes the Symbol Operator Op.${operatorOrAttribute.description} but only attributes, Op.and, Op.or, and Op.not are allowed.`);
      }

      let pojoWhereObject;
      try {
        pojoWhereObject = pojoWherePool.getObject();

        pojoWhereObject.leftOperand = operatorOrAttribute;

        // @ts-expect-error
        pojoWhereObject.whereValue = input[operatorOrAttribute];

        return handlePart(pojoWhereObject);
      } finally {
        if (pojoWhereObject) {
          pojoWherePool.free(pojoWhereObject);
        }
      }
    });

    return joinWithLogicalOperator(sqlArray, logicalOperatorSql);
  }
}

function joinWithLogicalOperator(sqlArray: string[], operator: string) {
  sqlArray = sqlArray.filter(val => Boolean(val));

  if (sqlArray.length === 0) {
    return '';
  }

  if (sqlArray.length === 1) {
    return sqlArray[0];
  }

  const sql = sqlArray.join(operator);

  if (sql.startsWith('(') && sql.endsWith(')')) {
    return sql;
  }

  return `(${sql})`;
}

export { WhereSqlBuilder };
