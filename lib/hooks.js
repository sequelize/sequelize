'use strict';

const _ = require('lodash');
const { logger } = require('./utils/logger');
const debug = logger.debugContext('hooks');

const hookTypes = {
  // Run before validation, called with instance, options.
  beforeValidate: {},
  // Run after validation passed, called with instance, options.
  afterValidate: {},
  // Run after failed, called with instance, options.
  validationFailed: {},
  // Run before creating a single instance, called with attributes, options.
  beforeCreate: {},
  // Run after creating a single instance, called with attributes, options.
  afterCreate: {},
  // Run before destroying a single instance, called with instance, options.
  beforeDestroy: {},
  // Run after destroying a single instance, called with instance, options.
  afterDestroy: {},
  // Run before restoring a single instance, called with instance, options.
  beforeRestore: {},
  // Run after restoring a single instance, called with instance, options.
  afterRestore: {},
  // Run before updating a single instance, called with instance, options.
  beforeUpdate: {},
  // Run after updating a single instance, called with instance, options.
  afterUpdate: {},
  // Run before creating or updating a single instance, It proxies `beforeCreate` and `beforeUpdate`, called with attributes, options.
  beforeSave: { proxies: ['beforeUpdate', 'beforeCreate'] },
  // Run after creating or updating a single instance, It proxies `afterCreate` and `afterUpdate`, called with attributes, options.
  afterSave: { proxies: ['afterUpdate', 'afterCreate'] },
  // Run before upserting, called with attributes, options.
  beforeUpsert: {},
  // Run after upserting, called with the result of upsert(), options.
  afterUpsert: {},
  // Run before creating instances in bulk, called with instances, options.
  beforeBulkCreate: {},
  // Run after creating instances in bulk, called with instances, options.
  afterBulkCreate: {},
  // Run before destroying instances in bulk, called with options.
  beforeBulkDestroy: {},
  // Run after destroying instances in bulk, called with options.
  afterBulkDestroy: {},
  // Run before restoring instances in bulk, called with options.
  beforeBulkRestore: {},
  // Run after restoring instances in bulk, called with options.
  afterBulkRestore: {},
  // Run before updating instances in bulk, called with options.
  beforeBulkUpdate: {},
  // Run after updating instances in bulk, called with options.
  afterBulkUpdate: {},
  // Run before a find (select) query, called with options.
  beforeFind: {},
  // Run before a find (select) query, after any { include: {all: ...} } options are expanded, called with options.
  beforeFindAfterExpandIncludeAll: {},
  // Run before a find (select) query, after all option parsing is complete, called with options.
  beforeFindAfterOptions: {},
  // Run after a find (select) query, called with instance(s), options.
  afterFind: {},
  // Run before a count query, called with options.
  beforeCount: {},
  // Run before a define call, called with attributes, options.
  beforeDefine: { sync: true, noModel: true },
  // Run after a define call, called with factory.
  afterDefine: { sync: true, noModel: true },
  // Run before Sequelize() call, called with config, options.
  beforeInit: { sync: true, noModel: true },
  // Run after Sequelize() call, called with sequelize.
  afterInit: { sync: true, noModel: true },
  // Run before a model is associated with another via `hasOne` etc., called with an object that contains `source`, `target` and `type`.
  beforeAssociate: { sync: true },
  // Run before a model is associated with another via `hasOne` etc., called with an object that contains `source`, `target`, `type` and `association`.
  afterAssociate: { sync: true },
  // Run before a connection is created, called with config passed to connection.
  beforeConnect: { noModel: true },
  // Run after a connection is created, called with the connection object and the config passed to connection.
  afterConnect: { noModel: true },
  // Run before a connection is disconnected, called with the connection object.
  beforeDisconnect: { noModel: true },
  // Run after a connection is disconnected, called with the connection object.
  afterDisconnect: { noModel: true },
  // Run before Model.sync call, called with options passed to Model.sync.
  beforeSync: {},
  // Run after Model.sync call, called with options passed to Model.sync.
  afterSync: {},
  // Run before sequelize.sync call, called with options passed to sequelize.sync.
  beforeBulkSync: { noModel: true },
  // Run after sequelize.sync call, called with options passed to sequelize.sync.
  afterBulkSync: { noModel: true },
  // Run before a query is executed, called with query options and a query object.
  beforeQuery: {},
  // Run after a query is executed, called with query options and a query object.
  afterQuery: {},
  // Run after a transansaction was committed.
  afterCommit: {}
};
exports.hooks = hookTypes;


/**
 * get array of current hook and its proxies combined
 *
 * @param {string} hookType any hook type @see {@link hookTypes}
 *
 * @private
 */
const getProxiedHooks = hookType =>
  hookTypes[hookType].proxies
    ? hookTypes[hookType].proxies.concat(hookType)
    : [hookType]
;

class Hooks {
  _getHooks(hookType) {
    return this.hooks[hookType] || [];
  }
  /**
   * Process user supplied hooks definition
   *
   * @param {object} hooks hooks definition
   * @param {Hooks} parent
   * @private
   */
  constructor(hooks, parent) {
    this.hooks = {};
    this.parent = parent;
    if (!hooks) {
      return;
    }
    _.map(hooks, (hooksArray, hookName) => {
      if (!Array.isArray(hooksArray)) hooksArray = [hooksArray];
      hooksArray.forEach(hookFn => this.add(hookName, hookFn));
    });
  }

  async run(hooks, ...hookArgs) {
    if (!hooks) throw new Error('run requires at least 1 argument');

    let hookType;

    if (typeof hooks === 'string') {
      hookType = hooks;
      hooks = this._getHooks(hookType);

      if (this.parent) {
        hooks = hooks.concat(this.parent._getHooks(hookType));
      }
    }

    if (!Array.isArray(hooks)) {
      hooks = [hooks];
    }

    // synchronous hooks
    if (hookTypes[hookType] && hookTypes[hookType].sync) {
      for (const hook of hooks) {
        debug(`running hook(sync) ${hookType}`);
        hook.apply(this.parent, hookArgs);
      }
      return;
    }

    // asynchronous hooks (default)
    for (const hook of hooks) {
      debug(`running hook ${hookType}`);
      await hook.apply(this.parent, hookArgs);
    }
  }

  /**
   * Add a hook to the model
   *
   * @param {string}          hookType hook name @see {@link hookTypes}
   * @param {Function}        fn The hook function
   */
  add(hookType, fn) {
    if (hookTypes[hookType] && hookTypes[hookType].noModel && this.parent) {
      throw new Error(`${hookType} is only applicable on a sequelize instance or static`);
    }
    debug(`adding hook ${hookType}`);
    // check for proxies, add them too
    hookType = getProxiedHooks(hookType);

    hookType.forEach(type => {
      const hooks = this._getHooks(type);
      hooks.push(fn);
      this.hooks[type] = hooks;
    });

    return this;
  }

  /**
   * Remove hook from the model
   *
   * @param {string} hookType @see {@link hookTypes}
   * @param {Function} fn name of hook or function reference which was attached
   */
  remove(hookType, fn) {
    if (!this.has(hookType)) {
      return this;
    }

    debug(`removing hook ${hookType}`);

    // check for proxies, add them too
    hookType = getProxiedHooks(hookType);

    for (const type of hookType) {
      this.hooks[type] = this.hooks[type].filter(hookFn => fn !== hookFn);
    }

    return this;
  }

  /**
   * Check whether the mode has any hooks of this type
   *
   * @param {string} hookType @see {@link hookTypes}
   */
  has(hookType) {
    return this.hooks[hookType] && !!this.hooks[hookType].length;
  }

  /**
   * Removes all hooks
   */
  removeAll() {
    this.hooks = {};
  }
}

exports.Hooks = Hooks;
