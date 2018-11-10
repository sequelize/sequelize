'use strict';

const util = require('util');


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
const Deferrable = module.exports = {
  INITIALLY_DEFERRED,
  INITIALLY_IMMEDIATE,
  NOT,
  SET_DEFERRED,
  SET_IMMEDIATE
};

function ABSTRACT() {}

ABSTRACT.prototype.toString = function() {
  return this.toSql.apply(this, arguments);
};

function INITIALLY_DEFERRED() {
  if (!(this instanceof INITIALLY_DEFERRED)) {
    return new INITIALLY_DEFERRED();
  }
}
util.inherits(INITIALLY_DEFERRED, ABSTRACT);

INITIALLY_DEFERRED.prototype.toSql = function() {
  return 'DEFERRABLE INITIALLY DEFERRED';
};

function INITIALLY_IMMEDIATE() {
  if (!(this instanceof INITIALLY_IMMEDIATE)) {
    return new INITIALLY_IMMEDIATE();
  }
}
util.inherits(INITIALLY_IMMEDIATE, ABSTRACT);

INITIALLY_IMMEDIATE.prototype.toSql = function() {
  return 'DEFERRABLE INITIALLY IMMEDIATE';
};

function NOT() {
  if (!(this instanceof NOT)) {
    return new NOT();
  }
}
util.inherits(NOT, ABSTRACT);

NOT.prototype.toSql = function() {
  return 'NOT DEFERRABLE';
};

function SET_DEFERRED(constraints) {
  if (!(this instanceof SET_DEFERRED)) {
    return new SET_DEFERRED(constraints);
  }

  this.constraints = constraints;
}
util.inherits(SET_DEFERRED, ABSTRACT);

SET_DEFERRED.prototype.toSql = function(queryGenerator) {
  return queryGenerator.setDeferredQuery(this.constraints);
};

function SET_IMMEDIATE(constraints) {
  if (!(this instanceof SET_IMMEDIATE)) {
    return new SET_IMMEDIATE(constraints);
  }

  this.constraints = constraints;
}
util.inherits(SET_IMMEDIATE, ABSTRACT);

SET_IMMEDIATE.prototype.toSql = function(queryGenerator) {
  return queryGenerator.setImmediateQuery(this.constraints);
};

Object.keys(Deferrable).forEach(key => {
  const DeferrableType = Deferrable[key];

  DeferrableType.toString = function() {
    const instance = new DeferrableType();
    return instance.toString.apply(instance, arguments);
  };
});
