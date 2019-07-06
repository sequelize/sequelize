'use strict';

const _ = require('lodash');
const { logger } = require('./utils/logger');
const Promise = require('./promise');
const debug = logger.debugContext('hooks');

const hookTypes = {
  beforeValidate: { params: 2 },
  afterValidate: { params: 2 },
  validationFailed: { params: 3 },
  beforeCreate: { params: 2 },
  afterCreate: { params: 2 },
  beforeDestroy: { params: 2 },
  afterDestroy: { params: 2 },
  beforeRestore: { params: 2 },
  afterRestore: { params: 2 },
  beforeUpdate: { params: 2 },
  afterUpdate: { params: 2 },
  beforeSave: { params: 2, proxies: ['beforeUpdate', 'beforeCreate'] },
  afterSave: { params: 2, proxies: ['afterUpdate', 'afterCreate'] },
  beforeUpsert: { params: 2 },
  afterUpsert: { params: 2 },
  beforeBulkCreate: { params: 2 },
  afterBulkCreate: { params: 2 },
  beforeBulkDestroy: { params: 1 },
  afterBulkDestroy: { params: 1 },
  beforeBulkRestore: { params: 1 },
  afterBulkRestore: { params: 1 },
  beforeBulkUpdate: { params: 1 },
  afterBulkUpdate: { params: 1 },
  beforeFind: { params: 1 },
  beforeFindAfterExpandIncludeAll: { params: 1 },
  beforeFindAfterOptions: { params: 1 },
  afterFind: { params: 2 },
  beforeCount: { params: 1 },
  beforeDefine: { params: 2, sync: true, noModel: true },
  afterDefine: { params: 1, sync: true, noModel: true },
  beforeInit: { params: 2, sync: true, noModel: true },
  afterInit: { params: 1, sync: true, noModel: true },
  beforeAssociate: { params: 2, sync: true },
  afterAssociate: { params: 2, sync: true },
  beforeConnect: { params: 1, noModel: true },
  afterConnect: { params: 2, noModel: true },
  beforeDisconnect: { params: 1, noModel: true },
  afterDisconnect: { params: 1, noModel: true },
  beforeSync: { params: 1 },
  afterSync: { params: 1 },
  beforeBulkSync: { params: 1 },
  afterBulkSync: { params: 1 },
  beforeQuery: { params: 2 },
  afterQuery: { params: 2 }
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

function getHooks(hooked, hookType) {
  return (hooked.options.hooks || {})[hookType] || [];
}

const Hooks = {
  /**
   * Process user supplied hooks definition
   *
   * @param {Object} hooks hooks definition
   *
   * @private
   * @memberof Sequelize
   * @memberof Sequelize.Model
   */
  _setupHooks(hooks) {
    this.options.hooks = {};
    _.map(hooks || {}, (hooksArray, hookName) => {
      if (!Array.isArray(hooksArray)) hooksArray = [hooksArray];
      hooksArray.forEach(hookFn => this.addHook(hookName, hookFn));
    });
  },

  runHooks(hooks, ...hookArgs) {
    if (!hooks) throw new Error('runHooks requires at least 1 argument');

    let hookType;

    if (typeof hooks === 'string') {
      hookType = hooks;
      hooks = getHooks(this, hookType);

      if (this.sequelize) {
        hooks = hooks.concat(getHooks(this.sequelize, hookType));
      }
    }

    if (!Array.isArray(hooks)) {
      hooks = [hooks];
    }

    // synchronous hooks
    if (hookTypes[hookType] && hookTypes[hookType].sync) {
      for (let hook of hooks) {
        if (typeof hook === 'object') {
          hook = hook.fn;
        }

        debug(`running hook(sync) ${hookType}`);
        hook.apply(this, hookArgs);
      }
      return;
    }

    // asynchronous hooks (default)
    return Promise.each(hooks, hook => {
      if (typeof hook === 'object') {
        hook = hook.fn;
      }

      debug(`running hook ${hookType}`);
      return hook.apply(this, hookArgs);
    }).return();
  },

  /**
   * Add a hook to the model
   *
   * @param {string}          hookType hook name @see {@link hookTypes}
   * @param {string|Function} [name] Provide a name for the hook function. It can be used to remove the hook later or to order hooks based on some sort of priority system in the future.
   * @param {Function}        fn The hook function
   *
   * @memberof Sequelize
   * @memberof Sequelize.Model
   */
  addHook(hookType, name, fn) {
    if (typeof name === 'function') {
      fn = name;
      name = null;
    }

    debug(`adding hook ${hookType}`);
    // check for proxies, add them too
    hookType = getProxiedHooks(hookType);

    hookType.forEach(type => {
      const hooks = getHooks(this, type);
      hooks.push(name ? { name, fn } : fn);
      this.options.hooks[type] = hooks;
    });

    return this;
  },

  /**
   * Remove hook from the model
   *
   * @param {string} hookType @see {@link hookTypes}
   * @param {string|Function} name name of hook or function reference which was attached
   *
   * @memberof Sequelize
   * @memberof Sequelize.Model
   */
  removeHook(hookType, name) {
    const isReference = typeof name === 'function' ? true : false;

    if (!this.hasHook(hookType)) {
      return this;
    }

    debug(`removing hook ${hookType}`);

    // check for proxies, add them too
    hookType = getProxiedHooks(hookType);

    for (const type of hookType) {
      this.options.hooks[type] = this.options.hooks[type].filter(hook => {
        if (isReference && typeof hook === 'function') {
          return hook !== name; // check if same method
        }
        if (!isReference && typeof hook === 'object') {
          return hook.name !== name;
        }
        return true;
      });
    }

    return this;
  },

  /**
   * Check whether the mode has any hooks of this type
   *
   * @param {string} hookType @see {@link hookTypes}
   *
   * @alias hasHooks
   *
   * @memberof Sequelize
   * @memberof Sequelize.Model
   */
  hasHook(hookType) {
    return this.options.hooks[hookType] && !!this.options.hooks[hookType].length;
  }
};
Hooks.hasHooks = Hooks.hasHook;


function applyTo(target, isModel = false) {
  _.mixin(target, Hooks);

  for (const hook of Object.keys(hookTypes)) {
    if (isModel && hookTypes[hook].noModel) {
      continue;
    }
    target[hook] = function(name, callback) {
      return this.addHook(hook, name, callback);
    };
  }
}
exports.applyTo = applyTo;

/**
 * A hook that is run before validation
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with instance, options
 * @name beforeValidate
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run after validation
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with instance, options
 * @name afterValidate
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run when validation fails
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with instance, options, error. Error is the
 * SequelizeValidationError. If the callback throws an error, it will replace the original validation error.
 * @name validationFailed
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run before creating a single instance
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with attributes, options
 * @name beforeCreate
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run after creating a single instance
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with attributes, options
 * @name afterCreate
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run before creating or updating a single instance, It proxies `beforeCreate` and `beforeUpdate`
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with attributes, options
 * @name beforeSave
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run before upserting
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with attributes, options
 * @name beforeUpsert
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run after upserting
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with the result of upsert(), options
 * @name afterUpsert
 * @memberof Sequelize.Model
 */

/**
  * A hook that is run after creating or updating a single instance, It proxies `afterCreate` and `afterUpdate`
  * @param {string}   name
  * @param {Function} fn   A callback function that is called with attributes, options
  * @name afterSave
  * @memberof Sequelize.Model
  */

/**
 * A hook that is run before destroying a single instance
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with instance, options
 *
 * @name beforeDestroy
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run after destroying a single instance
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with instance, options
 *
 * @name afterDestroy
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run before restoring a single instance
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with instance, options
 *
 * @name beforeRestore
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run after restoring a single instance
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with instance, options
 *
 * @name afterRestore
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run before updating a single instance
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with instance, options
 * @name beforeUpdate
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run after updating a single instance
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with instance, options
 * @name afterUpdate
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run before creating instances in bulk
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with instances, options
 * @name beforeBulkCreate
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run after creating instances in bulk
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with instances, options
 * @name afterBulkCreate
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run before destroying instances in bulk
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with options
 *
 * @name beforeBulkDestroy
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run after destroying instances in bulk
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with options
 *
 * @name afterBulkDestroy
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run before restoring instances in bulk
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with options
 *
 * @name beforeBulkRestore
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run after restoring instances in bulk
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with options
 *
 * @name afterBulkRestore
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run before updating instances in bulk
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with options
 * @name beforeBulkUpdate
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run after updating instances in bulk
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with options
 * @name afterBulkUpdate
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run before a find (select) query
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with options
 * @name beforeFind
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run before a find (select) query, after any { include: {all: ...} } options are expanded
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with options
 * @name beforeFindAfterExpandIncludeAll
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run before a find (select) query, after all option parsing is complete
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with options
 * @name beforeFindAfterOptions
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run after a find (select) query
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with instance(s), options
 * @name afterFind
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run before a count query
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with options
 * @name beforeCount
 * @memberof Sequelize.Model
 */

/**
 * A hook that is run before a define call
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with attributes, options
 * @name beforeDefine
 * @memberof Sequelize
 */

/**
 * A hook that is run after a define call
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with factory
 * @name afterDefine
 * @memberof Sequelize
 */

/**
 * A hook that is run before Sequelize() call
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with config, options
 * @name beforeInit
 * @memberof Sequelize
 */

/**
 * A hook that is run after Sequelize() call
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with sequelize
 * @name afterInit
 * @memberof Sequelize
 */

/**
 * A hook that is run before a connection is created
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with config passed to connection
 * @name beforeConnect
 * @memberof Sequelize
 */

/**
 * A hook that is run after a connection is created
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with the connection object and the config passed to connection
 * @name afterConnect
 * @memberof Sequelize
 */

/**
 * A hook that is run before a connection is disconnected
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with the connection object
 * @name beforeDisconnect
 * @memberof Sequelize
 */

/**
 * A hook that is run after a connection is disconnected
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with the connection object
 * @name afterDisconnect
 * @memberof Sequelize
 */

/**
 * A hook that is run before Model.sync call
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with options passed to Model.sync
 * @name beforeSync
 * @memberof Sequelize
 */

/**
 * A hook that is run after Model.sync call
 * @param {string}   name
 * @param {Function} fn   A callback function that is called with options passed to Model.sync
 * @name afterSync
 * @memberof Sequelize
 */

/**
  * A hook that is run before sequelize.sync call
  * @param {string}   name
  * @param {Function} fn   A callback function that is called with options passed to sequelize.sync
  * @name beforeBulkSync
  * @memberof Sequelize
  */

/**
  * A hook that is run after sequelize.sync call
  * @param {string}   name
  * @param {Function} fn   A callback function that is called with options passed to sequelize.sync
  * @name afterBulkSync
  * @memberof Sequelize
  */
