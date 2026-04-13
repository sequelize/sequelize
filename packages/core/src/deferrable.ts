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

  static get DEFERRED() {
    return ConstraintCheckingDeferred;
  }

  static get IMMEDIATE() {
    return ConstraintCheckingImmediate;
  }
}

class DeferredConstraintChecking extends ConstraintChecking {
  readonly #constraints: readonly string[];

  /**
   * Will trigger an additional query at the beginning of a
   * transaction which sets the constraints to deferred.
   *
   * @param constraints
   */
  constructor(constraints: readonly string[] = EMPTY_ARRAY) {
    super();
    this.#constraints = Object.freeze([...constraints]);
  }

  isEqual(other: unknown): boolean {
    return (
      other instanceof DeferredConstraintChecking && isEqual(this.#constraints, other.#constraints)
    );
  }

  get constraints(): readonly string[] {
    return this.#constraints;
  }
}

class ImmediateConstraintChecking extends ConstraintChecking {
  readonly #constraints: readonly string[];

  /**
   * Will trigger an additional query at the beginning of a
   * transaction which sets the constraints to immediately.
   *
   * @param constraints
   */
  constructor(constraints: readonly string[] = EMPTY_ARRAY) {
    super();
    this.#constraints = Object.freeze([...constraints]);
  }

  isEqual(other: unknown): boolean {
    return (
      other instanceof ImmediateConstraintChecking && isEqual(this.#constraints, other.#constraints)
    );
  }

  get constraints(): readonly string[] {
    return this.#constraints;
  }
}

const ConstraintCheckingDeferred = classToInvokable(DeferredConstraintChecking);
const ConstraintCheckingImmediate = classToInvokable(ImmediateConstraintChecking);
