import { classToInvokable } from './utils/class-to-invokable.js';

/**
 * A collection of properties related to deferrable constraints. It can be used to
 * make foreign key constraints deferrable and to set the constraints within a
 * transaction. This is only supported in PostgreSQL.
 *
 * The foreign keys can be configured like this. It will create a foreign key
 * that will check the constraints immediately when the data was inserted.
 *
 * ```js
 * sequelize.define('Model', {
 *   foreign_id: {
 *     type: Sequelize.INTEGER,
 *     references: {
 *       model: OtherModel,
 *       key: 'id',
 *       deferrable: Sequelize.Deferrable.INITIALLY_IMMEDIATE
 *     }
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
 *
 * @property INITIALLY_DEFERRED Defer constraints checks to the end of transactions.
 * @property INITIALLY_IMMEDIATE Trigger the constraint checks immediately
 * @property NOT Set the constraints to not deferred. This is the default in PostgreSQL and it make it impossible to dynamically defer the constraints within a transaction.
 * @property SET_DEFERRED
 * @property SET_IMMEDIATE
 */
class ABSTRACT {
  toString(...args) {
    return this.toSql(...args);
  }

  /**
   * These are used bare -- `references.deferrable` holds the type itself rather
   * than an instance, and the query generator calls `.toString(queryGenerator)`
   * on it. `new this()` resolves to the type it is called on.
   */
  static toString(...args) {
    return new this().toString(...args);
  }
}

class INITIALLY_DEFERRED extends ABSTRACT {
  toSql() {
    return 'DEFERRABLE INITIALLY DEFERRED';
  }
}

class INITIALLY_IMMEDIATE extends ABSTRACT {
  toSql() {
    return 'DEFERRABLE INITIALLY IMMEDIATE';
  }
}

class NOT extends ABSTRACT {
  toSql() {
    return 'NOT DEFERRABLE';
  }
}

class SET_DEFERRED extends ABSTRACT {
  constructor(constraints) {
    super();

    this.constraints = constraints;
  }

  toSql(queryGenerator) {
    return queryGenerator.setDeferredQuery(this.constraints);
  }
}

class SET_IMMEDIATE extends ABSTRACT {
  constructor(constraints) {
    super();

    this.constraints = constraints;
  }

  toSql(queryGenerator) {
    return queryGenerator.setImmediateQuery(this.constraints);
  }
}

const Deferrable = {
  INITIALLY_DEFERRED,
  INITIALLY_IMMEDIATE,
  NOT,
  SET_DEFERRED,
  SET_IMMEDIATE
};

// `Deferrable.SET_DEFERRED(['fk'])` is called without `new`, which a class
// rejects, so each is wrapped once the definitions are complete.
for (const [name, DeferrableType] of Object.entries(Deferrable)) {
  Deferrable[name] = classToInvokable(DeferrableType);
}

export default Deferrable;
