/**
 * An enum of query types used by {@link Sequelize#query}.
 */
export enum QueryTypes {
  SELECT = 'SELECT',
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  BULKUPDATE = 'BULKUPDATE',
  DELETE = 'DELETE',
  UPSERT = 'UPSERT',
  SHOWINDEXES = 'SHOWINDEXES',
  DESCRIBE = 'DESCRIBE',
  RAW = 'RAW',
  SHOWCONSTRAINTS = 'SHOWCONSTRAINTS',
}
