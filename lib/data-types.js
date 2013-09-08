var makeType = function(typeName, proto) {
  var t = function() {
    var self = this instanceof t ? this : Object.create(t.prototype)
    self.construct.apply(self, Array.prototype.slice.apply(arguments))
    return self
  }
  t._type = t
  t._typeName = typeName

  t.toString = function() {
    return new this._type().toString()
  }

  Object.defineProperty(t, 'type', {
    get: function() {
      return new this._type().toString()
    }
  })

  t.prototype = Object.create(proto, {
    type: {
      get: function() { return this.toString() }
    },
    _typeName: {
      get: function() { return t._typeName }
    }
  })
  t.prototype.constructor = t

  return t
}

var numeric_proto = {
  construct: function(length, decimals, unsigned, zerofill) {
    this._unsigned = !!unsigned
    this._zerofill = !!zerofill
    if (typeof length === 'number') {
      this._length = length
    }
    if (typeof decimals === 'number') {
      this._decimals = decimals
    }
  },

  toString: function() {
    var result = this._typeName
    if (this._length) {
      result += '(' + this._length
      if (typeof this._decimals === 'number') {
        result += ',' + this._decimals
      }
      result += ')'
    }
    if (this._unsigned) {
      result += ' UNSIGNED'
    }
    if (this._zerofill) {
      result += ' ZEROFILL'
    }
    return result
  },

  get UNSIGNED() {
    this._unsigned = true
    return this
  },

  get ZEROFILL() {
    this._zerofill = true
    return this
  },
}

var INTEGER = makeType('INTEGER', numeric_proto)
var BIGINT  = makeType('BIGINT', numeric_proto)
var FLOAT   = makeType('FLOAT', numeric_proto)

var BLOB    = makeType('BLOB', {
  construct: function(length) {
    this._length = (typeof length === 'string') ? length : ''
  },

  toString: function() {
    switch (this._length.toLowerCase()) {
    case 'tiny':
      return 'TINYBLOB'
    case 'medium':
      return 'MEDIUMBLOB'
    case 'long':
      return 'LONGBLOB'
    default:
      return this._typeName
    }
  }
})

var STRING  = makeType('VARCHAR', {
  construct: function(length, binary) {
    this._length = (typeof length === 'number') ? length : 255
    this._binary = !!binary
  },

  toString: function() {
    return 'VARCHAR(' + this._length + ')' + (this._binary ? ' BINARY' : '')
  },

  get BINARY() {
    this._binary = true
    return this
  }
})

Object.defineProperty(STRING, 'BINARY', {
  get: function() {
    return new STRING(undefined, true)
  }
})

var unsignedDesc = {
  get: function() {
    return new this._type(undefined, undefined, true)
  }
}

var zerofillDesc = {
  get: function() {
    return new this._type(undefined, undefined, undefined, true)
  }
}

Object.defineProperty(INTEGER, 'UNSIGNED', unsignedDesc)
Object.defineProperty(BIGINT,  'UNSIGNED', unsignedDesc)
Object.defineProperty(FLOAT,   'UNSIGNED', unsignedDesc)

Object.defineProperty(INTEGER, 'ZEROFILL', zerofillDesc)
Object.defineProperty(BIGINT,  'ZEROFILL', zerofillDesc)
Object.defineProperty(FLOAT,   'ZEROFILL', zerofillDesc)

module.exports = {
  STRING: STRING,

  TEXT: 'TEXT',
  INTEGER: INTEGER,
  BIGINT:  BIGINT,
  DATE: 'DATETIME',
  BOOLEAN: 'TINYINT(1)',
  FLOAT: FLOAT,
  NOW: 'NOW',
  BLOB: BLOB,

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

  ARRAY: function(type) { return type + '[]' },

  get HSTORE() {
    var result = function() {
      return {
        type: 'HSTORE'
      }
    }

    result.type = 'HSTORE'
    result.toString = result.valueOf = function() { return 'HSTORE' }

    return result
  }
}
