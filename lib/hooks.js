var Utils = require("./utils")

/**
 * Hooks are function that are called before and after  (bulk-) creation/updating/deletion and validation. Hooks can be added to you models in three ways:
 * 1. By specifying them as options in sequelize.define
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
var Hooks = module.exports = function(){}
var hookAliases = {
  beforeDelete: "beforeDestroy",
  afterDelete: "afterDestroy"
}

Hooks.replaceHookAliases = function(hooks) {
  var realHookName

  Utils._.each(hooks, function(hooksArray, name) {
    // Does an alias for this hook name exist?
    if(realHookName = hookAliases[name]) {
      // Add the hooks to the actual hook
      hooks[realHookName] = (hooks[realHookName] || []).concat(hooksArray)

      // Delete the alias
      delete hooks[name]
    }
  })

  return hooks
}

Hooks.runHooks = function() {
  var self  = this
    , tick  = 0
    , hooks = arguments[0]
    , args  = Array.prototype.slice.call(arguments, 1, arguments.length-1)
    , fn    = arguments[arguments.length-1]

  if (typeof hooks === "string") {
    hooks = this.options.hooks[hooks] || []
  }

  if (!Array.isArray(hooks)) {
    hooks = hooks === undefined ? [] : [hooks]
  }

  if (hooks.length < 1) {
    return fn.apply(this, [null].concat(args))
  }

  var run = function(hook) {
    if (!hook) {
      return fn.apply(this, [null].concat(args))
    }

    if (typeof hook === "object") {
      hook = hook.fn
    }

    hook.apply(self, args.concat(function() {
      tick++

      if (!!arguments[0]) {
        return fn(arguments[0])
      }

      // daoValues = newValues
      return run(hooks[tick])
    }))
  }

  run(hooks[tick])
}

/**
 * Alias of addHook
 * @see {Hooks#addHook}
 */ 
Hooks.hook = function() {
  Hooks.addHook.apply(this, arguments)
}

/**
 * Add a hook to the model
 * 
 * @param {String}    hooktype
 * @param {String}    [name]    Provide a name for the hooks function. This serves no purpose other than the ability/capability for the future to order hooks based on either a priority system or by before/after a specific hook.
 * @param {Function}  fn        The hook function
 */
Hooks.addHook = function(hookType, name, fn) {
  if (typeof name === "function") {
    fn = name
    name = null
  }

  var method = function() {
    fn.apply(this, Array.prototype.slice.call(arguments, 0, arguments.length-1).concat(arguments[arguments.length-1]))
  }

  // Aliases
  hookType = hookAliases[hookType] || hookType

  // Just in case if we override the default DAOFactory.options
  this.options.hooks[hookType] = this.options.hooks[hookType] || []
  this.options.hooks[hookType][this.options.hooks[hookType].length] = !!name ? {name: name, fn: method} : method
}

/**
 * A hook that is run before validation 
 * @param {String}   name
 * @param {Function} fn   A callback function that is called with model, callback(err)
 */
Hooks.beforeValidate = function(name, fn) {
  Hooks.addHook.call(this, 'beforeValidate', name, fn)
}

Hooks.afterValidate = function(name, fn) {
  Hooks.addHook.call(this, 'afterValidate', name, fn)
}

Hooks.beforeCreate = function(name, fn) {
  Hooks.addHook.call(this, 'beforeCreate', name, fn)
}

Hooks.afterCreate = function(name, fn) {
  Hooks.addHook.call(this, 'afterCreate', name, fn)
}

Hooks.beforeDestroy = function(name, fn) {
  Hooks.addHook.call(this, 'beforeDestroy', name, fn)
}

Hooks.afterDestroy = function(name, fn) {
  Hooks.addHook.call(this, 'afterDestroy', name, fn)
}

Hooks.beforeDelete = function(name, fn) {
  Hooks.addHook.call(this, 'beforeDelete', name, fn)
}

Hooks.afterDelete = function(name, fn) {
  Hooks.addHook.call(this, 'afterDelete', name, fn)
}

Hooks.beforeUpdate = function(name, fn) {
  Hooks.addHook.call(this, 'beforeUpdate', name, fn)
}

Hooks.afterUpdate = function(name, fn) {
  Hooks.addHook.call(this, 'afterUpdate', name, fn)
}

Hooks.beforeBulkCreate = function(name, fn) {
  Hooks.addHook.call(this, 'beforeBulkCreate', name, fn)
}

Hooks.afterBulkCreate = function(name, fn) {
  Hooks.addHook.call(this, 'afterBulkCreate', name, fn)
}

Hooks.beforeBulkDestroy = function(name, fn) {
  Hooks.addHook.call(this, 'beforeBulkDestroy', name, fn)
}

Hooks.afterBulkDestroy = function(name, fn) {
  Hooks.addHook.call(this, 'afterBulkDestroy', name, fn)
}

Hooks.beforeBulkUpdate = function(name, fn) {
  Hooks.addHook.call(this, 'beforeBulkUpdate', name, fn)
}

Hooks.afterBulkUpdate = function(name, fn) {
  Hooks.addHook.call(this, 'afterBulkUpdate', name, fn)
}
