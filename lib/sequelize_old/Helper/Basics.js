module.exports = function(instance) {
  instance.configure = function(options) {
    this.options = options
  }

  instance.log = function(obj) {
    var sys = require("sys")
    sys.log(sys.inspect(obj))
  }

  instance.evaluateTemplate = function(template, replacements) {
    var result = template
    this.Hash.keys(replacements).forEach(function(key) {
      result = result.replace("%{" + key + "}", replacements[key])
    })
    return result
  }
}