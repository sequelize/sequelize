var Utils = require("./utils")

var Hooks = module.exports = function(){}

Hooks.runHooks = function(hooks, daoValues, fn) {
  var self = this
    , tick = 0

  var run = function(hook) {
    if (!hook) {
      return fn(null, daoValues);
    }

    if (typeof hook === "object") {
      hook = hook.fn
    }

    hook.call(self, daoValues, function(err, newValues) {
      tick++
      if (!!err) {
        return fn(err)
      }

      daoValues = newValues
      return run(hooks[tick])
    })
  }

  run(hooks[tick])
}

Hooks.hook = function(hookType, name, fn) {
  Hooks.addHook.call(this, hookType, name, fn)
}

Hooks.addHook = function(hookType, name, fn) {
  if (typeof name === "function") {
    fn = name
    name = null
  }

  var method = function(daoValues, callback) {
    fn.call(this, daoValues, callback)
  }

  // Just in case if we override the default DAOFactory.options
  this.options.hooks[hookType] = this.options.hooks[hookType] || []
  this.options.hooks[hookType][this.options.hooks[hookType].length] = !!name ? {name: name, fn: method} : method
}

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

Hooks.beforeBulkDestroy = function(name, fn) {
  Hooks.addHook.call(this, 'beforeBulkDestroy', name, fn)
}

Hooks.afterBulkDestroy = function(name, fn) {
  Hooks.addHook.call(this, 'afterBulkDestroy', name, fn)
}

// - beforeSave
// - afterSave
// - beforeUpdate
// - afterUpdate
// - beforeDestroy
// - afterDestroy
// - beforeValidate
// - afterValidate

// user.save(callback); // If Model.id isn't set, save will invoke Model.create() instead
// // beforeValidate
// // afterValidate
// // beforeSave
// // beforeUpdate
// // afterUpdate
// // afterSave
// // callback
// user.updateAttribute('email', 'email@example.com', callback);
// // beforeValidate
// // afterValidate
// // beforeSave
// // beforeUpdate
// // afterUpdate
// // afterSave
// // callback
// user.destroy(callback);
// // beforeDestroy
// // afterDestroy
// // callback
// User.create(data, callback);
// // beforeValidate
// // afterValidate
// // beforeCreate
// // beforeSave
// // afterSave
// // afterCreate
// // callback
