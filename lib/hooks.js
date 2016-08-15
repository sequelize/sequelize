'use strict';

const Utils = require('./utils');
const Promise = require('./promise');
const debug = Utils.getLogger().debugContext('hooks');

/**
 * Hooks are function that are called before and after  (bulk-) creation/updating/deletion and validation. Hooks can be added to you models in three ways:
 *
 * 1. By specifying them as options in `sequelize.define`
 * 2. By calling `hook()` with a string and your hook handler function
 * 3. By calling the function with the same name as the hook you want
 * ```js
 * // Method 1
 * sequelize.define(name, { attributes }, {
 *   hooks: {
 *     beforeBulkCreate() {
 *       // can be a single function
 *     },
 *     beforeValidate: [
 *       function() {},
 *       function() {} // Or an array of several
 *     ]
 *   }
 * })
 *
 * // Method 2
 * Model.hook('afterDestroy', function () {})
 *
 * // Method 3
 * Model.afterBulkUpdate(function () {})
 * ```
 *
 * @see {Sequelize#define}
 * @mixin Hooks
 * @name Hooks
 */

const hookTypes = {
  beforeValidate: {params: 2},
  afterValidate: {params: 2},
  validationFailed: {params: 3},
  beforeCreate: {params: 2},
  afterCreate: {params: 2},
  beforeDestroy: {params: 2},
  afterDestroy: {params: 2},
  beforeRestore: {params: 2},
  afterRestore: {params: 2},
  beforeUpdate: {params: 2},
  afterUpdate: {params: 2},
  beforeSave: {params: 2, proxies: ['beforeUpdate', 'beforeCreate']},
  afterSave: {params: 2, proxies: ['afterUpdate', 'afterCreate']},
  beforeUpsert: {params: 2},
  afterUpsert: {params: 2},
  beforeBulkCreate: {params: 2},
  afterBulkCreate: {params: 2},
  beforeBulkDestroy: {params: 1},
  afterBulkDestroy: {params: 1},
  beforeBulkRestore: {params: 1},
  afterBulkRestore: {params: 1},
  beforeBulkUpdate: {params: 1},
  afterBulkUpdate: {params: 1},
  beforeFind: {params: 1},
  beforeFindAfterExpandIncludeAll: {params: 1},
  beforeFindAfterOptions: {params: 1},
  afterFind: {params: 2},
  beforeCount: {params: 1},
  beforeDefine: {params: 2, sync: true},
  afterDefine: {params: 1, sync: true},
  beforeInit: {params: 2, sync: true},
  afterInit: {params: 1, sync: true},
  beforeConnect: {params: 1},
  beforeSync: {params: 1},
  afterSync: {params: 1},
  beforeBulkSync: {params: 1},
  afterBulkSync: {params: 1}
};
exports.hooks = hookTypes;

const hookAliases = {
  beforeDelete: 'beforeDestroy',
  afterDelete: 'afterDestroy',
  beforeBulkDelete: 'beforeBulkDestroy',
  afterBulkDelete: 'afterBulkDestroy',
  beforeConnection: 'beforeConnect'
};
exports.hookAliases = hookAliases;

/**
 * get array of current hook and its proxied hooks combined
 */
const getProxiedHooks = (hookType) => (
  hookTypes[hookType].proxies
    ? hookTypes[hookType].proxies.concat(hookType)
    : [hookType]
);

const Hooks = {
  replaceHookAliases(hooks) {
    let realHookName;

    Utils._.each(hooks, (hooksArray, name) => {
      // Does an alias for this hook name exist?
      if (realHookName = hookAliases[name]) {
        // Add the hooks to the actual hook
        hooks[realHookName] = (hooks[realHookName] || []).concat(hooksArray);

        // Delete the alias
        delete hooks[name];
      }
    });

    return hooks;
  },

  runHooks(hooks) {
    if (!hooks) throw new Error('runHooks requires atleast 1 argument');

    const hookArgs = Utils.sliceArgs(arguments, 1);
    let hookType;

    if (typeof hooks === 'string') {
      hookType = hooks;
      hooks = this.options.hooks[hookType] || [];
      if (this.sequelize) hooks = hooks.concat(this.sequelize.options.hooks[hookType] || []);
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
        return hook.apply(this, hookArgs);
      }
      return;
    }

    // asynchronous hooks (default)
    return Promise.each(hooks, hook => {
      if (typeof hook === 'object') {
        hook = hook.fn;
      }

      debug(`running hook ${hookType}`);
      return Promise.resolve(hook.apply(this, hookArgs));
    }).return();
  },

  hook() {
    return Hooks.addHook.apply(this, arguments);
  },

  /**
   * Add a hook to the model
   *
   * @param {String}    hooktype
   * @param {String}    [name]    Provide a name for the hook function. It can be used to remove the hook later or to order hooks based on some sort of priority system in the future.
   * @param {Function}  fn        The hook function
   *
   * @alias hook
   */
  addHook(hookType, name, fn) {
    if (typeof name === 'function') {
      fn = name;
      name = null;
    }

    debug(`adding hook ${hookType}`);
    hookType = hookAliases[hookType] || hookType;

    // check for proxies, add them too
    hookType = getProxiedHooks(hookType);

    Utils._.each(hookType, (type) => {
      this.options.hooks[type] = this.options.hooks[type] || [];
      this.options.hooks[type].push(!!name ? {name, fn} : fn);
    });

    return this;
  },

  /**
   * Remove hook from the model
   *
   * @param {String} hookType
   * @param {String|Function} name
   */
  removeHook(hookType, name) {
    hookType = hookAliases[hookType] || hookType;
    const isReference = typeof name === 'function' ? true : false;

    if (!this.hasHook(hookType)) {
      return this;
    }

    Utils.debug(`removing hook ${hookType}`);

    // check for proxies, add them too
    hookType = getProxiedHooks(hookType);

    for (const type of hookType) {
      this.options.hooks[type] = this.options.hooks[type].filter(hook => {
        if (isReference && typeof hook === 'function') {
          return hook !== name; // check if same method
        } else {
          return typeof hook === 'object' && hook.name !== name;
        }
      });
    }

    return this;
  },

  /*
   * Check whether the mode has any hooks of this type
   *
   * @param {String}  hookType
   *
   * @alias hasHooks
   */
  hasHook(hookType) {
    return this.options.hooks[hookType] && !!this.options.hooks[hookType].length;
  }
};
Hooks.hasHooks = Hooks.hasHook;


function applyTo(target) {
  Utils._.mixin(target, Hooks);

  const allHooks = Object.keys(hookTypes).concat(Object.keys(hookAliases));
  for (const hook of allHooks) {
    target[hook] = function(name, callback) {
      return this.addHook(hook, name, callback);
    };
  }
}
exports.applyTo = applyTo;

/**
 * A hook that is run before validation
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance, options
 * @name beforeValidate
 */

/**
 * A hook that is run after validation
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance, options
 * @name afterValidate
 */

/**
 * A hook that is run when validation fails
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance, options, error. Error is the
 * SequelizeValidationError. If the callback throws an error, it will replace the original validation error.
 * @name validationFailed
 */

/**
 * A hook that is run before creating a single instance
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with attributes, options
 * @name beforeCreate
 */

/**
 * A hook that is run after creating a single instance
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with attributes, options
 * @name afterCreate
 */

/**
 * A hook that is run before creating or updating a single instance, It proxies `beforeCreate` and `beforeUpdate`
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with attributes, options
 * @name beforeSave
 */

/**
 * A hook that is run before upserting
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with attributes, options
 * @name beforeUpsert
 */

/**
 * A hook that is run after upserting
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with attributes, options
 * @name afterUpsert
 */

 /**
  * A hook that is run after creating or updating a single instance, It proxies `afterCreate` and `afterUpdate`
  * @param {String}   name
  * @param {Function} fn   A callback function that is called with attributes, options
  * @name afterSave
  */

/**
 * A hook that is run before destroying a single instance
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance, options
 *
 * @name beforeDestroy
 * @alias beforeDelete
 */

/**
 * A hook that is run after destroying a single instance
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance, options
 *
 * @name afterDestroy
 * @alias afterDelete
 */

/**
 * A hook that is run before restoring a single instance
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance, options
 *
 * @name beforeRestore
 */

/**
 * A hook that is run after restoring a single instance
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance, options
 *
 * @name afterRestore
 */

/**
 * A hook that is run before updating a single instance
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance, options
 * @name beforeUpdate
 */

/**
 * A hook that is run after updating a single instance
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance, options
 * @name afterUpdate
 */

/**
 * A hook that is run before creating instances in bulk
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instances, options
 * @name beforeBulkCreate
 */

/**
 * A hook that is run after creating instances in bulk
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instances, options
 * @name afterBulkCreate
 */

/**
 * A hook that is run before destroying instances in bulk
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options
 *
 * @name beforeBulkDestroy
 * @alias beforeBulkDelete
 */

/**
 * A hook that is run after destroying instances in bulk
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options
 *
 * @name afterBulkDestroy
 * @alias afterBulkDelete
 */

/**
 * A hook that is run before restoring instances in bulk
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options
 *
 * @name beforeBulkRestore
 */

/**
 * A hook that is run after restoring instances in bulk
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options
 *
 * @name afterBulkRestore
 */

/**
 * A hook that is run before updating instances in bulk
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options
 * @name beforeBulkUpdate
 */

/**
 * A hook that is run after updating instances in bulk
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options
 * @name afterBulkUpdate
 */

/**
 * A hook that is run before a find (select) query
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options
 * @name beforeFind
 */

/**
 * A hook that is run before a find (select) query, after any { include: {all: ...} } options are expanded
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options
 * @name beforeFindAfterExpandIncludeAll
 */

/**
 * A hook that is run before a find (select) query, after all option parsing is complete
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options
 * @name beforeFindAfterOptions
 */

/**
 * A hook that is run after a find (select) query
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance(s), options
 * @name afterFind
 */

/**
 * A hook that is run before a count query
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options
 * @name beforeCount
 */

/**
 * A hook that is run before a define call
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with attributes, options
 * @name beforeDefine
 */

/**
 * A hook that is run after a define call
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with factory
 * @name afterDefine
 */

/**
 * A hook that is run before Sequelize() call
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with config, options
 * @name beforeInit
 */

/**
 * A hook that is run after Sequelize() call
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with sequelize
 * @name afterInit
 */

/**
 * A hook that is run before a connection is created
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with config passed to connection
 * @name beforeConnect
 */

/**
 * A hook that is run before Model.sync call
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options passed to Model.sync
 * @name beforeSync
 */

/**
 * A hook that is run after Model.sync call
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options passed to Model.sync
 * @name afterSync
 */

 /**
  * A hook that is run before sequelize.sync call
  * @param {String}   name
  * @param {Function} fn   A callback function that is called with options passed to sequelize.sync
  * @name beforeBulkSync
  */

 /**
  * A hook that is run after sequelize.sync call
  * @param {String}   name
  * @param {Function} fn   A callback function that is called with options passed to sequelize.sync
  * @name afterBulkSync
  */
