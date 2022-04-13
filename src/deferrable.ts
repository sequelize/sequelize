import { classToInvokable } from './utils/index.js';

// TODO: replace dummy type with
//   import type { AbstractQueryGenerator } from './dialects/abstract/query-generator.js';
//  once query-generator has been migrated to TS.
type AbstractQueryGenerator = any;

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
  static toString(queryGenerator: AbstractQueryGenerator) {
    return new this().toString(queryGenerator);
  }

  toString(queryGenerator: AbstractQueryGenerator) {
    return this.toSql(queryGenerator);
  }

  toSql(_queryGenerator: AbstractQueryGenerator) {
    throw new Error('toSql implementation missing');
  }

  static readonly INITIALLY_DEFERRED = classToInvokable(class INITIALLY_DEFERRED extends Deferrable {
    toSql() {
      return 'DEFERRABLE INITIALLY DEFERRED';
    }
  });

  static readonly INITIALLY_IMMEDIATE = classToInvokable(class INITIALLY_IMMEDIATE extends Deferrable {
    toSql() {
      return 'DEFERRABLE INITIALLY IMMEDIATE';
    }
  });

  /**
   * Will set the constraints to not deferred. This is the default in PostgreSQL and it make
   * it impossible to dynamically defer the constraints within a transaction.
   */
  static readonly NOT = classToInvokable(class NOT extends Deferrable {
    toSql() {
      return 'NOT DEFERRABLE';
    }
  });

  /**
   * Will trigger an additional query at the beginning of a
   * transaction which sets the constraints to deferred.
   */
  static readonly SET_DEFERRED = classToInvokable(class SET_DEFERRED extends Deferrable {
    readonly #constraints: string[];

    /**
     * @param constraints An array of constraint names. Will defer all constraints by default.
     */
    constructor(constraints: string[]) {
      super();
      this.#constraints = constraints;
    }

    toSql(queryGenerator: AbstractQueryGenerator): string {
      return queryGenerator.setDeferredQuery(this.#constraints);
    }
  });

  /**
   * Will trigger an additional query at the beginning of a
   * transaction which sets the constraints to immediately.
   */
  static readonly SET_IMMEDIATE = classToInvokable(class SET_IMMEDIATE extends Deferrable {
    readonly #constraints: string[];

    /**
     * @param constraints An array of constraint names. Will defer all constraints by default.
     */
    constructor(constraints: string[]) {
      super();
      this.#constraints = constraints;
    }

    toSql(queryGenerator: AbstractQueryGenerator): string {
      return queryGenerator.setImmediateQuery(this.#constraints);
    }
  });
}
