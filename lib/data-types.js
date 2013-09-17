var STRING = function(length, binary) {
  if (this instanceof STRING) {
    this._binary = !!binary
    if (typeof length === 'number') {
      this._length = length
    } else {
      this._length = 255
    }
  } else {
    return new STRING(length, binary)
  }
}

STRING.prototype = {
  get BINARY() {
    this._binary = true
    return this
  },
  get type() {
    return this.toString()
  },
  toString: function() {
    return 'VARCHAR(' + this._length + ')' + ((this._binary) ? ' BINARY' : '')
  }
}

Object.defineProperty(STRING, 'BINARY', {
  get: function() {
    return new STRING(undefined, true)
  }
})

var INTEGER = function() {
  return INTEGER.prototype.construct.apply(this, [INTEGER].concat(Array.prototype.slice.apply(arguments)))
}

var BIGINT = function() {
  return BIGINT.prototype.construct.apply(this, [BIGINT].concat(Array.prototype.slice.apply(arguments)))
}

var FLOAT = function() {
  return FLOAT.prototype.construct.apply(this, [FLOAT].concat(Array.prototype.slice.apply(arguments)))
}

var BLOB = function() {
  return BLOB.prototype.construct.apply(this, [BLOB].concat(Array.prototype.slice.apply(arguments)))
}

FLOAT._type = FLOAT
FLOAT._typeName = 'FLOAT'
INTEGER._type = INTEGER
INTEGER._typeName = 'INTEGER'
BIGINT._type = BIGINT
BIGINT._typeName = 'BIGINT'
STRING._type = STRING
STRING._typeName = 'VARCHAR'
BLOB._type = BLOB
BLOB._typeName = 'BLOB'

BLOB.toString = STRING.toString = INTEGER.toString = FLOAT.toString = BIGINT.toString = function() {
  return new this._type().toString()
}

BLOB.prototype = {

  construct: function(RealType, length) {
    if (this instanceof RealType) {
      this._typeName = RealType._typeName
      if (typeof length === 'string') {
        this._length = length
      } else {
        this._length = ''
      }
    } else {
      return new RealType(length)
    }
  },

  get type() {
    return this.toString()
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
}

FLOAT.prototype = BIGINT.prototype = INTEGER.prototype = {

  construct: function(RealType, length, decimals, unsigned, zerofill) {
    if (this instanceof RealType) {
      this._typeName = RealType._typeName
      this._unsigned = !!unsigned
      this._zerofill = !!zerofill
      if (typeof length === 'number') {
        this._length = length
      }
      if (typeof decimals === 'number') {
        this._decimals = decimals
      }
    } else {
      return new RealType(length, decimals, unsigned, zerofill)
    }
  },

  get type() {
    return this.toString()
  },

  get UNSIGNED() {
    this._unsigned = true
    return this
  },

  get ZEROFILL() {
    this._zerofill = true
    return this
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
  }
}

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

var typeDesc = {
  get: function() {
    return new this._type().toString()
  }
}

Object.defineProperty(STRING,  'type', typeDesc)
Object.defineProperty(INTEGER, 'type', typeDesc)
Object.defineProperty(BIGINT,  'type', typeDesc)
Object.defineProperty(FLOAT,   'type', typeDesc)
Object.defineProperty(BLOB,    'type', typeDesc)

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
