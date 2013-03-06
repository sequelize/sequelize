module.exports = {
  STRING: 'VARCHAR(255)',
  TEXT: 'TEXT',
  INTEGER: 'INTEGER',
  BIGINT:  'BIGINT',
  DATE: 'DATETIME',
  BOOLEAN: 'TINYINT(1)',
  FLOAT: 'FLOAT',
  NOW: 'NOW',
  ENUM: 'ENUM',
  get DECIMAL() {
    var ret = function(precision, scale) {
      return 'DECIMAL(' + precision + ',' + scale + ')';
    };
    ret.toString = ret.valueOf = function() { return 'DECIMAL'; };
    return ret;
  },
  ARRAY: function(type) { return type + '[]' }
}
