'use strict';

const AbstractQuery = require('../abstract/query');
const SequelizeErrors = require('../../errors');
const parserStore = require('../parserStore')('oracle');
const _ = require('lodash');
const semver = require('semver');

class Query extends AbstractQuery {
  constructor(connection, sequelize, options) {
    super(connection, sequelize, options);
    this.options = _.extend(
      {
        logging: console.log,
        plain: false,
        raw: false
      },
      options || {}
    );

    this.checkLoggingOption();
    this.outFormat = options.outFormat || this.sequelize.connectionManager.lib.OBJECT;
  }

  getInsertIdField() {
    return 'id';
  }

  _run(connection, sql, parameters) {
    const self = this;

    if (parameters) {
      //Nothing, just for eslint
    }

    //We set the oracledb
    const oracledb = self.sequelize.connectionManager.lib;
    //Regexp for the bind params
    const regex = new RegExp('([$][:]["]*[a-zA-Z][a-zA-Z_0-9]*["]*)[;]([a-zA-Z][a-zA-Z(0-9)]*[$])');
    //We remove the / that escapes quotes
    if (sql.match(/^(SELECT|INSERT|DELETE)/)) {
      this.sql = sql.replace(/; *$/, '');
    } else {
      this.sql = sql;
    }

    //Method to generate the object for Oracle out bindings; format -> $:name;type$
    let regExResult = regex.exec(this.sql);
    const outParameters = {};

    while (regExResult !== null) {
      //if we have multiple params

      //We extract the name of the parameter to bind, removes the $: at the beginning
      const parameterName = regExResult[1].substring(2, regExResult[1].length);
      //We extract the type, removes the $ at the end
      const type = regExResult[2].substring(0, regExResult[2].length - 1);

      //We bind the type passed as argument to the real type
      switch (type) {
        case 'INTEGER':
        case 'NUMBER':
          outParameters[parameterName] = { dir: oracledb.BIND_OUT, type: oracledb.NUMBER };
          break;
        default:
          //Default, we choose String
          outParameters[parameterName] = { dir: oracledb.BIND_OUT, type: oracledb.STRING };
          break;
      }

      //Finally we replace the param in the sql by the correct format for Oracle:  $:name;type$ -> :name
      if (this.sql.indexOf(regExResult[0]) > -1 && this.sql.indexOf(`'${regExResult[0]}'`) > -1) {
        //if the parameters is between quotes
        this.sql = this.sql.replace("'" + regExResult[0] + "'", `:${parameterName}`);
      } else {
        this.sql = this.sql.replace(regExResult[0], `:${parameterName}`);
      }

      //We exec the regexp again to see if there are other parameters
      regExResult = regex.exec(this.sql);
    }

    this.outParameters = outParameters;

    //do we need benchmark for this query execution
    const benchmark = this.sequelize.options.benchmark || this.options.benchmark;
    const logAliasesQry = this.sequelize.options.dialectOptions
      ? this.sequelize.options.dialectOptions.logAliasesQry
      : false;

    let queryBegin;
    if (benchmark) {
      queryBegin = Date.now();
    } else {
      this.sequelize.log('Executing (' + (connection.uuid || 'default') + '): ' + this.sql, this.options);
    }

    // TRANSACTION SUPPORT
    if (_.startsWith(self.sql, 'BEGIN TRANSACTION')) {
      self.autocommit = false;
      return Promise.resolve();
    } else if (_.startsWith(self.sql, 'SET AUTOCOMMIT ON')) {
      self.autocommit = true;
      return Promise.resolve();
    } else if (_.startsWith(self.sql, 'SET AUTOCOMMIT OFF')) {
      self.autocommit = false;
      return Promise.resolve();
    } else if (_.startsWith(self.sql, 'DECLARE x NUMBER')) {
      //Calling a stored procedure for bulkInsert with NO attributes, returns nothing
      if (self.autoCommit === undefined) {
        if (connection.uuid) {
          self.autoCommit = false;
        } else {
          self.autoCommit = true;
        }
      }
      return connection
        .execute(self.sql, outParameters, { autoCommit: self.autoCommit })
        .then(() => {
          return {};
        })
        .catch(error => {
          throw self.formatError(error);
        });
    } else if (_.startsWith(self.sql, 'BEGIN')) {
      //Call to stored procedures - BEGIN TRANSACTION has been treated before
      if (self.autoCommit === undefined) {
        if (connection.uuid) {
          self.autoCommit = false;
        } else {
          self.autoCommit = true;
        }
      }

      return connection
        .execute(self.sql, Object.keys(self.outParameters).length > 0 ? self.outParameters : [], {
          outFormat: self.outFormat,
          autoCommit: self.autoCommit
        })
        .then(result => {
          if (!Array.isArray(result.outBinds)) {
            return [result.outBinds];
          }
          return result.outBinds;
        })
        .catch(error => {
          throw self.formatError(error);
        });
    } else if (_.startsWith(self.sql, 'COMMIT TRANSACTION')) {
      return connection
        .commit()
        .then(() => {
          return {};
        })
        .catch(err => {
          throw self.formatError(err);
        });
    } else if (_.startsWith(self.sql, 'ROLLBACK TRANSACTION')) {
      return connection
        .rollback()
        .then(() => {
          return {};
        })
        .catch(err => {
          throw self.formatError(err);
        });
    } else if (_.startsWith(self.sql, 'SET TRANSACTION')) {
      return connection
        .execute(self.sql, [], {autoCommit: false})
        .then(() => {
          return {};
        })
        .catch(error => {
          throw self.formatError(error);
        });
    } else {
      // QUERY SUPPORT
      //As Oracle does everything in transaction, if autoCommit is not defined, we set it to true
      if (self.autoCommit === undefined) {
        if (connection.uuid) {
          self.autoCommit = false;
        } else {
          self.autoCommit = true;
        }
      }

      if ('inputParameters' in self.options && self.options.inputParameters !== null) {
        if (Object.keys(self.outParameters).length === 0) {
          self.outParameters = {};
        }
        Object.assign(self.outParameters, self.options.inputParameters);
      }

      if (Object.keys(self.outParameters).length > 0) {
        //If we have some mapping with parameters to do - INSERT queries
        return connection
          .execute(self.sql, self.outParameters, { outFormat: self.outFormat, autoCommit: self.autoCommit })
          .then(result => {
            if (benchmark) {
              self.sequelize.log(
                'Executed (' + (connection.uuid || 'default') + '): ' + self.sql,
                Date.now() - queryBegin,
                self.options
              );
            }

            const formatedResult = self.formatResults(result);

            if (this.isUpsertQuery() || this.isInsertQuery()) {
              return formatedResult;
            }
            return [formatedResult];
          })
          .catch(error => {
            throw self.formatError(error);
          });
      } else {
        //Normal execution
        let sqlToExec = '';
        let opts = {};

        const isMinorTwelveTwo =
          semver.valid(this.sequelize.options.databaseVersion) &&
          semver.lt(this.sequelize.options.databaseVersion, '12.2.0');
        //From Oracle 12.2, aliases / column / table names can be 128 long each, don't need to do this
        //https://docs.oracle.com/database/122/NEWFT/new-features.htm#NEWFT-GUID-E82CA1F1-09C0-47DC-BC78-C984EC62BAF2
        if (isMinorTwelveTwo && self.options.type === 'SELECT') {
          // Dealing with long names in sql - we only come here if this is a select statement from selectQuery
          opts = this._dealWithLongAliasesBeforeSelect(self.sql);
          sqlToExec = opts.sql;
          if (logAliasesQry) {
            //We will log aliases query only if asked
            this.sequelize.log(
              'Executing reformated (' + (connection.uuid || 'default') + '): ' + sqlToExec,
              this.options
            );
          }
        } else {
          sqlToExec = self.sql;
        }

        return connection
          .execute(sqlToExec, [], { outFormat: self.outFormat, autoCommit: self.autoCommit })
          .then(result => {
            if (benchmark) {
              self.sequelize.log(
                'Executed (' + (connection.uuid || 'default') + '): ' + self.sql,
                Date.now() - queryBegin,
                self.options
              );
            }
            if (isMinorTwelveTwo && Object.keys(opts).length === 2) {
              //Replacing aliases by real names
              result = this._replaceLongAliases(opts.tableAliases, result);
            }
            const formatedResult = self.formatResults(result);
            return formatedResult === undefined ? {} : formatedResult;
          })
          .catch(error => {
            throw self.formatError(error);
          });
      }
    }
  }

  run(sql, parameters) {
    const self = this;
    if (!sql.match(/END;$/)) {
      sql = sql.replace(/; *$/, '');
    }

    return self._run(this.connection, sql, parameters);
  }

  /**
   * Specific method for replacing the the aliased names in results by the real names
   * t0 -> table1
   *
   * @param {*} tableAliases
   * @param {*} result
   */
  _replaceLongAliases(tableAliases, result) {
    if (result.rows && result.rows.length > 0) {
      const keys = Object.keys(result.rows[0]);
      //We iterate over each row
      result.rows.forEach(row => {
        //Iterate over each alias
        tableAliases.forEach(tableAlias => {
          //Then iterate over each property
          keys.forEach(key => {
            //if the property starts with a known alias
            if (key.indexOf(tableAlias.tableAlias) === 0) {
              //We split on the dot
              const names = key.split('.');
              //Generate te real name and set it in the row
              row[`${tableAlias.alias}.${names[names.length - 1]}`] = row[key];
              delete row[key];
            }
          });
        });
      });
    }
    return result;
  }

  /**
   * Specific method for replacing long names in requests (Oracle limits to 30 char)
   * table1 -> t0
   *
   * @param {*} sql : request to treat
   */
  _dealWithLongAliasesBeforeSelect(sql) {
    const regex = new RegExp('AS "([a-zA-Z0-9_.]*)"', 'g');
    const tableOnlyRegex = new RegExp('([a-zA-Z0-9->])*->([a-zA-Z0-9->])*', 'g');
    let tableAliases = [];
    let tIdNum = 0;

    //Start by changing all column aliases
    sql = sql.replace(regex, (match, alias) => {
      if (alias.length > 1) {
        //We start by extracting the alias name
        const lastDot = alias.lastIndexOf('.');
        const fullAliasName = alias.substr(0, lastDot); //Alias name
        const column = alias.substr(lastDot, alias.length); //Column name

        if (fullAliasName.length === 0) {
          //If we cannot have a fullAliasName, it means we don't have to replace anything
          return match;
        }

        //Check if the alias has already been encountered
        const alreadyTreatedAlias = tableAliases.find(f => {
          return f.alias === fullAliasName;
        });
        if (alreadyTreatedAlias === undefined) {
          const tableAlias = `t${tIdNum}`;
          tIdNum++;
          const aliasToTreat = {
            alias: fullAliasName, //Real alias name
            tableAlias //New table alias name
          };
          tableAliases.push(aliasToTreat);
          return 'AS "' + fullAliasName.replace(fullAliasName, tableAlias) + column + '"';
        } else {
          //Alias already encountered, taking back the previously generated alias
          return (
            'AS "' + alreadyTreatedAlias.alias.replace(fullAliasName, alreadyTreatedAlias.tableAlias) + column + '"'
          );
        }
      }
    });

    //Reverse to treat a.b.property before a.property
    // tableAliases = tableAliases.reverse();
    //We sort the array, ordering "a"" first, then "a->b"
    tableAliases = tableAliases.sort((first, second) => {
      const countFirst = (first.alias.match(/\./g) || []).length;
      const countSecond = (second.alias.match(/\./g) || []).length;
      if (countFirst < countSecond) {
        return 1;
      }
      if (countFirst > countSecond) {
        return -1;
      }
      return 0;
    });

    //Now we have to change the table aliases
    if (tableAliases.length > 0) {
      tableAliases.forEach(tableAlias => {
        const tableRegex = new RegExp(
          `${tableAlias.alias
            .replace(/(\.)/g, '->')
            .replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}|${tableAlias.alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}`,
          'g'
        );

        sql = sql.replace(tableRegex, (match, alias, fullSql) => {
          const nextChar = fullSql.substr(alias + match.length, 1);
          const previousChar = fullSql.substr(alias - 1, 1);
          //We replace only if the next char is . / space / " -> tablename. / tablename  / tablename"
          //And if the previous char is ( / " / space -> (tablename / "tablename /  tablename
          //It avoids treating column names that start with tablename
          if (
            (nextChar === '.' || nextChar === ' ' || nextChar === '"') &&
            (previousChar === '(' || previousChar === '"' || previousChar === ' ')
          ) {
            //Case where the tablename and the alias are the same, we don't want to replace the real tablename
            if ((nextChar === ' ' && previousChar === ' ') || (nextChar === '"' && previousChar === '"')) {
              const nextWord = fullSql.substr(alias + match.length + 1, match.length + 2).trim();
              const previousWord = fullSql.substr(alias - 6, 6).trim();
              if (nextWord.indexOf(match) > -1 && nextWord.indexOf('.') === -1) {
                return match;
              } else if (match.indexOf(nextWord) > -1) {
                //Case where the alias is shorter than the table (ex : tasks task)
                return match;
              }
              //We don't want to replace the table name
              if (previousWord.indexOf('JOIN') > -1 || previousWord.indexOf('FROM') > -1) {
                return match;
              }
            }
            return tableAlias.tableAlias;
          }
          //We are on a column name that starts with the name of the table, so we do nothing (ie table.tableId)
          return match;
        });
      });
    } else {
      //if we don't have aliases for columns, we haven't changed anything, but we can have to (aliases for tables)
      if (sql.indexOf('->') > -1) {
        sql = sql.replace(tableOnlyRegex, match => {
          const alreadyTreatedAlias = tableAliases.find(f => {
            return f.alias === match;
          });
          if (alreadyTreatedAlias) {
            return alreadyTreatedAlias.tableAlias;
          } else {
            const tableAlias = `t${tIdNum}`;
            tIdNum++;
            const aliasToTreat = {
              alias: match, //Real alias name
              tableAlias //New table alias name
            };
            tableAliases.push(aliasToTreat);
            return tableAlias;
          }
        });
      }
    }

    //We sort the array, ordering "a"" first, then "a->b"
    tableAliases = tableAliases.sort((first, second) => {
      const countFirst = (first.alias.match(/\./g) || []).length;
      const countSecond = (second.alias.match(/\./g) || []).length;
      if (countFirst < countSecond) {
        return -1;
      }
      if (countFirst > countSecond) {
        return 1;
      }
      return 0;
    });

    return {
      sql,
      tableAliases
    };
  }

  /**
   * Building the attribute map by matching the column names received 
   * from DB and the one in rawAttributes 
   * to sequelize format
   * @param {object} attrsMap
   * @param {object} rawAttributes
   * @private
   */
  _getAttributeMap(attrsMap, rawAttributes) {
    attrsMap = Object.assign(attrsMap, _.reduce(rawAttributes, (mp, _, key) => {
      const catalogKey = this.sequelize.queryInterface.queryGenerator.getCatalogName(key);
      mp[catalogKey] = key;
      return mp;
    }, {}));
  }

  /**
   * Process rows received from the DB.
   * Use parse function to parse the returned value 
   * to sequelize format
   * @param {Array} rows
   * @private
   */
  _processRows(rows) {
    let result = rows;
    let attrsMap = {};

    // When quoteIdentifiers is false we need to map the DB column names
    // To the one in attribute list
    if (this.sequelize.options.quoteIdentifiers === false) {
      // Building the attribute map from this.options.attributes
      // Needed in case of an aggregate function
      attrsMap = _.reduce(this.options.attributes, (mp, v, _) => {
        // Aggregate function is of form
        // Fn {fn: 'min', min}, so we have the name in index one of the object
        if (typeof v ===  'object') {
          v = v[1]
        }
        const catalogv = this.sequelize.queryInterface.queryGenerator.getCatalogName(v);
        mp[catalogv] = v;
        return mp;
      }, {});


      // Building the attribute map by matching the column names received 
      // from DB and the one in model.rawAttributes 
      if (this.model) {
        this._getAttributeMap(attrsMap, this.model.rawAttributes);
      }
      
      // If aliasesmapping exists we update the attribute map
      if (this.options.aliasesMapping) {
        let obj = Object.fromEntries(this.options.aliasesMapping);
        rows = rows
          .map(row => _.toPairs(row)
            .reduce((acc, [key, value]) => {
              const mapping = Object.values(obj).find(element => { 
                  const catalogElement = this.sequelize.queryInterface.queryGenerator.getCatalogName(element);
                  return catalogElement === key;
                });
              if(mapping)
                acc[mapping || key] = value;
              return acc;
            }, {})
          );
      }

      // Modify the keys into the format that sequelize expects
      result = rows.map(row => {
        return _.mapKeys(row, (value, key) => {
          let targetAttr = attrsMap[key];
          if (typeof targetAttr === 'string' && targetAttr !== key) {
            return targetAttr;
          } 
          return key;
        });
      });
    }

    // We parse the value received from the DB based on its datatype
    if (this.model) {
      result = result.map(row => {
        return _.mapValues(row, (value, key) => {
          if (this.model) {
            if (this.model.rawAttributes[key]) {
              let typeid = this.model.rawAttributes[key].type.toLocaleString();
              // //For some types, the "name" of the type is returned with the length, we remove it 
              if (typeid.indexOf('(') > -1) {
                typeid = typeid.substr(0, typeid.indexOf('('));
              }
              const parse = parserStore.get(typeid);
              if ((value !== null) & !!parse) {
                value = parse(value);
              }
            }
          }
          return value;
        });
      });
    }
  
    return result;
  }

  /**
   * High level function that handles the results of a query execuntion.
   * Example:
   * Oracle format : 
   * { rows: //All rows
     [ [ 'Oracle Database 11g Enterprise Edition Release 11.2.0.1.0 - 64bit Production' ],
       [ 'PL/SQL Release 11.2.0.1.0 - Production' ],
       [ 'CORE\t11.2.0.1.0\tProduction' ],
       [ 'TNS for 64-bit Windows: Version 11.2.0.1.0 - Production' ],
       [ 'NLSRTL Version 11.2.0.1.0 - Production' ] ],
    resultSet: undefined,
    outBinds: undefined, //Used for dbms_put.line
    rowsAffected: undefined, //Number of rows affecter
    metaData: [ { name: 'BANNER' } ] }
  *
  * @param {Array} data - The result of the query execution.
  */
  formatResults(data) {
    let result = this.instance;
    if (this.isInsertQuery(data)) {
      let insertData = data;
      //Specific case for insert/upsert
      if (_.includes(this.sql, 'INSERT INTO') && !_.includes(this.sql, 'DECLARE')) {
        //For returning into, oracle returns : {ID : [id]}, we need : [{ID : id}]
        //Treating the outbinds parameters
        const keys = Object.keys(this.outParameters);
        const key = keys[0];
        
        const row = {};
        //Treating the outbinds parameters
        row[key] = Array.isArray(insertData.outBinds[key]) ? insertData.outBinds[key][0] : insertData.outBinds[key];
        insertData = [row];
      } else if (!Array.isArray(data.outBinds)) {
        insertData = insertData.outBinds;
      }
      this.handleInsertQuery(insertData);
      return [result, data.rowsAffected]
    } else if (this.isShowTablesQuery()) {
      result = this.handleShowTablesQuery(data.rows);
    } else if (this.isDescribeQuery()) {
      result = {};
      const options = this.options;
      // Getting the table name on which we are doing describe query
      let table = Object.keys(this.sequelize.models);
      let modelAttributes = {};
      // Get the model raw attributes
      if (this.sequelize.models && table.length > 0) {
        this._getAttributeMap(modelAttributes, this.sequelize.models[table[0]].rawAttributes);
      }
      data.rows.forEach(_result => {
        if (_result.Default) {
          _result.Default = _result.Default.replace("('", '')
            .replace("')", '')
            .replace(/'/g, ''); /* jshint ignore: line */
        }

        if (!(modelAttributes[_result.COLUMN_NAME] in result)) {
          let key = modelAttributes[_result.COLUMN_NAME];
          if (!key) {
            key = _result.COLUMN_NAME;
          }

          result[key] = {
            type: _result.DATA_TYPE.toUpperCase(),
            allowNull: _result.NULLABLE === 'N' ? false : true,
            defaultValue: undefined,
            primaryKey: _result.PRIMARY === 'PRIMARY'
          };
        }
      });
    } else if (this.isShowIndexesQuery()) {
      result = this.handleShowIndexesQuery(data.rows);
    } else if (this.isSelectQuery()) {
      const rows = data.rows;
      let result = this._processRows(rows);
      return this.handleSelectQuery(result);
    } else if (this.isCallQuery()) {
      result = data.rows[0];
    } else if (this.isUpdateQuery()) {
      result = [result, data.rowsAffected];
    } else if (this.isBulkUpdateQuery()) {
      result = data.rowsAffected;
    } else if (this.isBulkDeleteQuery()) {
      result = data.rowsAffected;
    } else if (this.isVersionQuery()) {
      const version = data.rows[0].VERSION;
      if (version) {
        const versions = version.split('.');
        result = `${versions[0]}.${versions[1]}.${versions[2]}`;
      } else {
        result = '0.0.0';
      }
    } else if (this.isForeignKeysQuery()) {
      result = data.rows;
    } else if (this.isUpsertQuery()) {
      //Upsert Query, will return nothing
      data = data.outBinds;
      result = [{isNewRecord: data.isUpdate, value: data}, data.isUpdate == 0];
    } else if (this.isShowConstraintsQuery()) {
      result = this.handleShowConstraintsQuery(data);
    } else if (this.isRawQuery()) {
      // If data.rows exists then it is a select query
      // Hence we would have two components
      // metaData and rows and we return them
      // as [data.rows, data.metaData]
      // Else it is result of update/upsert/insert query
      // and it has no rows so we return [data, data]
      if (data && data.rows) {
        return [data.rows, data.metaData];
      }
      return [data, data];
    }

    return result;
  }

  handleShowConstraintsQuery(data) {
    //Convert snake_case keys to camelCase as its generated by stored procedure
    return data.rows.map(result => {
      const constraint = {};
      for (const key in result) {
        constraint[_.camelCase(key)] = result[key].toLowerCase();
      }
      return constraint;
    });
  }

  /**
   * Convert string with dot notation to object
   * ie : a.b.c -> a{b{c}}
   *
   * @param path
   * @param value
   * @param obj
   */
  convertStringToObj(path, value, obj) {
    const parts = path.split('.');
    let part;
    const last = parts.pop();
    part = parts.shift();
    while (part) {
      if (typeof obj[part] !== 'object') {
        obj[part] = {};
      }
      obj = obj[part];
      part = parts.shift();
    }
    obj[last] = value;
  }

  handleShowTablesQuery(results) {
    return results.map(resultSet => {
      return {
        tableName: resultSet.TABLE_NAME,
        schema: resultSet.TABLE_SCHEMA
      };
    });
  }

  formatError(err) {
    let match;
    //ORA-00001: unique constraint (USER.XXXXXXX) violated
    match = err.message.match(/unique constraint ([\s\S]*) violated/);
    if (match && match.length > 1) {
      match[1] = match[1].replace('(', '').replace(')', '').split('.')[1]; //As we get (SEQUELIZE.UNIQNAME), we replace to have UNIQNAME
      const errors = [];
      let fields = [],
        message = 'Validation error',
        uniqueKey = null;

      if (this.model) {
        const uniqueKeys = Object.keys(this.model.uniqueKeys);

        const currKey = uniqueKeys.find(key => {
          //We check directly AND with quotes -> "a"" === a || "a" === "a"
          return key.toUpperCase() === match[1].toUpperCase() || key.toUpperCase() === `"${match[1].toUpperCase()}"`;
        });

        if (currKey) {
          uniqueKey = this.model.uniqueKeys[currKey];
          fields = uniqueKey.fields;
        }

        if (uniqueKey && !!uniqueKey.msg) {
          message = uniqueKey.msg;
        }

        fields.forEach(field => {
          errors.push(
            new SequelizeErrors.ValidationErrorItem(
              this.getUniqueConstraintErrorMessage(field),
              'unique violation',
              field,
              null
            )
          );
        });
      }

      return new SequelizeErrors.UniqueConstraintError({
        message,
        errors,
        err,
        fields
      });
    }

    //ORA-02291: integrity constraint (string.string) violated - parent key not found / ORA-02292: integrity constraint (string.string) violated - child record found
    match = err.message.match(/ORA-02291/) || err.message.match(/ORA-02292/);
    if (match && match.length > 0) {
      return new SequelizeErrors.ForeignKeyConstraintError({
        fields: null,
        index: match[1],
        parent: err
      });
    }

    // ORA-02443: Cannot drop constraint  - nonexistent constraint
    match = err.message.match(/ORA-02443/);
    if (match && match.length > 0) {
      return new SequelizeErrors.UnknownConstraintError(match[1]);
    }

    return new SequelizeErrors.DatabaseError(err);
  }

  isShowIndexesQuery() {
    return this.sql.indexOf('SELECT i.index_name,i.table_name, i.column_name, u.uniqueness') > -1;
  }

  isSelectCountQuery() {
    return this.sql.toUpperCase().indexOf('SELECT COUNT(') > -1;
  }

  handleShowIndexesQuery(data) {
    const acc = [];

    //We first treat the datas
    data.forEach(indexRecord => {
      //We create the object
      if (!acc[indexRecord.INDEX_NAME]) {
        acc[indexRecord.INDEX_NAME] = {
          unique: indexRecord.UNIQUENESS === 'UNIQUE' ? true : false,
          primary: indexRecord.INDEX_NAME.toLowerCase().indexOf('pk') === 0,
          name: indexRecord.INDEX_NAME.toLowerCase(),
          tableName: indexRecord.TABLE_NAME.toLowerCase(),
          type: undefined
        };
        acc[indexRecord.INDEX_NAME].fields = [];
      }

      //We create the fields
      acc[indexRecord.INDEX_NAME].fields.push({
        attribute: indexRecord.COLUMN_NAME,
        length: undefined,
        order: indexRecord.DESCEND,
        collate: undefined
      });
    });
    const returnIndexes = [];

    const accKeys = Object.keys(acc);
    accKeys.forEach(accKey => {
      returnIndexes.push(acc[accKey]);
    });

    return returnIndexes;
  }

  handleInsertQuery(results, metaData) {
    if (this.instance && results.length > 0) {
      if ('pkReturnVal' in results[0]) {
        //The PK of the table is a reserved word (ex : uuid), we have to change the name in the result for the model to find the value correctly
        results[0][this.model.primaryKeyAttribute] = results[0].pkReturnVal;
        delete results[0].pkReturnVal;
      }
      // add the inserted row id to the instance
      const autoIncrementField = this.model.autoIncrementAttribute;
      let autoIncrementFieldAlias = null,
        id = null;

      if (
        Object.prototype.hasOwnProperty.call(this.model.rawAttributes, autoIncrementField) &&
        this.model.rawAttributes[autoIncrementField].field !== undefined
      )
        autoIncrementFieldAlias = this.model.rawAttributes[autoIncrementField].field;

      id = id || (results && results[0][this.getInsertIdField()]);
      id = id || (metaData && metaData[this.getInsertIdField()]);
      id = id || (results && results[0][autoIncrementField]);
      id = id || (autoIncrementFieldAlias && results && results[0][autoIncrementFieldAlias]);

      this.instance[autoIncrementField] = id;
    }
  }
}
function hasLowerCase(str) {
  return /[a-z]/.test(str);
}

module.exports = Query;
module.exports.Query = Query;
module.exports.default = Query;
