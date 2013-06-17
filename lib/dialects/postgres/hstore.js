module.exports = {
  stringifyPart: function(part) {
    switch(typeof part) {
      case 'boolean':
      case 'number':
        return String(part)
      case 'string':
        return '"' + part.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
      case 'undefined':
        return 'NULL'
      default:
        if (part === null)
          return 'NULL'
        else
          return '"' + JSON.stringify(part).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
    }
  },
  stringify: function(data) {
    var self = this

    return Object.keys(data).map(function(key) {
      return self.stringifyPart(key) + '=>' + self.stringifyPart(data[key])
    }).join(',')
  },
  parsePart: function(part) {
    part = part.replace(/\\\\/g, '\\').replace(/\\"/g, '"')

    switch(part[0]) {
      case '{':
      case '[':
        return JSON.parse(part)
      default:
        return part
    }
  },
  parse: function(string) {
    var self = this
    const rx = /\"((?:\\\"|[^"])*)\"\s*\=\>\s*((?:true|false|NULL|\d+|\d+\.\d+|\"((?:\\\"|[^"])*)\"))/g
    var object = { }

    string.replace(rx, function(match, key, value, innerValue) {
      switch(value) {
        case 'true':
          object[self.parsePart(key)] = true
          break
        case 'false':
          object[self.parsePart(key)] = false
          break
        case 'NULL':
          object[self.parsePart(key)] = null
          break
        default:
          object[self.parsePart(key)] = self.parsePart(innerValue || value)
          break
      }
    })

    return object;
  }
}
