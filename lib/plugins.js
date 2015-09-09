'use strict'

var assert = require('assert')

var getPlugins = function(obj){
  obj = obj || {}
  var plugins = obj.plugins
  assert(Array.isArray(plugins) || plugins === undefined,
    '"plugins" must be an array or undefined'
  )
  plugins = plugins || []
  return plugins
}

var runPluginHook = function(plugin, hookName, args){
  args = args || []
  if (plugin && plugin[hookName]) {
    assert(typeof plugin[hookName] === 'function',
      'plugin.' + hookName + ' must be a function'
    )
    plugin[hookName].apply(plugin, args)
  }
}

var beforeInitHook = function(connectionParams, options){
  getPlugins(options).forEach(function(plugin){
    runPluginHook(plugin, 'beforeInit', [ connectionParams, options ])
  })
}

var afterInitHook = function(sequelize){
  getPlugins(sequelize.options).forEach(function(plugin){
    runPluginHook(plugin, 'afterInit', [ sequelize ])
  })
  sequelize.addHook('beforeDefine', 'pluginsBeforeDefine', beforeDefineHook)
  sequelize.addHook('afterDefine', 'pluginsAfterDefine', afterDefineHook)
}

var beforeDefineHook = function(attributes, options){
  getPlugins(options.sequelize.options)
  .concat(getPlugins(options))
  .forEach(function(plugin){
    runPluginHook(plugin, 'beforeDefine', [ attributes, options ])
  })
}

var afterDefineHook = function(Model){
  getPlugins(Model.options)
  .concat(getPlugins(Model.sequelize.options))
  .forEach(function(plugin){
    runPluginHook(plugin, 'afterDefine', [ Model ])
  })
}

module.exports.beforeInitHook = beforeInitHook
module.exports.afterInitHook = afterInitHook
