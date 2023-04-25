import isEqual from 'lodash/isEqual';
import type { AbstractQueryGeneratorTypeScript } from './dialects/abstract/query-generator-typescript.js';
import { classToInvokable } from './utils/class-to-invokable.js';
import { EMPTY_ARRAY } from './utils/object.js';

/**
 * Can be used to
 * make foreign key constraints deferrable and to set the constaints within a
 * transaction. This is only supported in PostgreSQL.
 *
 * The foreign keys can be configured like this. It will create a foreign key
 * that will check the constraints immediately when the data was inserted.
 *
 * ```js
 * class MyModel extends Model {}
 * MyModel.init({
 *   foreign_id: {
 *     type: DataTypes.INTEGER,
 *     references: {
 *       model: OtherModel,
 *       key: 'id',
 *       deferrable: Sequelize.Deferrable.INITIALLY_IMMEDIATE
 *     }
 *   }
 * }, { sequelize });
 * ```
 *
 * The constraints can be configured in a transaction like this. It will
 * trigger a query once the transaction has been started and set the constraints
 * to be checked at the very end of the transaction.
 *
 * ```js
 * sequelize.transaction({
 *   deferrable: Sequelize.Deferrable.SET_DEFERRED
 * });
 * ```
 */
export class Deferrable {
  toString() {
    return this.constructor.name;
  }

  toSql(_queryGenerator: AbstractQueryGeneratorTypeScript): string {
    throw new Error('toSql implementation missing');
  }

  isEqual(_other: unknown): boolean {
    throw new Error('isEqual implementation missing');
  }

  static readonly INITIALLY_DEFERRED = classToInvokable(class INITIALLY_DEFERRED extends Deferrable {
    toSql() {
      return INITIALLY_DEFERRED.toSql();
    }

    static toSql() {
      return 'DEFERRABLE INITIALLY DEFERRED';
    }

    isEqual(other: unknown): boolean {
      return other instanceof INITIALLY_DEFERRED;
    }
  });

  static readonly INITIALLY_IMMEDIATE = classToInvokable(class INITIALLY_IMMEDIATE extends Deferrable {
    toSql() {
      return INITIALLY_IMMEDIATE.toSql();
    }

    isEqual(other: unknown): boolean {
      return other instanceof INITIALLY_IMMEDIATE;
    }

    static toSql() {
      return 'DEFERRABLE INITIALLY IMMEDIATE';
    }
  });

  /**
   * Will set the constraints to not deferred. This is the default in PostgreSQL and it make
   * it impossible to dynamically defer the constraints within a transaction.
   */
  static readonly NOT = classToInvokable(class NOT extends Deferrable {
    toSql() {
      return NOT.toSql();
    }

    isEqual(other: unknown): boolean {
      return other instanceof NOT;
    }

    static toSql() {
      return 'NOT DEFERRABLE';
    }
  });

  // TODO: move the following classes to their own namespace, as they are not related to the above classes
  //  the ones above are about configuring a constraint's deferrability when defining the constraint.
  //  The ones below are for configuring them during a transaction
  /**
   * Will trigger an additional query at the beginning of a
   * transaction which sets the constraints to deferred.
   */
  static readonly SET_DEFERRED = classToInvokable(class SET_DEFERRED extends Deferrable {
    readonly #constraints: readonly string[];

    /**
     * @param constraints An array of constraint names. Will defer all constraints by default.
     */
    constructor(constraints: readonly string[] = EMPTY_ARRAY) {
      super();
      this.#constraints = Object.freeze([...constraints]);
    }

    toSql(queryGenerator: AbstractQueryGeneratorTypeScript): string {
      return queryGenerator.setDeferredQuery(this.#constraints);
    }

    isEqual(other: unknown): boolean {
      return other instanceof SET_DEFERRED && isEqual(this.#constraints, other.#constraints);
    }

    static toSql(queryGenerator: AbstractQueryGeneratorTypeScript): string {
      return queryGenerator.setDeferredQuery(EMPTY_ARRAY);
    }
  });

  /**
   * Will trigger an additional query at the beginning of a
   * transaction which sets the constraints to immediately.
   */
  static readonly SET_IMMEDIATE = classToInvokable(class SET_IMMEDIATE extends Deferrable {
    readonly #constraints: readonly string[];

    /**
     * @param constraints An array of constraint names. Will defer all constraints by default.
     */
    constructor(constraints: readonly string[] = EMPTY_ARRAY) {
      super();
      this.#constraints = Object.freeze([...constraints]);
    }

    toSql(queryGenerator: AbstractQueryGeneratorTypeScript): string {
      return queryGenerator.setImmediateQuery(this.#constraints);
    }

    isEqual(other: unknown): boolean {
      return other instanceof SET_IMMEDIATE && isEqual(this.#constraints, other.#constraints);
    }

    static toSql(queryGenerator: AbstractQueryGeneratorTypeScript): string {
      return queryGenerator.setImmediateQuery(EMPTY_ARRAY);
    }
  });
}
