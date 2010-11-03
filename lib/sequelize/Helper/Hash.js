module.exports = function(instance) {
  instance.Hash = {
    isHash: function(obj) {
      return (typeof obj == 'object') && !obj.hasOwnProperty('length')
    },
    
    forEach: function(object, func) {
      instance.Hash.keys(object).forEach(function(key) {
        func(object[key], key, object)
      })
    },

    map: function(object, func) {
      var result = []
      instance.Hash.forEach(object, function(value, key, object) {
        result.push(func(value, key, object))
      })
      return result
    },

    keys: function(object) {
      var results = []
      for (var property in object)
        results.push(property)
      return results
    },

    values: function(object) {
      var result = []
      instance.Hash.keys(object).forEach(function(key) {
        result.push(object[key])
      })
      return result
    },

    merge: function(source, target, force) {
      instance.Hash.forEach(source, function(value, key) {
        if(!target[key] || force)
          target[key] = value
      })
      return target
    },
    without: function(object, withoutKeys) {
      var result = {}
      instance.Hash.forEach(object, function(value, key) {
        if(withoutKeys.indexOf(key) == -1)
          result[key] = value
      })
      return result
    }
  }
}