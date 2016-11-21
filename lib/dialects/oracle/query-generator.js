'use strict';

/* jshint -W110 */
var Utils = require('../../utils')
  , DataTypes = require('../../data-types')
  , AbstractQueryGenerator = require('../abstract/query-generator')
  , semver = require('semver')
  ,_ = require('lodash');

/* istanbul ignore next */
var throwMethodUndefined = function(methodName) {
  throw new Error('The method "' + methodName + '" is not defined! Please add it to your sql dialect.');
};

var sysschemas = "\'SYS\', \'SYSTEM\', \'OUTLN\', \'CSMIG\', \'CTXSYS\', \'DBSNMP\', \'DIP\', \'DMSYS\', \'DSSYS\', \'EXFSYS\', \'LBACSYS\', \'MDSYS\', \'ORACLE_OCM\', \'PERFSTAT\', \'TRACESVR\', \'TSMSYS\', \'XDB\',\'MDDATA\',\'SPATIAL_WFS_ADMIN_USR\',\'SPATIAL_CSW_ADMIN_USR\',\'APEX_PUBLIC_USER\',\'APPQOSSYS\',\'WMSYS\',\'ANONYMOUS\',\'OLAPSYS\',\'ORDSYS\',\'ORDDATA\',\'ORDPLUGINS\',\'SI_INFORMTN_SCHEMA\',\'SYSMAN\',\'FLOWS_FILES\',\'APEX_030200\',\'OWBSYS\',\'OWBSYS_AUDIT\',\'MGMT_VIEW\'";

var OracleQueryGenerator = _.extend(
  _.clone(require('../abstract/query-generator'))
);

var QueryGenerator = {
  options: {},
  dialect: 'oracle',

    createSchema: function(schema) {
    return [
        'DECLARE',
        '  V_COUNT INTEGER;',
        '  V_CURSOR_NAME INTEGER;',
        '  V_RET INTEGER;',
        'BEGIN',
        '  SELECT COUNT(1) INTO V_COUNT FROM ALL_USERS WHERE USERNAME = ', wrapSingleQuote(schema),';',
        '  IF V_COUNT = 0 THEN',
        '    EXECUTE IMMEDIATE', wrapSingleQuote('CREATE USER ' + schema + ' IDENTIFIED BY 12345'), ';',
        '    EXECUTE IMMEDIATE', wrapSingleQuote('GRANT create session TO ' + schema), ';',
        '    EXECUTE IMMEDIATE', wrapSingleQuote('GRANT create table TO ' + schema), ';',
        '    EXECUTE IMMEDIATE', wrapSingleQuote('GRANT create view TO ' + schema), ';',
        '    EXECUTE IMMEDIATE', wrapSingleQuote('GRANT create any trigger TO ' + schema), ';',
        '    EXECUTE IMMEDIATE', wrapSingleQuote('GRANT create any procedure TO ' + schema), ';',
        '    EXECUTE IMMEDIATE', wrapSingleQuote('GRANT create sequence TO ' + schema), ';',
        '    EXECUTE IMMEDIATE', wrapSingleQuote('GRANT create synonym TO ' + schema), ';',
        '    EXECUTE IMMEDIATE', wrapSingleQuote('GRANT UNLIMITED TABLESPACE TO ' + schema), ';',
        '  END IF;',
        'END;',
    ].join(' ');
  },


 showSchemasQuery: function() {
    return 'SELECT USERNAME AS "schema_name" FROM ALL_USERS WHERE USERNAME NOT IN (' + sysschemas + ', user)';
  },

 versionQuery: function() {
    return 'SELECT * FROM V$VERSION';
  },


//TODO missing checking that table does not already exists
  createTableQuery: function(tableName, attributes, options) {
    var query = "CREATE TABLE <%= table %> (<%= attributes %>)"
      , primaryKeys = []
      , foreignKeys = {}
      , attrStr = []
      , self = this;

    for (var attr in attributes) {
      if (attributes.hasOwnProperty(attr)) {
        var dataType = attributes[attr]
          , match;

        if (Utils._.includes(dataType, 'PRIMARY KEY')) {
          primaryKeys.push(attr);

          if (Utils._.includes(dataType, 'REFERENCES')) {
             // ORACLE doesn't support inline REFERENCES declarations: move to the end
            match = dataType.match(/^(.+) (REFERENCES.*)$/);
            attrStr.push(attr + ' ' + match[1].replace(/PRIMARY KEY/, ''));
            foreignKeys[attr] = match[2];
          } else {
            attrStr.push(attr + ' ' + dataType.replace(/PRIMARY KEY/, ''));
          }
        } else if (Utils._.includes(dataType, 'REFERENCES')) {
          // ORACLE doesn't support inline REFERENCES declarations: move to the end
          match = dataType.match(/^(.+) (REFERENCES.*)$/);
          attrStr.push(attr + ' ' + match[1]);
          foreignKeys[attr] = match[2];
        } else {
          attrStr.push(attr + ' ' + dataType);
        }
      }
    }

    var values = {
      table: tableName,
      attributes: attrStr.join(', '),
    }
    , pkString = primaryKeys.map(function(pk) { return pk; }.bind(this)).join(', ');

    if (!!options.uniqueKeys) {
      Utils._.each(options.uniqueKeys, function(columns, indexName) {
        if (!Utils._.isString(indexName)) {
          indexName = 'uniq_' + tableName + '_' + columns.fields.join('_');
        }
        values.attributes += ', CONSTRAINT ' + indexName + ' UNIQUE (' + Utils._.map(columns.fields, self.quoteIdentifier).join(', ') + ')';
      });
    }

    if (pkString.length > 0) {
      values.attributes += ', PRIMARY KEY (' + pkString + ')';
    }

    for (var fkey in foreignKeys) {
      if (foreignKeys.hasOwnProperty(fkey)) {
        values.attributes += ', FOREIGN KEY (' + fkey + ') ' + foreignKeys[fkey];
      }
    }

    return Utils._.template(query)(values).trim() + ';';
  },

//TODO
  describeTableQuery: function(tableName, schema) {
    var sql = [
      'SELECT',
        "c.COLUMN_NAME AS 'Name',",
        "c.DATA_TYPE AS 'Type',",
        "c.CHARACTER_MAXIMUM_LENGTH AS 'Length',",
        "c.IS_NULLABLE as 'IsNull',",
        "COLUMN_DEFAULT AS 'Default',",
        "tc.CONSTRAINT_TYPE AS 'Constraint'",
      'FROM',
        'INFORMATION_SCHEMA.TABLES t',
      'INNER JOIN',
        'INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA',
      'LEFT JOIN',
        'INFORMATION_SCHEMA.KEY_COLUMN_USAGE cu ON t.TABLE_NAME = cu.TABLE_NAME AND cu.COLUMN_NAME = c.COLUMN_NAME AND t.TABLE_SCHEMA = cu.TABLE_SCHEMA',
      'LEFT JOIN',
        'INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc ON t.TABLE_NAME = tc.TABLE_NAME AND cu.COLUMN_NAME = c.COLUMN_NAME AND tc.CONSTRAINT_TYPE = \'PRIMARY KEY\'',
      'WHERE t.TABLE_NAME =', wrapSingleQuote(tableName)
    ].join(' ');

    if (schema) {
      sql += 'AND t.TABLE_SCHEMA =' + wrapSingleQuote(schema);
    }

    return sql;
  },

  renameTableQuery: function(before, after) {
    var query = 'RENAME <%= before %> TO <%= after %>;';
    return Utils._.template(query)({
      before: before,
      after: after
    });
  },

  showTablesQuery: function () {
    return 'SELECT table_name, owner FROM all_tables;';
  },

  dropTableQuery: function(tableName) {

  var query = "BEGIN"
      + "EXECUTE IMMEDIATE 'DROP TABLE <%= table %>';"
        + "EXCEPTION"
        + "WHEN OTHERS THEN"
        + "IF SQLCODE != -942 THEN"
          + "RAISE;"
        + "END IF;"
    + "END;"

    var values = {
      table: tableName
    };

    return Utils._.template(query)(values).trim() + ';';
  },

  addColumnQuery: function(table, key, dataType) {
    // FIXME: attributeToSQL SHOULD be using attributes in addColumnQuery
    //        but instead we need to pass the key along as the field here
    dataType.field = key;

    var query = 'ALTER TABLE <%= table %> ADD (<%= attribute %>);'
      , attribute = Utils._.template('<%= key %> <%= definition %>')({
        key: key,
        definition: this.attributeToSQL(dataType, {
          context: 'addColumn'
        })
      });

    return Utils._.template(query)({
      table: table,
      attribute: attribute
    });
  },

  removeColumnQuery: function(tableName, attributeName) {
    var query = 'ALTER TABLE <%= tableName %> DROP COLUMN <%= attributeName %>;';
    return Utils._.template(query)({
      tableName: this.quoteTable(tableName),
      attributeName: attributeName
    });
  },

//TODO
  changeColumnQuery: function(tableName, attributes) {
    var modifyQuery = 'ALTER TABLE <%= tableName %> MODIFY (<%= query %>);';
    var alterQuery = 'ALTER TABLE <%= tableName %> <%= query %>;';
    var query = "";
    var attrString = [], constraintString = [];

    for (var attributeName in attributes) {
      var definition = attributes[attributeName];
      if (definition.match(/REFERENCES/)) {
        constraintString.push(Utils._.template('<%= fkName %> FOREIGN KEY (<%= attrName %>) <%= definition %>')({
          fkName: attributeName + '_foreign_idx',
          attrName: attributeName,
          definition: definition.replace(/.+?(?=REFERENCES)/,'')
        }));
      } else {
        attrString.push(Utils._.template('<%= attrName %> <%= definition %>')({
          attrName: attributeName,
          definition: definition
        }));
      }
    }

    var finalQuery = '';
    if (attrString.length) {
      finalQuery += attrString.join(', ');
      finalQuery += constraintString.length ? ' ' : '';
    }
    if (constraintString.length) {
      finalQuery += 'ADD CONSTRAINT ' + constraintString.join(', ');
      //Here, we don't use modify
      query = alterQuery;
    } else {
      query = modifyQuery;
    }

    return Utils._.template(query)({
      tableName: tableName,
      query: finalQuery
    });
  },

  renameColumnQuery: function(tableName, attrBefore, attributes) {
    var query = "ALTER TABLE <%= tableName %> RENAME COLUMN <%= before %> TO <%= after %>;"
      , newName = Object.keys(attributes)[0];

    return Utils._.template(query)({
      tableName: tableName,
      before: attrBefore,
      after: newName
    });
  },

  /*
  * Override of insertQuery, Oracle specific
  */
  insertQuery: function(table, valueHash, modelAttributes, options) {
    console.log('///////////////////////////////////////////////////////////////////');
    console.log('///////////////////////////////////////////////////////////////////');
    console.log('///////////////////////////////////////////////////////////////////');
    options = options || {};
    _.defaults(options, this.options);

    

    var query
      , valueQuery = 'INSERT<%= ignore %> INTO <%= table %> (<%= attributes %>) VALUES (<%= values %>)'
      , emptyQuery = 'INSERT<%= ignore %> INTO <%= table %> VALUES (<%= values %>)'
      , outputFragment
      , fields = []
      , values = []
      , primaryKey
      , key
      , value
      , identityWrapperRequired = false
      , modelAttributeMap = {}
      , tmpTable = ''         //tmpTable declaration for trigger
      , selectFromTmp = ''    //Select statement for trigger
      , tmpColumns = ''       //Columns for temp table for trigger
      , outputColumns = ''    //Columns to capture into temp table for trigger
      , attribute             //Model attribute holder
      , modelKey;             //key for model


      //We have to specify a variable that will be used as return value for the id
	    var returningQuery = "<%=valueQuery %> RETURNING <%=primaryKey %> INTO $:<%=primaryKey %>;<%=primaryKeyType %>$;";

    if (modelAttributes) {


      //TODO - ameliorate this for returning id if primaryKey is composed
      //We search for the primaryKey
      var keys = Object.keys(modelAttributes);
      var primaryKeyFound = false;
      var idx = 0;

      while(idx < keys.length && !primaryKeyFound) {
        var key = keys[idx];
        var attribute = modelAttributes[key];
        if(attribute.primaryKey) {
          primaryKeyFound = true;
          primaryKey = attribute;
        }
        idx++;
      }

      Utils._.each(modelAttributes, function(attribute, key) {
        modelAttributeMap[key] = attribute;
        if (attribute.field) {
          modelAttributeMap[attribute.field] = attribute;
        }
      });
    }

    if (this._dialect.supports['ON DUPLICATE KEY'] && options.onDuplicate) {
      valueQuery += ' ON DUPLICATE KEY ' + options.onDuplicate;
      emptyQuery += ' ON DUPLICATE KEY ' + options.onDuplicate;
    }

    valueHash = Utils.removeNullValuesFromHash(valueHash, this.options.omitNull);
    for (key in valueHash) {
      if (valueHash.hasOwnProperty(key)) {
        value = valueHash[key];
        fields.push(this.quoteIdentifier(key));

        // SERIALS' can't be NULL in postgresql, use DEFAULT where supported
        if (modelAttributeMap && modelAttributeMap[key] && modelAttributeMap[key].autoIncrement === true && !value) {
          if (!this._dialect.supports.autoIncrement.defaultValue) {
            fields.splice(-1,1);
          } else if (this._dialect.supports.DEFAULT) {
            values.push('DEFAULT');
          } else {
            values.push(this.escape(null));
          }
        } else {
          if (modelAttributeMap && modelAttributeMap[key] && modelAttributeMap[key].autoIncrement === true) {
            identityWrapperRequired = true;
          }

          values.push(this.escape(value, (modelAttributeMap && modelAttributeMap[key]) || undefined, { context: 'INSERT' }));
        }
      }
    }

    var replacements = {
      ignore: options.ignore ? this._dialect.supports.IGNORE : '',
      primaryKeyType : primaryKey.type.toSql(), 
      primaryKey : primaryKey.fieldName,
      table: this.quoteTable(table),
      attributes: fields.join(','),
      values: values.join(',')
    };

    if(options.returning) {
      query = returningQuery;
      replacements.valueQuery =  replacements.attributes.length ? Utils._.template(valueQuery)(replacements) : Utils._.template(emptyQuery)(replacements);
    } else {
      query = (replacements.attributes.length ? valueQuery : emptyQuery) + ';';
    }

    return Utils._.template(query)(replacements);
  },


/**
 * Oracle way to insert multiple rows inside a single statement
 * INSERT ALL INSERT INTO table (column_name1,column_name2)
    with row as (
      SELECT value as "column_name1",value as "column_name2" FROM DUAL UNION ALL
      SELECT value as "column_name1",value as "column_name2" FROM DUAL
    )
  SELECT * FROM row
 */
  bulkInsertQuery: function(tableName, attrValueHashes, options, attributes) {
    var query = 'INSERT ALL INTO <%= table %> (<%= attributes %>) WITH rowAttr AS (<%= rows %>) SELECT * FROM rowAttr;'
      , emptyQuery = 'INSERT INTO <%= table %> DEFAULT VALUES'
      , tuples = []
      , rows = []
      , allAttributes = []
      , needIdentityInsertWrapper = false
      , allQueries = []
      , outputFragment;

    Utils._.forEach(attrValueHashes, function(attrValueHash) {
      // special case for empty objects with primary keys
      var fields = Object.keys(attrValueHash);
      if (fields.length === 1 && attributes[fields[0]].autoIncrement && attrValueHash[fields[0]] === null) {
        allQueries.push(emptyQuery);
        return;
      }

      // normal case
      Utils._.forOwn(attrValueHash, function(value, key) {
        if (value !== null && attributes[key].autoIncrement) {
          needIdentityInsertWrapper = true;
        }


        if (allAttributes.indexOf(key) === -1) {
          if (value === null && attributes[key].autoIncrement)
            return;

          allAttributes.push(key);
        }
      });
    });

    /*if (allAttributes.length > 0) {
      Utils._.forEach(attrValueHashes, function(attrValueHash) {
        tuples.push('(' +
          allAttributes.map(function(key) {
            return this.escape(attrValueHash[key]);
          }.bind(this)).join(',') +
        ')');
      }.bind(this));

      allQueries.push(query);
    }*/

    //Loop over each row to insert
    if(allAttributes.length > 0) {
        //Loop over each attribute
        Utils._.forEach(attrValueHashes, function(attrValueHash, idx, array) {
          //Generating the row
          var row = "SELECT ";
          var attrs = allAttributes.map(function(key) {
              return this.escape(attrValueHash[key]) + ' AS "' + key + '"';
            }.bind(this)).join(',');
            row += attrs;
            row += idx < array.length - 1 ? ' FROM DUAL UNION ALL' : ' FROM DUAL'; 
          tuples.push(row);
        }.bind(this));
      allQueries.push(query);
    }

console.log('------------------------------------');
console.dir(tuples[0]);
console.log('------------------------------------');
console.dir(tuples[tuples.length - 1]);
    

    var replacements = {
      table: tableName,
      attributes: allAttributes.map(function(attr) {
                    return attr;
                  }.bind(this)).join(','),
      rows: tuples.join(' ')
    };

    var generatedQuery = Utils._.template(allQueries.join(';'))(replacements);

    return generatedQuery;
  },

  deleteQuery: function(tableName, where, options) {
    options = options || {};

    var table = tableName;
    if (options.truncate === true) {
      // Truncate does not allow LIMIT and WHERE
      return 'TRUNCATE TABLE ' + table;
    }

    where = this.getWhereConditions(where);
    var limit = ''
      , query = 'DELETE FROM <%= table %><%= where %><%= limit %>;';

    if (!!options.limit) {
      //Style of drop with limit with Oracle : delete from table where rowid IN (select rowid from table where rownum <= 10)
      //If where have de drop statement inside where (as unit test delete.test.js), we don't do anything on limit
        //We can add a limit
        if(where.length > 0) {
          //Where clause, we add this at the end
          limit = ' AND rowid IN(SELECT rowid FROM <%= table %> WHERE rownum <=' + options.limit + ')';
        } else {
          //No where clause, create one
          limit = ' WHERE rowid IN(SELECT rowid FROM <%= table %> WHERE rownum <=' + options.limit + ')';
        }
    }

    var replacements = {
      limit : limit,
      table: table,
      where: where,
    };

    if (replacements.where) {
      replacements.where = ' WHERE ' + replacements.where;
    }

    return Utils._.template(query)(replacements);
  },

  showIndexesQuery: function(tableName) {
    var sql = "SELECT INDEX_NAME, INDEX_TYPE, TABLE_OWNER, UNIQUENESS, STATUS, NUM_ROWS, SAMPLE_SIZE, PARTITIONED, GENERATED," +
     " INDEXING FROM USER_INDEXES WHERE table_name=UPPER(\'<%= tableName %>\');";
    return Utils._.template(sql)({
      tableName: tableName
    });
  },

  removeIndexQuery: function(tableName, indexNameOrAttributes) {
    var sql = 'DROP INDEX <%= indexName %>'
      , indexName = indexNameOrAttributes;

    if (typeof indexName !== 'string') {
      indexName = Utils.inflection.underscore(tableName + '_' + indexNameOrAttributes.join('_'));
    }

    var values = {
      tableName: tableName,
      indexName: indexName
    };

    return Utils._.template(sql)(values);
  },

  attributeToSQL: function(attribute) {
    if (!Utils._.isPlainObject(attribute)) {
      attribute = {
        type: attribute
      };
    }

    // handle self referential constraints
    if (attribute.references) {
      attribute = Utils.formatReferences(attribute);

      if (attribute.Model && attribute.Model.tableName === attribute.references.model) {
        this.sequelize.log('MSSQL does not support self referencial constraints, '
          + 'we will remove it but we recommend restructuring your query');
        attribute.onDelete = '';
        attribute.onUpdate = '';
      }
    }

    var template;

    if (attribute.type instanceof DataTypes.ENUM) {
      if (attribute.type.values && !attribute.values) attribute.values = attribute.type.values;

      // enums are a special case
      template = attribute.type.toSql();
      template += ' CHECK (' + attribute.field + ' IN(' + Utils._.map(attribute.values, function(value) {
        return this.escape(value);
      }.bind(this)).join(', ') + '))';
      return template;
    } else {
      template = attribute.type.toString();
    }

    //If autoincrement, not null is setted automatically
    if (attribute.autoIncrement) {
      template += ' GENERATED BY DEFAULT ON NULL AS IDENTITY';
    } else {
      if (attribute.allowNull === false) {
        template += ' NOT NULL';
      } else if (!attribute.primaryKey && !Utils.defaultValueSchemable(attribute.defaultValue)) {
        template += ' NULL';
      }
    }

    // Blobs/texts cannot have a defaultValue
    if (attribute.type !== 'TEXT' && attribute.type._binary !== true &&
        Utils.defaultValueSchemable(attribute.defaultValue)) {
      template += ' DEFAULT ' + this.escape(attribute.defaultValue);
    }

    if (attribute.unique === true) {
      template += ' UNIQUE';
    }

    if (attribute.primaryKey) {
      template += ' PRIMARY KEY';
    }

    if (attribute.references) {
      template += ' REFERENCES ' + attribute.references.model;

      if (attribute.references.key) {
        template += ' (' + attribute.references.key + ')';
      } else {
        template += ' (' + 'id' + ')';
      }

      if (attribute.onDelete) {
        template += ' ON DELETE ' + attribute.onDelete.toUpperCase();
      }

      if (attribute.onUpdate) {
        template += ' ON UPDATE ' + attribute.onUpdate.toUpperCase();
      }
    }

    return template;
  },

  attributesToSQL: function(attributes, options) {
    var result = {}
      , key
      , attribute
      , existingConstraints = [];

    for (key in attributes) {
      attribute = attributes[key];

      if (attribute.references) {
        attribute = Utils.formatReferences(attributes[key]);

        if (existingConstraints.indexOf(attribute.references.model.toString()) !== -1) {
          // no cascading constraints to a table more than once
          attribute.onDelete = '';
          attribute.onUpdate = '';
        } else {
          existingConstraints.push(attribute.references.model.toString());
        }

      }

      if (key && !attribute.field) attribute.field = key;
      result[attribute.field || key] = this.attributeToSQL(attribute, options);
    }

    return result;
  },

  findAutoIncrementField: function(factory) {
    var fields = [];
    for (var name in factory.attributes) {
      if (factory.attributes.hasOwnProperty(name)) {
        var definition = factory.attributes[name];

        if (definition && definition.autoIncrement) {
          fields.push(name);
        }
      }
    }

    return fields;
  },

  createTrigger: function() {
    throwMethodUndefined('createTrigger');
  },

  dropTrigger: function() {
    throwMethodUndefined('dropTrigger');
  },

  renameTrigger: function() {
    throwMethodUndefined('renameTrigger');
  },

  createFunction: function() {
    throwMethodUndefined('createFunction');
  },

  dropFunction: function() {
    throwMethodUndefined('dropFunction');
  },

  renameFunction: function() {
    throwMethodUndefined('renameFunction');
  },

  /*quoteIdentifier: function(identifier, force) {
      // if (identifier === '*') return identifier;
      // return '[' + identifier.replace(/[\[\]']+/g,'') + ']';
      return "\"" + identifier + "\"";
  },*/

  quoteIdentifier: function(identifier, force) {
    if (identifier === '*') return identifier;
    // if (!force && this.options && this.options.quoteIdentifiers === false) { // default is `true`
    //   // In Postgres, if tables or attributes are created double-quoted,
    //   // they are also case sensitive. If they contain any uppercase
    //   // characters, they must always be double-quoted. This makes it
    //   // impossible to write queries in portable SQL if tables are created in
    //   // this way. Hence, we strip quotes if we don't want case sensitivity.
    //   return Utils.removeTicks(identifier, '"');
    // } else {
    //   return Utils.addTicks(identifier, '"');
    // }
    if(force === true) {
      return Utils.addTicks(identifier, '"');
    } else if(identifier.indexOf('.') > - 1) {
      return Utils.addTicks(identifier, '"');
    } else {
      return identifier;
    }
  },

//TODO
  getForeignKeysQuery: function(table) {
    
    var tableName = table.tableName || table;
    var sql = [
      'SELECT',
        'constraint_name = C.CONSTRAINT_NAME',
      'FROM',
        'INFORMATION_SCHEMA.TABLE_CONSTRAINTS C',
      "WHERE C.CONSTRAINT_TYPE = 'FOREIGN KEY'",
      'AND C.TABLE_NAME =', wrapSingleQuote(tableName)
    ].join(' ');

    if (table.schema) {
      sql += ' AND C.TABLE_SCHEMA =' + wrapSingleQuote(table.schema);
    }

    return sql;
  },


  quoteTable: function(param, as) {
    var table = '';


    if (_.isObject(param)) {
      if (this._dialect.supports.schemas) {
        if (param.schema) {
          table += this.quoteIdentifier(param.schema) + '.';
        }

        table += this.quoteIdentifier(param.tableName);
      } else {
        if (param.schema) {
          table += param.schema + (param.delimiter || '.');
        }

        table += param.tableName;
        table = this.quoteIdentifier(table);
      }


    } else {
      table = this.quoteIdentifier(param);
    }

    //Oracle don't support as for table aliases
    if (as) {
      if(as.indexOf('.') > - 1) {
        table += ' ' + this.quoteIdentifier(as, true);
      } else {
        table += ' ' + this.quoteIdentifier(as);
      }
    } else {
      if(table.indexOf('.') > - 1) {
        table = this.quoteIdentifier(table, true);
      }
    }

  

    return table;
  },

//TODO
  getForeignKeyQuery: function(table, attributeName) {
    var tableName = table.tableName || table;
    var sql = [
      'SELECT',
        'constraint_name = TC.CONSTRAINT_NAME',
      'FROM',
        'INFORMATION_SCHEMA.TABLE_CONSTRAINTS TC',
        'JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE CCU',
          'ON TC.CONSTRAINT_NAME = CCU.CONSTRAINT_NAME',
      "WHERE TC.CONSTRAINT_TYPE = 'FOREIGN KEY'",
      'AND TC.TABLE_NAME =', wrapSingleQuote(tableName),
      'AND CCU.COLUMN_NAME =', wrapSingleQuote(attributeName),
    ].join(' ');

    if (table.schema) {
      sql += ' AND TC.TABLE_SCHEMA =' + wrapSingleQuote(table.schema);
    }

    return sql;
  },

  dropForeignKeyQuery: function(tableName, foreignKey) {
    return this.dropConstraintQuery(tableName, foreignKey);
  },

//TODO
  getDefaultConstraintQuery: function (tableName, attributeName) {
    var sql = "SELECT name FROM SYS.DEFAULT_CONSTRAINTS " +
      "WHERE PARENT_OBJECT_ID = OBJECT_ID('<%= table %>', 'U') " +
      "AND PARENT_COLUMN_ID = (SELECT column_id FROM sys.columns WHERE NAME = ('<%= column %>') " +
      "AND object_id = OBJECT_ID('<%= table %>', 'U'));";
    return Utils._.template(sql)({
      table: tableName,
      column: attributeName
    });
  },

  dropConstraintQuery: function (tableName, constraintName) {
    var sql = 'ALTER TABLE <%= table %> DROP CONSTRAINT <%= constraint %>;';
    return Utils._.template(sql)({
      table: tableName,
      constraint: constraintName
    });
  },

  setAutocommitQuery: function(value) {
    return '';
    // return 'SET IMPLICIT_TRANSACTIONS ' + (!!value ? 'OFF' : 'ON') + ';';
  },

  setIsolationLevelQuery: function(value, options) {
    if (options.parent) {
      return;
    }

  //We force the transaction level to the highest to have consistent datas 
    return 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;';
  },

  startTransactionQuery: function(transaction, options) {
    if (transaction.parent) {
      return 'SAVE TRANSACTION ' + transaction.name + ';';
    }

    return 'BEGIN TRANSACTION;';
  },

  commitTransactionQuery: function(transaction) {
    if (transaction.parent) {
      return;
    }

    return 'COMMIT TRANSACTION;';
  },

  rollbackTransactionQuery: function(transaction, options) {
    if (transaction.parent) {
      return 'ROLLBACK TRANSACTION ' + transaction.name + ';';
    }

    return 'ROLLBACK TRANSACTION;';
  },

  selectFromTableFragment: function(options, model, attributes, tables, mainTableAs, where) {
    var topFragment = '';
    var mainFragment = 'SELECT ' + attributes.join(', ') + ' FROM ' + tables;

    if(mainTableAs) {
      mainFragment += " " + mainTableAs;
    }

    // Handle SQL Server 2008 with TOP instead of LIMIT
    /*if (semver.valid(this.sequelize.options.databaseVersion) && semver.lt(this.sequelize.options.databaseVersion, '11.0.0')) {
      if (options.limit) {
        topFragment = 'TOP ' + options.limit + ' ';
      }
      if (options.offset) {
        var offset = options.offset || 0
          , isSubQuery = options.hasIncludeWhere || options.hasIncludeRequired || options.hasMultiAssociation
          , orders = { mainQueryOrder: [] };
        if (options.order) {
          orders = this.getQueryOrders(options, model, isSubQuery);
        }

        if(!orders.mainQueryOrder.length) {
          orders.mainQueryOrder.push(model.primaryKeyField);
        }

        var tmpTable = (mainTableAs) ? mainTableAs : 'OffsetTable';
        var whereFragment = (where) ? ' WHERE ' + where : '';

        /*
         * For earlier versions of SQL server, we need to nest several queries
         * in order to emulate the OFFSET behavior.
         *
         * 1. The outermost query selects all items from the inner query block.
         *    This is due to a limitation in SQL server with the use of computed
         *    columns (e.g. SELECT ROW_NUMBER()...AS x) in WHERE clauses.
         * 2. The next query handles the LIMIT and OFFSET behavior by getting
         *    the TOP N rows of the query where the row number is > OFFSET
         * 3. The innermost query is the actual set we want information from
         */
        /*var fragment = 'SELECT TOP 100 PERCENT ' + attributes.join(', ') + ' FROM ' +
                        '(SELECT ' + topFragment + '*' +
                          ' FROM (SELECT ROW_NUMBER() OVER (ORDER BY ' + orders.mainQueryOrder.join(', ') + ') as row_num, * ' +
                            ' FROM ' + tables + ' AS ' + tmpTable + whereFragment + ')' +
                          ' AS ' + tmpTable + ' WHERE row_num > ' + offset + ')' +
                        ' AS ' + tmpTable;
        return fragment;
      } else {
        mainFragment = 'SELECT ' + topFragment + attributes.join(', ') + ' FROM ' + tables;
      }
    }*/


    return mainFragment;
  },

  addLimitAndOffset: function(options, model) {
    // Skip handling of limit and offset as postfixes for older SQL Server versions
    // if(semver.valid(this.sequelize.options.databaseVersion) && semver.lt(this.sequelize.options.databaseVersion, '12.1.0.2.0')) {
    //   return '';
    // }

    var fragment = '';
    var offset = options.offset || 0
      , isSubQuery = options.hasIncludeWhere || options.hasIncludeRequired || options.hasMultiAssociation;

    var orders = {};
    if (options.order) {
      orders = this.getQueryOrders(options, model, isSubQuery);
    }

    if (options.limit || options.offset) {
      if (!options.order || (options.include && !orders.subQueryOrder.length)) {
        fragment += (options.order && !isSubQuery) ? ', ' : ' ORDER BY ';
        fragment += model.primaryKeyField;
      }

      if (options.offset || options.limit) {
        fragment += ' OFFSET ' + this.escape(offset) + ' ROWS';
      }

      if (options.limit) {
        fragment += ' FETCH NEXT ' + this.escape(options.limit) + ' ROWS ONLY';
      }
    }

    return fragment;
  },

  booleanValue: function(value) {
    return !!value ? 1 : 0;
  }
};

// private methods
function wrapSingleQuote(identifier){
  return Utils.addTicks(identifier, "'");
}

module.exports = Utils._.extend(Utils._.clone(AbstractQueryGenerator), QueryGenerator);
