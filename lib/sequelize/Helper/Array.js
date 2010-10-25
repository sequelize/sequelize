module.exports = function(instance) {
  instance.Array = {
    map: function(array, func) {
      var result = []
      array.forEach(function(element) {
        result.push(func(element))
      })
      return result
    },
    reject: function(array, func) {
      var result = []
      array.forEach(function(element) {
        if(!func(element)) result.push(element)
      })
      return result
    },
    select: function(array, func) {
      var result = []
      array.forEach(function(element) {
        if(func(element)) result.push(element)
      })
      return result
    },
    without: function(array, withouts) {
      var result = []
      array.forEach(function(e) {
        if(withouts.indexOf(e) == -1) result.push(e)
      })
      return result
    },
    join: function(arr1, arr2) {
      var result = []
      arr1.forEach(function(e) { result.push(e) })
      arr2.forEach(function(e) { result.push(e) })
      return result
    }
  }
}