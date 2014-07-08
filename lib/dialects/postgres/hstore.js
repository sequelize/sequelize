'use strict';

module.exports = {
  stringifyPart: function(part) {
    switch (typeof part) {
      case 'boolean':
      case 'number':
        return String(part);
      case 'string':
        return '"' + part.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
      case 'undefined':
        return 'NULL';
      default:
        if (part === null)
          return 'NULL';
        else
          return '"' + JSON.stringify(part).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    }
  },
  stringifyObject: function(data) {
    var self = this;

    return Object.keys(data).map(function(key) {
      return self.stringifyPart(key) + '=>' + self.stringifyPart(data[key]);
    }).join(',');
  },
  stringifyArray: function(data) {
    return data.map(this.stringifyObject, this);
  },
  stringify: function(data) {
    if (Array.isArray(data)) {
      return this.stringifyArray(data);
    }

    return this.stringifyObject(data);
  },
  parsePart: function(part) {
    part = part.replace(/\\\\/g, '\\').replace(/\\"/g, '"');

    switch (part[0]) {
      case '{':
      case '[':
        return JSON.parse(part);
      default:
        return part;
    }
  },
  parseObject: function(string) {
    var self = this,
        object = { };

    if (0 === string.length) {
      return object;
    }

    var rx = /\"((?:\\\"|[^"])*)\"\s*\=\>\s*((?:true|false|NULL|\d+|\d+\.\d+|\"((?:\\\"|[^"])*)\"))/g;

    string = string || '';

    string.replace(rx, function(match, key, value, innerValue) {
      switch (value) {
        case 'true':
          object[self.parsePart(key)] = true;
          break;
        case 'false':
          object[self.parsePart(key)] = false;
          break;
        case 'NULL':
          object[self.parsePart(key)] = null;
          break;
        default:
          object[self.parsePart(key)] = self.parsePart(innerValue || value);
          break;
      }
    });

    return object;
  },
  parseArray: function(string) {
    var matches = string.match(/{(.*)}/);
    var array = JSON.parse('['+ matches[1] +']');

    return array.map(this.parseObject, this);
  },
  parse: function(value) {
    if ('string' !== typeof value) {
      return value;
    }

    if ('{' === value[0] && '}' === value[value.length - 1]) {
      return this.parseArray(value);
    }

    return this.parseObject(value);
  }
};
