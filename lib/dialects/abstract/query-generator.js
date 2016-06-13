  'use strict';

var Utils = require('../../utils')
  , SqlString = require('../../sql-string')
  , Model = require('../../model')
  , DataTypes = require('../../data-types')
  , _ = require('lodash')
  , util = require('util')
  , Dottie = require('dottie')
  , BelongsTo = require('../../associations/belongs-to')
  , uuid = require('node-uuid')
  , semver = require('semver');

/* istanbul ignore next */
var throwMethodUndefined = function(methodName) {
  throw new Error('The method "' + methodName + '" is not defined! Please add it to your sql dialect.');
};

var QueryGenerator = {
  options: {},

  extractTableDetails: function(tableName, options) {
    options = options || {};
    tableName = tableName || {};
    return {
      schema: tableName.schema || options.schema || 'public',
      tableName: _.isPlainObject(tableName) ? tableName.tableName : tableName,
      delimiter: tableName.delimiter || options.delimiter || '.'
    };
  },

  addSchema: function(param) {
    var self = this;

    if (!param.$schema) return param.tableName || param;

    return {
      tableName: param.tableName || param,
      table: param.tableName || param,
      name: param.name || param,
      schema: param.$schema,
      delimiter: param.$schemaDelimiter || '.',
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

  versionQuery: function(tableName, attributes, options) {
    throwMethodUndefined('versionQuery');
  },

  describeTableQuery: function(tableName, schema, schemaDelimiter) {
    var table = this.quoteTable(
      this.addSchema({
        tableName: tableName,
        $schema: schema,
        $schemaDelimiter: schemaDelimiter
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
      , valueQuery = '<%= tmpTable %>INSERT<%= ignore %> INTO <%= table %> (<%= attributes %>)<%= output %> VALUES (<%= values %>)'
      , emptyQuery = '<%= tmpTable %>INSERT<%= ignore %> INTO <%= table %><%= output %>'
      , outputFragment
      , fields = []
      , values = []
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

    if (this._dialect.supports.returnValues && options.returning) {
      if (!!this._dialect.supports.returnValues.returning) {
        valueQuery += ' RETURNING *';
        emptyQuery += ' RETURNING *';
      } else if (!!this._dialect.supports.returnValues.output) {
        outputFragment = ' OUTPUT INSERTED.*';

        //To capture output rows when there is a trigger on MSSQL DB
        if (modelAttributes && options.hasTrigger && this._dialect.supports.tmpTableTrigger) {
            tmpTable = 'declare @tmp table (<%= columns %>); ';

            for (modelKey in modelAttributes){
              attribute = modelAttributes[modelKey];
              if(!(attribute.type instanceof DataTypes.VIRTUAL)){
                if (tmpColumns.length > 0){
                  tmpColumns += ',';
                  outputColumns += ',';
                }

                tmpColumns += this.quoteIdentifier(attribute.field) + ' ' + attribute.type.toSql();
                outputColumns += 'INSERTED.' + this.quoteIdentifier(attribute.field);
              }
            }

            var replacement ={
              columns : tmpColumns
            };

            tmpTable = Utils._.template(tmpTable)(replacement).trim();
            outputFragment = ' OUTPUT ' + outputColumns + ' into @tmp';
            selectFromTmp = ';select * from @tmp';

            valueQuery += selectFromTmp;
            emptyQuery += selectFromTmp;
        }
      }
    }

    if (this._dialect.supports.EXCEPTION && options.exception) {
      // Mostly for internal use, so we expect the user to know what he's doing!
      // pg_temp functions are private per connection, so we never risk this function interfering with another one.
      if (semver.gte(this.sequelize.options.databaseVersion, '9.2.0')) {
        // >= 9.2 - Use a UUID but prefix with 'func_' (numbers first not allowed)
        var delimiter = '$func_' + uuid.v4().replace(/-/g, '') + '$';

        options.exception = 'WHEN unique_violation THEN GET STACKED DIAGNOSTICS sequelize_caught_exception = PG_EXCEPTION_DETAIL;';
        valueQuery = 'CREATE OR REPLACE FUNCTION pg_temp.testfunc(OUT response <%= table %>, OUT sequelize_caught_exception text) RETURNS RECORD AS ' + delimiter +
          ' BEGIN ' + valueQuery + ' INTO response; EXCEPTION ' + options.exception + ' END ' + delimiter +
          ' LANGUAGE plpgsql; SELECT (testfunc.response).*, testfunc.sequelize_caught_exception FROM pg_temp.testfunc(); DROP FUNCTION IF EXISTS pg_temp.testfunc()';
      } else {
        options.exception = 'WHEN unique_violation THEN NULL;';
        valueQuery = 'CREATE OR REPLACE FUNCTION pg_temp.testfunc() RETURNS SETOF <%= table %> AS $body$ BEGIN RETURN QUERY ' + valueQuery + '; EXCEPTION ' + options.exception + ' END; $body$ LANGUAGE plpgsql; SELECT * FROM pg_temp.testfunc(); DROP FUNCTION IF EXISTS pg_temp.testfunc();';
      }
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
      table: this.quoteTable(table),
      attributes: fields.join(','),
      output: outputFragment,
      values: values.join(','),
      tmpTable: tmpTable
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
  bulkInsertQuery: function(tableName, attrValueHashes, options, rawAttributes) {
    options = options || {};
    rawAttributes = rawAttributes || {};

    var query = 'INSERT<%= ignoreDuplicates %> INTO <%= table %> (<%= attributes %>) VALUES <%= tuples %><%= onDuplicateKeyUpdate %><%= returning %>;'
      , tuples = []
      , serials = []
      , allAttributes = []
      , onDuplicateKeyUpdate = '';

    attrValueHashes.forEach(function(attrValueHash) {
      _.forOwn(attrValueHash, function(value, key) {
        if (allAttributes.indexOf(key) === -1) {
          allAttributes.push(key);
        }

        if (rawAttributes[key] && rawAttributes[key].autoIncrement === true) {
          serials.push(key);
        }
      });
    });

    attrValueHashes.forEach(function(attrValueHash) {
      tuples.push('(' +
        allAttributes.map(function(key) {
          if (this._dialect.supports.bulkDefault && serials.indexOf(key) !== -1) {
            return attrValueHash[key] || 'DEFAULT';
          }
          return this.escape(attrValueHash[key], rawAttributes[key], { context: 'INSERT' });
        }, this).join(',') +
        ')');
    }, this);

    if (this._dialect.supports.updateOnDuplicate && options.updateOnDuplicate) {
      onDuplicateKeyUpdate += ' ON DUPLICATE KEY UPDATE ' + options.updateOnDuplicate.map(function(attr) {
        var field = rawAttributes && rawAttributes[attr] && rawAttributes[attr].field || attr;
        var key = this.quoteIdentifier(field);
        return key + '=VALUES(' + key + ')';
      }, this).join(',');
    }

    var replacements = {
      ignoreDuplicates: options.ignoreDuplicates ? this._dialect.supports.ignoreDuplicates : '',
      table: this.quoteTable(tableName),
      attributes: allAttributes.map(function(attr) {
        return this.quoteIdentifier(attr);
      }, this).join(','),
      tuples: tuples.join(','),
      onDuplicateKeyUpdate: onDuplicateKeyUpdate,
      returning: this._dialect.supports.returnValues && options.returning ? ' RETURNING *' : ''
    };

    return _.template(query)(replacements);
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
      , modelAttributeMap = {}
      , tmpTable = ''         //tmpTable declaration for trigger
      , selectFromTmp = ''    //Select statement for trigger
      , tmpColumns = ''       //Columns for temp table for trigger
      , outputColumns = ''    //Columns to capture into temp table for trigger
      , attribute             //Model attribute holder
      , modelKey;             //key for model

    query = '<%= tmpTable %>UPDATE <%= table %> SET <%= values %><%= output %> <%= where %>';

    if (this._dialect.supports['LIMIT ON UPDATE'] && options.limit) {
      query += ' LIMIT ' + this.escape(options.limit) + ' ';
    }

    if (this._dialect.supports.returnValues) {
      if (!!this._dialect.supports.returnValues.output) {
        // we always need this for mssql
        outputFragment = ' OUTPUT INSERTED.*';

        //To capture output rows when there is a trigger on MSSQL DB
        if (attributes && options.hasTrigger && this._dialect.supports.tmpTableTrigger) {
            tmpTable = 'declare @tmp table (<%= columns %>); ';

            for (modelKey in attributes){
              attribute = attributes[modelKey];
              if(!(attribute.type instanceof DataTypes.VIRTUAL)){
                if (tmpColumns.length > 0){
                  tmpColumns += ',';
                  outputColumns += ',';
                }

                tmpColumns += this.quoteIdentifier(attribute.field) + ' ' + attribute.type.toSql();
                outputColumns += 'INSERTED.' + this.quoteIdentifier(attribute.field);
              }
            }

            var replacement ={
              columns : tmpColumns
            };

            tmpTable = Utils._.template(tmpTable)(replacement).trim();
            outputFragment = ' OUTPUT ' + outputColumns + ' into @tmp';
            selectFromTmp = ';select * from @tmp';

            query += selectFromTmp;
        }
      } else if (this._dialect.supports.returnValues && options.returning) {
        // ensure that the return output is properly mapped to model fields.
        options.mapToModel = true;
        query += ' RETURNING *';
      }
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
      values.push(this.quoteIdentifier(key) + '=' + this.escape(value, (modelAttributeMap && modelAttributeMap[key] || undefined), { context: 'UPDATE' }));
    }

    var replacements = {
      table: this.quoteTable(tableName),
      values: values.join(','),
      output: outputFragment,
      where: this.whereQuery(where),
      tmpTable: tmpTable
    };

    if (values.length === 0) {
      return '';
    }

    return Utils._.template(query)(replacements).trim();
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
      , values = []
      , outputFragment;

    query = 'UPDATE <%= table %> SET <%= values %><%= output %> <%= where %>';
    if (this._dialect.supports.returnValues) {
      if (!!this._dialect.supports.returnValues.returning) {
        query += ' RETURNING *';
      } else if (!!this._dialect.supports.returnValues.output) {
        outputFragment = ' OUTPUT INSERTED.*';
      }
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
      output: outputFragment,
      where: this.whereQuery(where)
    };

    return Utils._.template(query)(replacements);
  },

  nameIndexes: function (indexes, rawTablename) {
    return Utils._.map(indexes, function (index) {
      if (!index.hasOwnProperty('name')) {
        var onlyAttributeNames = index.fields.map(function(field) {
          return (typeof field === 'string') ? field : (field.name || field.attribute);
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
      - options:
        - type: UNIQUE|FULLTEXT|SPATIAL
        - name: The name of the index. Default is <table>_<attr1>_<attr2>
        - fields: An array of attributes as string or as hash.
                  If the attribute is a hash, it must have the following content:
                  - name: The name of the attribute/column
                  - length: An integer. Optional
                  - order: 'ASC' or 'DESC'. Optional
        - parser
      - rawTablename, the name of the table, without schema. Used to create the name of the index
  */
  addIndexQuery: function(tableName, attributes, options, rawTablename) {
    var fieldsSql;
    options = options || {};

    if (!Array.isArray(attributes)) {
      options = attributes;
      attributes = undefined;
    } else {
      options.fields = attributes;
    }

    // Backwards compatability
    if (options.indexName) {
      options.name = options.indexName;
    }
    if (options.indicesType) {
      options.type = options.indicesType;
    }
    if (options.indexType || options.method) {
      options.using = options.indexType || options.method;
    }

    options.prefix = options.prefix || rawTablename || tableName;
    if (options.prefix && _.isString(options.prefix)) {
      options.prefix = options.prefix.replace(/\./g, '_');
      options.prefix = options.prefix.replace(/(\"|\')/g, '');
    }

    fieldsSql = options.fields.map(function(field) {
      if (typeof field === 'string') {
        return this.quoteIdentifier(field);
      } else if (field._isSequelizeMethod) {
        return this.handleSequelizeMethod(field);
      } else {
        var result = '';

        if (field.attribute) {
          field.name = field.attribute;
        }

        if (!field.name) {
          throw new Error('The following index field has no name: ' + util.inspect(field));
        }

        result += this.quoteIdentifier(field.name);

        if (this._dialect.supports.index.collate && field.collate) {
          result += ' COLLATE ' + this.quoteIdentifier(field.collate);
        }

        if (this._dialect.supports.index.length && field.length) {
          result += '(' + field.length + ')';
        }

        if (field.order) {
          result += ' ' + field.order;
        }

        return result;
      }
    }.bind(this));

    if (!options.name) {
      // Mostly for cases where addIndex is called directly by the user without an options object (for example in migrations)
      // All calls that go through sequelize should already have a name
      options = this.nameIndexes([options], options.prefix)[0];
    }

    options = Model.prototype.$conformIndex(options);

    if (!this._dialect.supports.index.type) {
      delete options.type;
    }

    if (options.where) {
      options.where = this.whereQuery(options.where);
    }

    if (_.isString(tableName)) {
      tableName = this.quoteIdentifiers(tableName);
    } else {
      tableName = this.quoteTable(tableName);
    }

    var concurrently = this._dialect.supports.index.concurrently && options.concurrently ? 'CONCURRENTLY' : undefined
      , ind;
    if (this._dialect.supports.indexViaAlter) {
      ind = [
        'ALTER TABLE',
        tableName,
        concurrently,
        'ADD'
      ];
    } else {
      ind = ['CREATE'];
    }

    ind = ind.concat(
      options.unique ? 'UNIQUE' : '',
      options.type, 'INDEX',
      !this._dialect.supports.indexViaAlter ? concurrently : undefined,
      this.quoteIdentifiers(options.name),
      this._dialect.supports.index.using === 1 && options.using ? 'USING ' + options.using : '',
      !this._dialect.supports.indexViaAlter ? 'ON ' + tableName : undefined,
      this._dialect.supports.index.using === 2 && options.using ? 'USING ' + options.using : '',
      '(' + fieldsSql.join(', ') + (options.operator ? ' '+options.operator : '') + ')',
      (this._dialect.supports.index.parser && options.parser ? 'WITH PARSER ' + options.parser : undefined),
      (this._dialect.supports.index.where && options.where ? options.where : undefined)
    );

    return Utils._.compact(ind).join(' ');
  },

  /*
    Returns a query listing indexes for a given table.
    Parameters:
      - tableName: Name of an existing table.
      - options:
        - database: Name of the database.
  */
  /* istanbul ignore next */
  showIndexesQuery: function(tableName, options) {
    throwMethodUndefined('showIndexesQuery');
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
          table += param.schema + (param.delimiter || '.');
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
      var sql = (i > 0 ? this.quoteIdentifier(tableNames.join('.')) + '.' : (Utils._.isString(obj[0]) && parent ? this.quoteIdentifier(parent.name) + '.' : '')) + this.quote(obj[i], parent, force);
      if (i < len - 1) {
        if (obj[i + 1]._isSequelizeMethod) {
          sql += this.handleSequelizeMethod(obj[i + 1]);
        } else {
          sql += ' ' + obj[i + 1];
        }
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
  createTrigger: function(tableName, triggerName, timingType, fireOnArray, functionName, functionParams, optionsArray) {
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
  escape: function(value, field, options) {
    options = options || {};

    if (value !== null && value !== undefined) {
      if (value._isSequelizeMethod) {
        return this.handleSequelizeMethod(value);
      } else {
        if (field && field.type) {
          if (this.typeValidation && field.type.validate && value) {
            if (options.isList && Array.isArray(value)) {
              _.forEach(value, function(item) {
                field.type.validate(item, options);
              });
            } else {
              field.type.validate(value, options);
            }
          }

          if (field.type.stringify) {
            // Users shouldn't have to worry about these args - just give them a function that takes a single arg
            var simpleEscape = _.partialRight(SqlString.escape, this.options.timezone, this.dialect);

            value = field.type.stringify(value, { escape: simpleEscape, field: field, timezone: this.options.timezone });

            if (field.type.escape === false) {
              // The data-type already did the required escaping
              return value;
            }
          }
        }
      }
    }

    return SqlString.escape(value, this.options.timezone, this.dialect);
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
      , mainAttributes = options.attributes && options.attributes.slice()
      , mainJoinQueries = []
      // We'll use a subquery if we have a hasMany association and a limit
      , subQuery = options.subQuery === undefined ?
                   limit && options.hasMultiAssociation :
                   options.subQuery
      , subQueryItems = []
      , subQueryAttributes = null
      , subJoinQueries = []
      , mainTableAs = null;

    if (options.tableAs) {
      mainTableAs = this.quoteTable(options.tableAs);
    } else if (!Array.isArray(tableName) && model) {
      mainTableAs = this.quoteTable(model.name);
    }

    table = !Array.isArray(tableName) ? this.quoteTable(tableName) : tableName.map(function(t) {
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
        attr = attr.slice();

        if (attr[0]._isSequelizeMethod) {
          attr[0] = self.handleSequelizeMethod(attr[0]);
          addTable = false;
        } else if (attr[0].indexOf('(') === -1 && attr[0].indexOf(')') === -1) {
            attr[0] = self.quoteIdentifier(attr[0]);
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
    if (subQuery || options.groupedLimit) {
      // We need primary keys
      subQueryAttributes = mainAttributes;
      mainAttributes = [(mainTableAs || table) + '.*'];
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
          , parentIsTop = !include.parent.association && include.parent.model.name === options.model.name
          , whereOptions = Utils._.clone(options)
          , targetWhere;

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
              throw new Error(
                'Tried to select attributes using Sequelize.cast or Sequelize.fn without specifying an alias for the result, during eager loading. ' +
                'This means the attribute will not be added to the returned instance'
              );
            }

            var prefix;
            if (verbatim === true) {
              prefix = attr;
            } else {
              prefix = self.quoteIdentifier(as) + '.' + self.quoteIdentifier(attr);
            }
            return prefix + ' AS ' + self.quoteIdentifier(as + '.' + attrAs, true);
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
            , attrSource = primaryKeysSource[0]
            , primaryKeysTarget = association.target.primaryKeyAttributes
            , tableTarget = as
            , identTarget = association.foreignIdentifierField
            , attrTarget = association.target.rawAttributes[primaryKeysTarget[0]].field || primaryKeysTarget[0]

            , sourceJoinOn
            , targetJoinOn

            , throughWhere;

          if (options.includeIgnoreAttributes !== false) {
            // Through includes are always hasMany, so we need to add the attributes to the mainAttributes no matter what (Real join will never be executed in subquery)
            mainAttributes = mainAttributes.concat(throughAttributes);
          }

          // Figure out if we need to use field or attribute
          if (!subQuery) {
            attrSource = association.source.rawAttributes[primaryKeysSource[0]].field;
          }
          if (subQuery && !include.subQuery && !include.parent.subQuery && include.parent.model !== mainModel) {
            attrSource = association.source.rawAttributes[primaryKeysSource[0]].field;
          }

          // Filter statement for left side of through
          // Used by both join and subquery where

          // If parent include was in a subquery need to join on the aliased attribute

          if (subQuery && !include.subQuery && include.parent.subQuery && !parentIsTop) {
            sourceJoinOn = self.quoteIdentifier(tableSource + '.' + attrSource) + ' = ';
          } else {
            sourceJoinOn = self.quoteTable(tableSource) + '.' + self.quoteIdentifier(attrSource) + ' = ';
          }
          sourceJoinOn += self.quoteIdentifier(throughAs) + '.' + self.quoteIdentifier(identSource);

          // Filter statement for right side of through
          // Used by both join and subquery where
          targetJoinOn = self.quoteIdentifier(tableTarget) + '.' + self.quoteIdentifier(attrTarget) + ' = ';
          targetJoinOn += self.quoteIdentifier(throughAs) + '.' + self.quoteIdentifier(identTarget);

          if (include.through.where) {
            throughWhere = self.getWhereConditions(include.through.where, self.sequelize.literal(self.quoteIdentifier(throughAs)), include.through.model);
          }

          if (self._dialect.supports.joinTableDependent) {
            // Generate a wrapped join so that the through table join can be dependent on the target join
            joinQueryItem += joinType + '(';
            joinQueryItem += self.quoteTable(throughTable, throughAs);
            joinQueryItem += ' INNER JOIN ' + self.quoteTable(table, as) + ' ON ';
            joinQueryItem += targetJoinOn;

            if (throughWhere) {
              joinQueryItem += ' AND ' + throughWhere;
            }

            joinQueryItem += ') ON '+sourceJoinOn;
          } else {
            // Generate join SQL for left side of through
            joinQueryItem += joinType + self.quoteTable(throughTable, throughAs)  + ' ON ';
            joinQueryItem += sourceJoinOn;

            // Generate join SQL for right side of through
            joinQueryItem += joinType + self.quoteTable(table, as) + ' ON ';
            joinQueryItem += targetJoinOn;

            if (throughWhere) {
              joinQueryItem += ' AND ' + throughWhere;
            }

          }

          if (include.where || include.through.where) {
            if (include.where) {
              targetWhere = self.getWhereConditions(include.where, self.sequelize.literal(self.quoteIdentifier(as)), include.model, whereOptions);
              if (targetWhere) {
                joinQueryItem += ' AND ' + targetWhere;
              }
            }
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
                    attributes: [topInclude.through.model.primaryKeyField],
                    include: Model.$validateIncludedElements({
                      model: topInclude.through.model,
                      include: [{
                        association: topInclude.association.toTarget,
                        required: true
                      }]
                    }).include,
                    model: topInclude.through.model,
                    where: { $and: [
                      self.sequelize.asIs([
                        self.quoteTable(topParent.model.name) + '.' + self.quoteIdentifier(topParent.model.primaryKeyField),
                        self.quoteIdentifier(topInclude.through.model.name) + '.' + self.quoteIdentifier(topInclude.association.identifierField)
                      ].join(' = ')),
                      topInclude.through.where
                    ]},
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
                      ].join(' = '))
                    },
                    limit: 1,
                    includeIgnoreAttributes: false
                  }, topInclude.model);
                }

                options.where['__' + throughAs] = self.sequelize.asIs([
                  '(',
                    $query.replace(/\;$/, ''),
                  ')',
                  'IS NOT NULL'
                ].join(' '));
              })(include);
            }
          }
        } else {
          if (subQuery && include.subQueryFilter) {
            var associationWhere = {}
              , $query
              , subQueryWhere;

            associationWhere[association.identifierField] = {
              $raw: self.quoteTable(parentTable) + '.' + self.quoteIdentifier(association.source.primaryKeyField)
            };

            if (!options.where) options.where = {};

            // Creating the as-is where for the subQuery, checks that the required association exists
            $query = self.selectQuery(include.model.getTableName(), {
              attributes: [association.identifierField],
              where: {
                $and: [
                  associationWhere,
                  include.where || {}
                ]
              },
              limit: 1
            }, include.model);

            subQueryWhere = self.sequelize.asIs([
              '(',
                $query.replace(/\;$/, ''),
              ')',
              'IS NOT NULL'
            ].join(' '));

            if (Utils._.isPlainObject(options.where)) {
              options.where['__' + as] = subQueryWhere;
            } else {
              options.where = { $and: [options.where, subQueryWhere] };
            }
          }

          joinQueryItem = ' ' + self.joinIncludeQuery({
            model: mainModel,
            subQuery: options.subQuery,
            include: include,
            groupedLimit: options.groupedLimit
          });
        }

        if (include.subQuery && subQuery) {
          joinQueries.subQuery.push(joinQueryItem);
        } else {
          joinQueries.mainQuery.push(joinQueryItem);
        }

        if (include.include) {
          include.include.filter(function (include) {
            return !include.separate;
          }).forEach(function(childInclude) {
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
      options.include.filter(function (include) {
        return !include.separate;
      }).forEach(function(include) {
        var joinQueries = generateJoinQueries(include, mainTableAs);

        subJoinQueries = subJoinQueries.concat(joinQueries.subQuery);
        mainJoinQueries = mainJoinQueries.concat(joinQueries.mainQuery);

      }.bind(this));
    }

    // If using subQuery select defined subQuery attributes and join subJoinQueries
    if (subQuery) {
      subQueryItems.push(this.selectFromTableFragment(options, model, subQueryAttributes, table, mainTableAs));
      subQueryItems.push(subJoinQueries.join(''));

    // Else do it the reguar way
    } else {
      if (options.groupedLimit) {
        if (!mainTableAs) {
          mainTableAs = table;
        }
        mainQueryItems.push(this.selectFromTableFragment(options, model, mainAttributes, '('+
          options.groupedLimit.values.map(function (value) {
            var where = _.assign({}, options.where);
            where[options.groupedLimit.on] = value;

            return '('+self.selectQuery(
              table,
              {
                attributes: options.attributes,
                limit: options.groupedLimit.limit,
                order: options.order,
                where: where
              },
              model
            ).replace(/;$/, '')+')';
          }).join(
            self._dialect.supports['UNION ALL'] ?' UNION ALL ' : ' UNION '
          )
        +')', mainTableAs));
      } else {
        mainQueryItems.push(this.selectFromTableFragment(options, model, mainAttributes, table, mainTableAs));
      }
      mainQueryItems.push(mainJoinQueries.join(''));
    }

    // Add WHERE to sub or main query
    if (options.hasOwnProperty('where') && !options.groupedLimit) {
      options.where = this.getWhereConditions(options.where, mainTableAs || tableName, model, options);
      if (options.where) {
        if (subQuery) {
          subQueryItems.push(' WHERE ' + options.where);
        } else {
          mainQueryItems.push(' WHERE ' + options.where);
          // Walk the main query to update all selects
          _.each(mainQueryItems, function(value, key) {
            if(value.match(/^SELECT/)) {
              mainQueryItems[key] = this.selectFromTableFragment(options, model, mainAttributes, table, mainTableAs, options.where);
            }
          }.bind(this));
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
    if (options.order && !options.groupedLimit) {
      var orders = this.getQueryOrders(options, model, subQuery);

      if (orders.mainQueryOrder.length) {
        mainQueryItems.push(' ORDER BY ' + orders.mainQueryOrder.join(', '));
      }
      if (orders.subQueryOrder.length) {
        subQueryItems.push(' ORDER BY ' + orders.subQueryOrder.join(', '));
      }
    }

    // Add LIMIT, OFFSET to sub or main query
    var limitOrder = this.addLimitAndOffset(options, model);
    if (limitOrder && !options.groupedLimit) {
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
      query += ') AS ' + mainTableAs;
      query += mainJoinQueries.join('');
      query += mainQueryItems.join('');
    } else {
      query = mainQueryItems.join('');
    }

    if (options.lock && this._dialect.supports.lock) {
      var lock = options.lock;
      if (typeof options.lock === 'object') {
        lock = options.lock.level;
      }
      if (this._dialect.supports.lockKey && (lock === 'KEY SHARE' || lock === 'NO KEY UPDATE')) {
        query += ' FOR ' + lock;
      } else if (lock === 'SHARE') {
        query += ' ' + this._dialect.supports.forShare;
      } else {
        query += ' FOR UPDATE';
      }
      if (this._dialect.supports.lockOf && options.lock.of instanceof Model) {
        query += ' OF ' + this.quoteTable(options.lock.of.name);
      }
    }

    query += ';';

    return query;
  },

  getQueryOrders: function(options, model, subQuery) {
    var mainQueryOrder = [];
    var subQueryOrder = [];

    var validateOrder = function(order) {
      if (order instanceof Utils.literal) return;

      if (!_.includes([
        'ASC',
        'DESC',
        'ASC NULLS LAST',
        'DESC NULLS LAST',
        'ASC NULLS FIRST',
        'DESC NULLS FIRST',
        'NULLS FIRST',
        'NULLS LAST'
      ], order.toUpperCase())) {
        throw new Error(util.format('Order must be \'ASC\' or \'DESC\', \'%s\' given', order));
      }
    };

    if (Array.isArray(options.order)) {
      options.order.forEach(function(t) {
        if (Array.isArray(t) && _.size(t) > 1) {
          if (t[0] instanceof Model || t[0].model instanceof Model) {
            if (typeof t[t.length - 2] === 'string') {
              validateOrder(_.last(t));
            }
          } else {
            validateOrder(_.last(t));
          }
        }

        var hadSubquery = false;

        if (subQuery && (Array.isArray(t) && !(t[0] instanceof Model) && !(t[0].model instanceof Model))) {
          subQueryOrder.push(this.quote(t, model));
          hadSubquery = true;       
        }

        if (hadSubquery) {
          for (var name in model.attributes) {
            var attribute = model.attributes[name];
            if (attribute.field && attribute.field === t[0]) {
              t[0] = attribute.fieldName;
            }
          }
        }

        mainQueryOrder.push(this.quote(t, model));
      }.bind(this));
    } else {
      mainQueryOrder.push(this.quote(typeof options.order === 'string' ? new Utils.literal(options.order) : options.order, model));
    }

    return {
      mainQueryOrder: mainQueryOrder,
      subQueryOrder: subQueryOrder
    };
  },

  selectFromTableFragment: function(options, model, attributes, tables, mainTableAs, whereClause) {
    var fragment = 'SELECT ' + attributes.join(', ') + ' FROM ' + tables;

    if(mainTableAs) {
      fragment += ' AS ' + mainTableAs;
    }

    return fragment;
  },

  joinIncludeQuery: function(options) {
    var subQuery = options.subQuery
      , include = options.include
      , association = include.association
      , parent = include.parent
      , parentIsTop = !include.parent.association && include.parent.model.name === options.model.name
      , $parent
      , joinType = include.required ? 'INNER JOIN ' : 'LEFT OUTER JOIN '
      , joinOn
      , joinWhere

      /* Attributes for the left side */
      , left = association.source
      , asLeft
      , attrLeft = association instanceof BelongsTo ?
                   association.identifier :
                   left.primaryKeyAttribute
      , fieldLeft = association instanceof BelongsTo ?
                   association.identifierField :
                   left.rawAttributes[left.primaryKeyAttribute].field

      /* Attributes for the right side */
      , right = include.model
      , asRight = include.as
      , tableRight = right.getTableName()
      , fieldRight = association instanceof BelongsTo ?
                     right.rawAttributes[association.targetIdentifier || right.primaryKeyAttribute].field :
                     association.identifierField;

    while (($parent = ($parent && $parent.parent || include.parent)) && $parent.association) {
      if (asLeft) {
        asLeft = [$parent.as, asLeft].join('.');
      } else {
        asLeft = $parent.as;
      }
    }

    if (!asLeft) asLeft = parent.as || parent.model.name;
    else asRight = [asLeft, asRight].join('.');

    joinOn = [
      this.quoteTable(asLeft),
      this.quoteIdentifier(fieldLeft)
    ].join('.');

    if ((options.groupedLimit && parentIsTop) || (subQuery && include.parent.subQuery && !include.subQuery)) {
      if (parentIsTop) {
        // The main model attributes is not aliased to a prefix
        joinOn = [
          this.quoteTable(parent.as || parent.model.name),
          this.quoteIdentifier(attrLeft)
        ].join('.');
      } else {
        joinOn = this.quoteIdentifier(asLeft + '.' + attrLeft);
      }
    }

    joinOn += ' = ' + this.quoteIdentifier(asRight) + '.' + this.quoteIdentifier(fieldRight);

    if (include.on) {
      joinOn = this.whereItemsQuery(include.on, {
        prefix: this.sequelize.literal(this.quoteIdentifier(asRight)),
        model: include.model
      });
    }

    if (include.where) {
      joinWhere = this.whereItemsQuery(include.where, {
        prefix: this.sequelize.literal(this.quoteIdentifier(asRight)),
        model: include.model
      });
      if (joinWhere) {
        if (include.or) {
          joinOn += ' OR ' + joinWhere;
        } else {
          joinOn += ' AND ' + joinWhere;
        }
      }
    }

    return joinType + this.quoteTable(tableRight, asRight) + ' ON ' + joinOn;
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
  startTransactionQuery: function(transaction) {
    if (transaction.parent) {
      // force quoting of savepoint identifiers for postgres
      return 'SAVEPOINT ' + this.quoteIdentifier(transaction.name, true) + ';';
    }

    return 'START TRANSACTION;';
  },

  /**
   * Returns a query that defers the constraints. Only works for postgres.
   *
   * @param  {Transaction} transaction
   * @param  {Object} options An object with options.
   * @return {String}         The generated sql query.
   */
  deferConstraintsQuery: function () {},

  setConstraintQuery: function () {},
  setDeferredQuery: function () {},
  setImmediateQuery: function () {},

  /**
   * Returns a query that commits a transaction.
   *
   * @param  {Object} options An object with options.
   * @return {String}         The generated sql query.
   */
  commitTransactionQuery: function(transaction) {
    if (transaction.parent) {
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
  rollbackTransactionQuery: function(transaction) {
    if (transaction.parent) {
      // force quoting of savepoint identifiers for postgres
      return 'ROLLBACK TO SAVEPOINT ' + this.quoteIdentifier(transaction.name, true) + ';';
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

    /*jshint eqeqeq:false*/
    if (options.offset != null && options.limit == null) {
      fragment += ' LIMIT ' + this.escape(options.offset) + ', ' + 10000000000000;
    } else if (options.limit != null) {
      if (options.offset != null) {
        fragment += ' LIMIT ' + this.escape(options.offset) + ', ' + this.escape(options.limit);
      } else {
        fragment += ' LIMIT ' + this.escape(options.limit);
      }
    }

    return fragment;
  },

  handleSequelizeMethod: function (smth, tableName, factory, options, prepend) {
    var self = this
      , result;

    if (smth instanceof Utils.where) {
      var value = smth.logic
        , key;

      if (smth.attribute._isSequelizeMethod) {
        key = this.getWhereConditions(smth.attribute, tableName, factory, options, prepend);
      } else {
        key = this.quoteTable(smth.attribute.Model.name) + '.' + this.quoteIdentifier(smth.attribute.field || smth.attribute.fieldName);
      }

      if (value && value._isSequelizeMethod) {
        value = this.getWhereConditions(value, tableName, factory, options, prepend);

        result = (value === 'NULL') ? key + ' IS NULL' : [key, value].join(smth.comparator);
      } else if (_.isPlainObject(value)) {
        result = this.whereItemQuery(smth.attribute, value, {
          model: factory
        });
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

  whereQuery: function(where, options) {
    var query = this.whereItemsQuery(where, options);
    if (query && query.length) {
      return 'WHERE '+query;
    }
    return '';
  },
  whereItemsQuery: function(where, options, binding) {
    if (
      (Array.isArray(where) && where.length === 0) ||
      (_.isPlainObject(where) && _.isEmpty(where)) ||
      where === null ||
      where === undefined
    ) {
      // NO OP
      return '';
    }

    if (_.isString(where)) {
      throw new Error('where: "raw query" has been removed, please use where ["raw query", [replacements]]');
    }

    var self = this
      , items = [];

    binding = binding || 'AND';
    if (binding.substr(0, 1) !== ' ') binding = ' '+binding+' ';

    if (_.isPlainObject(where)) {
      _.forOwn(where, function (value, key) {
        items.push(self.whereItemQuery(key, value, options));
      });
    } else {
      items.push(self.whereItemQuery(undefined, where, options));
    }

    return items.length && items.filter(function (item) {
      return item && item.length;
    }).join(binding) || '';
  },
  whereItemQuery: function(key, value, options) {
    options = options || {};

    var self = this
      , binding
      , outerBinding
      , comparatorMap
      , aliasMap
      , comparator = '='
      , field = options.field || options.model && options.model.rawAttributes && options.model.rawAttributes[key] || options.model && options.model.fieldRawAttributesMap && options.model.fieldRawAttributesMap[key]
      , fieldType = options.type || (field && field.type)
      , tmp;

    if (key && typeof key === 'string' && key.indexOf('.') !== -1 && options.model) {
      if (options.model.rawAttributes[key.split('.')[0]] && options.model.rawAttributes[key.split('.')[0]].type instanceof DataTypes.JSON) {
        field = options.model.rawAttributes[key.split('.')[0]];
        fieldType = field.type;
        tmp = value;
        value = {};

        Dottie.set(value, key.split('.').slice(1), tmp);
        key = field.field || key.split('.')[0];
      }
    }

    comparatorMap = {
      $eq: '=',
      $ne: '!=',
      $gte: '>=',
      $gt: '>',
      $lte: '<=',
      $lt: '<',
      $not: 'IS NOT',
      $is: 'IS',
      $like: 'LIKE',
      $notLike: 'NOT LIKE',
      $iLike: 'ILIKE',
      $notILike: 'NOT ILIKE',
      $between: 'BETWEEN',
      $notBetween: 'NOT BETWEEN',
      $overlap: '&&',
      $contains: '@>',
      $contained: '<@'
    };

    // Maintain BC
    aliasMap = {
      'ne': '$ne',
      'in': '$in',
      'not': '$not',
      'notIn': '$notIn',
      'gte': '$gte',
      'gt': '$gt',
      'lte': '$lte',
      'lt': '$lt',
      'like': '$like',
      'ilike': '$iLike',
      '$ilike': '$iLike',
      'nlike': '$notLike',
      '$notlike': '$notLike',
      'notilike': '$notILike',
      '..': '$between',
      'between': '$between',
      '!..': '$notBetween',
      'notbetween': '$notBetween',
      'nbetween': '$notBetween',
      'overlap': '$overlap',
      '&&': '$overlap',
      '@>': '$contains',
      '<@': '$contained'
    };

    key = aliasMap[key] || key;
    if (_.isPlainObject(value)) {
      _.forOwn(value, function (item, key) {
        if (aliasMap[key]) {
          value[aliasMap[key]] = item;
          delete value[key];
        }
      });
    }

    if (key === undefined) {
      if (typeof value === 'string') {
        return value;
      }

      if (_.isPlainObject(value) && _.size(value) === 1) {
        key = Object.keys(value)[0];
        value = _.values(value)[0];
      }
    }

    if (value && value._isSequelizeMethod && !(key !== undefined && value instanceof Utils.fn)) {
      return this.handleSequelizeMethod(value);
    }

    // Convert where: [] to $and if possible, else treat as literal/replacements
    if (key === undefined && Array.isArray(value)) {
      if (Utils.canTreatArrayAsAnd(value)) {
        key = '$and';
      } else {
        return Utils.format(value, this.dialect);
      }
    }
    // OR/AND/NOT grouping logic
    if (key === '$or' || key === '$and' || key === '$not') {
      binding = (key === '$or') ?' OR ' : ' AND ';
      outerBinding = '';
      if (key === '$not') outerBinding = 'NOT ';

      if (Array.isArray(value)) {
        value = value.map(function (item) {
          var itemQuery = self.whereItemsQuery(item, options, ' AND ');
          if ((Array.isArray(item) || _.isPlainObject(item)) && _.size(item) > 1) {
            itemQuery = '('+itemQuery+')';
          }
          return itemQuery;
        }).filter(function (item) {
          return item && item.length;
        });

        // $or: [] should return no data.
        // $not of no restriction should also return no data
        if ((key === '$or' || key === '$not') && value.length === 0) {
          return '0 = 1';
        }

        return value.length ? outerBinding + '('+value.join(binding)+')' : undefined;
      } else {
        value = self.whereItemsQuery(value, options, binding);

        if ((key === '$or' || key === '$not') && !value) {
          return '0 = 1';
        }

        return value ? outerBinding + '('+value+')' : undefined;
      }
    }

    if (value && (value.$or || value.$and)) {
      binding = value.$or ? ' OR ' : ' AND ';
      value = value.$or || value.$and;

      if (_.isPlainObject(value)) {
        value = _.reduce(value, function (result, _value, key) {
          result.push(_.zipObject([key], [_value]));
          return result;
        }, []);
      }

      value = value.map(function (_value) {
        return self.whereItemQuery(key, _value, options);
      }).filter(function (item) {
        return item && item.length;
      });

      return value.length ? '('+value.join(binding)+')' : undefined;
    }

    if (_.isPlainObject(value) && fieldType instanceof DataTypes.JSON && options.json !== false) {
      return (function () {
        var $items = []
          , result
          , traverse;

        traverse = function (prop, item, path) {
          var $where = {}
            , $key
            , $cast
            , $baseKey
            , $tmp
            , castKey;

          if (path[path.length - 1].indexOf('::') > -1) {
            $tmp = path[path.length - 1].split('::');
            $cast = $tmp[1];
            path[path.length - 1] = $tmp[0];
          }

          $baseKey = self.quoteIdentifier(key)+'#>>\'{'+path.join(', ')+'}\'';

          if (options.prefix) {
            if (options.prefix instanceof Utils.literal) {
              $baseKey = self.handleSequelizeMethod(options.prefix)+'.'+$baseKey;
            } else {
              $baseKey = self.quoteTable(options.prefix)+'.'+$baseKey;
            }
          }

          $baseKey = '('+$baseKey+')';

          castKey = function ($item) {
            var key = $baseKey;

            if (!$cast) {
              if (typeof $item === 'number') {
                $cast = 'double precision';
              } else if ($item instanceof Date) {
                $cast = 'timestamptz';
              } else if (typeof $item === 'boolean') {
                $cast = 'boolean';
              }
            }

            if ($cast) {
              key += '::'+$cast;
            }

            return key;
          };

          if (_.isPlainObject(item)) {
            _.forOwn(item, function ($item, $prop) {
              if ($prop.indexOf('$') === 0) {
                $where[$prop] = $item;
                $key = castKey($item);

                $items.push(self.whereItemQuery(new Utils.literal($key), $where/*, _.pick(options, 'prefix')*/));
              } else {
                traverse($prop, $item, path.concat([$prop]));
              }
            });
          } else {
            $where.$eq = item;
            $key = castKey(item);

            $items.push(self.whereItemQuery(new Utils.literal($key), $where/*, _.pick(options, 'prefix')*/));
          }
        };

        _.forOwn(value, function (item, prop) {
          if (prop.indexOf('$') === 0) {
            var $where = {};
            $where[prop] = item;
            $items.push(self.whereItemQuery(key, $where, _.assign({}, options, {json: false})));
            return;
          }

          traverse(prop, item, [prop]);
        });

        result = $items.join(' AND ');
        return $items.length > 1 ? '('+result+')' : result;
      })();
    }

    // If multiple keys we combine the different logic conditions
    if (_.isPlainObject(value) && Object.keys(value).length > 1) {
      return (function () {
        var $items = [];
        _.forOwn(value, function (item, logic) {
          var $where = {};
          $where[logic] = item;
          $items.push(self.whereItemQuery(key, $where, options));
        });

        return '('+$items.join(' AND ')+')';
      })();
    }

    // Do [] to $in/$notIn normalization
    if (value && (!fieldType || !(fieldType instanceof DataTypes.ARRAY))) {
      if (Array.isArray(value)) {
        value = {
          $in: value
        };
      } else if (value && Array.isArray(value.$not)) {
        value.$notIn = value.$not;
        delete value.$not;
      }
    }

    // normalize $not: non-bool|non-null to $ne
    if (value && typeof value.$not !== 'undefined' && [null, true, false].indexOf(value.$not) < 0) {
      value.$ne = value.$not;
      delete value.$not;
    }

    // Setup keys and comparators
    if (Array.isArray(value) && fieldType instanceof DataTypes.ARRAY) {
      value = this.escape(value, field);
    } else if (value && (value.$in || value.$notIn)) {
      comparator = 'IN';
      if (value.$notIn) comparator = 'NOT IN';

      if ((value.$in || value.$notIn) instanceof Utils.literal) {
        value = (value.$in || value.$notIn).val;
      } else if ((value.$in || value.$notIn).length) {
        value = '('+(value.$in || value.$notIn).map(function (item) {
          return self.escape(item);
        }).join(', ')+')';
      } else {
        value = '(NULL)';
      }
    } else if (value && (value.$any || value.$all)) {
      comparator = value.$any ? '= ANY' : '= ALL';
      if (value.$any && value.$any.$values || value.$all && value.$all.$values) {
        value = '(VALUES '+(value.$any && value.$any.$values || value.$all && value.$all.$values).map(function (value) {
          return '('+this.escape(value)+')';
        }.bind(this)).join(', ')+')';
      } else {
        value = '('+this.escape(value.$any || value.$all, field)+')';
      }
    } else if (value && (value.$between || value.$notBetween)) {
      comparator = 'BETWEEN';
      if (value.$notBetween) comparator = 'NOT BETWEEN';

      value = (value.$between || value.$notBetween).map(function (item) {
        return self.escape(item);
      }).join(' AND ');
    } else if (value && value.$raw) {
      value = value.$raw;
    } else if (value && value.$col) {
      value = value.$col.split('.');

      if (value.length > 2) {
        value = [
          value.slice(0, -1).join('.'),
          value[value.length - 1]
        ];
      }

      value = value.map(this.quoteIdentifier.bind(this)).join('.');
    } else {
      var escapeValue = true;
      var escapeOptions = {};

      if (_.isPlainObject(value)) {
        _.forOwn(value, function (item, key) {
          if (comparatorMap[key]) {
            comparator = comparatorMap[key];
            value = item;

            if (_.isPlainObject(value) && value.$any) {
              comparator += ' ANY';
              escapeOptions.isList = true;
              value = value.$any;
            } else if (_.isPlainObject(value) && value.$all) {
              comparator += ' ALL';
              escapeOptions.isList = true;
              value = value.$all;
            } else if (value && value.$col) {
              escapeValue = false;
              value = this.whereItemQuery(null, value);
            }
          }
        }.bind(this));
      }

      if (comparator === '=' && value === null) {
        comparator = 'IS';
      } else if (comparator === '!=' && value === null) {
        comparator = 'IS NOT';
      }

      escapeOptions.acceptStrings = comparator.indexOf('LIKE') !== -1;

      if (escapeValue) {
        value = this.escape(value, field, escapeOptions);

        //if ANY is used with like, add parentheses to generate correct query
        if (escapeOptions.acceptStrings && (comparator.indexOf('ANY') > comparator.indexOf('LIKE'))) {
         value = '(' + value + ')';
        }
      }
    }

    if (key) {
      var prefix = true;
      if (key._isSequelizeMethod) {
        key = this.handleSequelizeMethod(key);
      } else if (Utils.isColString(key)) {
        key = key.substr(1, key.length - 2).split('.');

        if (key.length > 2) {
          key = [
            key.slice(0, -1).join('.'),
            key[key.length - 1]
          ];
        }

        key = key.map(this.quoteIdentifier.bind(this)).join('.');
        prefix = false;
      } else {
        key = this.quoteIdentifier(key);
      }

      if (options.prefix && prefix) {
        if (options.prefix instanceof Utils.literal) {
          key = [this.handleSequelizeMethod(options.prefix), key].join('.');
        } else {
          key = [this.quoteTable(options.prefix), key].join('.');
        }
      }
      return [key, value].join(' '+comparator+' ');
    }
    return value;
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
      return self.whereItemsQuery(smth, {
        model: factory,
        prefix: prepend && tableName
      });
    } else if (typeof smth === 'number') {
      var primaryKeys = !!factory ? Object.keys(factory.primaryKeys) : [];

      if (primaryKeys.length > 0) {
        // Since we're just a number, assume only the first key
        primaryKeys = primaryKeys[0];
      } else {
        primaryKeys = 'id';
      }

      where[primaryKeys] = smth;

      return self.whereItemsQuery(where, {
        model: factory,
        prefix: prepend && tableName
      });
    } else if (typeof smth === 'string') {
      return self.whereItemsQuery(smth, {
        model: factory,
        prefix: prepend && tableName
      });
    } else if (Buffer.isBuffer(smth)) {
      result = this.escape(smth);
    } else if (Array.isArray(smth)) {
      if (smth.length === 0) return '1=1';
      if (Utils.canTreatArrayAsAnd(smth)) {
        var _smth = { $and: smth };
        result = self.getWhereConditions(_smth, tableName, factory, options, prepend);
      } else {
        result = Utils.format(smth, this.dialect);
      }
    } else if (smth === null) {
      return self.whereItemsQuery(smth, {
        model: factory,
        prefix: prepend && tableName
      });
    }

    return result ? result : '1=1';
  },

  booleanValue: function(value) {
    return value;
  }
};

module.exports = QueryGenerator;
