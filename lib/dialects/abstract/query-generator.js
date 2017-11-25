'use strict';

const Utils = require('../../utils');
const SqlString = require('../../sql-string');
const Model = require('../../model');
const DataTypes = require('../../data-types');
const util = require('util');
const _ = require('lodash');
const Dottie = require('dottie');
const Association = require('../../associations/base');
const BelongsTo = require('../../associations/belongs-to');
const BelongsToMany = require('../../associations/belongs-to-many');
const HasMany = require('../../associations/has-many');
const Op = require('../../operators');
const uuid = require('uuid');
const semver = require('semver');

const QueryGenerator = {
  _templateSettings: require('lodash').runInContext().templateSettings,
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

  dropSchema(tableName, options) {
    return this.dropTableQuery(tableName, options);
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

  dropTableQuery(tableName) {
    return `DROP TABLE IF EXISTS ${this.quoteTable(tableName)};`;
  },

  renameTableQuery(before, after) {
    return `ALTER TABLE ${this.quoteTable(before)} RENAME TO ${this.quoteTable(after)};`;
  },

  /*
    Returns an insert into command. Parameters: table name + hash of attribute-value-pairs.
   @private
  */
  insertQuery(table, valueHash, modelAttributes, options) {
    options = options || {};
    _.defaults(options, this.options);

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
      _.each(modelAttributes, (attribute, key) => {
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
      } else if (this._dialect.supports.returnValues.output) {
        outputFragment = ' OUTPUT INSERTED.*';

        //To capture output rows when there is a trigger on MSSQL DB
        if (modelAttributes && options.hasTrigger && this._dialect.supports.tmpTableTrigger) {

          let tmpColumns = '';
          let outputColumns = '';
          tmpTable = 'declare @tmp table (<%= columns %>); ';

          for (const modelKey in modelAttributes) {
            const attribute = modelAttributes[modelKey];
            if (!(attribute.type instanceof DataTypes.VIRTUAL)) {
              if (tmpColumns.length > 0) {
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

          tmpTable = _.template(tmpTable, this._templateSettings)(replacement).trim();
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

          values.push(this.escape(value, modelAttributeMap && modelAttributeMap[key] || undefined, { context: 'INSERT' }));
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

    return _.template(query, this._templateSettings)(replacements);
  },

  /*
    Returns an insert into command for multiple values.
    Parameters: table name + list of hashes of attribute-value-pairs.
   @private
  */
  bulkInsertQuery(tableName, attrValueHashes, options, rawAttributes) {
    options = options || {};
    rawAttributes = rawAttributes || {};

    const query = 'INSERT<%= ignoreDuplicates %> INTO <%= table %> (<%= attributes %>) VALUES <%= tuples %><%= onDuplicateKeyUpdate %><%= returning %>;';
    const tuples = [];
    const serials = {};
    const allAttributes = [];
    let onDuplicateKeyUpdate = '';

    for (const attrValueHash of attrValueHashes) {
      _.forOwn(attrValueHash, (value, key) => {
        if (allAttributes.indexOf(key) === -1) {
          allAttributes.push(key);
        }

        if (rawAttributes[key] && rawAttributes[key].autoIncrement === true) {
          serials[key] = true;
        }
      });
    }

    for (const attrValueHash of attrValueHashes) {
      tuples.push('(' + allAttributes.map(key => {
        if (this._dialect.supports.bulkDefault && serials[key] === true) {
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

    return _.template(query, this._templateSettings)(replacements);
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
   @private
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
      if (this.dialect !== 'mssql') {
        query += ' LIMIT ' + this.escape(options.limit) + ' ';
      }
    }

    if (this._dialect.supports.returnValues) {
      if (this._dialect.supports.returnValues.output) {
        // we always need this for mssql
        outputFragment = ' OUTPUT INSERTED.*';

        //To capture output rows when there is a trigger on MSSQL DB
        if (attributes && options.hasTrigger && this._dialect.supports.tmpTableTrigger) {
          tmpTable = 'declare @tmp table (<%= columns %>); ';
          let tmpColumns = '';
          let outputColumns = '';

          for (const modelKey in attributes) {
            const attribute = attributes[modelKey];
            if (!(attribute.type instanceof DataTypes.VIRTUAL)) {
              if (tmpColumns.length > 0) {
                tmpColumns += ',';
                outputColumns += ',';
              }

              tmpColumns += this.quoteIdentifier(attribute.field) + ' ' + attribute.type.toSql();
              outputColumns += 'INSERTED.' + this.quoteIdentifier(attribute.field);
            }
          }

          const replacement ={
            columns: tmpColumns
          };

          tmpTable = _.template(tmpTable, this._templateSettings)(replacement).trim();
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
      _.each(attributes, (attribute, key) => {
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
      values.push(this.quoteIdentifier(key) + '=' + this.escape(value, modelAttributeMap && modelAttributeMap[key] || undefined, { context: 'UPDATE' }));
    }

    const replacements = {
      table: this.quoteTable(tableName),
      values: values.join(','),
      output: outputFragment,
      where: this.whereQuery(where, options),
      tmpTable
    };

    if (values.length === 0) {
      return '';
    }

    return _.template(query, this._templateSettings)(replacements).trim();
  },

  /*
    Returns an update query.
    Parameters:
      - operator -> String with the arithmetic operator (e.g. '+' or '-')
      - tableName -> Name of the table
      - values -> A hash with attribute-value-pairs
      - where -> A hash with conditions (e.g. {name: 'foo'})
                 OR an ID as integer
                 OR a string with conditions (e.g. 'name="foo"').
                 If you use a string, you have to escape it on your own.
   @private
  */
  arithmeticQuery(operator, tableName, attrValueHash, where, options, attributes) {
    attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull);

    const values = [];
    let query = 'UPDATE <%= table %> SET <%= values %><%= output %> <%= where %>';
    let outputFragment;

    if (this._dialect.supports.returnValues) {
      if (this._dialect.supports.returnValues.returning) {
        options.mapToModel = true;
        query += ' RETURNING *';
      } else if (this._dialect.supports.returnValues.output) {
        outputFragment = ' OUTPUT INSERTED.*';
      }
    }

    for (const key in attrValueHash) {
      const value = attrValueHash[key];
      values.push(this.quoteIdentifier(key) + '=' + this.quoteIdentifier(key) + operator + ' ' + this.escape(value));
    }

    attributes = attributes || {};
    for (const key in attributes) {
      const value = attributes[key];
      values.push(this.quoteIdentifier(key) + '=' + this.escape(value));
    }

    const replacements = {
      table: this.quoteTable(tableName),
      values: values.join(','),
      output: outputFragment,
      where: this.whereQuery(where)
    };

    return _.template(query, this._templateSettings)(replacements);
  },

  nameIndexes(indexes, rawTablename) {
    if (typeof rawTablename === 'object') {
      // don't include schema in the index name
      rawTablename = rawTablename.tableName;
    }

    return _.map(indexes, index => {
      if (!index.hasOwnProperty('name')) {
        const onlyAttributeNames = index.fields.map(field => typeof field === 'string' ? field : field.name || field.attribute);
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
   @private
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
      } else if (field instanceof Utils.SequelizeMethod) {
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
      this._dialect.supports.index.parser && options.parser ? 'WITH PARSER ' + options.parser : undefined,
      this._dialect.supports.index.where && options.where ? options.where : undefined
    );

    return _.compact(ind).join(' ');
  },

  addConstraintQuery(tableName, options) {
    options = options || {};
    const constraintSnippet = this.getConstraintSnippet(tableName, options);

    if (typeof tableName === 'string') {
      tableName = this.quoteIdentifiers(tableName);
    } else {
      tableName = this.quoteTable(tableName);
    }

    return `ALTER TABLE ${tableName} ADD ${constraintSnippet};`;
  },

  getConstraintSnippet(tableName, options) {
    let constraintSnippet, constraintName;

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
          throw new Error('The following index field has no name: ' + field);
        }

        result += this.quoteIdentifier(field.name);
        return result;
      }
    });

    const fieldsSqlQuotedString = fieldsSql.join(', ');
    const fieldsSqlString = fieldsSql.join('_');

    switch (options.type.toUpperCase()) {
      case 'UNIQUE':
        constraintName = this.quoteIdentifier(options.name || `${tableName}_${fieldsSqlString}_uk`);
        constraintSnippet = `CONSTRAINT ${constraintName} UNIQUE (${fieldsSqlQuotedString})`;
        break;
      case 'CHECK':
        options.where = this.whereItemsQuery(options.where);
        constraintName = this.quoteIdentifier(options.name || `${tableName}_${fieldsSqlString}_ck`);
        constraintSnippet = `CONSTRAINT ${constraintName} CHECK (${options.where})`;
        break;
      case 'DEFAULT':
        if (options.defaultValue === undefined) {
          throw new Error('Default value must be specifed for DEFAULT CONSTRAINT');
        }

        if (this._dialect.name !== 'mssql') {
          throw new Error('Default constraints are supported only for MSSQL dialect.');
        }

        constraintName = this.quoteIdentifier(options.name || `${tableName}_${fieldsSqlString}_df`);
        constraintSnippet = `CONSTRAINT ${constraintName} DEFAULT (${this.escape(options.defaultValue)}) FOR ${fieldsSql[0]}`;
        break;
      case 'PRIMARY KEY':
        constraintName = this.quoteIdentifier(options.name || `${tableName}_${fieldsSqlString}_pk`);
        constraintSnippet = `CONSTRAINT ${constraintName} PRIMARY KEY (${fieldsSqlQuotedString})`;
        break;
      case 'FOREIGN KEY':
        const references = options.references;
        if (!references || !references.table || !references.field) {
          throw new Error('references object with table and field must be specified');
        }
        constraintName = this.quoteIdentifier(options.name || `${tableName}_${fieldsSqlString}_${references.table}_fk`);
        const referencesSnippet = `${this.quoteTable(references.table)} (${this.quoteIdentifier(references.field)})`;
        constraintSnippet = `CONSTRAINT ${constraintName} `;
        constraintSnippet += `FOREIGN KEY (${fieldsSqlQuotedString}) REFERENCES ${referencesSnippet}`;
        if (options.onUpdate) {
          constraintSnippet += ` ON UPDATE ${options.onUpdate.toUpperCase()}`;
        }
        if (options.onDelete) {
          constraintSnippet += ` ON DELETE ${options.onDelete.toUpperCase()}`;
        }
        break;
      default: throw new Error(`${options.type} is invalid.`);
    }
    return constraintSnippet;
  },

  removeConstraintQuery(tableName, constraintName) {
    return `ALTER TABLE ${this.quoteIdentifiers(tableName)} DROP CONSTRAINT ${this.quoteIdentifiers(constraintName)}`;
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
        Each <model> can be a model, or an object {model: Model, as: String}, matching include, or an
        association object, or the name of an association.
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
   @private
  */
  quote(collection, parent, connector) {
    // init
    const validOrderOptions = [
      'ASC',
      'DESC',
      'ASC NULLS LAST',
      'DESC NULLS LAST',
      'ASC NULLS FIRST',
      'DESC NULLS FIRST',
      'NULLS FIRST',
      'NULLS LAST'
    ];

    // default
    connector = connector || '.';

    // just quote as identifiers if string
    if (typeof collection === 'string') {
      return this.quoteIdentifiers(collection);
    } else if (Array.isArray(collection)) {
      // iterate through the collection and mutate objects into associations
      collection.forEach((item, index) => {
        const previous = collection[index - 1];
        let previousAssociation;
        let previousModel;

        // set the previous as the parent when previous is undefined or the target of the association
        if (!previous && parent !== undefined) {
          previousModel = parent;
        } else if (previous && previous instanceof Association) {
          previousAssociation = previous;
          previousModel = previous.target;
        }

        // if the previous item is a model, then attempt getting an association
        if (previousModel && previousModel.prototype instanceof Model) {
          let model;
          let as;

          if (typeof item === 'function' && item.prototype instanceof Model) {
            // set
            model = item;
          } else if (_.isPlainObject(item) && item.model && item.model.prototype instanceof Model) {
            // set
            model = item.model;
            as = item.as;
          }

          if (model) {
            // set the as to either the through name or the model name
            if (!as && previousAssociation && previousAssociation instanceof Association && previousAssociation.through && previousAssociation.through.model === model) {
              // get from previous association
              item = new Association(previousModel, model, {
                as: model.name
              });
            } else {
              // get association from previous model
              item = previousModel.getAssociationForAlias(model, as);

              // attempt to use the model name if the item is still null
              if (!item) {
                item = previousModel.getAssociationForAlias(model, model.name);
              }
            }

            // make sure we have an association
            if (!(item instanceof Association)) {
              throw new Error(util.format('Unable to find a valid association for model, \'%s\'', model.name));
            }
          }
        }

        if (typeof item === 'string') {
          // get order index
          const orderIndex = validOrderOptions.indexOf(item.toUpperCase());

          // see if this is an order
          if (index > 0 && orderIndex !== -1) {
            item = this.sequelize.literal(' ' + validOrderOptions[orderIndex]);
          } else if (previousModel && previousModel.prototype instanceof Model) {
            // only go down this path if we have preivous model and check only once
            if (previousModel.associations !== undefined && previousModel.associations[item]) {
              // convert the item to an association
              item = previousModel.associations[item];
            } else if (previousModel.rawAttributes !== undefined && previousModel.rawAttributes[item] && item !== previousModel.rawAttributes[item].field) {
              // convert the item attribute from its alias
              item = previousModel.rawAttributes[item].field;
            } else if (
              item.indexOf('.') !== -1
              && previousModel.rawAttributes !== undefined
            ) {
              const itemSplit = item.split('.');

              if (previousModel.rawAttributes[itemSplit[0]].type instanceof DataTypes.JSON) {
                // just quote identifiers for now
                const identifier = this.quoteIdentifiers(previousModel.name  + '.' + previousModel.rawAttributes[itemSplit[0]].field);

                // get path
                const path = itemSplit.slice(1);

                // extract path
                item = this.jsonPathExtractionQuery(identifier, path);

                // literal because we don't want to append the model name when string
                item = this.sequelize.literal(item);
              }
            }
          }
        }

        collection[index] = item;
      }, this);

      // loop through array, adding table names of models to quoted
      const collectionLength = collection.length;
      const tableNames = [];
      let item;
      let i = 0;

      for (i = 0; i < collectionLength - 1; i++) {
        item = collection[i];
        if (typeof item === 'string' || item._modelAttribute || item instanceof Utils.SequelizeMethod) {
          break;
        } else if (item instanceof Association) {
          tableNames[i] = item.as;
        }
      }

      // start building sql
      let sql = '';

      if (i > 0) {
        sql += this.quoteIdentifier(tableNames.join(connector)) + '.';
      } else if (typeof collection[0] === 'string' && parent) {
        sql += this.quoteIdentifier(parent.name) + '.';
      }

      // loop through everything past i and append to the sql
      collection.slice(i).forEach(collectionItem => {
        sql += this.quote(collectionItem, parent, connector);
      }, this);

      return sql;
    } else if (collection._modelAttribute) {
      return this.quoteTable(collection.Model.name) + '.' + this.quoteIdentifier(collection.fieldName);
    } else if (collection instanceof Utils.SequelizeMethod) {
      return this.handleSequelizeMethod(collection);
    } else if (_.isPlainObject(collection) && collection.raw) {
      // simple objects with raw is no longer supported
      throw new Error('The `{raw: "..."}` syntax is no longer supported.  Use `sequelize.literal` instead.');
    } else {
      throw new Error('Unknown structure passed to order / group: ' + util.inspect(collection));
    }
  },

  /*
    Split an identifier into .-separated tokens and quote each part
   @private
  */
  quoteIdentifiers(identifiers) {
    if (identifiers.indexOf('.') !== -1) {
      identifiers = identifiers.split('.');
      return this.quoteIdentifier(identifiers.slice(0, identifiers.length - 1).join('.')) + '.' + this.quoteIdentifier(identifiers[identifiers.length - 1]);
    } else {
      return this.quoteIdentifier(identifiers);
    }
  },

  /*
    Escape a value (e.g. a string, number or date)
   @private
  */
  escape(value, field, options) {
    options = options || {};

    if (value !== null && value !== undefined) {
      if (value instanceof Utils.SequelizeMethod) {
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

            value = field.type.stringify(value, { escape: simpleEscape, field, timezone: this.options.timezone, operation: options.operation });

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
   @private
  */
  selectQuery(tableName, options, model) {
    options = options || {};
    const limit = options.limit;
    const mainQueryItems = [];
    const subQueryItems = [];
    const subQuery = options.subQuery === undefined ? limit && options.hasMultiAssociation : options.subQuery;
    const attributes = {
      main: options.attributes && options.attributes.slice(),
      subQuery: null
    };
    const mainTable = {
      name: tableName,
      quotedName: null,
      as: null,
      model
    };
    const topLevelInfo = {
      names: mainTable,
      options,
      subQuery
    };
    let mainJoinQueries = [];
    let subJoinQueries = [];
    let query;

    // resolve table name options
    if (options.tableAs) {
      mainTable.as = this.quoteIdentifier(options.tableAs);
    } else if (!Array.isArray(mainTable.name) && mainTable.model) {
      mainTable.as = this.quoteIdentifier(mainTable.model.name);
    }

    mainTable.quotedName = !Array.isArray(mainTable.name) ? this.quoteTable(mainTable.name) : tableName.map(t => {
      return Array.isArray(t) ? this.quoteTable(t[0], t[1]) : this.quoteTable(t, true);
    }).join(', ');

    if (subQuery && attributes.main) {
      for (const keyAtt of mainTable.model.primaryKeyAttributes) {
        // Check if mainAttributes contain the primary key of the model either as a field or an aliased field
        if (!_.find(attributes.main, attr => keyAtt === attr || keyAtt === attr[0] || keyAtt === attr[1])) {
          attributes.main.push(mainTable.model.rawAttributes[keyAtt].field ? [keyAtt, mainTable.model.rawAttributes[keyAtt].field] : keyAtt);
        }
      }
    }

    attributes.main = this.escapeAttributes(attributes.main, options, mainTable.as);
    attributes.main = attributes.main || (options.include ? [`${mainTable.as}.*`] : ['*']);

    // If subquery, we ad the mainAttributes to the subQuery and set the mainAttributes to select * from subquery
    if (subQuery || options.groupedLimit) {
      // We need primary keys
      attributes.subQuery = attributes.main;
      attributes.main = [(mainTable.as || mainTable.quotedName) + '.*'];
    }

    if (options.include) {
      for (const include of options.include) {
        if (include.separate) {
          continue;
        }
        const joinQueries = this.generateInclude(include, { externalAs: mainTable.as, internalAs: mainTable.as }, topLevelInfo);

        subJoinQueries = subJoinQueries.concat(joinQueries.subQuery);
        mainJoinQueries = mainJoinQueries.concat(joinQueries.mainQuery);

        if (joinQueries.attributes.main.length > 0) {
          attributes.main = attributes.main.concat(joinQueries.attributes.main);
        }
        if (joinQueries.attributes.subQuery.length > 0) {
          attributes.subQuery = attributes.subQuery.concat(joinQueries.attributes.subQuery);
        }
      }
    }

    if (subQuery) {
      subQueryItems.push(this.selectFromTableFragment(options, mainTable.model, attributes.subQuery, mainTable.quotedName, mainTable.as));
      subQueryItems.push(subJoinQueries.join(''));
    } else {
      if (options.groupedLimit) {
        if (!mainTable.as) {
          mainTable.as = mainTable.quotedName;
        }
        const where = Object.assign({}, options.where);
        let groupedLimitOrder,
          whereKey,
          include,
          groupedTableName = mainTable.as;

        if (typeof options.groupedLimit.on === 'string') {
          whereKey = options.groupedLimit.on;
        } else if (options.groupedLimit.on instanceof HasMany) {
          whereKey = options.groupedLimit.on.foreignKeyField;
        }

        if (options.groupedLimit.on instanceof BelongsToMany) {
          // BTM includes needs to join the through table on to check ID
          groupedTableName = options.groupedLimit.on.manyFromSource.as;
          const groupedLimitOptions = Model._validateIncludedElements({
            include: [{
              association: options.groupedLimit.on.manyFromSource,
              duplicating: false, // The UNION'ed query may contain duplicates, but each sub-query cannot
              required: true,
              where: Object.assign({
                [Op.placeholder]: true
              }, options.groupedLimit.through && options.groupedLimit.through.where)
            }],
            model
          });

          // Make sure attributes from the join table are mapped back to models
          options.hasJoin = true;
          options.hasMultiAssociation = true;
          options.includeMap = Object.assign(groupedLimitOptions.includeMap, options.includeMap);
          options.includeNames = groupedLimitOptions.includeNames.concat(options.includeNames || []);
          include = groupedLimitOptions.include;

          if (Array.isArray(options.order)) {
            // We need to make sure the order by attributes are available to the parent query
            options.order.forEach((order, i) => {
              if (Array.isArray(order)) {
                order = order[0];
              }

              let alias = `subquery_order_${i}`;
              options.attributes.push([order, alias]);

              // We don't want to prepend model name when we alias the attributes, so quote them here
              alias = this.sequelize.literal(this.quote(alias));

              if (Array.isArray(options.order[i])) {
                options.order[i][0] = alias;
              } else {
                options.order[i] = alias;
              }
            });
            groupedLimitOrder = options.order;
          }
        } else {
          // Ordering is handled by the subqueries, so ordering the UNION'ed result is not needed
          groupedLimitOrder = options.order;
          delete options.order;
          where[Op.placeholder] = true;
        }

        // Caching the base query and splicing the where part into it is consistently > twice
        // as fast than generating from scratch each time for values.length >= 5
        const baseQuery = '(' + this.selectQuery(
          tableName,
          {
            attributes: options.attributes,
            limit: options.groupedLimit.limit,
            order: groupedLimitOrder,
            where,
            include,
            model
          },
          model
        ).replace(/;$/, '') + ')';
        const placeHolder = this.whereItemQuery(Op.placeholder, true, { model });
        const splicePos = baseQuery.indexOf(placeHolder);

        mainQueryItems.push(this.selectFromTableFragment(options, mainTable.model, attributes.main, '(' +
          options.groupedLimit.values.map(value => {
            let groupWhere;
            if (whereKey) {
              groupWhere = {
                [whereKey]: value
              };
            }
            if (include) {
              groupWhere = {
                [options.groupedLimit.on.foreignIdentifierField]: value
              };
            }

            return Utils.spliceStr(baseQuery, splicePos, placeHolder.length, this.getWhereConditions(groupWhere, groupedTableName));
          }).join(
            this._dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION '
          )
          + ')', mainTable.as));
      } else {
        mainQueryItems.push(this.selectFromTableFragment(options, mainTable.model, attributes.main, mainTable.quotedName, mainTable.as));
      }

      mainQueryItems.push(mainJoinQueries.join(''));
    }

    // Add WHERE to sub or main query
    if (options.hasOwnProperty('where') && !options.groupedLimit) {
      options.where = this.getWhereConditions(options.where, mainTable.as || tableName, model, options);
      if (options.where) {
        if (subQuery) {
          subQueryItems.push(' WHERE ' + options.where);
        } else {
          mainQueryItems.push(' WHERE ' + options.where);
          // Walk the main query to update all selects
          _.each(mainQueryItems, (value, key) => {
            if (value.match(/^SELECT/)) {
              mainQueryItems[key] = this.selectFromTableFragment(options, model, attributes.main, mainTable.quotedName, mainTable.as, options.where);
            }
          });
        }
      }
    }

    // Add GROUP BY to sub or main query
    if (options.group) {
      options.group = Array.isArray(options.group) ? options.group.map(t => this.quote(t, model)).join(', ') : this.quote(options.group, model);
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
      const orders = this.getQueryOrders(options, model, subQuery);
      if (orders.mainQueryOrder.length) {
        mainQueryItems.push(' ORDER BY ' + orders.mainQueryOrder.join(', '));
      }
      if (orders.subQueryOrder.length) {
        subQueryItems.push(' ORDER BY ' + orders.subQueryOrder.join(', '));
      }
    }

    // Add LIMIT, OFFSET to sub or main query
    const limitOrder = this.addLimitAndOffset(options, mainTable.model);
    if (limitOrder && !options.groupedLimit) {
      if (subQuery) {
        subQueryItems.push(limitOrder);
      } else {
        mainQueryItems.push(limitOrder);
      }
    }

    if (subQuery) {
      query = `SELECT ${attributes.main.join(', ')} FROM (${subQueryItems.join('')}) AS ${mainTable.as}${mainJoinQueries.join('')}${mainQueryItems.join('')}`;
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

    return `${query};`;
  },

  escapeAttributes(attributes, options, mainTableAs) {
    return attributes && attributes.map(attr => {
      let addTable = true;

      if (attr instanceof Utils.SequelizeMethod) {
        return this.handleSequelizeMethod(attr);
      }
      if (Array.isArray(attr)) {
        if (attr.length !== 2) {
          throw new Error(JSON.stringify(attr) + ' is not a valid attribute definition. Please use the following format: [\'attribute definition\', \'alias\']');
        }
        attr = attr.slice();

        if (attr[0] instanceof Utils.SequelizeMethod) {
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
  },

  generateInclude(include, parentTableName, topLevelInfo) {
    const association = include.association;
    const joinQueries = {
      mainQuery: [],
      subQuery: []
    };
    const mainChildIncludes = [];
    const subChildIncludes = [];
    let requiredMismatch = false;
    const includeAs = {
      internalAs: include.as,
      externalAs: include.as
    };
    const attributes = {
      main: [],
      subQuery: []
    };
    let joinQuery;

    topLevelInfo.options.keysEscaped = true;

    if (topLevelInfo.names.name !== parentTableName.externalAs && topLevelInfo.names.as !== parentTableName.externalAs) {
      includeAs.internalAs = `${parentTableName.internalAs}->${include.as}`;
      includeAs.externalAs = `${parentTableName.externalAs}.${include.as}`;
    }

    // includeIgnoreAttributes is used by aggregate functions
    if (topLevelInfo.options.includeIgnoreAttributes !== false) {
      const includeAttributes = include.attributes.map(attr => {
        let attrAs = attr;
        let verbatim = false;

        if (Array.isArray(attr) && attr.length === 2) {
          if (attr[0] instanceof Utils.SequelizeMethod && (
            attr[0] instanceof Utils.Literal ||
            attr[0] instanceof Utils.Cast ||
            attr[0] instanceof Utils.Fn
          )) {
            verbatim = true;
          }

          attr = attr.map(attr => attr instanceof Utils.SequelizeMethod ? this.handleSequelizeMethod(attr) : attr);

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
          prefix = `${this.quoteIdentifier(includeAs.internalAs)}.${this.quoteIdentifier(attr)}`;
        }
        return `${prefix} AS ${this.quoteIdentifier(`${includeAs.externalAs}.${attrAs}`, true)}`;
      });
      if (include.subQuery && topLevelInfo.subQuery) {
        for (const attr of includeAttributes) {
          attributes.subQuery.push(attr);
        }
      } else {
        for (const attr of includeAttributes) {
          attributes.main.push(attr);
        }
      }
    }

    //through
    if (include.through) {
      joinQuery = this.generateThroughJoin(include, includeAs, parentTableName.internalAs, topLevelInfo);
    } else {
      if (topLevelInfo.subQuery && include.subQueryFilter) {
        const associationWhere = {};

        associationWhere[association.identifierField] = {
          [Op.eq]: this.sequelize.literal(`${this.quoteTable(parentTableName.internalAs)}.${this.quoteIdentifier(association.sourceKeyField || association.source.primaryKeyField)}`)
        };

        if (!topLevelInfo.options.where) {
          topLevelInfo.options.where = {};
        }

        // Creating the as-is where for the subQuery, checks that the required association exists
        const $query = this.selectQuery(include.model.getTableName(), {
          attributes: [association.identifierField],
          where: {
            [Op.and]: [
              associationWhere,
              include.where || {}
            ]
          },
          limit: 1,
          tableAs: include.as
        }, include.model);

        const subQueryWhere = this.sequelize.asIs([
          '(',
          $query.replace(/\;$/, ''),
          ')',
          'IS NOT NULL'
        ].join(' '));

        if (_.isPlainObject(topLevelInfo.options.where)) {
          topLevelInfo.options.where['__' + includeAs.internalAs] = subQueryWhere;
        } else {
          topLevelInfo.options.where = { [Op.and]: [topLevelInfo.options.where, subQueryWhere] };
        }
      }
      joinQuery = this.generateJoin(include, topLevelInfo);
    }

    // handle possible new attributes created in join
    if (joinQuery.attributes.main.length > 0) {
      attributes.main = attributes.main.concat(joinQuery.attributes.main);
    }

    if (joinQuery.attributes.subQuery.length > 0) {
      attributes.subQuery = attributes.subQuery.concat(joinQuery.attributes.subQuery);
    }

    if (include.include) {
      for (const childInclude of include.include) {
        if (childInclude.separate || childInclude._pseudo) {
          continue;
        }

        const childJoinQueries = this.generateInclude(childInclude, includeAs, topLevelInfo);

        if (include.required === false && childInclude.required === true) {
          requiredMismatch = true;
        }
        // if the child is a sub query we just give it to the
        if (childInclude.subQuery && topLevelInfo.subQuery) {
          subChildIncludes.push(childJoinQueries.subQuery);
        }
        if (childJoinQueries.mainQuery) {
          mainChildIncludes.push(childJoinQueries.mainQuery);
        }
        if (childJoinQueries.attributes.main.length > 0) {
          attributes.main = attributes.main.concat(childJoinQueries.attributes.main);
        }
        if (childJoinQueries.attributes.subQuery.length > 0) {
          attributes.subQuery = attributes.subQuery.concat(childJoinQueries.attributes.subQuery);
        }
      }
    }

    if (include.subQuery && topLevelInfo.subQuery) {
      if (requiredMismatch && subChildIncludes.length > 0) {
        joinQueries.subQuery.push(` ${joinQuery.join} ( ${joinQuery.body}${subChildIncludes.join('')} ) ON ${joinQuery.condition}`);
      } else {
        joinQueries.subQuery.push(` ${joinQuery.join} ${joinQuery.body} ON ${joinQuery.condition}`);
        if (subChildIncludes.length > 0) {
          joinQueries.subQuery.push(subChildIncludes.join(''));
        }
      }
      joinQueries.mainQuery.push(mainChildIncludes.join(''));
    } else {
      if (requiredMismatch && mainChildIncludes.length > 0) {
        joinQueries.mainQuery.push(` ${joinQuery.join} ( ${joinQuery.body}${mainChildIncludes.join('')} ) ON ${joinQuery.condition}`);
      } else {
        joinQueries.mainQuery.push(` ${joinQuery.join} ${joinQuery.body} ON ${joinQuery.condition}`);
        if (mainChildIncludes.length > 0) {
          joinQueries.mainQuery.push(mainChildIncludes.join(''));
        }
      }
      joinQueries.subQuery.push(subChildIncludes.join(''));
    }

    return {
      mainQuery: joinQueries.mainQuery.join(''),
      subQuery: joinQueries.subQuery.join(''),
      attributes
    };
  },

  generateJoin(include, topLevelInfo) {
    const association = include.association;
    const parent = include.parent;
    const parentIsTop = !!parent && !include.parent.association && include.parent.model.name === topLevelInfo.options.model.name;
    let $parent;
    let joinWhere;
    /* Attributes for the left side */
    const left = association.source;
    const attrLeft = association instanceof BelongsTo ?
      association.identifier :
      association.sourceKeyAttribute || left.primaryKeyAttribute;
    const fieldLeft = association instanceof BelongsTo ?
      association.identifierField :
      left.rawAttributes[association.sourceKeyAttribute || left.primaryKeyAttribute].field;
    let asLeft;
    /* Attributes for the right side */
    const right = include.model;
    const tableRight = right.getTableName();
    const fieldRight = association instanceof BelongsTo ?
      right.rawAttributes[association.targetIdentifier || right.primaryKeyAttribute].field :
      association.identifierField;
    let asRight = include.as;

    while (($parent = $parent && $parent.parent || include.parent) && $parent.association) {
      if (asLeft) {
        asLeft = `${$parent.as}->${asLeft}`;
      } else {
        asLeft = $parent.as;
      }
    }

    if (!asLeft) asLeft = parent.as || parent.model.name;
    else asRight = `${asLeft}->${asRight}`;

    let joinOn = `${this.quoteTable(asLeft)}.${this.quoteIdentifier(fieldLeft)}`;

    if (topLevelInfo.options.groupedLimit && parentIsTop || topLevelInfo.subQuery && include.parent.subQuery && !include.subQuery) {
      if (parentIsTop) {
        // The main model attributes is not aliased to a prefix
        joinOn = `${this.quoteTable(parent.as || parent.model.name)}.${this.quoteIdentifier(attrLeft)}`;
      } else {
        joinOn = this.quoteIdentifier(`${asLeft.replace(/->/g, '.')}.${attrLeft}`);
      }
    }

    joinOn += ` = ${this.quoteIdentifier(asRight)}.${this.quoteIdentifier(fieldRight)}`;

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
          joinOn += ` OR ${joinWhere}`;
        } else {
          joinOn += ` AND ${joinWhere}`;
        }
      }
    }

    return {
      join: include.required ? 'INNER JOIN' : 'LEFT OUTER JOIN',
      body: this.quoteTable(tableRight, asRight),
      condition: joinOn,
      attributes: {
        main: [],
        subQuery: []
      }
    };
  },

  generateThroughJoin(include, includeAs, parentTableName, topLevelInfo) {
    const through = include.through;
    const throughTable = through.model.getTableName();
    const throughAs = `${includeAs.internalAs}->${through.as}`;
    const externalThroughAs = `${includeAs.externalAs}.${through.as}`;
    const throughAttributes = through.attributes.map(attr =>
      this.quoteIdentifier(throughAs) + '.' + this.quoteIdentifier(Array.isArray(attr) ? attr[0] : attr)
      + ' AS '
      + this.quoteIdentifier(externalThroughAs + '.' + (Array.isArray(attr) ? attr[1] : attr))
    );
    const association = include.association;
    const parentIsTop = !include.parent.association && include.parent.model.name === topLevelInfo.options.model.name;
    const primaryKeysSource = association.source.primaryKeyAttributes;
    const tableSource = parentTableName;
    const identSource = association.identifierField;
    const primaryKeysTarget = association.target.primaryKeyAttributes;
    const tableTarget = includeAs.internalAs;
    const identTarget = association.foreignIdentifierField;
    const attrTarget = association.target.rawAttributes[primaryKeysTarget[0]].field || primaryKeysTarget[0];

    const joinType = include.required ? 'INNER JOIN' : 'LEFT OUTER JOIN';
    let joinBody;
    let joinCondition;
    const attributes = {
      main: [],
      subQuery: []
    };
    let attrSource = primaryKeysSource[0];
    let sourceJoinOn;
    let targetJoinOn;
    let throughWhere;
    let targetWhere;

    if (topLevelInfo.options.includeIgnoreAttributes !== false) {
      // Through includes are always hasMany, so we need to add the attributes to the mainAttributes no matter what (Real join will never be executed in subquery)
      for (const attr of throughAttributes) {
        attributes.main.push(attr);
      }
    }

    // Figure out if we need to use field or attribute
    if (!topLevelInfo.subQuery) {
      attrSource = association.source.rawAttributes[primaryKeysSource[0]].field;
    }
    if (topLevelInfo.subQuery && !include.subQuery && !include.parent.subQuery && include.parent.model !== topLevelInfo.options.mainModel) {
      attrSource = association.source.rawAttributes[primaryKeysSource[0]].field;
    }

    // Filter statement for left side of through
    // Used by both join and subquery where
    // If parent include was in a subquery need to join on the aliased attribute
    if (topLevelInfo.subQuery && !include.subQuery && include.parent.subQuery && !parentIsTop) {
      sourceJoinOn = `${this.quoteIdentifier(`${tableSource}.${attrSource}`)} = `;
    } else {
      sourceJoinOn = `${this.quoteTable(tableSource)}.${this.quoteIdentifier(attrSource)} = `;
    }
    sourceJoinOn += `${this.quoteIdentifier(throughAs)}.${this.quoteIdentifier(identSource)}`;

    // Filter statement for right side of through
    // Used by both join and subquery where
    targetJoinOn = `${this.quoteIdentifier(tableTarget)}.${this.quoteIdentifier(attrTarget)} = `;
    targetJoinOn += `${this.quoteIdentifier(throughAs)}.${this.quoteIdentifier(identTarget)}`;

    if (through.where) {
      throughWhere = this.getWhereConditions(through.where, this.sequelize.literal(this.quoteIdentifier(throughAs)), through.model);
    }

    if (this._dialect.supports.joinTableDependent) {
      // Generate a wrapped join so that the through table join can be dependent on the target join
      joinBody = `( ${this.quoteTable(throughTable, throughAs)} INNER JOIN ${this.quoteTable(include.model.getTableName(), includeAs.internalAs)} ON ${targetJoinOn}`;
      if (throughWhere) {
        joinBody += ` AND ${throughWhere}`;
      }
      joinBody += ')';
      joinCondition = sourceJoinOn;
    } else {
      // Generate join SQL for left side of through
      joinBody = `${this.quoteTable(throughTable, throughAs)} ON ${sourceJoinOn} ${joinType} ${this.quoteTable(include.model.getTableName(), includeAs.internalAs)}`;
      joinCondition = targetJoinOn;
      if (throughWhere) {
        joinCondition += ` AND ${throughWhere}`;
      }
    }

    if (include.where || include.through.where) {
      if (include.where) {
        targetWhere = this.getWhereConditions(include.where, this.sequelize.literal(this.quoteIdentifier(includeAs.internalAs)), include.model, topLevelInfo.options);
        if (targetWhere) {
          joinCondition += ` AND ${targetWhere}`;
        }
      }
      if (topLevelInfo.subQuery && include.required) {
        if (!topLevelInfo.options.where) {
          topLevelInfo.options.where = {};
        }
        let parent = include;
        let child = include;
        let nestedIncludes = [];
        let query;

        while ((parent = parent.parent)) { // eslint-disable-line
          nestedIncludes = [_.extend({}, child, { include: nestedIncludes })];
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
            where: {
              [Op.and]: [
                this.sequelize.asIs([
                  this.quoteTable(topParent.model.name) + '.' + this.quoteIdentifier(topParent.model.primaryKeyField),
                  this.quoteIdentifier(topInclude.through.model.name) + '.' + this.quoteIdentifier(topInclude.association.identifierField)
                ].join(' = ')),
                topInclude.through.where
              ]
            },
            limit: 1,
            includeIgnoreAttributes: false
          }, topInclude.through.model);
        } else {
          const isBelongsTo = topInclude.association.associationType === 'BelongsTo';
          const join = [
            this.quoteTable(topParent.model.name) + '.' + this.quoteIdentifier(isBelongsTo ? topInclude.association.identifierField : topParent.model.primaryKeyAttributes[0]),
            this.quoteIdentifier(topInclude.model.name) + '.' + this.quoteIdentifier(isBelongsTo ? topInclude.model.primaryKeyAttributes[0] : topInclude.association.identifierField)
          ].join(' = ');
          query = this.selectQuery(topInclude.model.tableName, {
            attributes: [topInclude.model.primaryKeyAttributes[0]],
            include: topInclude.include,
            where: {
              [Op.join]: this.sequelize.asIs(join)
            },
            limit: 1,
            includeIgnoreAttributes: false
          }, topInclude.model);
        }
        topLevelInfo.options.where['__' + throughAs] = this.sequelize.asIs([
          '(',
          query.replace(/\;$/, ''),
          ')',
          'IS NOT NULL'
        ].join(' '));
      }
    }

    return {
      join: joinType,
      body: joinBody,
      condition: joinCondition,
      attributes
    };
  },

  getQueryOrders(options, model, subQuery) {
    const mainQueryOrder = [];
    const subQueryOrder = [];

    if (Array.isArray(options.order)) {
      for (let order of options.order) {
        // wrap if not array
        if (!Array.isArray(order)) {
          order = [order];
        }

        if (
          subQuery
          && Array.isArray(order)
          && order[0]
          && !(order[0] instanceof Association)
          && !(typeof order[0] === 'function' && order[0].prototype instanceof Model)
          && !(typeof order[0].model === 'function' && order[0].model.prototype instanceof Model)
          && !(typeof order[0] === 'string' && model && model.associations !== undefined && model.associations[order[0]])
        ) {
          subQueryOrder.push(this.quote(order, model, '->'));
        }
        mainQueryOrder.push(this.quote(order, model, '->'));
      }
    } else if (options.order instanceof Utils.SequelizeMethod) {
      const sql = this.quote(options.order, model, '->');
      if (subQuery) {
        subQueryOrder.push(sql);
      }
      mainQueryOrder.push(sql);
    } else {
      throw new Error('Order must be type of array or instance of a valid sequelize method.');
    }

    return {mainQueryOrder, subQueryOrder};
  },

  selectFromTableFragment(options, model, attributes, tables, mainTableAs) {
    let fragment = 'SELECT ' + attributes.join(', ') + ' FROM ' + tables;

    if (mainTableAs) {
      fragment += ' AS ' + mainTableAs;
    }

    return fragment;
  },

  /**
   * Returns a query that starts a transaction.
   *
   * @param  {Boolean} value   A boolean that states whether autocommit shall be done or not.
   * @param  {Object}  options An object with options.
   * @return {String}          The generated sql query.
   * @private
   */
  setAutocommitQuery(value, options) {
    if (options.parent) {
      return;
    }

    // no query when value is not explicitly set
    if (typeof value === 'undefined' || value === null) {
      return;
    }

    return 'SET autocommit = ' + (value ? 1 : 0) + ';';
  },

  /**
   * Returns a query that sets the transaction isolation level.
   *
   * @param  {String} value   The isolation level.
   * @param  {Object} options An object with options.
   * @return {String}         The generated sql query.
   * @private
   */
  setIsolationLevelQuery(value, options) {
    if (options.parent) {
      return;
    }

    return 'SET SESSION TRANSACTION ISOLATION LEVEL ' + value + ';';
  },

  generateTransactionId() {
    return uuid.v4();
  },

  /**
   * Returns a query that starts a transaction.
   *
   * @param  {Transaction} transaction
   * @param  {Object} options An object with options.
   * @return {String}         The generated sql query.
   * @private
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
   * @private
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
   * @private
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
   * @private
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
   * @private
   */
  addLimitAndOffset(options) {
    let fragment = '';

    /* eslint-disable */
    if (options.offset != null && options.limit == null) {
      fragment += ' LIMIT ' + this.escape(options.offset) + ', ' + 10000000000000;
    } else if (options.limit != null) {
      if (options.offset != null) {
        fragment += ' LIMIT ' + this.escape(options.offset) + ', ' + this.escape(options.limit);
      } else {
        fragment += ' LIMIT ' + this.escape(options.limit);
      }
    }
    /* eslint-enable */

    return fragment;
  },

  handleSequelizeMethod(smth, tableName, factory, options, prepend) {
    let result;

    if (smth instanceof Utils.Where) {
      let value = smth.logic;
      let key;

      if (smth.attribute instanceof Utils.SequelizeMethod) {
        key = this.getWhereConditions(smth.attribute, tableName, factory, options, prepend);
      } else {
        key = this.quoteTable(smth.attribute.Model.name) + '.' + this.quoteIdentifier(smth.attribute.field || smth.attribute.fieldName);
      }

      if (value && value instanceof Utils.SequelizeMethod) {
        value = this.getWhereConditions(value, tableName, factory, options, prepend);

        result = value === 'NULL' ? key + ' IS NULL' : [key, value].join(smth.comparator);
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

        result = value === 'NULL' ? key + ' IS NULL' : [key, value].join(' ' + smth.comparator + ' ');
      }
    } else if (smth instanceof Utils.Literal) {
      result = smth.val;
    } else if (smth instanceof Utils.Cast) {
      if (smth.val instanceof Utils.SequelizeMethod) {
        result = this.handleSequelizeMethod(smth.val, tableName, factory, options, prepend);
      } else if (_.isPlainObject(smth.val)) {
        result = this.whereItemsQuery(smth.val);
      } else {
        result = this.escape(smth.val);
      }

      result = 'CAST(' + result + ' AS ' + smth.type.toUpperCase() + ')';
    } else if (smth instanceof Utils.Fn) {
      result = smth.fn + '(' + smth.args.map(arg => {
        if (arg instanceof Utils.SequelizeMethod) {
          return this.handleSequelizeMethod(arg, tableName, factory, options, prepend);
        } else if (_.isPlainObject(arg)) {
          return this.whereItemsQuery(arg);
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
      where === null ||
      where === undefined ||
      Utils.getComplexSize(where) === 0
    ) {
      // NO OP
      return '';
    }

    if (_.isString(where)) {
      throw new Error('Support for `{where: \'raw query\'}` has been removed.');
    }

    const items = [];

    binding = binding || 'AND';
    if (binding.substr(0, 1) !== ' ') binding = ' '+binding+' ';

    if (_.isPlainObject(where)) {
      Utils.getComplexKeys(where).forEach(prop => {
        const item = where[prop];
        items.push(this.whereItemQuery(prop, item, options));
      });
    } else {
      items.push(this.whereItemQuery(undefined, where, options));
    }

    return items.length && items.filter(item => item && item.length).join(binding) || '';
  },

  OperatorMap: {
    [Op.eq]: '=',
    [Op.ne]: '!=',
    [Op.gte]: '>=',
    [Op.gt]: '>',
    [Op.lte]: '<=',
    [Op.lt]: '<',
    [Op.not]: 'IS NOT',
    [Op.is]: 'IS',
    [Op.in]: 'IN',
    [Op.notIn]: 'NOT IN',
    [Op.like]: 'LIKE',
    [Op.notLike]: 'NOT LIKE',
    [Op.iLike]: 'ILIKE',
    [Op.notILike]: 'NOT ILIKE',
    [Op.regexp]: '~',
    [Op.notRegexp]: '!~',
    [Op.iRegexp]: '~*',
    [Op.notIRegexp]: '!~*',
    [Op.between]: 'BETWEEN',
    [Op.notBetween]: 'NOT BETWEEN',
    [Op.overlap]: '&&',
    [Op.contains]: '@>',
    [Op.contained]: '<@',
    [Op.adjacent]: '-|-',
    [Op.strictLeft]: '<<',
    [Op.strictRight]: '>>',
    [Op.noExtendRight]: '&<',
    [Op.noExtendLeft]: '&>',
    [Op.any]: 'ANY',
    [Op.all]: 'ALL',
    [Op.and]: ' AND ',
    [Op.or]: ' OR ',
    [Op.col]: 'COL',
    [Op.placeholder]: '$$PLACEHOLDER$$',
    [Op.raw]: 'DEPRECATED' //kept here since we still throw an explicit error if operator being used remove by v5,
  },

  OperatorsAliasMap: {},

  setOperatorsAliases(aliases) {
    if (!aliases || _.isEmpty(aliases)) {
      this.OperatorsAliasMap = false;
    } else {
      this.OperatorsAliasMap = _.assign({}, aliases);
    }
  },

  whereItemQuery(key, value, options) {
    options = options || {};
    if (key && typeof key === 'string' && key.indexOf('.') !== -1 && options.model) {
      const keyParts = key.split('.');
      if (options.model.rawAttributes[keyParts[0]] && options.model.rawAttributes[keyParts[0]].type instanceof DataTypes.JSON) {
        const tmp = {};
        const field = options.model.rawAttributes[keyParts[0]];
        Dottie.set(tmp, keyParts.slice(1), value);
        return this.whereItemQuery(field.field || keyParts[0], tmp, Object.assign({field}, options));
      }
    }

    const field = this._findField(key, options);
    const fieldType = field && field.type || options.type;

    const isPlainObject = _.isPlainObject(value);
    const isArray = !isPlainObject && Array.isArray(value);
    key = this.OperatorsAliasMap && this.OperatorsAliasMap[key] || key;
    if (isPlainObject) {
      value = this._replaceAliases(value);
    }
    const valueKeys = isPlainObject && Utils.getComplexKeys(value);

    if (key === undefined) {
      if (typeof value === 'string') {
        return value;
      }

      if (isPlainObject && valueKeys.length === 1) {
        return this.whereItemQuery(valueKeys[0], value[valueKeys[0]], options);
      }
    }

    if (!value) {
      return this._joinKeyValue(key, this.escape(value, field), value === null ? this.OperatorMap[Op.is] : this.OperatorMap[Op.eq], options.prefix);
    }

    if (value instanceof Utils.SequelizeMethod && !(key !== undefined && value instanceof Utils.Fn)) {
      return this.handleSequelizeMethod(value);
    }

    // Convert where: [] to Op.and if possible, else treat as literal/replacements
    if (key === undefined && isArray) {
      if (Utils.canTreatArrayAsAnd(value)) {
        key = Op.and;
      } else {
        throw new Error('Support for literal replacements in the `where` object has been removed.');
      }
    }

    if (key === Op.or || key === Op.and || key === Op.not) {
      return this._whereGroupBind(key, value, options);
    }


    if (value[Op.or]) {
      return this._whereBind(this.OperatorMap[Op.or], key, value[Op.or], options);
    }

    if (value[Op.and]) {
      return this._whereBind(this.OperatorMap[Op.and], key, value[Op.and], options);
    }

    if (isArray && fieldType instanceof DataTypes.ARRAY) {
      return this._joinKeyValue(key, this.escape(value, field), this.OperatorMap[Op.eq], options.prefix);
    }

    if (isPlainObject && fieldType instanceof DataTypes.JSON && options.json !== false) {
      return this._whereJSON(key, value, options);
    }
    // If multiple keys we combine the different logic conditions
    if (isPlainObject && valueKeys.length > 1) {
      return this._whereBind(this.OperatorMap[Op.and], key, value, options);
    }

    if (isArray) {
      return this._whereParseSingleValueObject(key, field, Op.in, value, options);
    }
    if (isPlainObject) {
      if (this.OperatorMap[valueKeys[0]]) {
        return this._whereParseSingleValueObject(key, field, valueKeys[0], value[valueKeys[0]], options);
      } else {
        return this._whereParseSingleValueObject(key, field, this.OperatorMap[Op.eq], value, options);
      }
    }

    if (key === Op.placeholder) {
      return this._joinKeyValue(this.OperatorMap[key], this.escape(value, field), this.OperatorMap[Op.eq], options.prefix);
    }

    return this._joinKeyValue(key, this.escape(value, field), this.OperatorMap[Op.eq], options.prefix);
  },

  _findField(key, options) {
    if (options.field) {
      return options.field;
    }

    if (options.model && options.model.rawAttributes && options.model.rawAttributes[key]) {
      return options.model.rawAttributes[key];
    }

    if (options.model && options.model.fieldRawAttributesMap && options.model.fieldRawAttributesMap[key]) {
      return options.model.fieldRawAttributesMap[key];
    }
  },

  _replaceAliases(orig) {
    const obj = {};
    if (!this.OperatorsAliasMap) {
      return orig;
    }

    Utils.getOperators(orig).forEach(op => {
      const item = orig[op];
      if (_.isPlainObject(item)) {
        obj[op] = this._replaceAliases(item);
      } else {
        obj[op] = item;
      }
    });

    _.forOwn(orig, (item, prop) => {
      prop = this.OperatorsAliasMap[prop] || prop;
      if (_.isPlainObject(item)) {
        item = this._replaceAliases(item);
      }
      obj[prop] = item;
    });
    return obj;
  },

  // OR/AND/NOT grouping logic
  _whereGroupBind(key, value, options) {
    const binding = key === Op.or ? this.OperatorMap[Op.or] : this.OperatorMap[Op.and];
    const outerBinding = key === Op.not ? 'NOT ': '';

    if (Array.isArray(value)) {
      value = value.map(item => {
        let itemQuery = this.whereItemsQuery(item, options, this.OperatorMap[Op.and]);
        if (itemQuery && itemQuery.length && (Array.isArray(item) || _.isPlainObject(item)) && Utils.getComplexSize(item) > 1) {
          itemQuery = '('+itemQuery+')';
        }
        return itemQuery;
      }).filter(item => item && item.length);

      value = value.length && value.join(binding);
    } else {
      value = this.whereItemsQuery(value, options, binding);
    }
    // Op.or: [] should return no data.
    // Op.not of no restriction should also return no data
    if ((key === Op.or || key === Op.not) && !value) {
      return '0 = 1';
    }

    return value ? outerBinding + '('+value+')' : undefined;
  },

  _whereBind(binding, key, value, options) {
    if (_.isPlainObject(value)) {
      value = Utils.getComplexKeys(value).map(prop => {
        const item = value[prop];
        return this.whereItemQuery(key, {[prop]: item}, options);
      });
    } else {
      value = value.map(item => this.whereItemQuery(key, item, options));
    }

    value = value.filter(item => item && item.length);

    return value.length ? '('+value.join(binding)+')' : undefined;
  },

  _whereJSON(key, value, options) {
    const items = [];
    let baseKey = this.quoteIdentifier(key);
    if (options.prefix) {
      if (options.prefix instanceof Utils.Literal) {
        baseKey = `${this.handleSequelizeMethod(options.prefix)}.${baseKey}`;
      } else {
        baseKey = `${this.quoteTable(options.prefix)}.${baseKey}`;
      }
    }

    Utils.getOperators(value).forEach(op => {
      const where = {};
      where[op] = value[op];
      items.push(this.whereItemQuery(key, where, _.assign({}, options, {json: false})));
    });

    _.forOwn(value, (item, prop) => {
      this._traverseJSON(items, baseKey, prop, item, [prop]);
    });

    const result = items.join(this.OperatorMap[Op.and]);
    return items.length > 1 ? '('+result+')' : result;
  },


  _traverseJSON(items, baseKey, prop, item, path) {
    let cast;

    if (path[path.length - 1].indexOf('::') > -1) {
      const tmp = path[path.length - 1].split('::');
      cast = tmp[1];
      path[path.length - 1] = tmp[0];
    }

    const pathKey = this.jsonPathExtractionQuery(baseKey, path);

    if (_.isPlainObject(item)) {
      Utils.getOperators(item).forEach(op => {
        const value = this._toJSONValue(item[op]);
        items.push(this.whereItemQuery(this._castKey(pathKey, value, cast), {[op]: value}));
      });
      _.forOwn(item, (value, itemProp) => {
        this._traverseJSON(items, baseKey, itemProp, value, path.concat([itemProp]));
      });

      return;
    }

    item = this._toJSONValue(item);
    items.push(this.whereItemQuery(this._castKey(pathKey, item, cast), {[Op.eq]: item}));
  },

  _toJSONValue(value) {
    return value;
  },

  _castKey(key, value, cast, json) {
    cast = cast || this._getJsonCast(Array.isArray(value) ? value[0] : value);
    if (cast) {
      return new Utils.Literal(this.handleSequelizeMethod(new Utils.Cast(new Utils.Literal(key), cast, json)));
    }

    return new Utils.Literal(key);
  },

  _getJsonCast(value) {
    if (typeof value === 'number') {
      return 'double precision';
    }
    if (value instanceof Date) {
      return 'timestamptz';
    }
    if (typeof value === 'boolean') {
      return 'boolean';
    }
    return;
  },

  _joinKeyValue(key, value, comparator, prefix) {
    if (!key) {
      return value;
    }
    if (comparator === undefined) {
      throw new Error(`${key} and ${value} has no comperator`);
    }
    key = this._getSafeKey(key, prefix);
    return [key, value].join(' '+comparator+' ');
  },

  _getSafeKey(key, prefix) {
    if (key instanceof Utils.SequelizeMethod) {
      key = this.handleSequelizeMethod(key);
      return this._prefixKey(this.handleSequelizeMethod(key), prefix);
    }

    if (Utils.isColString(key)) {
      key = key.substr(1, key.length - 2).split('.');

      if (key.length > 2) {
        key = [
          // join the tables by -> to match out internal namings
          key.slice(0, -1).join('->'),
          key[key.length - 1]
        ];
      }

      return key.map(identifier => this.quoteIdentifier(identifier)).join('.');
    }

    return this._prefixKey(this.quoteIdentifier(key), prefix);
  },

  _prefixKey(key, prefix) {
    if (prefix) {
      if (prefix instanceof Utils.Literal) {
        return [this.handleSequelizeMethod(prefix), key].join('.');
      }

      return [this.quoteTable(prefix), key].join('.');
    }

    return key;
  },

  _whereParseSingleValueObject(key, field, prop, value, options) {
    if (prop === Op.not) {
      if (Array.isArray(value)) {
        prop = Op.notIn;
      } else if ([null, true, false].indexOf(value) < 0) {
        prop = Op.ne;
      }
    }

    let comparator = this.OperatorMap[prop] || this.OperatorMap[Op.eq];

    switch (prop) {
      case Op.in:
      case Op.notIn:
        if (value instanceof Utils.Literal) {
          return this._joinKeyValue(key, value.val, comparator, options.prefix);
        }

        if (value.length) {
          return this._joinKeyValue(key, `(${value.map(item => this.escape(item, field)).join(', ')})`, comparator, options.prefix);
        }

        if (comparator === this.OperatorMap[Op.in]) {
          return this._joinKeyValue(key, '(NULL)', comparator, options.prefix);
        }

        return '';
      case Op.any:
      case Op.all:
        comparator = `${this.OperatorMap[Op.eq]} ${comparator}`;
        if (value[Op.values]) {
          return this._joinKeyValue(key, `(VALUES ${value[Op.values].map(item => `(${this.escape(item)})`).join(', ')})`, comparator, options.prefix);
        }

        return this._joinKeyValue(key, `(${this.escape(value, field)})`, comparator, options.prefix);
      case Op.between:
      case Op.notBetween:
        return this._joinKeyValue(key, `${this.escape(value[0])} AND ${this.escape(value[1])}`, comparator, options.prefix);
      case Op.raw:
        throw new Error('The `$raw` where property is no longer supported.  Use `sequelize.literal` instead.');
      case Op.col:
        comparator = this.OperatorMap[Op.eq];
        value = value.split('.');

        if (value.length > 2) {
          value = [
            // join the tables by -> to match out internal namings
            value.slice(0, -1).join('->'),
            value[value.length - 1]
          ];
        }

        return this._joinKeyValue(key, value.map(identifier => this.quoteIdentifier(identifier)).join('.'), comparator, options.prefix);
    }

    const escapeOptions = {
      acceptStrings: comparator.indexOf(this.OperatorMap[Op.like]) !== -1
    };

    if (_.isPlainObject(value)) {
      if (value[Op.col]) {
        return this._joinKeyValue(key, this.whereItemQuery(null, value), comparator, options.prefix);
      }
      if (value[Op.any]) {
        escapeOptions.isList = true;
        return this._joinKeyValue(key, `(${this.escape(value[Op.any], field, escapeOptions)})`, `${comparator} ${this.OperatorMap[Op.any]}`, options.prefix);
      }
      if (value[Op.all]) {
        escapeOptions.isList = true;
        return this._joinKeyValue(key, `(${this.escape(value[Op.all], field, escapeOptions)})`, `${comparator} ${this.OperatorMap[Op.all]}`, options.prefix);
      }
    }

    if (comparator.indexOf(this.OperatorMap[Op.regexp]) !== -1) {
      return this._joinKeyValue(key, `'${value}'`, comparator, options.prefix);
    }

    if (value === null && comparator === this.OperatorMap[Op.eq]) {
      return this._joinKeyValue(key, this.escape(value, field, escapeOptions), this.OperatorMap[Op.is], options.prefix);
    } else if (value === null && this.OperatorMap[Op.ne]) {
      return this._joinKeyValue(key, this.escape(value, field, escapeOptions), this.OperatorMap[Op.not], options.prefix);
    }

    return this._joinKeyValue(key, this.escape(value, field, escapeOptions), comparator, options.prefix);
  },

  /*
    Takes something and transforms it into values of a where condition.
   @private
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

    if (smth && smth instanceof Utils.SequelizeMethod) { // Checking a property is cheaper than a lot of instanceof calls
      result = this.handleSequelizeMethod(smth, tableName, factory, options, prepend);
    } else if (_.isPlainObject(smth)) {
      return this.whereItemsQuery(smth, {
        model: factory,
        prefix: prepend && tableName
      });
    } else if (typeof smth === 'number') {
      let primaryKeys = factory ? Object.keys(factory.primaryKeys) : [];

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
      if (smth.length === 0 || smth.length > 0 && smth[0].length === 0) return '1=1';
      if (Utils.canTreatArrayAsAnd(smth)) {
        const _smth = { [Op.and]: smth };
        result = this.getWhereConditions(_smth, tableName, factory, options, prepend);
      } else {
        throw new Error('Support for literal replacements in the `where` object has been removed.');
      }
    } else if (smth === null) {
      return this.whereItemsQuery(smth, {
        model: factory,
        prefix: prepend && tableName
      });
    }

    return result ? result : '1=1';
  },

  // A recursive parser for nested where conditions
  parseConditionObject(conditions, path) {
    path = path || [];
    return _.reduce(conditions, (result, value, key) => {
      if (_.isObject(value)) {
        result = result.concat(this.parseConditionObject(value, path.concat(key))); // Recursively parse objects
      } else {
        result.push({ path: path.concat(key), value });
      }
      return result;
    }, []);
  },

  isIdentifierQuoted(string) {
    return /^\s*(?:([`"'])(?:(?!\1).|\1{2})*\1\.?)+\s*$/i.test(string);
  },

  booleanValue(value) {
    return value;
  }
};

module.exports = QueryGenerator;
