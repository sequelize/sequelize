'use strict';

const Utils = require('../../utils');
const SqlString = require('../../sql-string');
const Model = require('../../model');
const DataTypes = require('../../data-types');
const _ = require('lodash');
const util = require('util');
const Dottie = require('dottie');
const BelongsTo = require('../../associations/belongs-to');
const uuid = require('node-uuid');
const semver = require('semver');

/* istanbul ignore next */
function throwMethodUndefined(methodName) {
  throw new Error('The method "' + methodName + '" is not defined! Please add it to your sql dialect.');
}

const QueryGenerator = {
  options: {},

  extractTableDetails(tableName, options) {
    options = options || {};
    tableName = tableName || {};
    return {
      schema: tableName.schema || options.schema || 'public',
      tableName: _.isPlainObject(tableName) ? tableName.tableName : tableName,
      delimiter: tableName.delimiter || options.delimiter || '.'
    };
  },

  addSchema(param) {
    const self = this;

    if (!param._schema) return param.tableName || param;

    return {
      tableName: param.tableName || param,
      table: param.tableName || param,
      name: param.name || param,
      schema: param._schema,
      delimiter: param._schemaDelimiter || '.',
      toString() {
        return self.quoteTable(this);
      }
    };
  },

  /*
    Returns a query for dropping a schema
  */
  dropSchema(tableName, options) {
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
  createTableQuery(tableName, attributes, options) {
    throwMethodUndefined('createTableQuery');
  },

  versionQuery(tableName, attributes, options) {
    throwMethodUndefined('versionQuery');
  },

  describeTableQuery(tableName, schema, schemaDelimiter) {
    const table = this.quoteTable(
      this.addSchema({
        tableName,
        _schema: schema,
        _schemaDelimiter: schemaDelimiter
      })
    );

    return 'DESCRIBE ' + table + ';';
  },

  /*
    Returns a query for dropping a table.
  */
  dropTableQuery(tableName, options) {
    options = options || {};

    return `DROP TABLE IF EXISTS ${this.quoteTable(tableName)};`;
  },

  /*
    Returns a rename table query.
    Parameters:
      - originalTableName: Name of the table before execution.
      - futureTableName: Name of the table after execution.
  */
  renameTableQuery(before, after) {
    return `ALTER TABLE ${this.quoteTable(before)} RENAME TO ${this.quoteTable(after)};`;
  },

  /*
    Returns a query, which gets all available table names in the database.
  */
  /* istanbul ignore next */
  showTablesQuery() {
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
  addColumnQuery(tableName, attributes) {
    throwMethodUndefined('addColumnQuery');
  },

  /*
    Returns a query, which removes an attribute from an existing table.
    Parameters:
      - tableName: Name of the existing table
      - attributeName: Name of the obsolete attribute.
  */
  /* istanbul ignore next */
  removeColumnQuery(tableName, attributeName) {
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
  changeColumnQuery(tableName, attributes) {
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
  renameColumnQuery(tableName, attrNameBefore, attrNameAfter) {
    throwMethodUndefined('renameColumnQuery');
  },

  /*
    Returns an insert into command. Parameters: table name + hash of attribute-value-pairs.
  */
  insertQuery(table, valueHash, modelAttributes, options) {
    options = options || {};

    const modelAttributeMap = {};
    const fields = [];
    const values = [];
    let query;
    let valueQuery = '<%= tmpTable %>INSERT<%= ignoreDuplicates %> INTO <%= table %> (<%= attributes %>)<%= output %> VALUES (<%= values %>)';
    let emptyQuery = '<%= tmpTable %>INSERT<%= ignoreDuplicates %> INTO <%= table %><%= output %>';
    let outputFragment;
    let identityWrapperRequired = false;
    let tmpTable = '';         //tmpTable declaration for trigger

    if (modelAttributes) {
      Utils._.each(modelAttributes, (attribute, key) => {
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
      if (this._dialect.supports.returnValues.returning) {
        valueQuery += ' RETURNING *';
        emptyQuery += ' RETURNING *';
      } else if (!!this._dialect.supports.returnValues.output) {
        outputFragment = ' OUTPUT INSERTED.*';

        //To capture output rows when there is a trigger on MSSQL DB
        if (modelAttributes && options.hasTrigger && this._dialect.supports.tmpTableTrigger) {

          let tmpColumns = '';
          let outputColumns = '';
          tmpTable = 'declare @tmp table (<%= columns %>); ';

          for (const modelKey in modelAttributes){
            const attribute = modelAttributes[modelKey];
            if(!(attribute.type instanceof DataTypes.VIRTUAL)){
              if (tmpColumns.length > 0){
                tmpColumns += ',';
                outputColumns += ',';
              }

              tmpColumns += this.quoteIdentifier(attribute.field) + ' ' + attribute.type.toSql();
              outputColumns += 'INSERTED.' + this.quoteIdentifier(attribute.field);
            }
          }

          const replacement = {
            columns: tmpColumns
          };

          tmpTable = Utils._.template(tmpTable)(replacement).trim();
          outputFragment = ' OUTPUT ' + outputColumns + ' into @tmp';
          const selectFromTmp = ';select * from @tmp';

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
        const delimiter = '$func_' + uuid.v4().replace(/-/g, '') + '$';

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
    for (const key in valueHash) {
      if (valueHash.hasOwnProperty(key)) {
        const value = valueHash[key];
        fields.push(this.quoteIdentifier(key));

        // SERIALS' can't be NULL in postgresql, use DEFAULT where supported
        if (modelAttributeMap && modelAttributeMap[key] && modelAttributeMap[key].autoIncrement === true && !value) {
          if (!this._dialect.supports.autoIncrement.defaultValue) {
            fields.splice(-1, 1);
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

    const replacements = {
      ignoreDuplicates: options.ignoreDuplicates ? this._dialect.supports.IGNORE : '',
      table: this.quoteTable(table),
      attributes: fields.join(','),
      output: outputFragment,
      values: values.join(','),
      tmpTable
    };

    query = (replacements.attributes.length ? valueQuery : emptyQuery) + ';';
    if (identityWrapperRequired && this._dialect.supports.autoIncrement.identityInsert) {
      query = [
        'SET IDENTITY_INSERT', this.quoteTable(table), 'ON;',
        query,
        'SET IDENTITY_INSERT', this.quoteTable(table), 'OFF;'
      ].join(' ');
    }

    return Utils._.template(query)(replacements);
  },

  /*
    Returns an insert into command for multiple values.
    Parameters: table name + list of hashes of attribute-value-pairs.
  */
  bulkInsertQuery(tableName, attrValueHashes, options, rawAttributes) {
    options = options || {};
    rawAttributes = rawAttributes || {};

    const query = 'INSERT<%= ignoreDuplicates %> INTO <%= table %> (<%= attributes %>) VALUES <%= tuples %><%= onDuplicateKeyUpdate %><%= returning %>;';
    const tuples = [];
    const serials = [];
    const allAttributes = [];
    let onDuplicateKeyUpdate = '';

    for (const attrValueHash of attrValueHashes) {
      _.forOwn(attrValueHash, (value, key) => {
        if (allAttributes.indexOf(key) === -1) {
          allAttributes.push(key);
        }

        if (rawAttributes[key] && rawAttributes[key].autoIncrement === true) {
          serials.push(key);
        }
      });
    }

    for (const attrValueHash of attrValueHashes) {
      tuples.push('(' + allAttributes.map(key => {
        if (this._dialect.supports.bulkDefault && serials.indexOf(key) !== -1) {
          return attrValueHash[key] || 'DEFAULT';
        }
        return this.escape(attrValueHash[key], rawAttributes[key], { context: 'INSERT' });
      }).join(',') + ')');
    }

    if (this._dialect.supports.updateOnDuplicate && options.updateOnDuplicate) {
      onDuplicateKeyUpdate += ' ON DUPLICATE KEY UPDATE ' + options.updateOnDuplicate.map(attr => {
        const field = rawAttributes && rawAttributes[attr] && rawAttributes[attr].field || attr;
        const key = this.quoteIdentifier(field);
        return key + '=VALUES(' + key + ')';
      }).join(',');
    }

    const replacements = {
      ignoreDuplicates: options.ignoreDuplicates ? this._dialect.supports.ignoreDuplicates : '',
      table: this.quoteTable(tableName),
      attributes: allAttributes.map(attr => this.quoteIdentifier(attr)).join(','),
      tuples: tuples.join(','),
      onDuplicateKeyUpdate,
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
  updateQuery(tableName, attrValueHash, where, options, attributes) {
    options = options || {};
    _.defaults(options, this.options);

    attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, options.omitNull, options);

    const values = [];
    const modelAttributeMap = {};
    let query = '<%= tmpTable %>UPDATE <%= table %> SET <%= values %><%= output %> <%= where %>';
    let outputFragment;
    let tmpTable = '';        // tmpTable declaration for trigger
    let selectFromTmp = '';   // Select statement for trigger

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
          let tmpColumns = '';
          let outputColumns = '';

          for (const modelKey in attributes){
            const attribute = attributes[modelKey];
            if(!(attribute.type instanceof DataTypes.VIRTUAL)){
              if (tmpColumns.length > 0){
                tmpColumns += ',';
                outputColumns += ',';
              }

              tmpColumns += this.quoteIdentifier(attribute.field) + ' ' + attribute.type.toSql();
              outputColumns += 'INSERTED.' + this.quoteIdentifier(attribute.field);
            }
          }

          const replacement ={
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
      Utils._.each(attributes, (attribute, key) => {
        modelAttributeMap[key] = attribute;
        if (attribute.field) {
          modelAttributeMap[attribute.field] = attribute;
        }
      });
    }

    for (const key in attrValueHash) {
      if (modelAttributeMap && modelAttributeMap[key] &&
          modelAttributeMap[key].autoIncrement === true &&
          !this._dialect.supports.autoIncrement.update) {
        // not allowed to update identity column
        continue;
      }

      const value = attrValueHash[key];
      values.push(this.quoteIdentifier(key) + '=' + this.escape(value, (modelAttributeMap && modelAttributeMap[key] || undefined), { context: 'UPDATE' }));
    }

    const replacements = {
      table: this.quoteTable(tableName),
      values: values.join(','),
      output: outputFragment,
      where: this.whereQuery(where),
      tmpTable
    };

    if (values.length === 0) {
      return '';
    }

    return Utils._.template(query)(replacements).trim();
  },

  /*
    Returns an upsert query.
  */
  upsertQuery(tableName, insertValues, updateValues, where, rawAttributes, options) {
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
  deleteQuery(tableName, where, options) {
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
  incrementQuery(tableName, attrValueHash, where, options) {
    attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull);

    const values = [];
    let query = 'UPDATE <%= table %> SET <%= values %><%= output %> <%= where %>';
    let outputFragment;

    if (this._dialect.supports.returnValues) {
      if (!!this._dialect.supports.returnValues.returning) {
        query += ' RETURNING *';
      } else if (!!this._dialect.supports.returnValues.output) {
        outputFragment = ' OUTPUT INSERTED.*';
      }
    }

    for (const key in attrValueHash) {
      const value = attrValueHash[key];
      values.push(this.quoteIdentifier(key) + '=' + this.quoteIdentifier(key) + ' + ' + this.escape(value));
    }

    options = options || {};
    for (const key in options) {
      const value = options[key];
      values.push(this.quoteIdentifier(key) + '=' + this.escape(value));
    }

    const replacements = {
      table: this.quoteTable(tableName),
      values: values.join(','),
      output: outputFragment,
      where: this.whereQuery(where)
    };

    return Utils._.template(query)(replacements);
  },

  nameIndexes(indexes, rawTablename) {
    return Utils._.map(indexes, index => {
      if (!index.hasOwnProperty('name')) {
        const onlyAttributeNames = index.fields.map(field => (typeof field === 'string') ? field : (field.name || field.attribute));
        index.name = Utils.underscore(rawTablename + '_' + onlyAttributeNames.join('_'));
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
  addIndexQuery(tableName, attributes, options, rawTablename) {
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

    const fieldsSql = options.fields.map(field => {
      if (typeof field === 'string') {
        return this.quoteIdentifier(field);
      } else if (field._isSequelizeMethod) {
        return this.handleSequelizeMethod(field);
      } else {
        let result = '';

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
    });

    if (!options.name) {
      // Mostly for cases where addIndex is called directly by the user without an options object (for example in migrations)
      // All calls that go through sequelize should already have a name
      options = this.nameIndexes([options], options.prefix)[0];
    }

    options = Model._conformIndex(options);

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

    const concurrently = this._dialect.supports.index.concurrently && options.concurrently ? 'CONCURRENTLY' : undefined;
    let ind;
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
  showIndexesQuery(tableName, options) {
    throwMethodUndefined('showIndexesQuery');
  },

  /*
    Returns a remove index query.
    Parameters:
      - tableName: Name of an existing table.
      - indexNameOrAttributes: The name of the index as string or an array of attribute names.
  */
  /* istanbul ignore next */
  removeIndexQuery(tableName, indexNameOrAttributes) {
    throwMethodUndefined('removeIndexQuery');
  },

  /*
    This method transforms an array of attribute hashes into equivalent
    sql attribute definition.
  */
  /* istanbul ignore next */
  attributesToSQL(attributes) {
    throwMethodUndefined('attributesToSQL');
  },

  /*
    Returns all auto increment fields of a factory.
  */
  /* istanbul ignore next */
  findAutoIncrementField(factory) {
    throwMethodUndefined('findAutoIncrementField');
  },


  quoteTable(param, as) {
    let table = '';

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
  quote(obj, parent, force) {
    if (Utils._.isString(obj)) {
      return this.quoteIdentifiers(obj, force);
    } else if (Array.isArray(obj)) {
      // loop through array, adding table names of models to quoted
      // (checking associations to see if names should be singularised or not)
      const len = obj.length;
      const tableNames = [];
      let parentAssociation;
      let item;
      let model;
      let as;
      let association;
      let i = 0;

      for (i = 0; i < len - 1; i++) {
        item = obj[i];
        if (item._modelAttribute || Utils._.isString(item) || item._isSequelizeMethod || 'raw' in item) {
          break;
        }

        if (typeof item === 'function' && item.prototype instanceof Model) {
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
      let sql = (i > 0 ? this.quoteIdentifier(tableNames.join('.')) + '.' : (Utils._.isString(obj[0]) && parent ? this.quoteIdentifier(parent.name) + '.' : '')) + this.quote(obj[i], parent, force);
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
  createTrigger(tableName, triggerName, timingType, fireOnArray, functionName, functionParams, optionsArray) {
    throwMethodUndefined('createTrigger');
  },

  /*
   Drop a trigger
   */
  /* istanbul ignore next */
  dropTrigger(tableName, triggerName) {
    throwMethodUndefined('dropTrigger');
  },

  /*
   Rename a trigger
  */
  /* istanbul ignore next */
  renameTrigger(tableName, oldTriggerName, newTriggerName) {
    throwMethodUndefined('renameTrigger');
  },

  /*
   Create a function
   */
  /* istanbul ignore next */
  createFunction(functionName, params, returnType, language, body, options) {
    throwMethodUndefined('createFunction');
  },

  /*
   Drop a function
   */
  /* istanbul ignore next */
  dropFunction(functionName, params) {
    throwMethodUndefined('dropFunction');
  },

  /*
   Rename a function
   */
  /* istanbul ignore next */
  renameFunction(oldFunctionName, params, newFunctionName) {
    throwMethodUndefined('renameFunction');
  },

  /*
    Escape an identifier (e.g. a table or attribute name)
  */
  /* istanbul ignore next */
  quoteIdentifier(identifier, force) {
    throwMethodUndefined('quoteIdentifier');
  },

  /*
    Split an identifier into .-separated tokens and quote each part
  */
  quoteIdentifiers(identifiers, force) {
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
  escape(value, field, options) {
    options = options || {};

    if (value !== null && value !== undefined) {
      if (value._isSequelizeMethod) {
        return this.handleSequelizeMethod(value);
      } else {
        if (field && field.type) {
          if (this.typeValidation && field.type.validate && value) {
            if (options.isList && Array.isArray(value)) {
              for (const item of value) {
                field.type.validate(item, options);
              }
            } else {
              field.type.validate(value, options);
            }
          }

          if (field.type.stringify) {
            // Users shouldn't have to worry about these args - just give them a function that takes a single arg
            const simpleEscape = _.partialRight(SqlString.escape, this.options.timezone, this.dialect);

            value = field.type.stringify(value, { escape: simpleEscape, field, timezone: this.options.timezone });

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
  getForeignKeysQuery(tableName, schemaName) {
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
  dropForeignKeyQuery(tableName, foreignKey) {
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

  selectQuery(tableName, options, model) {
    // Enter and change at your own peril -- Mick Hansen

    options = options || {};

    const limit = options.limit;
    const mainModel = model;
    const mainQueryItems = [];
    const subQuery = options.subQuery === undefined ? limit && options.hasMultiAssociation : options.subQuery;
    const subQueryItems = [];
    let table = null;
    let query;
    let mainAttributes = options.attributes && options.attributes.slice();
    let mainJoinQueries = [];
    // We'll use a subquery if we have a hasMany association and a limit
    let subQueryAttributes = null;
    let subJoinQueries = [];
    let mainTableAs = null;

    if (options.tableAs) {
      mainTableAs = this.quoteTable(options.tableAs);
    } else if (!Array.isArray(tableName) && model) {
      mainTableAs = this.quoteTable(model.name);
    }

    table = !Array.isArray(tableName) ? this.quoteTable(tableName) : tableName.map(t => {
      if (Array.isArray(t)) {
        return this.quoteTable(t[0], t[1]);
      }
      return this.quoteTable(t, true);
    }).join(', ');

    if (subQuery && mainAttributes) {
      for (const keyAtt of model.primaryKeyAttributes) {
        // Check if mainAttributes contain the primary key of the model either as a field or an aliased field
        if (!_.find(mainAttributes, attr => keyAtt === attr || keyAtt === attr[0] || keyAtt === attr[1])) {
          mainAttributes.push(model.rawAttributes[keyAtt].field ? [keyAtt, model.rawAttributes[keyAtt].field] : keyAtt);
        }
      }
    }

    // Escape attributes
    mainAttributes = mainAttributes && mainAttributes.map(attr => {
      let addTable = true;

      if (attr._isSequelizeMethod) {
        return this.handleSequelizeMethod(attr);
      }

      if (Array.isArray(attr)) {
        if (attr.length !== 2) {
          throw new Error(JSON.stringify(attr) + ' is not a valid attribute definition. Please use the following format: [\'attribute definition\', \'alias\']');
        }
        attr = attr.slice();

        if (attr[0]._isSequelizeMethod) {
          attr[0] = this.handleSequelizeMethod(attr[0]);
          addTable = false;
        } else if (attr[0].indexOf('(') === -1 && attr[0].indexOf(')') === -1) {
          attr[0] = this.quoteIdentifier(attr[0]);
        }
        attr = [attr[0], this.quoteIdentifier(attr[1])].join(' AS ');
      } else {
        attr = attr.indexOf(Utils.TICK_CHAR) < 0 && attr.indexOf('"') < 0 ? this.quoteIdentifiers(attr) : attr;
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
      const generateJoinQueries = (include, parentTable) => {
        const association = include.association;
        const through = include.through;
        const joinType = include.required ? ' INNER JOIN ' : ' LEFT OUTER JOIN ';
        const parentIsTop = !include.parent.association && include.parent.model.name === options.model.name;
        const whereOptions = Utils._.clone(options);
        const table = include.model.getTableName();
        const joinQueries = {
          mainQuery: [],
          subQuery: []
        };
        let as = include.as;
        let joinQueryItem = '';
        let attributes;
        let targetWhere;

        whereOptions.keysEscaped = true;

        if (tableName !== parentTable && mainTableAs !== parentTable) {
          as = parentTable + '.' + include.as;
        }

        // includeIgnoreAttributes is used by aggregate functions
        if (options.includeIgnoreAttributes !== false) {
          attributes = include.attributes.map(attr => {
            let attrAs = attr;
            let verbatim = false;

            if (Array.isArray(attr) && attr.length === 2) {
              if (attr[0]._isSequelizeMethod) {
                if (attr[0] instanceof Utils.Literal ||
                  attr[0] instanceof Utils.Cast ||
                  attr[0] instanceof Utils.Fn
                ) {
                  verbatim = true;
                }
              }

              attr = attr.map(attr => attr._isSequelizeMethod ? this.handleSequelizeMethod(attr) : attr);

              attrAs = attr[1];
              attr = attr[0];
            } else if (attr instanceof Utils.Literal) {
              return attr.val; // We trust the user to rename the field correctly
            } else if (attr instanceof Utils.Cast || attr instanceof Utils.Fn) {
              throw new Error(
                'Tried to select attributes using Sequelize.cast or Sequelize.fn without specifying an alias for the result, during eager loading. ' +
                'This means the attribute will not be added to the returned instance'
              );
            }

            let prefix;
            if (verbatim === true) {
              prefix = attr;
            } else {
              prefix = this.quoteIdentifier(as) + '.' + this.quoteIdentifier(attr);
            }
            return prefix + ' AS ' + this.quoteIdentifier(as + '.' + attrAs, true);
          });
          if (include.subQuery && subQuery) {
            subQueryAttributes = subQueryAttributes.concat(attributes);
          } else {
            mainAttributes = mainAttributes.concat(attributes);
          }
        }

        if (through) {
          const throughTable = through.model.getTableName();
          const throughAs = as + '.' + through.as;
          const throughAttributes = through.attributes.map(attr =>
            this.quoteIdentifier(throughAs) + '.' + this.quoteIdentifier(Array.isArray(attr) ? attr[0] : attr)
             + ' AS '
             + this.quoteIdentifier(throughAs + '.' + (Array.isArray(attr) ? attr[1] : attr))
          );
          const primaryKeysSource = association.source.primaryKeyAttributes;
          const tableSource = parentTable;
          const identSource = association.identifierField;
          const primaryKeysTarget = association.target.primaryKeyAttributes;
          const tableTarget = as;
          const identTarget = association.foreignIdentifierField;
          const attrTarget = association.target.rawAttributes[primaryKeysTarget[0]].field || primaryKeysTarget[0];

          let attrSource = primaryKeysSource[0];
          let sourceJoinOn;
          let targetJoinOn;
          let throughWhere;

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
            sourceJoinOn = this.quoteIdentifier(tableSource + '.' + attrSource) + ' = ';
          } else {
            sourceJoinOn = this.quoteTable(tableSource) + '.' + this.quoteIdentifier(attrSource) + ' = ';
          }
          sourceJoinOn += this.quoteIdentifier(throughAs) + '.' + this.quoteIdentifier(identSource);

          // Filter statement for right side of through
          // Used by both join and subquery where
          targetJoinOn = this.quoteIdentifier(tableTarget) + '.' + this.quoteIdentifier(attrTarget) + ' = ';
          targetJoinOn += this.quoteIdentifier(throughAs) + '.' + this.quoteIdentifier(identTarget);

          if (include.through.where) {
            throughWhere = this.getWhereConditions(include.through.where, this.sequelize.literal(this.quoteIdentifier(throughAs)), include.through.model);
          }

          if (this._dialect.supports.joinTableDependent) {
            // Generate a wrapped join so that the through table join can be dependent on the target join
            joinQueryItem += joinType + '(';
            joinQueryItem += this.quoteTable(throughTable, throughAs);
            joinQueryItem += ' INNER JOIN ' + this.quoteTable(table, as) + ' ON ';
            joinQueryItem += targetJoinOn;

            if (throughWhere) {
              joinQueryItem += ' AND ' + throughWhere;
            }

            joinQueryItem += ') ON '+sourceJoinOn;
          } else {
            // Generate join SQL for left side of through
            joinQueryItem += joinType + this.quoteTable(throughTable, throughAs)  + ' ON ';
            joinQueryItem += sourceJoinOn;

            // Generate join SQL for right side of through
            joinQueryItem += joinType + this.quoteTable(table, as) + ' ON ';
            joinQueryItem += targetJoinOn;

            if (throughWhere) {
              joinQueryItem += ' AND ' + throughWhere;
            }

          }

          if (include.where || include.through.where) {
            if (include.where) {
              targetWhere = this.getWhereConditions(include.where, this.sequelize.literal(this.quoteIdentifier(as)), include.model, whereOptions);
              if (targetWhere) {
                joinQueryItem += ' AND ' + targetWhere;
              }
            }
            if (subQuery && include.required) {

              if (!options.where) options.where = {};

              let parent = include;
              let child = include;
              let nestedIncludes = [];
              let query;

              while (parent = parent.parent) {
                nestedIncludes = [_.extend({}, child, {include: nestedIncludes})];
                child = parent;
              }

              const topInclude = nestedIncludes[0];
              const topParent = topInclude.parent;

              if (topInclude.through && Object(topInclude.through.model) === topInclude.through.model) {
                query = this.selectQuery(topInclude.through.model.getTableName(), {
                  attributes: [topInclude.through.model.primaryKeyField],
                  include: Model._validateIncludedElements({
                    model: topInclude.through.model,
                    include: [{
                      association: topInclude.association.toTarget,
                      required: true
                    }]
                  }).include,
                  model: topInclude.through.model,
                  where: { $and: [
                    this.sequelize.asIs([
                      this.quoteTable(topParent.model.name) + '.' + this.quoteIdentifier(topParent.model.primaryKeyField),
                      this.quoteIdentifier(topInclude.through.model.name) + '.' + this.quoteIdentifier(topInclude.association.identifierField)
                    ].join(' = ')),
                    topInclude.through.where
                  ]},
                  limit: 1,
                  includeIgnoreAttributes: false
                }, topInclude.through.model);
              } else {
                query = this.selectQuery(topInclude.model.tableName, {
                  attributes: [topInclude.model.primaryKeyAttributes[0]],
                  include: topInclude.include,
                  where: {
                    $join: this.sequelize.asIs([
                      this.quoteTable(topParent.model.name) + '.' + this.quoteIdentifier(topParent.model.primaryKeyAttributes[0]),
                      this.quoteIdentifier(topInclude.model.name) + '.' + this.quoteIdentifier(topInclude.association.identifierField)
                    ].join(' = '))
                  },
                  limit: 1,
                  includeIgnoreAttributes: false
                }, topInclude.model);
              }

              options.where['__' + throughAs] = this.sequelize.asIs([
                '(',
                query.replace(/\;$/, ''),
                ')',
                'IS NOT NULL'
              ].join(' '));
            }
          }
        } else {
          if (subQuery && include.subQueryFilter) {
            const associationWhere = {};

            associationWhere[association.identifierField] = {
              $raw: this.quoteTable(parentTable) + '.' + this.quoteIdentifier(association.source.primaryKeyField)
            };

            if (!options.where) options.where = {};

            // Creating the as-is where for the subQuery, checks that the required association exists
            const $query = this.selectQuery(include.model.getTableName(), {
              attributes: [association.identifierField],
              where: {
                $and: [
                  associationWhere,
                  include.where || {}
                ]
              },
              limit: 1
            }, include.model);

            const subQueryWhere = this.sequelize.asIs([
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

          joinQueryItem = ' ' + this.joinIncludeQuery({
            model: mainModel,
            subQuery: options.subQuery,
            include,
            groupedLimit: options.groupedLimit
          });
        }

        if (include.subQuery && subQuery) {
          joinQueries.subQuery.push(joinQueryItem);
        } else {
          joinQueries.mainQuery.push(joinQueryItem);
        }

        if (include.include) {
          for (const childInclude of include.include) {

            if (childInclude.separate || childInclude._pseudo) {
              continue;
            }

            const childJoinQueries = generateJoinQueries(childInclude, as);

            if (childInclude.subQuery && subQuery) {
              joinQueries.subQuery = joinQueries.subQuery.concat(childJoinQueries.subQuery);
            }
            if (childJoinQueries.mainQuery) {
              joinQueries.mainQuery = joinQueries.mainQuery.concat(childJoinQueries.mainQuery);
            }

          }
        }

        return joinQueries;
      };

      // Loop through includes and generate subqueries
      for (const include of options.include) {
        if (include.separate) {
          continue;
        }

        const joinQueries = generateJoinQueries(include, mainTableAs);

        subJoinQueries = subJoinQueries.concat(joinQueries.subQuery);
        mainJoinQueries = mainJoinQueries.concat(joinQueries.mainQuery);

      }
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
          options.groupedLimit.values.map(value => {
            const where = _.assign({}, options.where);
            where[options.groupedLimit.on] = value;

            return '('+this.selectQuery(
              tableName,
              {
                attributes: options.attributes,
                limit: options.groupedLimit.limit,
                order: options.order,
                where
              },
              model
            ).replace(/;$/, '')+')';
          }).join(
            this._dialect.supports['UNION ALL'] ?' UNION ALL ' : ' UNION '
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
          _.each(mainQueryItems, (value, key) => {
            if(value.match(/^SELECT/)) {
              mainQueryItems[key] = this.selectFromTableFragment(options, model, mainAttributes, table, mainTableAs, options.where);
            }
          });
        }
      }
    }

    // Add GROUP BY to sub or main query
    if (options.group) {
      options.group = Array.isArray(options.group) ? options.group.map(t => this.quote(t, model)).join(', ') : options.group;
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
      const orders = this.getQueryOrders(options, model, subQuery);

      if (orders.mainQueryOrder.length) {
        mainQueryItems.push(' ORDER BY ' + orders.mainQueryOrder.join(', '));
      }
      if (orders.subQueryOrder.length) {
        subQueryItems.push(' ORDER BY ' + orders.subQueryOrder.join(', '));
      }
    }

    // Add LIMIT, OFFSET to sub or main query
    const limitOrder = this.addLimitAndOffset(options, model);
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
      let lock = options.lock;
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
      if (this._dialect.supports.lockOf && options.lock.of && options.lock.of.prototype instanceof Model) {
        query += ' OF ' + this.quoteTable(options.lock.of.name);
      }
    }

    query += ';';

    return query;
  },

  getQueryOrders(options, model, subQuery) {
    const mainQueryOrder = [];
    const subQueryOrder = [];

    const validateOrder = order => {
      if (order instanceof Utils.Literal) return;

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
      for (const t of options.order) {
        if (Array.isArray(t) && _.size(t) > 1) {
          if ((typeof t[0] === 'function' && t[0].prototype instanceof Model) || (typeof t[0].model === 'function' && t[0].model.prototype instanceof Model)) {
            if (typeof t[t.length - 2] === 'string') {
              validateOrder(_.last(t));
            }
          } else {
            validateOrder(_.last(t));
          }
        }

        if (subQuery && (Array.isArray(t) && !(typeof t[0] === 'function' && t[0].prototype instanceof Model) && !(t[0] && typeof t[0].model === 'function' && t[0].model.prototype instanceof Model))) {
          subQueryOrder.push(this.quote(t, model));
        }

        mainQueryOrder.push(this.quote(t, model));
      }
    } else {
      var sql = this.quote(typeof options.order === 'string' ? new Utils.Literal(options.order) : options.order, model);
      if (subQuery) {
        subQueryOrder.push(sql);
      }
      mainQueryOrder.push(sql);
    }

    return {mainQueryOrder, subQueryOrder};
  },

  selectFromTableFragment(options, model, attributes, tables, mainTableAs, whereClause) {
    let fragment = 'SELECT ' + attributes.join(', ') + ' FROM ' + tables;

    if(mainTableAs) {
      fragment += ' AS ' + mainTableAs;
    }

    return fragment;
  },

  joinIncludeQuery(options) {
    const subQuery = options.subQuery;
    const include = options.include;
    const association = include.association;
    const parent = include.parent;
    const parentIsTop = !include.parent.association && include.parent.model.name === options.model.name;
    const joinType = include.required ? 'INNER JOIN ' : 'LEFT OUTER JOIN ';
    let $parent;
    let joinWhere;

    /* Attributes for the left side */
    const left = association.source;
    const attrLeft = association instanceof BelongsTo ?
                     association.identifier :
                     left.primaryKeyAttribute;
    const fieldLeft = association instanceof BelongsTo ?
                      association.identifierField :
                      left.rawAttributes[left.primaryKeyAttribute].field;
    let asLeft;

    /* Attributes for the right side */
    const right = include.model;
    const tableRight = right.getTableName();
    const fieldRight = association instanceof BelongsTo ?
                     right.rawAttributes[association.targetIdentifier || right.primaryKeyAttribute].field :
                     association.identifierField;
    let asRight = include.as;

    while (($parent = ($parent && $parent.parent || include.parent)) && $parent.association) {
      if (asLeft) {
        asLeft = [$parent.as, asLeft].join('.');
      } else {
        asLeft = $parent.as;
      }
    }

    if (!asLeft) asLeft = parent.as || parent.model.name;
    else asRight = [asLeft, asRight].join('.');

    let joinOn = [
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
  setAutocommitQuery(value, options) {
    if (options.parent) {
      return;
    }

    // no query when value is not explicitly set
    if (typeof value === 'undefined' || value === null) {
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
  setIsolationLevelQuery(value, options) {
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
  startTransactionQuery(transaction) {
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
  deferConstraintsQuery() {},

  setConstraintQuery() {},
  setDeferredQuery() {},
  setImmediateQuery() {},

  /**
   * Returns a query that commits a transaction.
   *
   * @param  {Object} options An object with options.
   * @return {String}         The generated sql query.
   */
  commitTransactionQuery(transaction) {
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
  rollbackTransactionQuery(transaction) {
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
  addLimitAndOffset(options, model) {
    let fragment = '';

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

  handleSequelizeMethod(smth, tableName, factory, options, prepend) {
    let result;

    if (smth instanceof Utils.Where) {
      let value = smth.logic;
      let key;

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
    } else if (smth instanceof Utils.Literal) {
      result = smth.val;
    } else if (smth instanceof Utils.Cast) {
      if (smth.val._isSequelizeMethod) {
        result = this.handleSequelizeMethod(smth.val, tableName, factory, options, prepend);
      } else {
        result = this.escape(smth.val);
      }

      result = 'CAST(' + result + ' AS ' + smth.type.toUpperCase() + ')';
    } else if (smth instanceof Utils.Fn) {
      result = smth.fn + '(' + smth.args.map(arg => {
        if (arg._isSequelizeMethod) {
          return this.handleSequelizeMethod(arg, tableName, factory, options, prepend);
        } else {
          return this.escape(arg);
        }
      }).join(', ') + ')';
    } else if (smth instanceof Utils.Col) {
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

  whereQuery(where, options) {
    const query = this.whereItemsQuery(where, options);
    if (query && query.length) {
      return 'WHERE '+query;
    }
    return '';
  },
  whereItemsQuery(where, options, binding) {
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

    const items = [];

    binding = binding || 'AND';
    if (binding.substr(0, 1) !== ' ') binding = ' '+binding+' ';

    if (_.isPlainObject(where)) {
      _.forOwn(where, (value, key) => {
        items.push(this.whereItemQuery(key, value, options));
      });
    } else {
      items.push(this.whereItemQuery(undefined, where, options));
    }

    return items.length && items.filter(item => item && item.length).join(binding) || '';
  },
  whereItemQuery(key, value, options) {
    options = options || {};

    let binding;
    let outerBinding;
    let comparator = '=';
    let field = options.field || options.model && options.model.rawAttributes && options.model.rawAttributes[key] || options.model && options.model.fieldRawAttributesMap && options.model.fieldRawAttributesMap[key];
    let fieldType = options.type || (field && field.type);

    if (key && typeof key === 'string' && key.indexOf('.') !== -1 && options.model) {
      if (options.model.rawAttributes[key.split('.')[0]] && options.model.rawAttributes[key.split('.')[0]].type instanceof DataTypes.JSON) {
        field = options.model.rawAttributes[key.split('.')[0]];
        fieldType = field.type;
        const tmp = value;
        value = {};

        Dottie.set(value, key.split('.').slice(1), tmp);
        key = field.field || key.split('.')[0];
      }
    }

    const comparatorMap = {
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
      $contained: '<@',
      $adjacent: '-|-',
      $strictLeft: '<<',
      $strictRight: '>>',
      $noExtendRight: '&<',
      $noExtendLeft: '&>'
    };

    // Maintain BC
    const aliasMap = {
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
      _.forOwn(value, (item, key) => {
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

    if (value && value._isSequelizeMethod && !(key !== undefined && value instanceof Utils.Fn)) {
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
        value = value.map(item => {
          let itemQuery = this.whereItemsQuery(item, options, ' AND ');
          if ((Array.isArray(item) || _.isPlainObject(item)) && _.size(item) > 1) {
            itemQuery = '('+itemQuery+')';
          }
          return itemQuery;
        }).filter(item => item && item.length);

        // $or: [] should return no data.
        // $not of no restriction should also return no data
        if ((key === '$or' || key === '$not') && value.length === 0) {
          return '0 = 1';
        }

        return value.length ? outerBinding + '('+value.join(binding)+')' : undefined;
      } else {
        value = this.whereItemsQuery(value, options, binding);

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
        value = _.reduce(value, (result, _value, key) => {
          result.push(_.zipObject([key], [_value]));
          return result;
        }, []);
      }

      value = value.map(_value => this.whereItemQuery(key, _value, options)).filter(item => item && item.length);

      return value.length ? '('+value.join(binding)+')' : undefined;
    }

    if (_.isPlainObject(value) && fieldType instanceof DataTypes.JSON && options.json !== false) {
      const items = [];
      const traverse = (prop, item, path) => {
        const where = {};
        let cast;

        if (path[path.length - 1].indexOf('::') > -1) {
          const tmp = path[path.length - 1].split('::');
          cast = tmp[1];
          path[path.length - 1] = tmp[0];
        }

        let baseKey = this.quoteIdentifier(key)+'#>>\'{'+path.join(', ')+'}\'';

        if (options.prefix) {
          if (options.prefix instanceof Utils.Literal) {
            baseKey = this.handleSequelizeMethod(options.prefix)+'.'+baseKey;
          } else {
            baseKey = this.quoteTable(options.prefix)+'.'+baseKey;
          }
        }

        baseKey = '('+baseKey+')';

        const castKey = item => {
          let key = baseKey;

          if (!cast) {
            if (typeof item === 'number') {
              cast = 'double precision';
            } else if (item instanceof Date) {
              cast = 'timestamptz';
            } else if (typeof item === 'boolean') {
              cast = 'boolean';
            }
          }

          if (cast) {
            key += '::'+cast;
          }

          return key;
        };

        if (_.isPlainObject(item)) {
          _.forOwn(item, (item, prop) => {
            if (prop.indexOf('$') === 0) {
              where[prop] = item;
              const key = castKey(item);

              items.push(this.whereItemQuery(new Utils.Literal(key), where/*, _.pick(options, 'prefix')*/));
            } else {
              traverse(prop, item, path.concat([prop]));
            }
          });
        } else {
          where.$eq = item;
          const key = castKey(item);

          items.push(this.whereItemQuery(new Utils.Literal(key), where/*, _.pick(options, 'prefix')*/));
        }
      };

      _.forOwn(value, (item, prop) => {
        if (prop.indexOf('$') === 0) {
          const where = {};
          where[prop] = item;
          items.push(this.whereItemQuery(key, where, _.assign({}, options, {json: false})));
          return;
        }

        traverse(prop, item, [prop]);
      });

      const result = items.join(' AND ');
      return items.length > 1 ? '('+result+')' : result;
    }

    // If multiple keys we combine the different logic conditions
    if (_.isPlainObject(value) && Object.keys(value).length > 1) {
      const items = [];
      _.forOwn(value, (item, logic) => {
        const where = {};
        where[logic] = item;
        items.push(this.whereItemQuery(key, where, options));
      });

      return '('+items.join(' AND ')+')';
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

      if ((value.$in || value.$notIn) instanceof Utils.Literal) {
        value = (value.$in || value.$notIn).val;
      } else if ((value.$in || value.$notIn).length) {
        value = '('+(value.$in || value.$notIn).map(item => this.escape(item)).join(', ')+')';
      } else {
        if (value.$in) {
          value = '(NULL)';
        } else {
          return '';
        }
      }
    } else if (value && (value.$any || value.$all)) {
      comparator = value.$any ? '= ANY' : '= ALL';
      if (value.$any && value.$any.$values || value.$all && value.$all.$values) {
        value = '(VALUES '+(value.$any && value.$any.$values || value.$all && value.$all.$values).map(value => '('+this.escape(value)+')').join(', ')+')';
      } else {
        value = '('+this.escape(value.$any || value.$all, field)+')';
      }
    } else if (value && (value.$between || value.$notBetween)) {
      comparator = 'BETWEEN';
      if (value.$notBetween) comparator = 'NOT BETWEEN';

      value = (value.$between || value.$notBetween).map(item => this.escape(item)).join(' AND ');
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

      value = value.map(identifier => this.quoteIdentifier(identifier)).join('.');
    } else {
      let escapeValue = true;
      const escapeOptions = {};

      if (_.isPlainObject(value)) {
        _.forOwn(value, (item, key) => {
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
        });
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
      let prefix = true;
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

        key = key.map(identifier => this.quoteIdentifier(identifier)).join('.');
        prefix = false;
      } else {
        key = this.quoteIdentifier(key);
      }

      if (options.prefix && prefix) {
        if (options.prefix instanceof Utils.Literal) {
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
  getWhereConditions(smth, tableName, factory, options, prepend) {
    let result = null;
    const where = {};

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
      return this.whereItemsQuery(smth, {
        model: factory,
        prefix: prepend && tableName
      });
    } else if (typeof smth === 'number') {
      let primaryKeys = !!factory ? Object.keys(factory.primaryKeys) : [];

      if (primaryKeys.length > 0) {
        // Since we're just a number, assume only the first key
        primaryKeys = primaryKeys[0];
      } else {
        primaryKeys = 'id';
      }

      where[primaryKeys] = smth;

      return this.whereItemsQuery(where, {
        model: factory,
        prefix: prepend && tableName
      });
    } else if (typeof smth === 'string') {
      return this.whereItemsQuery(smth, {
        model: factory,
        prefix: prepend && tableName
      });
    } else if (Buffer.isBuffer(smth)) {
      result = this.escape(smth);
    } else if (Array.isArray(smth)) {
      if (smth.length === 0) return '1=1';
      if (Utils.canTreatArrayAsAnd(smth)) {
        const _smth = { $and: smth };
        result = this.getWhereConditions(_smth, tableName, factory, options, prepend);
      } else {
        result = Utils.format(smth, this.dialect);
      }
    } else if (smth === null) {
      return this.whereItemsQuery(smth, {
        model: factory,
        prefix: prepend && tableName
      });
    }

    return result ? result : '1=1';
  },

  booleanValue(value) {
    return value;
  }
};

module.exports = QueryGenerator;
