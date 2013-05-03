module.exports = {
  STRING: 'VARCHAR(255)',
  TEXT: 'TEXT',
  BIGINT:  'BIGINT',
  DATE: 'DATETIME',
  BOOLEAN: 'TINYINT(1)',
  FLOAT: 'FLOAT',
  NOW: 'NOW',

  get INTEGER() {
    var result = function() {}

    result.toString = result.valueOf = function() { return 'INTEGER' }
    result.type = 'INTEGER'

    result.get = function(number) {
      if (number === null || number === undefined) {
        return number
      }

      return parseInt(number)
    }

    result.set = function(number) {
      if (number === null || number === undefined) {
        return number
      }

      return parseInt(number)
    }

    return result
  },

  get HSTORE() {
    var result = function() {}

    result.toString = result.valueOf = function() { return 'TEXT' }
    result.type = 'HSTORE'

    result.get = function(text) {
      if (typeof text === "object") {
        return text
      }

      var obj = {}
        , pattern = '("\\\\.|[^"\\\\]*"\s*=|[^=]*)\s*=\s*>\s*("(?:\\.|[^"\\\\])*"|[^,]*)(?:\s*,\s*|$)'
        , rex = new RegExp(pattern,'g')
        , r = null

      while ((r = rex.exec(text)) !== null) {
        if (!!r[1] && !!r[2]) {
          obj[r[1].replace(/^"/, '').replace(/"$/, '').trim()] = r[2].replace(/^"/, '').replace(/"$/, '').trim()
        }
      }

      return obj
    }

    result.set = function(obj, callee) {
      if (typeof obj !== "object") {
        throw new Error("HSTORE column must be an object when setting it's value.")
      }

      var text = []
      Object.keys(obj).forEach(function(key){
        if (typeof obj[key] !== "string" && typeof obj[key] !== "number") {
          throw new Error("Value for HSTORE must be a string or number.")
        }

        text.push(callee.QueryInterface.QueryGenerator.addQuotes(key) + '=>' + (typeof obj[key] === "string" ? callee.QueryInterface.QueryGenerator.addQuotes(obj[key]) : obj[key]))
      }.bind(this))

      return text.join(',')
    }

    return result
  },

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
