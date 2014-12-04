'use strict';

var Utils = require('../../utils')
  , SqlString = require('../../sql-string')
  , Model = require('../../model')
  , _ = require('lodash')
  , util = require('util');

module.exports = (function() {
  var QueryGenerator = {
    addSchema: function(param) {
      var self = this
        , schema = (!param.options && param.schema) || (param.options && param.options.schema ? param.options.schema : undefined)
        , schemaDelimiter = (param.options && param.options.schemaDelimiter ? param.options.schemaDelimiter : undefined);

      if (!schema) return param.tableName || param;

      return {
        tableName: param.tableName || param,
        table: param.tableName || param,
        name: param.name || param,
        schema: schema,
        delimiter: schemaDelimiter || '.',
        toString: function() {
          return self.quoteTable(this);
        }
      };
    },

    /*
      Returns a query for dropping a schema
    */
    dropSchema: function(tableName, options) {
      return this.dropTableQuery(tableName, options);
    },

    /*
      Returns a query for creating a table.
      Parameters:
        - tableName: Name of the new table.
        - attributes: An object with containing attribute-attributeType-pairs.
                      Attributes should have the format:
                      {attributeName: type, attr2: type2}
                      --> e.g. {title: 'VARCHAR(255)'}
        - options: An object with options.
                   Defaults: { engine: 'InnoDB', charset: null }
    */
    /* istanbul ignore next */
    createTableQuery: function(tableName, attributes, options) {
      throwMethodUndefined('createTableQuery');
    },

    describeTableQuery: function(tableName, schema, schemaDelimiter) {
      var table = this.quoteTable(
        this.addSchema({
          tableName: tableName,
          options: {
            schema: schema,
            schemaDelimiter: schemaDelimiter
          }
        })
      );

      return 'DESCRIBE ' + table + ';';
    },

    /*
      Returns a query for dropping a table.
    */
    dropTableQuery: function(tableName, options) {
      options = options || {};

      var query = 'DROP TABLE IF EXISTS <%= table %>;';

      return Utils._.template(query)({
        table: this.quoteTable(tableName)
      });
    },

    /*
      Returns a rename table query.
      Parameters:
        - originalTableName: Name of the table before execution.
        - futureTableName: Name of the table after execution.
    */
    renameTableQuery: function(before, after) {
      var query = 'ALTER TABLE <%= before %> RENAME TO <%= after %>;';
      return Utils._.template(query)({
        before: this.quoteTable(before),
        after: this.quoteTable(after)
      });
    },

    /*
      Returns a query, which gets all available table names in the database.
    */
    /* istanbul ignore next */
    showTablesQuery: function() {
      throwMethodUndefined('showTablesQuery');
    },

    /*
      Returns a query, which adds an attribute to an existing table.
      Parameters:
        - tableName: Name of the existing table.
        - attributes: A hash with attribute-attributeOptions-pairs.
          - key: attributeName
          - value: A hash with attribute specific options:
            - type: DataType
            - defaultValue: A String with the default value
            - allowNull: Boolean
    */
    /* istanbul ignore next */
    addColumnQuery: function(tableName, attributes) {
      throwMethodUndefined('addColumnQuery');
    },

    /*
      Returns a query, which removes an attribute from an existing table.
      Parameters:
        - tableName: Name of the existing table
        - attributeName: Name of the obsolete attribute.
    */
    /* istanbul ignore next */
    removeColumnQuery: function(tableName, attributeName) {
      throwMethodUndefined('removeColumnQuery');
    },

    /*
      Returns a query, which modifies an existing attribute from a table.
      Parameters:
        - tableName: Name of the existing table.
        - attributes: A hash with attribute-attributeOptions-pairs.
          - key: attributeName
          - value: A hash with attribute specific options:
            - type: DataType
            - defaultValue: A String with the default value
            - allowNull: Boolean
    */
    /* istanbul ignore next */
    changeColumnQuery: function(tableName, attributes) {
      throwMethodUndefined('changeColumnQuery');
    },

    /*
      Returns a query, which renames an existing attribute.
      Parameters:
        - tableName: Name of an existing table.
        - attrNameBefore: The name of the attribute, which shall be renamed.
        - attrNameAfter: The name of the attribute, after renaming.
    */
    /* istanbul ignore next */
    renameColumnQuery: function(tableName, attrNameBefore, attrNameAfter) {
      throwMethodUndefined('renameColumnQuery');
    },

    /*
      Returns an insert into command. Parameters: table name + hash of attribute-value-pairs.
    */
    insertQuery: function(table, valueHash, modelAttributes, options) {
      options = options || {};

      var query
        , valueQuery = 'INSERT<%= ignore %> INTO <%= table %> (<%= attributes %>)<%= output %> VALUES (<%= values %>)'
        , emptyQuery = 'INSERT<%= ignore %> INTO <%= table %><%= output %>'
        , outputFragment
        , fields = []
        , values = []
        , key
        , value
        , identityWrapperRequired = false
        , modelAttributeMap = {};

      if (modelAttributes) {
        Utils._.each(modelAttributes, function(attribute, key) {
          modelAttributeMap[key] = attribute;
          if (attribute.field) {
            modelAttributeMap[attribute.field] = attribute;
          }
        });
      }

      if (this._dialect.supports['DEFAULT VALUES']) {
        emptyQuery += ' DEFAULT VALUES';
      } else if (this._dialect.supports['VALUES ()']) {
        emptyQuery += ' VALUES ()';
      }

      // FIXME: ideally these two can be merged in the future, the only
      //        difference is placement of the value in the query
      if (this._dialect.supports['RETURNING'] && options.returning) {
        valueQuery += ' RETURNING *';
        emptyQuery += ' RETURNING *';
      } else if (this._dialect.supports['OUTPUT'] && options.returning) {
        outputFragment = ' OUTPUT INSERTED.*';
      }

      if (this._dialect.supports['EXCEPTION'] && options.exception) {
        // Mostly for internal use, so we expect the user to know what he's doing!
        // pg_temp functions are private per connection, so we never risk this function interfering with another one.
        valueQuery = 'CREATE OR REPLACE FUNCTION pg_temp.testfunc() RETURNS SETOF <%= table %> AS $body$ BEGIN RETURN QUERY ' + valueQuery + '; EXCEPTION ' + options.exception + ' END; $body$ LANGUAGE plpgsql; SELECT * FROM pg_temp.testfunc(); DROP FUNCTION IF EXISTS pg_temp.testfunc();';
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
            } else if (this._dialect.supports['DEFAULT']) {
              values.push('DEFAULT');
            } else {
              values.push(this.escape(null));
            }
          } else {
            if (modelAttributeMap && modelAttributeMap[key] && modelAttributeMap[key].autoIncrement === true) {
              identityWrapperRequired = true;
            }

            values.push(this.escape(value, (modelAttributeMap && modelAttributeMap[key]) || undefined));
          }
        }
      }

      var replacements = {
        ignore: options.ignore ? this._dialect.supports['IGNORE'] : '',
        table: this.quoteTable(table),
        attributes: fields.join(','),
        output: outputFragment,
        values: values.join(',')
      };

      query = (replacements.attributes.length ? valueQuery : emptyQuery) + ';';
      if (identityWrapperRequired && this._dialect.supports.autoIncrement.identityInsert) {
        query = [
          'SET IDENTITY_INSERT', this.quoteTable(table), 'ON;',
          query,
          'SET IDENTITY_INSERT', this.quoteTable(table), 'OFF;',
        ].join(' ');
      }

      return Utils._.template(query)(replacements);
    },
    /*
      Returns an insert into command for multiple values.
      Parameters: table name + list of hashes of attribute-value-pairs.
    */
    /* istanbul ignore next */
    bulkInsertQuery: function(tableName, attrValueHashes) {
      throwMethodUndefined('bulkInsertQuery');
    },

    /*
      Returns an update query.
      Parameters:
        - tableName -> Name of the table
        - values -> A hash with attribute-value-pairs
        - where -> A hash with conditions (e.g. {name: 'foo'})
                   OR an ID as integer
                   OR a string with conditions (e.g. 'name="foo"').
                   If you use a string, you have to escape it on your own.
    */
    updateQuery: function(tableName, attrValueHash, where, options, attributes) {
      options = options || {};
      _.defaults(options, this.options);

      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, options.omitNull, options);

      var query
        , values = []
        , outputFragment
        , modelAttributeMap = [];

      query = 'UPDATE <%= table %> SET <%= values %><%= output %> WHERE <%= where %>';

      if (this._dialect.supports['LIMIT ON UPDATE'] && options.limit) {
        query += ' LIMIT ' + this.escape(options.limit) + ' ';
      }

      if (this._dialect.supports['RETURNING'] && options.returning) {
        query += ' RETURNING *';
      } else if (this._dialect.supports['OUTPUT']) {
        outputFragment = ' OUTPUT INSERTED.*';
      }

      if (attributes) {
        Utils._.each(attributes, function(attribute, key) {
          modelAttributeMap[key] = attribute;
          if (attribute.field) {
            modelAttributeMap[attribute.field] = attribute;
          }
        });
      }

      for (var key in attrValueHash) {
        if (modelAttributeMap && modelAttributeMap[key] &&
            modelAttributeMap[key].autoIncrement === true &&
            !this._dialect.supports.autoIncrement.update) {
          // not allowed to update identity column
          continue;
        }

        var value = attrValueHash[key];
        values.push(this.quoteIdentifier(key) + '=' + this.escape(value, (!!attributes && !!attributes[key] ? attributes[key] : undefined)));
      }

      var replacements = {
        table: this.quoteTable(tableName),
        values: values.join(','),
        output: outputFragment,
        where: this.getWhereConditions(where)
      };

      if (values.length === 0) {
        return '';
      }

      return Utils._.template(query)(replacements);
    },

    /*
      Returns an upsert query.
    */
    upsertQuery: function (tableName, insertValues, updateValues, where, rawAttributes, options) {
      throwMethodUndefined('upsertQuery');
    },

    /*
      Returns a deletion query.
      Parameters:
        - tableName -> Name of the table
        - where -> A hash with conditions (e.g. {name: 'foo'})
                   OR an ID as integer
                   OR a string with conditions (e.g. 'name="foo"').
                   If you use a string, you have to escape it on your own.
      Options:
        - limit -> Maximaum count of lines to delete
        - truncate -> boolean - whether to use an 'optimized' mechanism (i.e. TRUNCATE) if available,
                                note that this should not be the default behaviour because TRUNCATE does not
                                always play nicely (e.g. InnoDB tables with FK constraints)
                                (@see http://dev.mysql.com/doc/refman/5.6/en/truncate-table.html).
                                Note that truncate must ignore limit and where
    */
    /* istanbul ignore next */
    deleteQuery: function(tableName, where, options) {
      throwMethodUndefined('deleteQuery');
    },

    /*
      Returns an update query.
      Parameters:
        - tableName -> Name of the table
        - values -> A hash with attribute-value-pairs
        - where -> A hash with conditions (e.g. {name: 'foo'})
                   OR an ID as integer
                   OR a string with conditions (e.g. 'name="foo"').
                   If you use a string, you have to escape it on your own.
    */
    incrementQuery: function(tableName, attrValueHash, where, options) {
      attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull);

      var query
        , key
        , value
        , values = [];

      query = 'UPDATE <%= table %> SET <%= values %> WHERE <%= where %>';
      if (this._dialect.supports['RETURNING']) {
        query += ' RETURNING *';
      }

      for (key in attrValueHash) {
        value = attrValueHash[key];
        values.push(this.quoteIdentifier(key) + '=' + this.quoteIdentifier(key) + ' + ' + this.escape(value));
      }

      options = options || {};
      for (key in options) {
        value = options[key];
        values.push(this.quoteIdentifier(key) + '=' + this.escape(value));
      }

      var replacements = {
        table: this.quoteTable(tableName),
        values: values.join(','),
        where: this.getWhereConditions(where)
      };

      return Utils._.template(query)(replacements);
    },

    nameIndexes: function (indexes, rawTablename) {
      return Utils._.map(indexes, function (index) {
        if (!index.hasOwnProperty('name')) {
          var onlyAttributeNames = index.fields.map(function(attribute) {
            return (typeof attribute === 'string') ? attribute : attribute.attribute;
          }.bind(this));

          index.name = Utils.inflection.underscore(rawTablename + '_' + onlyAttributeNames.join('_'));
        }

        return index;
      });
    },

    /*
      Returns an add index query.
      Parameters:
        - tableName -> Name of an existing table, possibly with schema.
        - attributes:
            An array of attributes as string or as hash.
            If the attribute is a hash, it must have the following content:
              - attribute: The name of the attribute/column
              - length: An integer. Optional
              - order: 'ASC' or 'DESC'. Optional
        - options:
          - indicesType: UNIQUE|FULLTEXT|SPATIAL
          - indexName: The name of the index. Default is <tableName>_<attrName1>_<attrName2>
          - parser
        - rawTablename, the name of the table, without schema. Used to create the name of the index
    */
    addIndexQuery: function(tableName, attributes, options, rawTablename) {
      options = options || {};

      var transformedAttributes = attributes.map(function(attribute) {
        if (typeof attribute === 'string') {
          return this.quoteIdentifier(attribute);
        } else {
          var result = '';

          if (!attribute.attribute) {
            throw new Error('The following index attribute has no attribute: ' + util.inspect(attribute));
          }

          result += this.quoteIdentifier(attribute.attribute);

          if (this._dialect.supports.index.collate && attribute.collate) {
            result += ' COLLATE ' + this.quoteIdentifier(attribute.collate);
          }

          if (this._dialect.supports.index.length && attribute.length) {
            result += '(' + attribute.length + ')';
          }

          if (attribute.order) {
            result += ' ' + attribute.order;
          }

          return result;
        }
      }.bind(this));

      if (!options.name) {
        // Mostly for cases where addIndex is called directly by the user without an options object (for example in migrations)
        // All calls that go through sequelize should already have a name
        options.fields = options.fields || attributes;
        options = this.nameIndexes([options], rawTablename)[0];
      }

      options = Utils._.defaults(options, {
        type: '',
        indicesType: options.type || '',
        indexType: options.method || undefined,
        indexName: options.name,
        parser: null
      });

      if (options.indicesType.toLowerCase() === 'unique') {
        options.unique = true;
        delete options.indicesType;
      }

      if (!this._dialect.supports.index.type) {
        delete options.indicesType;
      }

      return Utils._.compact([
        'CREATE',
        options.unique ? 'UNIQUE' : '',
        options.indicesType, 'INDEX',
        this._dialect.supports.index.concurrently && options.concurrently ? 'CONCURRENTLY' : undefined,
        this.quoteIdentifiers(options.indexName),
        this._dialect.supports.index.using === 1 && options.indexType ? 'USING ' + options.indexType : '',
        'ON', this.quoteIdentifiers(tableName),
        this._dialect.supports.index.using === 2 && options.indexType ? 'USING ' + options.indexType : '',
        '(' + transformedAttributes.join(', ') + ')',
        (this._dialect.supports.index.parser && options.parser ? 'WITH PARSER ' + options.parser : undefined)
      ]).join(' ');
    },

    /*
      Returns an show index query.
      Parameters:
        - tableName: Name of an existing table.
        - options:
          - database: Name of the database.
    */
    /* istanbul ignore next */
    showIndexQuery: function(tableName, options) {
      throwMethodUndefined('showIndexQuery');
    },

    /*
      Returns a remove index query.
      Parameters:
        - tableName: Name of an existing table.
        - indexNameOrAttributes: The name of the index as string or an array of attribute names.
    */
    /* istanbul ignore next */
    removeIndexQuery: function(tableName, indexNameOrAttributes) {
      throwMethodUndefined('removeIndexQuery');
    },

    /*
      This method transforms an array of attribute hashes into equivalent
      sql attribute definition.
    */
    /* istanbul ignore next */
    attributesToSQL: function(attributes) {
      throwMethodUndefined('attributesToSQL');
    },

    /*
      Returns all auto increment fields of a factory.
    */
    /* istanbul ignore next */
    findAutoIncrementField: function(factory) {
      throwMethodUndefined('findAutoIncrementField');
    },


    quoteTable: function(param, as) {
      var table = '';

      if (as === true) {
        as = param.as || param.name || param;
      }

      if (_.isObject(param)) {
        if (this._dialect.supports.schemas) {
          if (param.schema) {
            table += this.quoteIdentifier(param.schema) + '.';
          }

          table += this.quoteIdentifier(param.tableName);
        } else {
          if (param.schema) {
            table += param.schema + param.delimiter;
          }

          table += param.tableName;
          table = this.quoteIdentifier(table);
        }


      } else {
        table = this.quoteIdentifier(param);
      }

      if (as) {
        table += ' AS ' + this.quoteIdentifier(as);
      }
      return table;
    },

    /*
      Quote an object based on its type. This is a more general version of quoteIdentifiers
      Strings: should proxy to quoteIdentifiers
      Arrays:
        * Expects array in the form: [<model> (optional), <model> (optional),... String, String (optional)]
          Each <model> can be a model or an object {model: Model, as: String}, matching include
        * Zero or more models can be included in the array and are used to trace a path through the tree of
          included nested associations. This produces the correct table name for the ORDER BY/GROUP BY SQL
          and quotes it.
        * If a single string is appended to end of array, it is quoted.
          If two strings appended, the 1st string is quoted, the 2nd string unquoted.
      Objects:
        * If raw is set, that value should be returned verbatim, without quoting
        * If fn is set, the string should start with the value of fn, starting paren, followed by
          the values of cols (which is assumed to be an array), quoted and joined with ', ',
          unless they are themselves objects
        * If direction is set, should be prepended

      Currently this function is only used for ordering / grouping columns and Sequelize.col(), but it could
      potentially also be used for other places where we want to be able to call SQL functions (e.g. as default values)
    */
    quote: function(obj, parent, force) {
      if (Utils._.isString(obj)) {
        return this.quoteIdentifiers(obj, force);
      } else if (Array.isArray(obj)) {
        // loop through array, adding table names of models to quoted
        // (checking associations to see if names should be singularised or not)
        var tableNames = []
          , parentAssociation
          , len = obj.length
          , item
          , model
          , as
          , association;
        for (var i = 0; i < len - 1; i++) {
          item = obj[i];
          if (item._modelAttribute || Utils._.isString(item) || item._isSequelizeMethod || 'raw' in item) {
            break;
          }

          if (item instanceof Model) {
            model = item;
            as = undefined;
          } else {
            model = item.model;
            as = item.as;
          }

          // check if model provided is through table
          if (!as && parentAssociation && parentAssociation.through && parentAssociation.through.model === model) {
            association = {as: model.name};
          } else {
            // find applicable association for linking parent to this model
            association = parent.getAssociation(model, as);
          }

          if (association) {
            tableNames[i] = association.as;
            parent = model;
            parentAssociation = association;
          } else {
            tableNames[i] = model.tableName;
            throw new Error('\'' + tableNames.join('.') + '\' in order / group clause is not valid association');
          }
        }

        // add 1st string as quoted, 2nd as unquoted raw
        var sql = (i > 0 ? this.quoteIdentifier(tableNames.join('.')) + '.' : (Utils._.isString(obj[0]) ? this.quoteIdentifier(parent.name) + '.' : '')) + this.quote(obj[i], parent, force);
        if (i < len - 1) {
          sql += ' ' + obj[i + 1];
        }
        return sql;
      } else if (obj._modelAttribute) {
        return this.quoteTable(obj.Model.name) + '.' + obj.fieldName;
      } else if (obj._isSequelizeMethod) {
        return this.handleSequelizeMethod(obj);
      } else if (Utils._.isObject(obj) && 'raw' in obj) {
        return obj.raw;
      } else {
        throw new Error('Unknown structure passed to order / group: ' + JSON.stringify(obj));
      }
    },

    /*
     Create a trigger
     */
    /* istanbul ignore next */
    createTrigger: function(tableName, triggerName, timingType, fireOnArray, functionName, functionParams,
        optionsArray) {
      throwMethodUndefined('createTrigger');
    },

    /*
     Drop a trigger
     */
    /* istanbul ignore next */
    dropTrigger: function(tableName, triggerName) {
      throwMethodUndefined('dropTrigger');
    },

    /*
     Rename a trigger
    */
    /* istanbul ignore next */
    renameTrigger: function(tableName, oldTriggerName, newTriggerName) {
      throwMethodUndefined('renameTrigger');
    },

    /*
     Create a function
     */
    /* istanbul ignore next */
    createFunction: function(functionName, params, returnType, language, body, options) {
      throwMethodUndefined('createFunction');
    },

    /*
     Drop a function
     */
    /* istanbul ignore next */
    dropFunction: function(functionName, params) {
      throwMethodUndefined('dropFunction');
    },

    /*
     Rename a function
     */
    /* istanbul ignore next */
    renameFunction: function(oldFunctionName, params, newFunctionName) {
      throwMethodUndefined('renameFunction');
    },

    /*
      Escape an identifier (e.g. a table or attribute name)
    */
    /* istanbul ignore next */
    quoteIdentifier: function(identifier, force) {
      throwMethodUndefined('quoteIdentifier');
    },

    /*
      Split an identifier into .-separated tokens and quote each part
    */
    quoteIdentifiers: function(identifiers, force) {
      if (identifiers.indexOf('.') !== -1) {
        identifiers = identifiers.split('.');
        return this.quoteIdentifier(identifiers.slice(0, identifiers.length - 1).join('.')) + '.' + this.quoteIdentifier(identifiers[identifiers.length - 1]);
      } else {
        return this.quoteIdentifier(identifiers);
      }
    },

    /*
      Escape a value (e.g. a string, number or date)
    */
    escape: function(value, field) {
      if (value && value._isSequelizeMethod) {
        return this.handleSequelizeMethod(value);
      } else {
        return SqlString.escape(value, false, this.options.timezone, this.dialect, field);
      }
    },

    /**
     * Generates an SQL query that returns all foreign keys of a table.
     *
     * @param  {String} tableName  The name of the table.
     * @param  {String} schemaName The name of the schema.
     * @return {String}            The generated sql query.
     */
    /* istanbul ignore next */
    getForeignKeysQuery: function(tableName, schemaName) {
      throwMethodUndefined('getForeignKeysQuery');
    },

    /**
     * Generates an SQL query that removes a foreign key from a table.
     *
     * @param  {String} tableName  The name of the table.
     * @param  {String} foreignKey The name of the foreign key constraint.
     * @return {String}            The generated sql query.
     */
    /* istanbul ignore next */
    dropForeignKeyQuery: function(tableName, foreignKey) {
      throwMethodUndefined('dropForeignKeyQuery');
    },


    /*
      Returns a query for selecting elements in the table <tableName>.
      Options:
        - attributes -> An array of attributes (e.g. ['name', 'birthday']). Default: *
        - where -> A hash with conditions (e.g. {name: 'foo'})
                   OR an ID as integer
                   OR a string with conditions (e.g. 'name="foo"').
                   If you use a string, you have to escape it on your own.
        - order -> e.g. 'id DESC'
        - group
        - limit -> The maximum count you want to get.
        - offset -> An offset value to start from. Only useable with limit!
    */

    selectQuery: function(tableName, options, model) {
      // Enter and change at your own peril -- Mick Hansen

      options = options || {};

      var table = null
        , self = this
        , query
        , limit = options.limit
        , mainModel = model
        , mainQueryItems = []
        , mainAttributes = options.attributes && options.attributes.slice(0)
        , mainJoinQueries = []
        // We'll use a subquery if we have hasMany associations and a limit and a filtered/required association
        , subQuery = options.subQuery === undefined ?
                     limit && (options.hasIncludeWhere || options.hasIncludeRequired || options.hasMultiAssociation) && options.subQuery !== false :
                     options.subquery
        , subQueryItems = []
        , subQueryAttributes = null
        , subJoinQueries = []
        , mainTableAs = null;

      if (options.tableAs) {
        mainTableAs = this.quoteTable(options.tableAs);
      } else if (!Array.isArray(tableName) && model) {
        options.tableAs = mainTableAs = this.quoteTable(model.name);
      }

      options.table = table = !Array.isArray(tableName) ? this.quoteTable(tableName) : tableName.map(function(t) {
        if (Array.isArray(t)) {
          return this.quoteTable(t[0], t[1]);
        }
        return this.quoteTable(t, true);
      }.bind(this)).join(', ');

      if (subQuery && mainAttributes) {
        model.primaryKeyAttributes.forEach(function(keyAtt) {
          // Check if mainAttributes contain the primary key of the model either as a field or an aliased field
          if (!_.find(mainAttributes, function (attr) {
            return keyAtt === attr || keyAtt === attr[0] || keyAtt === attr[1];
          })) {
            mainAttributes.push(model.rawAttributes[keyAtt].field ? [keyAtt, model.rawAttributes[keyAtt].field] : keyAtt);
          }
        });
      }

      // Escape attributes
      mainAttributes = mainAttributes && mainAttributes.map(function(attr) {
        var addTable = true;

        if (attr._isSequelizeMethod) {
          return self.handleSequelizeMethod(attr);
        }

        if (Array.isArray(attr) && attr.length === 2) {
          if (attr[0]._isSequelizeMethod) {
            attr[0] = self.handleSequelizeMethod(attr[0]);
            addTable = false;
          } else {
            if (attr[0].indexOf('(') === -1 && attr[0].indexOf(')') === -1) {
              attr[0] = self.quoteIdentifier(attr[0]);
            }
          }
          attr = [attr[0], self.quoteIdentifier(attr[1])].join(' AS ');
        } else {
          attr = attr.indexOf(Utils.TICK_CHAR) < 0 && attr.indexOf('"') < 0 ? self.quoteIdentifiers(attr) : attr;
        }

        if (options.include && attr.indexOf('.') === -1 && addTable) {
          attr = mainTableAs + '.' + attr;
        }
        return attr;
      });

      // If no attributes specified, use *
      mainAttributes = mainAttributes || (options.include ? [mainTableAs + '.*'] : ['*']);

      // If subquery, we ad the mainAttributes to the subQuery and set the mainAttributes to select * from subquery
      if (subQuery) {
        // We need primary keys
        subQueryAttributes = mainAttributes;
        mainAttributes = [mainTableAs + '.*'];
      }

      if (options.include) {
        var generateJoinQueries = function(include, parentTable) {
          var table = include.model.getTableName()
            , as = include.as
            , joinQueryItem = ''
            , joinQueries = {
              mainQuery: [],
              subQuery: []
            }
            , attributes
            , association = include.association
            , through = include.through
            , joinType = include.required ? ' INNER JOIN ' : ' LEFT OUTER JOIN '
            , includeWhere = {}
            , whereOptions = Utils._.clone(options);

          whereOptions.keysEscaped = true;

          if (tableName !== parentTable && mainTableAs !== parentTable) {
            as = parentTable + '.' + include.as;
          }

          // includeIgnoreAttributes is used by aggregate functions
          if (options.includeIgnoreAttributes !== false) {

            attributes = include.attributes.map(function(attr) {
              var attrAs = attr,
                  verbatim = false;

              if (Array.isArray(attr) && attr.length === 2) {
                if (attr[0]._isSequelizeMethod) {
                  if (attr[0] instanceof Utils.literal ||
                    attr[0] instanceof Utils.cast ||
                    attr[0] instanceof Utils.fn
                  ) {
                    verbatim = true;
                  }
                }

                attr = attr.map(function($attr) {
                  return $attr._isSequelizeMethod ? self.handleSequelizeMethod($attr) : $attr;
                });

                attrAs = attr[1];
                attr = attr[0];
              } else if (attr instanceof Utils.literal) {
                return attr.val; // We trust the user to rename the field correctly
              } else if (attr instanceof Utils.cast ||
                attr instanceof Utils.fn
              ) {
                throw new Error("Tried to select attributes using Sequelize.cast or Sequelize.fn without specifying an alias for the result, during eager loading. " +
                  "This means the attribute will not be added to the returned instance");
              }

              var prefix;
              if (verbatim === true) {
                prefix = attr;
              } else {
                prefix = self.quoteIdentifier(as) + '.' + self.quoteIdentifier(attr);
              }
              return prefix + ' AS ' + self.quoteIdentifier(as + '.' + attrAs);
            });
            if (include.subQuery && subQuery) {
              subQueryAttributes = subQueryAttributes.concat(attributes);
            } else {
              mainAttributes = mainAttributes.concat(attributes);
            }
          }

          if (through) {
            var throughTable = through.model.getTableName()
              , throughAs = as + '.' + through.as
              , throughAttributes = through.attributes.map(function(attr) {
                return self.quoteIdentifier(throughAs) + '.' + self.quoteIdentifier(Array.isArray(attr) ? attr[0] : attr) +
                       ' AS ' +
                       self.quoteIdentifier(throughAs + '.' + (Array.isArray(attr) ? attr[1] : attr));
              })
              , primaryKeysSource = association.source.primaryKeyAttributes
              , tableSource = parentTable
              , identSource = association.identifierField
              , attrSource = association.source.rawAttributes[primaryKeysSource[0]].field || primaryKeysSource[0]
              , where

              , primaryKeysTarget = association.target.primaryKeyAttributes
              , tableTarget = as
              , identTarget = association.foreignIdentifierField
              , attrTarget = association.target.rawAttributes[primaryKeysTarget[0]].field || primaryKeysTarget[0]

              , sourceJoinOn
              , targetJoinOn
              , targetWhere;

            if (options.includeIgnoreAttributes !== false) {
              // Through includes are always hasMany, so we need to add the attributes to the mainAttributes no matter what (Real join will never be executed in subquery)
              mainAttributes = mainAttributes.concat(throughAttributes);
            }

            // Filter statement for left side of through
            // Used by both join and subquery where
            sourceJoinOn = self.quoteTable(tableSource) + '.' + self.quoteIdentifier(attrSource) + ' = ';
            sourceJoinOn += self.quoteIdentifier(throughAs) + '.' + self.quoteIdentifier(identSource);

            // Filter statement for right side of through
            // Used by both join and subquery where
            targetJoinOn = self.quoteIdentifier(tableTarget) + '.' + self.quoteIdentifier(attrTarget) + ' = ';
            targetJoinOn += self.quoteIdentifier(throughAs) + '.' + self.quoteIdentifier(identTarget);

            if (self._dialect.supports.joinTableDependent) {
              // Generate a wrapped join so that the through table join can be dependent on the target join
              joinQueryItem += joinType + '(';
              joinQueryItem += self.quoteTable(throughTable, throughAs);
              joinQueryItem += joinType + self.quoteTable(table, as) + ' ON ';
              joinQueryItem += targetJoinOn;
              joinQueryItem += ') ON '+sourceJoinOn;
            } else {
              // Generate join SQL for left side of through
              joinQueryItem += joinType + self.quoteTable(throughTable, throughAs)  + ' ON ';
              joinQueryItem += sourceJoinOn;

              // Generate join SQL for right side of through
              joinQueryItem += joinType + self.quoteTable(table, as) + ' ON ';
              joinQueryItem += targetJoinOn;
            }

            if (include.where) {
              targetWhere = self.getWhereConditions(include.where, self.sequelize.literal(self.quoteIdentifier(as)), include.model, whereOptions);
              joinQueryItem += ' AND ' + targetWhere;
              if (subQuery && include.required) {
                if (!options.where) options.where = {};
                (function (include) {
                  // Closure to use sane local variables

                  var parent = include
                    , child = include
                    , nestedIncludes = []
                    , topParent
                    , topInclude
                    , $query;

                  while (parent = parent.parent) {
                    nestedIncludes = [_.extend({}, child, {include: nestedIncludes})];
                    child = parent;
                  }

                  topInclude = nestedIncludes[0];
                  topParent = topInclude.parent;

                  if (topInclude.through && Object(topInclude.through.model) === topInclude.through.model) {
                    $query = self.selectQuery(topInclude.through.model.getTableName(), {
                      attributes: [topInclude.through.model.primaryKeyAttributes[0]],
                      include: [{
                        model: topInclude.model,
                        as: topInclude.model.name,
                        attributes: [],
                        association: {
                          associationType: 'BelongsTo',
                          isSingleAssociation: true,
                          source: topInclude.association.target,
                          target: topInclude.association.source,
                          identifier: topInclude.association.foreignIdentifier,
                          identifierField: topInclude.association.foreignIdentifierField
                        },
                        required: true,
                        include: topInclude.include,
                        _pseudo: true
                      }],
                      where: {
                        $join: self.sequelize.asIs([
                          self.quoteTable(topParent.model.name) + '.' + self.quoteIdentifier(topParent.model.primaryKeyAttributes[0]),
                          self.quoteIdentifier(topInclude.through.model.name) + '.' + self.quoteIdentifier(topInclude.association.identifierField)
                        ].join(" = "))
                      },
                      limit: 1,
                      includeIgnoreAttributes: false
                    }, topInclude.through.model);
                  } else {
                    $query = self.selectQuery(topInclude.model.tableName, {
                      attributes: [topInclude.model.primaryKeyAttributes[0]],
                      include: topInclude.include,
                      where: {
                        $join: self.sequelize.asIs([
                          self.quoteTable(topParent.model.name) + '.' + self.quoteIdentifier(topParent.model.primaryKeyAttributes[0]),
                          self.quoteIdentifier(topInclude.model.name) + '.' + self.quoteIdentifier(topInclude.association.identifierField)
                        ].join(" = "))
                      },
                      limit: 1,
                      includeIgnoreAttributes: false
                    }, topInclude.model);
                  }

                  options.where['__' + throughAs] = self.sequelize.asIs([
                    '(',
                      $query.replace(/\;$/, ""),
                    ')',
                    'IS NOT NULL'
                  ].join(' '));
                })(include);
              }
            }
          } else {
            var left = association.source
              , right = association.target
              , primaryKeysLeft = left.primaryKeyAttributes
              , primaryKeysRight = right.primaryKeyAttributes
              , tableLeft = parentTable
              , attrLeft = association.associationType === 'BelongsTo' ?
                           association.identifierField || association.identifier :
                           primaryKeysLeft[0]

              , tableRight = as
              , attrRight = association.associationType !== 'BelongsTo' ?
                            association.identifierField || association.identifier :
                            right.rawAttributes[primaryKeysRight[0]].field || primaryKeysRight[0]
              , joinOn;

            // Filter statement
            // Used by both join and subquery where
            if (subQuery && !include.subQuery && include.parent.subQuery && (include.hasParentRequired || include.hasParentWhere || include.parent.hasIncludeRequired || include.parent.hasIncludeWhere)) {
              joinOn = self.quoteIdentifier(tableLeft + '.' + attrLeft);
            } else {
              if (association.associationType !== 'BelongsTo') {
                // Alias the left attribute if the left attribute is not from a subqueried main table
                // When doing a query like SELECT aliasedKey FROM (SELECT primaryKey FROM primaryTable) only aliasedKey is available to the join, this is not the case when doing a regular select where you can't used the aliased attribute
                if (!subQuery || (subQuery && !include.subQuery && include.parent.model !== mainModel)) {
                  if (left.rawAttributes[attrLeft].field) {
                    attrLeft = left.rawAttributes[attrLeft].field;
                  }
                }
              }
              joinOn = self.quoteTable(tableLeft) + '.' + self.quoteIdentifier(attrLeft);
            }

            joinOn += ' = ' + self.quoteTable(tableRight) + '.' + self.quoteIdentifier(attrRight);

            if (include.where) {
              joinOn += ' AND ' + self.getWhereConditions(include.where, self.sequelize.literal(self.quoteIdentifier(as)), include.model, whereOptions);
            }

            // If its a multi association and the main query is a subquery (because of limit) we need to filter based on this association in a subquery
            if (subQuery && association.isMultiAssociation && include.required) {
              if (!options.where) options.where = {};
              // Creating the as-is where for the subQuery, checks that the required association exists
              var $query = self.selectQuery(include.model.getTableName(), {
                tableAs: as,
                attributes: [attrRight],
                where: self.sequelize.asIs([joinOn]),
                limit: 1
              }, include.model);

              options.where['__' + as] = self.sequelize.asIs([
                '(',
                  $query.replace(/\;$/, ""),
                ')',
                'IS NOT NULL'
              ].join(' '));
            }

            // Generate join SQL
            joinQueryItem += joinType + self.quoteTable(table, as) + ' ON ' + joinOn;
          }

          if (include.subQuery && subQuery) {
            joinQueries.subQuery.push(joinQueryItem);
          } else {
            joinQueries.mainQuery.push(joinQueryItem);
          }

          if (include.include) {
            include.include.forEach(function(childInclude) {
              if (childInclude._pseudo) return;
              var childJoinQueries = generateJoinQueries(childInclude, as);

              if (childInclude.subQuery && subQuery) {
                joinQueries.subQuery = joinQueries.subQuery.concat(childJoinQueries.subQuery);
              }
              if (childJoinQueries.mainQuery) {
                joinQueries.mainQuery = joinQueries.mainQuery.concat(childJoinQueries.mainQuery);
              }

            }.bind(this));
          }

          return joinQueries;
        };

        // Loop through includes and generate subqueries
        options.include.forEach(function(include) {
          var joinQueries = generateJoinQueries(include, options.tableAs);

          subJoinQueries = subJoinQueries.concat(joinQueries.subQuery);
          mainJoinQueries = mainJoinQueries.concat(joinQueries.mainQuery);

        }.bind(this));
      }

      // If using subQuery select defined subQuery attributes and join subJoinQueries
      if (subQuery) {
        subQueryItems.push('SELECT ' + subQueryAttributes.join(', ') + ' FROM ' + options.table);
        if (mainTableAs) {
          subQueryItems.push(' AS ' + mainTableAs);
        }
        subQueryItems.push(subJoinQueries.join(''));

      // Else do it the reguar way
      } else {
        mainQueryItems.push('SELECT ' + mainAttributes.join(', ') + ' FROM ' + options.table);
        if (mainTableAs) {
          mainQueryItems.push(' AS ' + mainTableAs);
        }
        mainQueryItems.push(mainJoinQueries.join(''));
      }

      // Add WHERE to sub or main query
      if (options.hasOwnProperty('where')) {
        options.where = this.getWhereConditions(options.where, mainTableAs || tableName, model, options);
        if (options.where) {
          if (subQuery) {
            subQueryItems.push(' WHERE ' + options.where);
          } else {
            mainQueryItems.push(' WHERE ' + options.where);
          }
        }
      }

      // Add GROUP BY to sub or main query
      if (options.group) {
        options.group = Array.isArray(options.group) ? options.group.map(function(t) { return this.quote(t, model); }.bind(this)).join(', ') : options.group;
        if (subQuery) {
          subQueryItems.push(' GROUP BY ' + options.group);
        } else {
          mainQueryItems.push(' GROUP BY ' + options.group);
        }
      }

      // Add HAVING to sub or main query
      if (options.hasOwnProperty('having')) {
        options.having = this.getWhereConditions(options.having, tableName, model, options, false);
        if (subQuery) {
          subQueryItems.push(' HAVING ' + options.having);
        } else {
          mainQueryItems.push(' HAVING ' + options.having);
        }
      }
      // Add ORDER to sub or main query
      if (options.order) {
        var mainQueryOrder = [];
        var subQueryOrder = [];

        if (Array.isArray(options.order)) {
          options.order.forEach(function(t) {
            if (subQuery && !(t[0] instanceof Model) && !(t[0].model instanceof Model)) {
              subQueryOrder.push(this.quote(t, model));
            }
            mainQueryOrder.push(this.quote(t, model));
          }.bind(this));
        } else {
          mainQueryOrder.push(options.order);
        }

        if (mainQueryOrder.length) {
          mainQueryItems.push(' ORDER BY ' + mainQueryOrder.join(', '));
        }
        if (subQueryOrder.length) {
          subQueryItems.push(' ORDER BY ' + subQueryOrder.join(', '));
        }
      }

      // Add LIMIT, OFFSET to sub or main query
      var limitOrder = this.addLimitAndOffset(options, model);
      if (limitOrder) {
        if (subQuery) {
          subQueryItems.push(limitOrder);
        } else {
          mainQueryItems.push(limitOrder);
        }
      }

      // If using subQuery, select attributes from wrapped subQuery and join out join tables
      if (subQuery) {
        query = 'SELECT ' + mainAttributes.join(', ') + ' FROM (';
        query += subQueryItems.join('');
        query += ') AS ' + options.tableAs;
        query += mainJoinQueries.join('');
        query += mainQueryItems.join('');
      } else {
        query = mainQueryItems.join('');
      }

      if (options.lock && this._dialect.supports.lock) {
        if (options.lock === 'SHARE') {
          query += ' ' + this._dialect.supports.forShare;
        } else {
          query += ' FOR UPDATE';
        }
      }

      query += ';';

      return query;
    },

    /**
     * Returns a query that starts a transaction.
     *
     * @param  {Boolean} value   A boolean that states whether autocommit shall be done or not.
     * @param  {Object}  options An object with options.
     * @return {String}          The generated sql query.
     */
    setAutocommitQuery: function(value, options) {
      if (options.parent) {
        return;
      }

      return 'SET autocommit = ' + (!!value ? 1 : 0) + ';';
    },

    /**
     * Returns a query that sets the transaction isolation level.
     *
     * @param  {String} value   The isolation level.
     * @param  {Object} options An object with options.
     * @return {String}         The generated sql query.
     */
    setIsolationLevelQuery: function(value, options) {
      if (options.parent) {
        return;
      }

      return 'SET SESSION TRANSACTION ISOLATION LEVEL ' + value + ';';
    },

    /**
     * Returns a query that starts a transaction.
     *
     * @param  {Transaction} transaction
     * @param  {Object} options An object with options.
     * @return {String}         The generated sql query.
     */
    startTransactionQuery: function(transaction, options) {
      if (options.parent) {
        return 'SAVEPOINT ' + this.quoteIdentifier(transaction.name) + ';';
      }

      return 'START TRANSACTION;';
    },

    /**
     * Returns a query that commits a transaction.
     *
     * @param  {Object} options An object with options.
     * @return {String}         The generated sql query.
     */
    commitTransactionQuery: function(options) {
      if (options.parent) {
        return;
      }

      return 'COMMIT;';
    },

    /**
     * Returns a query that rollbacks a transaction.
     *
     * @param  {Transaction} transaction
     * @param  {Object} options An object with options.
     * @return {String}         The generated sql query.
     */
    rollbackTransactionQuery: function(transaction, options) {
      if (options.parent) {
        return 'ROLLBACK TO SAVEPOINT ' + this.quoteIdentifier(transaction.name) + ';';
      }

      return 'ROLLBACK;';
    },

    /**
     * Returns an SQL fragment for adding result constraints
     *
     * @param  {Object} options An object with selectQuery options.
     * @param  {Object} options The model passed to the selectQuery.
     * @return {String}         The generated sql query.
     */
    addLimitAndOffset: function(options, model) {
      var fragment = '';
      if (options.offset && !options.limit) {
        fragment += ' LIMIT ' + options.offset + ', ' + 18440000000000000000;
      } else if (options.limit) {
        if (options.offset) {
          fragment += ' LIMIT ' + options.offset + ', ' + options.limit;
        } else {
          fragment += ' LIMIT ' + options.limit;
        }
      }

      return fragment;
    },

    handleSequelizeMethod: function (smth, tableName, factory, options, prepend) {
      var self = this
        , result;

      if ((smth instanceof Utils.and) || (smth instanceof Utils.or)) {
        var connector = (smth instanceof Utils.and) ? ' AND ' : ' OR ';

        result = smth.args.filter(function(arg) {
          return arg !== undefined;
        }).map(function(arg) {
          return self.getWhereConditions(arg, tableName, factory, options, prepend);
        }).join(connector);

        result = result.length && '(' + result + ')' || undefined;
      } else if (smth instanceof Utils.where) {
        var value = smth.logic
          , key
          , logic
          , _result = []
          , _value;

        if (smth.attribute._isSequelizeMethod) {
          key = this.getWhereConditions(smth.attribute, tableName, factory, options, prepend);
        } else {
          key = this.quoteTable(smth.attribute.Model.name) + '.' + this.quoteIdentifier(smth.attribute.field || smth.attribute.fieldName);
        }

        if (value._isSequelizeMethod) {
          value = this.getWhereConditions(value, tableName, factory, options, prepend);

          result = (value === 'NULL') ? key + ' IS NULL' : [key, value].join(smth.comparator);
        } else if (_.isPlainObject(value)) {
         result = this.plainObjectToWhere(value, key, key, factory).join(' AND ');
        } else {
          if (typeof value === 'boolean') {
            value = this.booleanValue(value);
          } else {
            value = this.escape(value);
          }

          result = (value === 'NULL') ? key + ' IS NULL' : [key, value].join(' ' + smth.comparator + ' ');
        }
      } else if (smth instanceof Utils.literal) {
        result = smth.val;
      } else if (smth instanceof Utils.cast) {
        if (smth.val._isSequelizeMethod) {
          result = this.handleSequelizeMethod(smth.val, tableName, factory, options, prepend);
        } else {
          result = this.escape(smth.val);
        }

        result = 'CAST(' + result + ' AS ' + smth.type.toUpperCase() + ')';
      } else if (smth instanceof Utils.fn) {
        result = smth.fn + '(' + smth.args.map(function(arg) {
          if (arg._isSequelizeMethod) {
            return self.handleSequelizeMethod(arg, tableName, factory, options, prepend);
          } else {
            return self.escape(arg);
          }
        }).join(', ') + ')';
      } else if (smth instanceof Utils.col) {
        if (Array.isArray(smth.col)) {
          if (!factory) {
            throw new Error('Cannot call Sequelize.col() with array outside of order / group clause');
          }
        } else if (smth.col.indexOf('*') === 0) {
          return '*';
        }
        return this.quote(smth.col, factory);
      } else {
        result = smth.toString(this, factory);
      }

      return result;
    },

    /*
      Takes something and transforms it into values of a where condition.
    */
    getWhereConditions: function(smth, tableName, factory, options, prepend) {
      var result = null
        , where = {}
        , self = this;

      if (Array.isArray(tableName)) {
        tableName = tableName[0];
        if (Array.isArray(tableName)) {
          tableName = tableName[1];
        }
      }

      options = options || {};

      if (typeof prepend === 'undefined') {
        prepend = true;
      }

      if (smth && smth._isSequelizeMethod === true) { // Checking a property is cheaper than a lot of instanceof calls
        result = this.handleSequelizeMethod(smth, tableName, factory, options, prepend);
      } else if (Utils._.isPlainObject(smth)) {
        if (prepend) {
          if (tableName) options.keysEscaped = true;
          smth = this.prependTableNameToHash(tableName, smth);
        }
        result = this.hashToWhereConditions(smth, factory, options);
      } else if (typeof smth === 'number') {
        var primaryKeys = !!factory ? Object.keys(factory.primaryKeys) : [];

        if (primaryKeys.length > 0) {
          // Since we're just a number, assume only the first key
          primaryKeys = primaryKeys[0];
        } else {
          primaryKeys = 'id';
        }

        where[primaryKeys] = smth;

        if (tableName) options.keysEscaped = true;
        smth = this.prependTableNameToHash(tableName, where);
        result = this.hashToWhereConditions(smth);
      } else if (typeof smth === 'string') {
        result = smth;
      } else if (Buffer.isBuffer(smth)) {
        result = this.escape(smth);
      } else if (Array.isArray(smth)) {
        if (Utils.canTreatArrayAsAnd(smth)) {
          var _smth = self.sequelize.and.apply(null, smth);
          result = self.getWhereConditions(_smth, tableName, factory, options, prepend);
        } else {
          result = Utils.format(smth, this.dialect);
        }
      } else if (smth === null) {
        result = '1=1';
      }

      return result ? result : '1=1';
    },

    prependTableNameToHash: function(tableName, hash) {
      if (tableName) {
        var _hash = {};

        for (var key in hash) {
          if (key.indexOf('.') === -1) {
            if (tableName instanceof Utils.literal) {
              _hash[tableName.val + '.' + this.quoteIdentifier(key)] = hash[key];
            } else {
              _hash[this.quoteTable(tableName) + '.' + this.quoteIdentifier(key)] = hash[key];
            }
          } else {
            _hash[this.quoteIdentifiers(key)] = hash[key];
          }
        }

        return _hash;
      } else {
        return hash;
      }
    },

    findAssociation: function(attribute, dao) {
      var associationToReturn;

      Object.keys(dao.associations).forEach(function(key) {
        if (!dao.associations[key]) return;


        var association = dao.associations[key]
          , associationName;

        associationName = association.as;

        if (associationName === attribute) {
          associationToReturn = association;
        }
      });

      return associationToReturn;
    },

    getAssociationFilterDAO: function(filterStr, dao) {
      var associationParts = filterStr.split('.')
        , self = this;

      associationParts.pop();

      associationParts.forEach(function(attribute) {
        dao = self.findAssociation(attribute, dao).target;
      });

      return dao;
    },

    isAssociationFilter: function(filterStr, dao, options) {
      if (!dao) {
        return false;
      }

      var pattern = /^[a-z][a-zA-Z0-9]+(\.[a-z][a-zA-Z0-9]+)+$/;
      if (!pattern.test(filterStr)) return false;

      var associationParts = filterStr.split('.')
        , attributePart = associationParts.pop()
        , self = this;

      return associationParts.every(function(attribute) {
        var association = self.findAssociation(attribute, dao);
        if (!association) return false;
        dao = association.target;
        return !!dao;
      }) && dao.rawAttributes.hasOwnProperty(attributePart);
    },

    getAssociationFilterColumn: function(filterStr, dao, options) {
      var associationParts = filterStr.split('.')
        , attributePart = associationParts.pop()
        , self = this
        , association
        , keyParts = [];

      associationParts.forEach(function(attribute) {
        association = self.findAssociation(attribute, dao);
        dao = association.target;
        if (options.include) {
          keyParts.push(association.as || association.options.as || dao.tableName);
        }
      });

      if (options.include) {
        return this.quoteIdentifier(keyParts.join('.')) + '.' + this.quoteIdentifiers(attributePart);
      }
      return this.quoteIdentifiers(dao.tableName + '.' + attributePart);
    },

    getConditionalJoins: function(options, originalDao) {
      var joins = ''
        , self = this
        , joinedTables = {};

      if (Utils._.isPlainObject(options.where)) {
        Object.keys(options.where).forEach(function(filterStr) {
          var associationParts = filterStr.split('.')
            , attributePart = associationParts.pop()
            , dao = originalDao;

          if (self.isAssociationFilter(filterStr, dao, options)) {
            associationParts.forEach(function(attribute) {
              var association = self.findAssociation(attribute, dao);

              if (!joinedTables[association.target.tableName]) {
                joinedTables[association.target.tableName] = true;

                if (association.associationType === 'BelongsTo') {
                  joins += ' LEFT JOIN ' + self.quoteIdentifiers(association.target.tableName);
                  joins += ' ON ' + self.quoteIdentifiers(association.source.tableName + '.' + association.identifier);
                  joins += ' = ' + self.quoteIdentifiers(association.target.tableName + '.' + association.target.autoIncrementField);
                } else if (Object(association.through.model) === association.through.model) {
                  joinedTables[association.through.model.tableName] = true;
                  joins += ' LEFT JOIN ' + self.quoteIdentifiers(association.through.model.tableName);
                  joins += ' ON ' + self.quoteIdentifiers(association.source.tableName + '.' + association.source.autoIncrementField);
                  joins += ' = ' + self.quoteIdentifiers(association.through.model.tableName + '.' + association.identifier);

                  joins += ' LEFT JOIN ' + self.quoteIdentifiers(association.target.tableName);
                  joins += ' ON ' + self.quoteIdentifiers(association.through.model.tableName + '.' + association.foreignIdentifier);
                  joins += ' = ' + self.quoteIdentifiers(association.target.tableName + '.' + association.target.autoIncrementField);
                } else {
                  joins += ' LEFT JOIN ' + self.quoteIdentifiers(association.target.tableName);
                  joins += ' ON ' + self.quoteIdentifiers(association.source.tableName + '.' + association.source.autoIncrementField);
                  joins += ' = ' + self.quoteIdentifiers(association.target.tableName + '.' + association.identifier);
                }
              }
              dao = association.target;
            });
          }
        });
      }

      return joins;
    },

    arrayValue: function(value, key, _key, factory, logicResult) {
      var _value = null;

      if (value.length === 0) { value = [null]; }
      _value = '(' + value.map(function(v) { return this.escape(v); }.bind(this)).join(',') + ')';
      return [_key, _value].join(' ' + logicResult + ' ');
    },

    /*
      Takes a hash and transforms it into a mysql where condition: {key: value, key2: value2} ==> key=value AND key2=value2
      The values are transformed by the relevant datatype.
    */
    hashToWhereConditions: function(hash, dao, options) {
      var result = [];

      options = options || {};

      // Closures are nice
      Utils._.each(hash, function(value, key) {
        var _key
          , _value = null;

        if (value && value._isSequelizeMethod === true && (value instanceof Utils.literal)) {
          result.push(value.val);
          return;
        }

        if (options.keysEscaped) {
          _key = key;
        } else {
          if (this.isAssociationFilter(key, dao, options)) {
            _key = key = this.getAssociationFilterColumn(key, dao, options);
          } else {
            _key = this.quoteIdentifiers(key);
          }
        }

        if (Array.isArray(value)) {
          result.push(this.arrayValue(value, key, _key, dao, 'IN'));
        } else if (value && Utils._.isPlainObject(value)) {
          result = result.concat(this.plainObjectToWhere(value, key, _key, dao));
        } else {
          if (typeof value === 'boolean') {
            _value = this.booleanValue(value);
          } else {
            _value = this.escape(value);
          }

          result.push((_value === 'NULL') ? _key + ' IS NULL' : [_key, _value].join('='));
        }
      }.bind(this));

      return result.join(' AND ');
    },

    plainObjectToWhere: function (value, key, _key, dao) {
      var _value
        , result = [];

      if (!!value.join) {
        //using as sentinel for join column => value
        _value = this.quoteIdentifiers(value.join);
        result.push([_key, _value].join('='));
      } else {
        for (var logic in value) {
          var logicResult = Utils.getWhereLogic(logic, value[logic]);

          if (logicResult === 'BETWEEN' || logicResult === 'NOT BETWEEN') {
            _value = this.escape(value[logic][0]);
            var _value2 = this.escape(value[logic][1]);

            result.push(' (' + _key + ' ' + logicResult + ' ' + _value + ' AND ' + _value2 + ') ');
          } else if (logicResult === 'IN' || logicResult === 'NOT IN' || Array.isArray(value[logic])) {
            var values = Array.isArray(value[logic]) ? value[logic] : [value[logic]];
            result.push(this.arrayValue(values, key, _key, dao, logicResult));
          } else {
            _value = this.escape(value[logic]);
            result.push([_key, _value].join(' ' + logicResult + ' '));
          }
        }
      }

      return result;
    },

    booleanValue: function(value) {
      return value;
    }
  };

  /* istanbul ignore next */
  var throwMethodUndefined = function(methodName) {
    throw new Error('The method "' + methodName + '" is not defined! Please add it to your sql dialect.');
  };

  return QueryGenerator;
})();

