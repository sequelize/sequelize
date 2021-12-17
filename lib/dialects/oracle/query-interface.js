'use strict';
const { QueryInterface } = require('../abstract/query-interface');
//const Utils = require('../../utils');

const _ = require('lodash');
/**
 * The interface that Sequelize uses to talk with Oracle database
 */
class OracleQueryInterface extends QueryInterface {

  /**
   * A wrapper that adds the currentModel of the describe in options
   * This is used for mapping the real column names to those returned by Oracle
   *
   * @param tableName
   * @param options
   */
  addOptionsForDescribe(tableName, options) {
    if (this.sequelize && this.sequelize.models && Object.keys(this.sequelize.models).length > 0) {
      const keys = Object.keys(this.sequelize.models);
      let i = 0,
        found = false;
      while (i < keys.length && !found) {
        const model = this.sequelize.models[keys[i]];
        if (model.tableName === tableName) {
          if (options) {
            options['describeModelAttributes'] = model.rawAttributes;
          } else {
            options = {
              describeModelAttributes: model.rawAttributes
            };
          }
          found = true;
        }
        i++;
      }
    }
    return options;
  }
}

exports.OracleQueryInterface = OracleQueryInterface;
