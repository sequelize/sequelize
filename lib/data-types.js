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
  ARRAY: function(type) { return type + '[]' }
}
