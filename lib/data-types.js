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

var CHAR = function (length, binary) {
  if (this instanceof CHAR) {
    this._binary = !!binary
    if (typeof length === 'number') {
      this._length = length
    } else {
      this._length = 255
    }
  } else {
    return new CHAR(length, binary)
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

CHAR.prototype = {
  get BINARY() {
    this._binary = true
    return this
  },
  get type() {
    return this.toString()
  },
  toString: function() {
    return 'CHAR(' + this._length + ')' + ((this._binary) ? ' BINARY' : '')
  }
}

Object.defineProperty(STRING, 'BINARY', {
  get: function() {
    return new STRING(undefined, true)
  }
})

Object.defineProperty(CHAR, 'BINARY', {
  get: function() {
    return new CHAR(undefined, true)
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

var DECIMAL = function() {
  return DECIMAL.prototype.construct.apply(this, [DECIMAL].concat(Array.prototype.slice.apply(arguments)))
}

FLOAT._type = FLOAT
FLOAT._typeName = 'FLOAT'
INTEGER._type = INTEGER
INTEGER._typeName = 'INTEGER'
BIGINT._type = BIGINT
BIGINT._typeName = 'BIGINT'
STRING._type = STRING
STRING._typeName = 'VARCHAR'
CHAR._type = CHAR
CHAR._typeName = 'CHAR'
BLOB._type = BLOB
BLOB._typeName = 'BLOB'
DECIMAL._type = DECIMAL
DECIMAL._typeName = 'DECIMAL'


BLOB.toString = STRING.toString = CHAR.toString = INTEGER.toString = FLOAT.toString = BIGINT.toString = DECIMAL.toString = function() {
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

DECIMAL.prototype = {

  construct: function(RealType, precision, scale) {
    if (this instanceof RealType) {
      this._typeName = RealType._typeName
      if (typeof precision === 'number') {
        this._precision = precision
      } else {
        this._precision = 0
      }
      if (typeof scale === 'number') {
        this._scale = scale
      } else {
        this._scale = 0
      }
    } else {
      return new RealType(precision, scale)
    }
  },

  get type() {
    return this.toString()
  },

  get PRECISION() {
    return this._precision
  },

  get SCALE() {
    return this._scale
  },

  toString: function() {
    if (this._precision || this._scale) {
      return 'DECIMAL(' + this._precision + ',' + this._scale + ')'
    }

    return 'DECIMAL'
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

var decimalDesc = {
  get: function() {
    return new this._type(undefined, undefined, undefined)
  }
}

Object.defineProperty(STRING,  'type', typeDesc)
Object.defineProperty(CHAR,    'type', typeDesc)
Object.defineProperty(INTEGER, 'type', typeDesc)
Object.defineProperty(BIGINT,  'type', typeDesc)
Object.defineProperty(FLOAT,   'type', typeDesc)
Object.defineProperty(BLOB,    'type', typeDesc)
Object.defineProperty(DECIMAL, 'type', typeDesc)

Object.defineProperty(INTEGER, 'UNSIGNED', unsignedDesc)
Object.defineProperty(BIGINT,  'UNSIGNED', unsignedDesc)
Object.defineProperty(FLOAT,   'UNSIGNED', unsignedDesc)

Object.defineProperty(INTEGER, 'ZEROFILL', zerofillDesc)
Object.defineProperty(BIGINT,  'ZEROFILL', zerofillDesc)
Object.defineProperty(FLOAT,   'ZEROFILL', zerofillDesc)

Object.defineProperty(DECIMAL, 'PRECISION', decimalDesc)
Object.defineProperty(DECIMAL, 'SCALE', decimalDesc)

module.exports = {
  STRING: STRING,
  CHAR: CHAR,

  TEXT: 'TEXT',
  INTEGER: INTEGER,
  BIGINT:  BIGINT,
  DATE: 'DATETIME',
  BOOLEAN: 'TINYINT(1)',
  FLOAT: FLOAT,
  NOW: 'NOW',
  BLOB: BLOB,
  DECIMAL: DECIMAL,
  UUID: 'UUID',
  UUIDV1: 'UUIDV1',
  UUIDV4: 'UUIDV4',

  get ENUM() {
    var result = function() {
      return {
        type: 'ENUM',
        values: Array.prototype.slice.call(arguments).reduce(function(result, element) {
          return result.concat(Array.isArray(element) ? element : [ element ])
        }, []),
        toString: result.toString
      }
    }

    result.toString = result.valueOf = function() { return 'ENUM' }

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
  },

  get JSON() {
    var result = function() {
      return {
        type: 'JSON'
      }
    }

    result.type = 'JSON'
    result.toString = result.valueOf = function() { return 'JSON' }

    return result
  }

}
