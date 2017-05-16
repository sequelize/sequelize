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
    if (Object.keys(tableName).length > 0) {
      if (upperSkip.indexOf(tableName.tableName) === -1) {
        return this.dropTable(tableName, _.assign({}, options, { cascade: true }) );
      }
    } else {
      if (upperSkip.indexOf(tableName) === -1) {
        return this.dropTable(tableName, _.assign({}, options, { cascade: true }) );
      }
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


/**
  A wrapper that fixes Oracle's inability to cleanly remove columns from existing tables if they have a default constraint.

  @method removeColumn
  @for    QueryInterface

  @param  {String} tableName     The name of the table.
  @param  {String} attributeName The name of the attribute that we want to remove.
  @param  {Object} options
  @param  {Boolean|Function} [options.logging] A function that logs the sql queries, or false for explicitly not logging these queries
 @private
 */
const removeColumn = function(tableName, attributeName, options) {
  options = Object.assign({ raw: true }, options || {});

  let constraintsSql = [];

  //We start by searching if the primary key is an identity
  const descriptionTableQuery = this.QueryGenerator.isIdentityPrimaryKey(tableName);
  return this.sequelize.query(descriptionTableQuery, options)
  .spread(PKResult => {

    for (let i = 0; i < PKResult.length; i++) {
      //We iterate through the primary keys to determine if we are working on it
      if (PKResult[i].column_name === attributeName.toUpperCase()) {
        //The column we are working on is in the PK AND is an identity column, we have to drop the identity 
        let dropIdentitySql = this.QueryGenerator.dropIdentityColumn(tableName, attributeName);
        constraintsSql.push({
          sql : dropIdentitySql,
          options
        });
        break;
      }
    }

    //This method return all constraints on a table with a given attribute
    const findConstraintSql = this.QueryGenerator.getConstraintsOnColumn(tableName, attributeName);
    return this.sequelize.query(findConstraintSql, options)
    .spread(results => {
      if (!results.length && constraintsSql.length === 0) {
        // No default constraint found -- we can cleanly remove the column
        return;
      }

      //Function to execute the different remove one by one
      const deleteRecursively = function(constraints, idx, sequelizeInstance) {
        if (constraints.length > 0) {
          if (idx < constraints.length) {
            let elem = constraints[idx];
            idx++;
            //While elements, we execute the query
            return sequelizeInstance.query(elem.sql, elem.options)
            .then(() => {
              return deleteRecursively(constraints, idx, sequelizeInstance);
            });
          } else {
            //Done, we get out
            return Promise.resolve({});
          }
        } else {
          return Promise.resolve({});
        }
      };

      results.forEach(result => {
        //For each constraint, we get the sql
        constraintsSql.push({
          sql : this.QueryGenerator.dropConstraintQuery(tableName, result.constraint_name),
          options
        });
      });

      // const dropConstraintSql = this.QueryGenerator.dropConstraintQuery(tableName, results[0].name);
      return deleteRecursively(constraintsSql, 0, this.sequelize);
    })
    .then(() => {
      const removeSql = this.QueryGenerator.removeColumnQuery(tableName, attributeName);
      return this.sequelize.query(removeSql, options);
    });

  });
  
};

/**
 * A wrapper that adds the currentModel of the describe in options
 * This is used for mapping the real column names to those returned by Oracle
 */
const addOptionsForDescribe = function(tableName, options) {
    if (this.sequelize && this.sequelize.models && Object.keys(this.sequelize.models).length > 0) {
      let keys = Object.keys(this.sequelize.models);
      let i = 0, found = false;
      while (i < keys.length && !found) {
        let model = this.sequelize.models[keys[i]];
        if (model.tableName === tableName) {
          if (options) {
            options["describeModelAttributes"] = model.attributes;
          } else {
            options = {
              "describeModelAttributes" : model.attributes
            };
          }
          found = true;
        }
        i++;
      }
    }
    return options;
  }


module.exports = {
  dropAllTables,
  removeColumn,
  addOptionsForDescribe
};
