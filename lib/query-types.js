'use strict';

/**
 * @namespace QueryTypes
 * @memberof Sequelize
 *
 *
 * @property SELECT
 * @property INSERT
 * @property UPDATE
 * @property BULKUPDATE
 * @property BULKDELETE
 * @property DELETE
 * @property UPSERT
 * @property VERSION
 * @property SHOWTABLES
 * @property SHOWINDEXES
 * @property DESCRIBE
 * @property RAW
 * @property FOREIGNKEYS
 * @property SHOWCONSTRAINTS
 */
module.exports = {
  SELECT: 'SELECT',
  INSERT: 'INSERT',
  UPDATE: 'UPDATE',
  BULKUPDATE: 'BULKUPDATE',
  BULKDELETE: 'BULKDELETE',
  DELETE: 'DELETE',
  UPSERT: 'UPSERT',
  VERSION: 'VERSION',
  SHOWTABLES: 'SHOWTABLES',
  SHOWINDEXES: 'SHOWINDEXES',
  DESCRIBE: 'DESCRIBE',
  RAW: 'RAW',
  FOREIGNKEYS: 'FOREIGNKEYS',
  SHOWCONSTRAINTS: 'SHOWCONSTRAINTS'
};
