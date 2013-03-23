module.exports = {
  STRING: 'VARCHAR(255)',
  TEXT: 'TEXT',
  INTEGER: 'INTEGER',
  BIGINT:  'BIGINT',
  DATE: 'DATETIME',
  BOOLEAN: 'TINYINT(1)',
  FLOAT: 'FLOAT',
  NOW: 'NOW',

  get ENUM() {
    var result = function() {
      return {
        type:   'ENUM',
        values: Array.prototype.slice.call(arguments).reduce(function(result, element) {
          return result.concat(Array.isArray(element) ? element : [ element ])
        }, [])
      }
    }

    result.toString = result.valueOf = function() { return 'ENUM' }

    return result
  },

  get DECIMAL() {
    var result = function(precision, scale) {
      return 'DECIMAL(' + precision + ',' + scale + ')'
    }

    result.toString = result.valueOf = function() { return 'DECIMAL' }

    return result
  },
  ARRAY: function(type) { return type + '[]' }
}
