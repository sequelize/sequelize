import { EMPTY_ARRAY } from '@sequelize/utils';
import isEqual from 'lodash/isEqual';
import { classToInvokable } from './utils/class-to-invokable.js';

/**
 * Can be used to make foreign key constraints deferrable.
 * This is only supported in PostgreSQL.
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
 */
export enum Deferrable {
  INITIALLY_DEFERRED = 'INITIALLY_DEFERRED',
  INITIALLY_IMMEDIATE = 'INITIALLY_IMMEDIATE',
  NOT = 'NOT',
}

/**
 * Can be used to set constraints deferrable within a transaction.
 * This is only supported in PostgreSQL.
 *
 * The constraints can be configured to be deferrable in a transaction like this.
 * It will trigger a query once the transaction has been started and set the constraints
 * to be checked at the very end of the transaction.
 *
 * ```js
 * sequelize.transaction({
 *   constraintChecking: Sequelize.ConstraintChecking.DEFERRED
 * });
 * ```
 */
export class ConstraintChecking {
  toString() {
    return this.constructor.name;
  }

  isEqual(_other: unknown): boolean {
    throw new Error('isEqual implementation missing');
  }

  static toString() {
    return this.name;
  }

  get constraints(): readonly string[] {
    throw new Error('constraints getter implementation missing');
  }

  /**
   * Will trigger an additional query at the beginning of a
   * transaction which sets the constraints to deferred.
   */
  static readonly DEFERRED = classToInvokable(
    class DEFERRED extends ConstraintChecking {
      readonly #constraints: readonly string[];

      /**
       * @param constraints An array of constraint names. Will defer all constraints by default.
       */
      constructor(constraints: readonly string[] = EMPTY_ARRAY) {
        super();
        this.#constraints = Object.freeze([...constraints]);
      }

      isEqual(other: unknown): boolean {
        return other instanceof DEFERRED && isEqual(this.#constraints, other.#constraints);
      }

      get constraints(): readonly string[] {
        return this.#constraints;
      }
    },
  );

  /**
   * Will trigger an additional query at the beginning of a
   * transaction which sets the constraints to immediately.
   */
  static readonly IMMEDIATE = classToInvokable(
    class IMMEDIATE extends ConstraintChecking {
      readonly #constraints: readonly string[];

      /**
       * @param constraints An array of constraint names. Will defer all constraints by default.
       */
      constructor(constraints: readonly string[] = EMPTY_ARRAY) {
        super();
        this.#constraints = Object.freeze([...constraints]);
      }

      isEqual(other: unknown): boolean {
        return other instanceof IMMEDIATE && isEqual(this.#constraints, other.#constraints);
      }

      get constraints(): readonly string[] {
        return this.#constraints;
      }
    },
  );
}
