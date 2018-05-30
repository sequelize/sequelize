'use strict';

const { classToInvokable } = require('./utils');

class ABSTRACT {
  static toString() {
    const instance = new this();
    return instance.toString.apply(instance, arguments);
  }

  toString() {
    return this.toSql.apply(this, arguments);
  }

  toSql() {
    throw new Error('toSql implementation missing');
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

const Deferrable = module.exports = { // eslint-disable-line
  INITIALLY_DEFERRED: classToInvokable(INITIALLY_DEFERRED),
  INITIALLY_IMMEDIATE: classToInvokable(INITIALLY_IMMEDIATE),
  NOT: classToInvokable(NOT),
  SET_DEFERRED: classToInvokable(SET_DEFERRED),
  SET_IMMEDIATE: classToInvokable(SET_IMMEDIATE)
};