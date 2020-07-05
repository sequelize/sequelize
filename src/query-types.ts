/**
 * An enum of query types used by `sequelize.query`
 *
 * @see {@link Sequelize#query}
 */
enum QueryTypes {
  SELECT = 'SELECT',
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  BULKUPDATE = 'BULKUPDATE',
  BULKDELETE = 'BULKDELETE',
  DELETE = 'DELETE',
  UPSERT = 'UPSERT',
  VERSION = 'VERSION',
  SHOWTABLES = 'SHOWTABLES',
  SHOWINDEXES = 'SHOWINDEXES',
  DESCRIBE = 'DESCRIBE',
  RAW = 'RAW',
  FOREIGNKEYS = 'FOREIGNKEYS',
  SHOWCONSTRAINTS = 'SHOWCONSTRAINTS'
}

module.exports = QueryTypes;
