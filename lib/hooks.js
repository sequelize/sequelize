var Hooks = module.exports = function(){}

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

Hooks.hook = function(hookType, name, fn) {
  // For aliases, we may want to incorporate some sort of way to mitigate this
  if (hookType === "beforeDelete") {
    hookType = 'beforeDestroy'
  }
  else if (hookType === "afterDelete") {
    hookType = 'afterDestroy'
  }

  Hooks.addHook.call(this, hookType, name, fn)
}

Hooks.addHook = function(hookType, name, fn) {
  if (typeof name === "function") {
    fn = name
    name = null
  }

  var method = function() {
    fn.apply(this, Array.prototype.slice.call(arguments, 0, arguments.length-1).concat(arguments[arguments.length-1]))
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

Hooks.beforeDelete = function(name, fn) {
  Hooks.addHook.call(this, 'beforeDestroy', name, fn)
}

Hooks.afterDelete = function(name, fn) {
  Hooks.addHook.call(this, 'afterDestroy', name, fn)
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
