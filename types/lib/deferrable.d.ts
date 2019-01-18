/**
 * Can be used to
 * make foreign key constraints deferrable and to set the constaints within a
 * transaction. This is only supported in PostgreSQL.
 *
 * The foreign keys can be configured like this. It will create a foreign key
 * that will check the constraints immediately when the data was inserted.
 *
 * ```js
 * sequelize.define('Model', {
 *   foreign_id: {
 *   type: Sequelize.INTEGER,
 *   references: {
 *     model: OtherModel,
 *     key: 'id',
 *     deferrable: Sequelize.Deferrable.INITIALLY_IMMEDIATE
 *   }
 *   }
 * });
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

/**
 *
 */
export interface AbstractDeferrableStatic {
  new (): Deferrable;
  (): Deferrable;
}
export interface Deferrable {
  toString(): string;
  toSql(): string;
}

export interface InitiallyDeferredDeferrableStatic extends AbstractDeferrableStatic {
  new (): InitiallyDeferredDeferrable;
  (): InitiallyDeferredDeferrable;
}
export interface InitiallyDeferredDeferrable extends Deferrable {}
export const INITIALLY_DEFERRED: InitiallyDeferredDeferrableStatic;

export interface InitiallyImmediateDeferrableStatic extends AbstractDeferrableStatic {
  new (): InitiallyImmediateDeferrable;
  (): InitiallyImmediateDeferrable;
}
export interface InitiallyImmediateDeferrable extends Deferrable {}
export const INITIALLY_IMMEDIATE: InitiallyImmediateDeferrableStatic;

export interface NotDeferrableStatic extends AbstractDeferrableStatic {
  new (): NotDeferrable;
  (): NotDeferrable;
}
export interface NotDeferrable extends Deferrable {}
/**
 * Will set the constraints to not deferred. This is the default in PostgreSQL and it make
 * it impossible to dynamically defer the constraints within a transaction.
 */
export const NOT: NotDeferrableStatic;

export interface SetDeferredDeferrableStatic extends AbstractDeferrableStatic {
  /**
   * @param constraints An array of constraint names. Will defer all constraints by default.
   */
  new (constraints: string[]): SetDeferredDeferrable;
  /**
   * @param constraints An array of constraint names. Will defer all constraints by default.
   */
  (constraints: string[]): SetDeferredDeferrable;
}
export interface SetDeferredDeferrable extends Deferrable {}
/**
 * Will trigger an additional query at the beginning of a
 * transaction which sets the constraints to deferred.
 */
export const SET_DEFERRED: SetDeferredDeferrableStatic;

export interface SetImmediateDeferrableStatic extends AbstractDeferrableStatic {
  /**
   * @param constraints An array of constraint names. Will defer all constraints by default.
   */
  new (constraints: string[]): SetImmediateDeferrable;
  /**
   * @param constraints An array of constraint names. Will defer all constraints by default.
   */
  (constraints: string[]): SetImmediateDeferrable;
}
export interface SetImmediateDeferrable extends Deferrable {}
/**
 * Will trigger an additional query at the beginning of a
 * transaction which sets the constraints to immediately.
 *
 * @param constraints An array of constraint names. Will defer all constraints by default.
 */
export const SET_IMMEDIATE: SetImmediateDeferrableStatic;
