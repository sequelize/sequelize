'use strict';

const Utils = require('../../utils');
const _ = require('lodash');
const Promise = require('../../promise');

/**
 Returns an object that treats Oracle's inabilities to do certain queries.
 */

/**
  A wrapper that fixes Oracle's inability to cleanly drop constraints on multiple tables if the calls are made at the same time 
  @param  {Object} options
 */
const dropAllTables = function(options) {

  options = options || {};
  const skip = options.skip || [];

  //As oracle uppercase all tables names, we create a mapping array with everything in upperCase
  const upperSkip = skip.map(table => {
    return table.toUpperCase();
  });

  const dropAllTablesFct = tableNames => Promise.each(tableNames, tableName => {
    // if tableName is not in the Array of tables names then dont drop it
    if (upperSkip.indexOf(tableName.tableName || tableName) === -1) {
      return this.dropTable(tableName, _.assign({}, options, { cascade: true }) );
    }
  });

  //Function to make each call to drop indexes / FK / PK... 
  //Mandatory for Oracle as it could try to delete a PK and a FK at the same time on different tables and causes issues with the DB
  const doAfter = function(promises, idx, sequelizeInstance) {
    if (promises.length > 0) {
        
      if (idx < promises.length) {
        let elem = promises[idx];
        idx++;
        //While elements, we execute the query
        return sequelizeInstance.query(elem.sql, elem.options)
        .then(() => {
          return doAfter(promises, idx, sequelizeInstance);
        });
      } else {
        //Done, we get out
        return Promise.resolve({});
      }
    } else {
      return Promise.resolve({});
    }
  };

  return this.showAllTables(options).then(tableNames => {
    return this.getForeignKeysForTables(tableNames, options).then(foreignKeys => {
      const promises = [];

      tableNames.forEach(tableName => {
        let normalizedTableName = tableName;
        if (Utils._.isObject(tableName)) {
          normalizedTableName = tableName.schema + '.' + tableName.tableName;
        }

        foreignKeys[normalizedTableName].forEach(foreignKey => {
          const sql = this.QueryGenerator.dropForeignKeyQuery(tableName, foreignKey);
          //Instead of calling the promises, we set all parameters into an array
          promises.push({sql, options});
        });
      });

      return doAfter(promises, 0, this.sequelize)
      .then(() => {
        return dropAllTablesFct(tableNames);
      });
    });
  });
};




module.exports = {
  dropAllTables
};
