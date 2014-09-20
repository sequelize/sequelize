'use strict';

var Utils = require('./utils')
  , Promise = require('./promise');

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
 *     beforeBulkCreate: function () {
 *       // can be a single function
 *     },
 *     beforeValidate: [
 *       function () {},
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
 */
var Hooks = module.exports = function() {};
var hookTypes = {
  beforeValidate: {params: 2},
  afterValidate: {params: 2},
  beforeCreate: {params: 2},
  afterCreate: {params: 2},
  beforeDestroy: {params: 2},
  afterDestroy: {params: 2},
  beforeUpdate: {params: 2},
  afterUpdate: {params: 2},
  beforeBulkCreate: {params: 2},
  afterBulkCreate: {params: 2},
  beforeBulkDestroy: {params: 1},
  afterBulkDestroy: {params: 1},
  beforeBulkUpdate: {params: 1},
  afterBulkUpdate: {params: 1},
  beforeFind: {params: 1},
  beforeFindAfterExpandIncludeAll: {params: 1},
  beforeFindAfterOptions: {params: 1},
  afterFind: {params: 2}
};
var hookAliases = {
  beforeDelete: 'beforeDestroy',
  afterDelete: 'afterDestroy',
  beforeBulkDelete: 'beforeBulkDestroy',
  afterBulkDelete: 'afterBulkDestroy'
};

Hooks.replaceHookAliases = function(hooks) {
  var realHookName;

  Utils._.each(hooks, function(hooksArray, name) {
    // Does an alias for this hook name exist?
    if (realHookName = hookAliases[name]) {
      // Add the hooks to the actual hook
      hooks[realHookName] = (hooks[realHookName] || []).concat(hooksArray);

      // Delete the alias
      delete hooks[name];
    }
  });

  return hooks;
};

Hooks.runHooks = function(hooks) {
  var self = this
    , fn
    , fnArgs = Array.prototype.slice.call(arguments, 1)
    , hookType;

  if (typeof fnArgs[fnArgs.length - 1] === 'function') {
    fn = fnArgs.pop();
  }

  if (typeof hooks === 'string') {
    hookType = hooks;
    hooks = this.options.hooks[hooks] || [];
  }

  if (!Array.isArray(hooks)) {
    hooks = hooks === undefined ? [] : [hooks];
  }

  var promise = Promise.map(hooks, function(hook) {
    if (typeof hook === 'object') {
      hook = hook.fn;
    }

    if (hookType && hook.length > hookTypes[hookType].params) {
      hook = Promise.promisify(hook, self);
    }

    return hook.apply(self, fnArgs);
  }, {concurrency: 1}).return();

  if (fn) {
    return promise.nodeify(fn);
  }

  return promise;
};

Hooks.hook = function() {
  return Hooks.addHook.apply(this, arguments);
};

/**
 * Add a hook to the model
 *
 * @param {String}    hooktype
 * @param {String}    [name]    Provide a name for the hook function. This serves no purpose, other than the ability to be able to order hooks based on some sort of priority system in the future.
 * @param {Function}  fn        The hook function
 *
 * @alias hook
 */
Hooks.addHook = function(hookType, name, fn) {
  if (typeof name === 'function') {
    fn = name;
    name = null;
  }

  // Aliases
  hookType = hookAliases[hookType] || hookType;

  // Just in case if we override the default DAOFactory.options
  this.options.hooks[hookType] = this.options.hooks[hookType] || [];
  this.options.hooks[hookType][this.options.hooks[hookType].length] = !!name ? {name: name, fn: fn} : fn;
  return this;
};

/**
 * A hook that is run before validation
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance, options, callback(err)
 */
Hooks.beforeValidate = function(name, fn) {
  return Hooks.addHook.call(this, 'beforeValidate', name, fn);
};

/**
 * A hook that is run after validation
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance, options, callback(err)
 */
Hooks.afterValidate = function(name, fn) {
  return Hooks.addHook.call(this, 'afterValidate', name, fn);
};

/**
 * A hook that is run before creating a single instance
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with attributes, options, callback(err)
 */
Hooks.beforeCreate = function(name, fn) {
  return Hooks.addHook.call(this, 'beforeCreate', name, fn);
};

/**
 * A hook that is run after creating a single instance
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with attributes, options, callback(err)
 */
Hooks.afterCreate = function(name, fn) {
  return Hooks.addHook.call(this, 'afterCreate', name, fn);
};

/**
 * A hook that is run before destroying a single instance
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance, options, callback(err)
 *
 * @alias beforeDelete
 */
Hooks.beforeDestroy = function(name, fn) {
  return Hooks.addHook.call(this, 'beforeDestroy', name, fn);
};

Hooks.beforeDelete = function(name, fn) {
  return Hooks.addHook.call(this, 'beforeDelete', name, fn);
};

/**
 * A hook that is run after destroying a single instance
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance, options, callback(err)
 *
 * @alias afterDelete
 */
Hooks.afterDestroy = function(name, fn) {
  return Hooks.addHook.call(this, 'afterDestroy', name, fn);
};

Hooks.afterDelete = function(name, fn) {
  return Hooks.addHook.call(this, 'afterDelete', name, fn);
};

/**
 * A hook that is run before updating a single instance
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance, options, callback(err)
 */
Hooks.beforeUpdate = function(name, fn) {
  return Hooks.addHook.call(this, 'beforeUpdate', name, fn);
};

/**
 * A hook that is run after updating a single instance
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance, options, callback(err)
 */
Hooks.afterUpdate = function(name, fn) {
  return Hooks.addHook.call(this, 'afterUpdate', name, fn);
};

/**
 * A hook that is run before creating instances in bulk
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instances, options, callback(err)
 */
Hooks.beforeBulkCreate = function(name, fn) {
  return Hooks.addHook.call(this, 'beforeBulkCreate', name, fn);
};

/**
 * A hook that is run after creating instances in bulk
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instances, options, callback(err)
 */
Hooks.afterBulkCreate = function(name, fn) {
  return Hooks.addHook.call(this, 'afterBulkCreate', name, fn);
};

/**
 * A hook that is run before destroying instances in bulk
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options, callback(err)
 *
 * @alias beforeBulkDelete
 */
Hooks.beforeBulkDestroy = function(name, fn) {
  return Hooks.addHook.call(this, 'beforeBulkDestroy', name, fn);
};

Hooks.beforeBulkDelete = function(name, fn) {
  return Hooks.addHook.call(this, 'beforeBulkDelete', name, fn);
};

/**
 * A hook that is run after destroying instances in bulk
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options, callback(err)
 *
 * @alias afterBulkDelete
 */
Hooks.afterBulkDestroy = function(name, fn) {
  return Hooks.addHook.call(this, 'afterBulkDestroy', name, fn);
};

Hooks.afterBulkDelete = function(name, fn) {
  return Hooks.addHook.call(this, 'afterBulkDelete', name, fn);
};

/**
 * A hook that is run after updating instances in bulk
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options, callback(err)
 */
Hooks.beforeBulkUpdate = function(name, fn) {
  return Hooks.addHook.call(this, 'beforeBulkUpdate', name, fn);
};

/**
 * A hook that is run after updating instances in bulk
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options, callback(err)
 */
Hooks.afterBulkUpdate = function(name, fn) {
  return Hooks.addHook.call(this, 'afterBulkUpdate', name, fn);
};

/**
 * A hook that is run before a find (select) query
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options, callback(err)
 */
Hooks.beforeFind = function(name, fn) {
  return Hooks.addHook.call(this, 'beforeFind', name, fn);
};

/**
 * A hook that is run before a find (select) query, after any { include: {all: ...} } options are expanded
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options, callback(err)
 */
Hooks.beforeFindAfterExpandIncludeAll = function(name, fn) {
  return Hooks.addHook.call(this, 'beforeFindAfterExpandIncludeAll', name, fn);
};

/**
 * A hook that is run before a find (select) query, after all option parsing is complete
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with options, callback(err)
 */
Hooks.beforeFindAfterOptions = function(name, fn) {
  return Hooks.addHook.call(this, 'beforeFindAfterOptions', name, fn);
};

/**
 * A hook that is run after a find (select) query
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with instance(s), options, callback(err)
 */
Hooks.afterFind = function(name, fn) {
  return Hooks.addHook.call(this, 'afterFind', name, fn);
};
