'use strict';
const { QueryInterface } = require('../abstract/query-interface');
const QueryTypes = require('../../query-types');

/**
 * The interface that Sequelize uses to talk with Db2 database
 */
class Db2QueryInterface extends QueryInterface {
  async getForeignKeyReferencesForTable(tableName, options) {
    const queryOptions = {
      ...options,
      type: QueryTypes.FOREIGNKEYS
    };
    const query = this.queryGenerator.getForeignKeysQuery(tableName, this.sequelize.config.username);
    return this.sequelize.query(query, queryOptions);
  }
}

exports.Db2QueryInterface = Db2QueryInterface;
