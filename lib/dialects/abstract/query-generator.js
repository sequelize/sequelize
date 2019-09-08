'use strict';

const util = require('util');
const _ = require('lodash');
const uuidv4 = require('uuid/v4');
const semver = require('semver');

const Utils = require('../../utils');
const deprecations = require('../../utils/deprecations');
const SqlString = require('../../sql-string');
const DataTypes = require('../../data-types');
const Model = require('../../model');
const Association = require('../../associations/base');
const BelongsTo = require('../../associations/belongs-to');
const BelongsToMany = require('../../associations/belongs-to-many');
const HasMany = require('../../associations/has-many');
const Op = require('../../operators');
const sequelizeError = require('../../errors');
const IndexHints = require('../../index-hints');

const QuoteHelper = require('./query-generator/helpers/quote');

/**
 * Abstract Query Generator
 *
 * @private
 */
class QueryGenerator {
  constructor(options) {
    if (!options.sequelize) throw new Error('QueryGenerator initialized without options.sequelize');
    if (!options._dialect) throw new Error('QueryGenerator initialized without options._dialect');

    this.sequelize = options.sequelize;
    this.options = options.sequelize.options;

    // dialect name
    this.dialect = options._dialect.name;
    this._dialect = options._dialect;
  }

  extractTableDetails(tableName, options) {
    options = options || {};
    tableName = tableName || {};
    return {
      schema: tableName.schema || options.schema || 'public',
      tableName: _.isPlainObject(tableName) ? tableName.tableName : tableName,
      delimiter: tableName.delimiter || options.delimiter || '.'
    };
  }

  addSchema(param) {
    if (!param._schema) return param.tableName || param;
    const self = this;
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
  }

  dropSchema(tableName, options) {
    return this.dropTableQuery(tableName, options);
  }

  describeTableQuery(tableName, schema, schemaDelimiter) {
    const table = this.quoteTable(
      this.addSchema({
        tableName,
        _schema: schema,
        _schemaDelimiter: schemaDelimiter
      })
    );

    return `DESCRIBE ${table};`;
  }

  dropTableQuery(tableName) {
    return `DROP TABLE IF EXISTS ${this.quoteTable(tableName)};`;
  }

  renameTableQuery(before, after) {
    return `ALTER TABLE ${this.quoteTable(before)} RENAME TO ${this.quoteTable(after)};`;
  }

  /**
   * Returns an insert into command
   *
   * @param {string} table
   * @param {Object} valueHash       attribute value pairs
   * @param {Object} modelAttributes
   * @param {Object} [options]
   *
   * @private
   */
  insertQuery(table, valueHash, modelAttributes, options) {
    options = options || {};
    _.defaults(options, this.options);

    const modelAttributeMap = {};
    const fields = [];
    const values = [];
    const bind = [];
    const quotedTable = this.quoteTable(table);
    const bindParam = options.bindParam === undefined ? this.bindParam(bind) : options.bindParam;
    let query;
    let valueQuery = '';
    let emptyQuery = '';
    let outputFragment = '';
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

          for (const modelKey in modelAttributes) {
            const attribute = modelAttributes[modelKey];
            if (!(attribute.type instanceof DataTypes.VIRTUAL)) {
              if (tmpColumns.length > 0) {
                tmpColumns += ',';
                outputColumns += ',';
              }

              tmpColumns += `${this.quoteIdentifier(attribute.field)} ${attribute.type.toSql()}`;
              outputColumns += `INSERTED.${this.quoteIdentifier(attribute.field)}`;
            }
          }

          tmpTable = `declare @tmp table (${tmpColumns});`;
          outputFragment = ` OUTPUT ${outputColumns} into @tmp`;
          const selectFromTmp = ';select * from @tmp';

          valueQuery += selectFromTmp;
          emptyQuery += selectFromTmp;
        }
      }
    }

    if (_.get(this, ['sequelize', 'options', 'dialectOptions', 'prependSearchPath']) || options.searchPath) {
      // Not currently supported with search path (requires output of multiple queries)
      options.bindParam = false;
    }

    if (this._dialect.supports.EXCEPTION && options.exception) {
      // Not currently supported with bind parameters (requires output of multiple queries)
      options.bindParam = false;
    }

    valueHash = Utils.removeNullValuesFromHash(valueHash, this.options.omitNull);
    for (const key in valueHash) {
      if (Object.prototype.hasOwnProperty.call(valueHash, key)) {
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

          if (value instanceof Utils.SequelizeMethod || options.bindParam === false) {
            values.push(this.escape(value, modelAttributeMap && modelAttributeMap[key] || undefined, { context: 'INSERT' }));
          } else {
            values.push(this.format(value, modelAttributeMap && modelAttributeMap[key] || undefined, { context: 'INSERT' }, bindParam));
          }
        }
      }
    }

    const replacements = {
      ignoreDuplicates: options.ignoreDuplicates ? this._dialect.supports.inserts.ignoreDuplicates : '',
      onConflictDoNothing: options.ignoreDuplicates ? this._dialect.supports.inserts.onConflictDoNothing : '',
      attributes: fields.join(','),
      output: outputFragment,
      values: values.join(','),
      tmpTable
    };

    valueQuery = `${tmpTable}INSERT${replacements.ignoreDuplicates} INTO ${quotedTable} (${replacements.attributes})${replacements.output} VALUES (${replacements.values})${replacements.onConflictDoNothing}${valueQuery}`;
    emptyQuery = `${tmpTable}INSERT${replacements.ignoreDuplicates} INTO ${quotedTable}${replacements.output}${replacements.onConflictDoNothing}${emptyQuery}`;

    if (this._dialect.supports.EXCEPTION && options.exception) {
      // Mostly for internal use, so we expect the user to know what he's doing!
      // pg_temp functions are private per connection, so we never risk this function interfering with another one.
      if (semver.gte(this.sequelize.options.databaseVersion, '9.2.0')) {
        // >= 9.2 - Use a UUID but prefix with 'func_' (numbers first not allowed)
        const delimiter = `$func_${uuidv4().replace(/-/g, '')}$`;

        options.exception = 'WHEN unique_violation THEN GET STACKED DIAGNOSTICS sequelize_caught_exception = PG_EXCEPTION_DETAIL;';
        valueQuery = `${`CREATE OR REPLACE FUNCTION pg_temp.testfunc(OUT response ${quotedTable}, OUT sequelize_caught_exception text) RETURNS RECORD AS ${delimiter}` +
          ' BEGIN '}${valueQuery} INTO response; EXCEPTION ${options.exception} END ${delimiter
        } LANGUAGE plpgsql; SELECT (testfunc.response).*, testfunc.sequelize_caught_exception FROM pg_temp.testfunc(); DROP FUNCTION IF EXISTS pg_temp.testfunc()`;
      } else {
        options.exception = 'WHEN unique_violation THEN NULL;';
        valueQuery = `CREATE OR REPLACE FUNCTION pg_temp.testfunc() RETURNS SETOF ${quotedTable} AS $body$ BEGIN RETURN QUERY ${valueQuery}; EXCEPTION ${options.exception} END; $body$ LANGUAGE plpgsql; SELECT * FROM pg_temp.testfunc(); DROP FUNCTION IF EXISTS pg_temp.testfunc();`;
      }
    }

    if (this._dialect.supports['ON DUPLICATE KEY'] && options.onDuplicate) {
      valueQuery += ` ON DUPLICATE KEY ${options.onDuplicate}`;
      emptyQuery += ` ON DUPLICATE KEY ${options.onDuplicate}`;
    }

    query = `${replacements.attributes.length ? valueQuery : emptyQuery};`;
    if (identityWrapperRequired && this._dialect.supports.autoIncrement.identityInsert) {
      query = `SET IDENTITY_INSERT ${quotedTable} ON; ${query} SET IDENTITY_INSERT ${quotedTable} OFF;`;
    }

    // Used by Postgres upsertQuery and calls to here with options.exception set to true
    const result = { query };
    if (options.bindParam !== false) {
      result.bind = bind;
    }
    return result;
  }

  /**
   * Returns an insert into command for multiple values.
   *
   * @param {string} tableName
   * @param {Object} fieldValueHashes
   * @param {Object} options
   * @param {Object} fieldMappedAttributes
   *
   * @private
   */
  bulkInsertQuery(tableName, fieldValueHashes, options, fieldMappedAttributes) {
    options = options || {};
    fieldMappedAttributes = fieldMappedAttributes || {};

    const tuples = [];
    const serials = {};
    const allAttributes = [];
    let onDuplicateKeyUpdate = '';

    for (const fieldValueHash of fieldValueHashes) {
      _.forOwn(fieldValueHash, (value, key) => {
        if (!allAttributes.includes(key)) {
          allAttributes.push(key);
        }
        if (
          fieldMappedAttributes[key]
          && fieldMappedAttributes[key].autoIncrement === true
        ) {
          serials[key] = true;
        }
      });
    }

    for (const fieldValueHash of fieldValueHashes) {
      const values = allAttributes.map(key => {
        if (
          this._dialect.supports.bulkDefault
          && serials[key] === true
        ) {
          return fieldValueHash[key] || 'DEFAULT';
        }

        return this.escape(fieldValueHash[key], fieldMappedAttributes[key], { context: 'INSERT' });
      });

      tuples.push(`(${values.join(',')})`);
    }

    if (this._dialect.supports.inserts.updateOnDuplicate && options.updateOnDuplicate) {
      if (this._dialect.supports.inserts.updateOnDuplicate == ' ON CONFLICT DO UPDATE SET') { // postgres / sqlite
        // If no conflict target columns were specified, use the primary key names from options.upsertKeys
        const conflictKeys = options.upsertKeys.map(attr => this.quoteIdentifier(attr));
        const updateKeys = options.updateOnDuplicate.map(attr => `${this.quoteIdentifier(attr)}=EXCLUDED.${this.quoteIdentifier(attr)}`);
        onDuplicateKeyUpdate = ` ON CONFLICT (${conflictKeys.join(',')}) DO UPDATE SET ${updateKeys.join(',')}`;
      } else { // mysql / maria
        const valueKeys = options.updateOnDuplicate.map(attr => `${this.quoteIdentifier(attr)}=VALUES(${this.quoteIdentifier(attr)})`);
        onDuplicateKeyUpdate = `${this._dialect.supports.inserts.updateOnDuplicate} ${valueKeys.join(',')}`;
      }
    }

    const ignoreDuplicates = options.ignoreDuplicates ? this._dialect.supports.inserts.ignoreDuplicates : '';
    const attributes = allAttributes.map(attr => this.quoteIdentifier(attr)).join(',');
    const onConflictDoNothing = options.ignoreDuplicates ? this._dialect.supports.inserts.onConflictDoNothing : '';
    let returning = '';

    if (this._dialect.supports.returnValues && Array.isArray(options.returning)) {
      const fields = options.returning.map(field => this.quoteIdentifier(field)).join(',');
      returning += ` RETURNING ${fields}`;
    } else {
      returning += this._dialect.supports.returnValues && options.returning ? ' RETURNING *' : '';
    }

    return `INSERT${ignoreDuplicates} INTO ${this.quoteTable(tableName)} (${attributes}) VALUES ${tuples.join(',')}${onDuplicateKeyUpdate}${onConflictDoNothing}${returning};`;
  }

  /**
   * Returns an update query
   *
   * @param {string} tableName
   * @param {Object} attrValueHash
   * @param {Object} where A hash with conditions (e.g. {name: 'foo'}) OR an ID as integer
   * @param {Object} options
   * @param {Object} attributes
   *
   * @private
   */
  updateQuery(tableName, attrValueHash, where, options, attributes) {
    options = options || {};
    _.defaults(options, this.options);

    attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, options.omitNull, options);

    const values = [];
    const bind = [];
    const modelAttributeMap = {};
    let outputFragment = '';
    let tmpTable = '';        // tmpTable declaration for trigger
    let selectFromTmp = '';   // Select statement for trigger
    let suffix = '';

    if (_.get(this, ['sequelize', 'options', 'dialectOptions', 'prependSearchPath']) || options.searchPath) {
      // Not currently supported with search path (requires output of multiple queries)
      options.bindParam = false;
    }

    const bindParam = options.bindParam === undefined ? this.bindParam(bind) : options.bindParam;

    if (this._dialect.supports['LIMIT ON UPDATE'] && options.limit) {
      if (this.dialect !== 'mssql') {
        suffix = ` LIMIT ${this.escape(options.limit)} `;
      }
    }

    if (this._dialect.supports.returnValues) {
      if (this._dialect.supports.returnValues.output) {
        // we always need this for mssql
        outputFragment = ' OUTPUT INSERTED.*';

        //To capture output rows when there is a trigger on MSSQL DB
        if (attributes && options.hasTrigger && this._dialect.supports.tmpTableTrigger) {
          let tmpColumns = '';
          let outputColumns = '';

          for (const modelKey in attributes) {
            const attribute = attributes[modelKey];
            if (!(attribute.type instanceof DataTypes.VIRTUAL)) {
              if (tmpColumns.length > 0) {
                tmpColumns += ',';
                outputColumns += ',';
              }

              tmpColumns += `${this.quoteIdentifier(attribute.field)} ${attribute.type.toSql()}`;
              outputColumns += `INSERTED.${this.quoteIdentifier(attribute.field)}`;
            }
          }

          tmpTable = `declare @tmp table (${tmpColumns}); `;
          outputFragment = ` OUTPUT ${outputColumns} into @tmp`;
          selectFromTmp = ';select * from @tmp';

          suffix += selectFromTmp;
        }
      } else if (this._dialect.supports.returnValues && options.returning) {
        // ensure that the return output is properly mapped to model fields.
        options.mapToModel = true;
        suffix += ' RETURNING *';
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

      if (value instanceof Utils.SequelizeMethod || options.bindParam === false) {
        values.push(`${this.quoteIdentifier(key)}=${this.escape(value, modelAttributeMap && modelAttributeMap[key] || undefined, { context: 'UPDATE' })}`);
      } else {
        values.push(`${this.quoteIdentifier(key)}=${this.format(value, modelAttributeMap && modelAttributeMap[key] || undefined, { context: 'UPDATE' }, bindParam)}`);
      }
    }

    const whereOptions = _.defaults({ bindParam }, options);

    if (values.length === 0) {
      return '';
    }

    const query = `${tmpTable}UPDATE ${this.quoteTable(tableName)} SET ${values.join(',')}${outputFragment} ${this.whereQuery(where, whereOptions)}${suffix}`.trim();
    // Used by Postgres upsertQuery and calls to here with options.exception set to true
    const result = { query };
    if (options.bindParam !== false) {
      result.bind = bind;
    }
    return result;
  }

  /**
   * Returns an update query using arithmetic operator
   *
   * @param {string} operator      String with the arithmetic operator (e.g. '+' or '-')
   * @param {string} tableName     Name of the table
   * @param {Object} attrValueHash A hash with attribute-value-pairs
   * @param {Object} where         A hash with conditions (e.g. {name: 'foo'}) OR an ID as integer
   * @param {Object} options
   * @param {Object} attributes
   */
  arithmeticQuery(operator, tableName, attrValueHash, where, options, attributes) {
    options = options || {};
    _.defaults(options, { returning: true });

    attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, this.options.omitNull);

    const values = [];
    let outputFragment = '';
    let returningFragment = '';

    if (this._dialect.supports.returnValues && options.returning) {
      if (this._dialect.supports.returnValues.returning) {
        options.mapToModel = true;
        returningFragment = 'RETURNING *';
      } else if (this._dialect.supports.returnValues.output) {
        outputFragment = ' OUTPUT INSERTED.*';
      }
    }

    for (const key in attrValueHash) {
      const value = attrValueHash[key];
      values.push(`${this.quoteIdentifier(key)}=${this.quoteIdentifier(key)}${operator} ${this.escape(value)}`);
    }

    attributes = attributes || {};
    for (const key in attributes) {
      const value = attributes[key];
      values.push(`${this.quoteIdentifier(key)}=${this.escape(value)}`);
    }

    return `UPDATE ${this.quoteTable(tableName)} SET ${values.join(',')}${outputFragment} ${this.whereQuery(where)} ${returningFragment}`.trim();
  }

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
        - using
        - operator
        - concurrently: Pass CONCURRENT so other operations run while the index is created
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

    options.prefix = options.prefix || rawTablename || tableName;
    if (options.prefix && typeof options.prefix === 'string') {
      options.prefix = options.prefix.replace(/\./g, '_');
      options.prefix = options.prefix.replace(/("|')/g, '');
    }

    const fieldsSql = options.fields.map(field => {
      if (typeof field === 'string') {
        return this.quoteIdentifier(field);
      }
      if (field instanceof Utils.SequelizeMethod) {
        return this.handleSequelizeMethod(field);
      }
      let result = '';

      if (field.attribute) {
        field.name = field.attribute;
      }

      if (!field.name) {
        throw new Error(`The following index field has no name: ${util.inspect(field)}`);
      }

      result += this.quoteIdentifier(field.name);

      if (this._dialect.supports.index.collate && field.collate) {
        result += ` COLLATE ${this.quoteIdentifier(field.collate)}`;
      }

      if (this._dialect.supports.index.length && field.length) {
        result += `(${field.length})`;
      }

      if (field.order) {
        result += ` ${field.order}`;
      }

      return result;
    });

    if (!options.name) {
      // Mostly for cases where addIndex is called directly by the user without an options object (for example in migrations)
      // All calls that go through sequelize should already have a name
      options = Utils.nameIndex(options, options.prefix);
    }

    options = Model._conformIndex(options);

    if (!this._dialect.supports.index.type) {
      delete options.type;
    }

    if (options.where) {
      options.where = this.whereQuery(options.where);
    }

    if (typeof tableName === 'string') {
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
      this._dialect.supports.index.using === 1 && options.using ? `USING ${options.using}` : '',
      !this._dialect.supports.indexViaAlter ? `ON ${tableName}` : undefined,
      this._dialect.supports.index.using === 2 && options.using ? `USING ${options.using}` : '',
      `(${fieldsSql.join(', ')}${options.operator ? ` ${options.operator}` : ''})`,
      this._dialect.supports.index.parser && options.parser ? `WITH PARSER ${options.parser}` : undefined,
      this._dialect.supports.index.where && options.where ? options.where : undefined
    );

    return _.compact(ind).join(' ');
  }

  addConstraintQuery(tableName, options) {
    options = options || {};
    const constraintSnippet = this.getConstraintSnippet(tableName, options);

    if (typeof tableName === 'string') {
      tableName = this.quoteIdentifiers(tableName);
    } else {
      tableName = this.quoteTable(tableName);
    }

    return `ALTER TABLE ${tableName} ADD ${constraintSnippet};`;
  }

  getConstraintSnippet(tableName, options) {
    let constraintSnippet, constraintName;

    const fieldsSql = options.fields.map(field => {
      if (typeof field === 'string') {
        return this.quoteIdentifier(field);
      }
      if (field instanceof Utils.SequelizeMethod) {
        return this.handleSequelizeMethod(field);
      }
      if (field.attribute) {
        field.name = field.attribute;
      }

      if (!field.name) {
        throw new Error(`The following index field has no name: ${field}`);
      }

      return this.quoteIdentifier(field.name);
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
  }

  removeConstraintQuery(tableName, constraintName) {
    if (typeof tableName === 'string') {
      tableName = this.quoteIdentifiers(tableName);
    } else {
      tableName = this.quoteTable(tableName);
    }

    return `ALTER TABLE ${tableName} DROP CONSTRAINT ${this.quoteIdentifiers(constraintName)}`;
  }

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
    }
    if (Array.isArray(collection)) {
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
            item = this.sequelize.literal(` ${validOrderOptions[orderIndex]}`);
          } else if (previousModel && previousModel.prototype instanceof Model) {
            // only go down this path if we have preivous model and check only once
            if (previousModel.associations !== undefined && previousModel.associations[item]) {
              // convert the item to an association
              item = previousModel.associations[item];
            } else if (previousModel.rawAttributes !== undefined && previousModel.rawAttributes[item] && item !== previousModel.rawAttributes[item].field) {
              // convert the item attribute from its alias
              item = previousModel.rawAttributes[item].field;
            } else if (
              item.includes('.')
              && previousModel.rawAttributes !== undefined
            ) {
              const itemSplit = item.split('.');

              if (previousModel.rawAttributes[itemSplit[0]].type instanceof DataTypes.JSON) {
                // just quote identifiers for now
                const identifier = this.quoteIdentifiers(`${previousModel.name}.${previousModel.rawAttributes[itemSplit[0]].field}`);

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
        sql += `${this.quoteIdentifier(tableNames.join(connector))}.`;
      } else if (typeof collection[0] === 'string' && parent) {
        sql += `${this.quoteIdentifier(parent.name)}.`;
      }

      // loop through everything past i and append to the sql
      collection.slice(i).forEach(collectionItem => {
        sql += this.quote(collectionItem, parent, connector);
      }, this);

      return sql;
    }
    if (collection._modelAttribute) {
      return `${this.quoteTable(collection.Model.name)}.${this.quoteIdentifier(collection.fieldName)}`;
    }
    if (collection instanceof Utils.SequelizeMethod) {
      return this.handleSequelizeMethod(collection);
    }
    if (_.isPlainObject(collection) && collection.raw) {
      // simple objects with raw is no longer supported
      throw new Error('The `{raw: "..."}` syntax is no longer supported.  Use `sequelize.literal` instead.');
    }
    throw new Error(`Unknown structure passed to order / group: ${util.inspect(collection)}`);
  }

  /**
   * Split a list of identifiers by "." and quote each part
   *
   * @param {string} identifier
   * @param {boolean} force
   *
   * @returns {string}
   */
  quoteIdentifier(identifier, force) {
    return QuoteHelper.quoteIdentifier(this.dialect, identifier, {
      force,
      quoteIdentifiers: this.options.quoteIdentifiers
    });
  }

  quoteIdentifiers(identifiers) {
    if (identifiers.includes('.')) {
      identifiers = identifiers.split('.');

      const head = identifiers.slice(0, identifiers.length - 1).join('.');
      const tail = identifiers[identifiers.length - 1];

      return `${this.quoteIdentifier(head)}.${this.quoteIdentifier(tail)}`;
    }

    return this.quoteIdentifier(identifiers);
  }

  quoteAttribute(attribute, model) {
    if (model && attribute in model.rawAttributes) {
      return this.quoteIdentifier(attribute);
    }
    return this.quoteIdentifiers(attribute);
  }

  /**
   * Quote table name with optional alias and schema attribution
   *
   * @param {string|Object}  param table string or object
   * @param {string|boolean} alias alias name
   *
   * @returns {string}
   */
  quoteTable(param, alias) {
    let table = '';

    if (alias === true) {
      alias = param.as || param.name || param;
    }

    if (_.isObject(param)) {
      if (this._dialect.supports.schemas) {
        if (param.schema) {
          table += `${this.quoteIdentifier(param.schema)}.`;
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

    if (alias) {
      table += ` AS ${this.quoteIdentifier(alias)}`;
    }

    return table;
  }

  /*
    Escape a value (e.g. a string, number or date)
    @private
  */
  escape(value, field, options) {
    options = options || {};

    if (value !== null && value !== undefined) {
      if (value instanceof Utils.SequelizeMethod) {
        return this.handleSequelizeMethod(value);
      }
      if (field && field.type) {
        this.validate(value, field, options);

        if (field.type.stringify) {
          // Users shouldn't have to worry about these args - just give them a function that takes a single arg
          const simpleEscape = escVal => SqlString.escape(escVal, this.options.timezone, this.dialect);

          value = field.type.stringify(value, { escape: simpleEscape, field, timezone: this.options.timezone, operation: options.operation });

          if (field.type.escape === false) {
            // The data-type already did the required escaping
            return value;
          }
        }
      }
    }

    return SqlString.escape(value, this.options.timezone, this.dialect);
  }

  bindParam(bind) {
    return value => {
      bind.push(value);
      return `$${bind.length}`;
    };
  }

  /*
    Returns a bind parameter representation of a value (e.g. a string, number or date)
    @private
  */
  format(value, field, options, bindParam) {
    options = options || {};

    if (value !== null && value !== undefined) {
      if (value instanceof Utils.SequelizeMethod) {
        throw new Error('Cannot pass SequelizeMethod as a bind parameter - use escape instead');
      }
      if (field && field.type) {
        this.validate(value, field, options);

        if (field.type.bindParam) {
          return field.type.bindParam(value, { escape: _.identity, field, timezone: this.options.timezone, operation: options.operation, bindParam });
        }
      }
    }

    return bindParam(value);
  }

  /*
    Validate a value against a field specification
    @private
  */
  validate(value, field, options) {
    if (this.typeValidation && field.type.validate && value) {
      try {
        if (options.isList && Array.isArray(value)) {
          for (const item of value) {
            field.type.validate(item, options);
          }
        } else {
          field.type.validate(value, options);
        }
      } catch (error) {
        if (error instanceof sequelizeError.ValidationError) {
          error.errors.push(new sequelizeError.ValidationErrorItem(
            error.message,
            'Validation error',
            field.fieldName,
            value,
            null,
            `${field.type.key} validator`
          ));
        }

        throw error;
      }
    }
  }

  isIdentifierQuoted(identifier) {
    return QuoteHelper.isIdentifierQuoted(identifier);
  }

  /**
   * Generates an SQL query that extract JSON property of given path.
   *
   * @param   {string}               column  The JSON column
   * @param   {string|Array<string>} [path]  The path to extract (optional)
   * @returns {string}                       The generated sql query
   * @private
   */
  jsonPathExtractionQuery(column, path) {
    let paths = _.toPath(path);
    let pathStr;
    const quotedColumn = this.isIdentifierQuoted(column)
      ? column
      : this.quoteIdentifier(column);

    switch (this.dialect) {
      case 'mysql':
      case 'mariadb':
      case 'sqlite':
        /**
         * Non digit sub paths need to be quoted as ECMAScript identifiers
         * https://bugs.mysql.com/bug.php?id=81896
         */
        if (this.dialect === 'mysql') {
          paths = paths.map(subPath => {
            return /\D/.test(subPath)
              ? Utils.addTicks(subPath, '"')
              : subPath;
          });
        }

        pathStr = this.escape(['$']
          .concat(paths)
          .join('.')
          .replace(/\.(\d+)(?:(?=\.)|$)/g, (__, digit) => `[${digit}]`));

        if (this.dialect === 'sqlite') {
          return `json_extract(${quotedColumn},${pathStr})`;
        }

        return `json_unquote(json_extract(${quotedColumn},${pathStr}))`;

      case 'postgres':
        pathStr = this.escape(`{${paths.join(',')}}`);
        return `(${quotedColumn}#>>${pathStr})`;

      default:
        throw new Error(`Unsupported ${this.dialect} for JSON operations`);
    }
  }

  /*
    Returns a query for selecting elements in the table <tableName>.
    Options:
      - attributes -> An array of attributes (e.g. ['name', 'birthday']). Default: *
      - where -> A hash with conditions (e.g. {name: 'foo'})
                 OR an ID as integer
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

    // Aliases can be passed through subqueries and we don't want to reset them
    if (this.options.minifyAliases && !options.aliasesMapping) {
      options.aliasesMapping = new Map();
      options.aliasesByTable = {};
    }

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
        if (!attributes.main.some(attr => keyAtt === attr || keyAtt === attr[0] || keyAtt === attr[1])) {
          attributes.main.push(mainTable.model.rawAttributes[keyAtt].field ? [keyAtt, mainTable.model.rawAttributes[keyAtt].field] : keyAtt);
        }
      }
    }

    attributes.main = this.escapeAttributes(attributes.main, options, mainTable.as);
    attributes.main = attributes.main || (options.include ? [`${mainTable.as}.*`] : ['*']);

    // If subquery, we add the mainAttributes to the subQuery and set the mainAttributes to select * from subquery
    if (subQuery || options.groupedLimit) {
      // We need primary keys
      attributes.subQuery = attributes.main;
      attributes.main = [`${mainTable.as || mainTable.quotedName}.*`];
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
          attributes.main = _.uniq(attributes.main.concat(joinQueries.attributes.main));
        }
        if (joinQueries.attributes.subQuery.length > 0) {
          attributes.subQuery = _.uniq(attributes.subQuery.concat(joinQueries.attributes.subQuery));
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
        const baseQuery = `SELECT * FROM (${this.selectQuery(
          tableName,
          {
            attributes: options.attributes,
            offset: options.offset,
            limit: options.groupedLimit.limit,
            order: groupedLimitOrder,
            aliasesMapping: options.aliasesMapping,
            aliasesByTable: options.aliasesByTable,
            where,
            include,
            model
          },
          model
        ).replace(/;$/, '')}) AS sub`; // Every derived table must have its own alias
        const placeHolder = this.whereItemQuery(Op.placeholder, true, { model });
        const splicePos = baseQuery.indexOf(placeHolder);

        mainQueryItems.push(this.selectFromTableFragment(options, mainTable.model, attributes.main, `(${
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
        })`, mainTable.as));
      } else {
        mainQueryItems.push(this.selectFromTableFragment(options, mainTable.model, attributes.main, mainTable.quotedName, mainTable.as));
      }

      mainQueryItems.push(mainJoinQueries.join(''));
    }

    // Add WHERE to sub or main query
    if (Object.prototype.hasOwnProperty.call(options, 'where') && !options.groupedLimit) {
      options.where = this.getWhereConditions(options.where, mainTable.as || tableName, model, options);
      if (options.where) {
        if (subQuery) {
          subQueryItems.push(` WHERE ${options.where}`);
        } else {
          mainQueryItems.push(` WHERE ${options.where}`);
          // Walk the main query to update all selects
          mainQueryItems.forEach((value, key) => {
            if (value.startsWith('SELECT')) {
              mainQueryItems[key] = this.selectFromTableFragment(options, model, attributes.main, mainTable.quotedName, mainTable.as, options.where);
            }
          });
        }
      }
    }

    // Add GROUP BY to sub or main query
    if (options.group) {
      options.group = Array.isArray(options.group) ? options.group.map(t => this.aliasGrouping(t, model, mainTable.as, options)).join(', ') :  this.aliasGrouping(options.group, model, mainTable.as, options);

      if (subQuery) {
        subQueryItems.push(` GROUP BY ${options.group}`);
      } else {
        mainQueryItems.push(` GROUP BY ${options.group}`);
      }
    }

    // Add HAVING to sub or main query
    if (Object.prototype.hasOwnProperty.call(options, 'having')) {
      options.having = this.getWhereConditions(options.having, tableName, model, options, false);
      if (options.having) {
        if (subQuery) {
          subQueryItems.push(` HAVING ${options.having}`);
        } else {
          mainQueryItems.push(` HAVING ${options.having}`);
        }
      }
    }

    // Add ORDER to sub or main query
    if (options.order) {
      const orders = this.getQueryOrders(options, model, subQuery);
      if (orders.mainQueryOrder.length) {
        mainQueryItems.push(` ORDER BY ${orders.mainQueryOrder.join(', ')}`);
      }
      if (orders.subQueryOrder.length) {
        subQueryItems.push(` ORDER BY ${orders.subQueryOrder.join(', ')}`);
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
        query += ` FOR ${lock}`;
      } else if (lock === 'SHARE') {
        query += ` ${this._dialect.supports.forShare}`;
      } else {
        query += ' FOR UPDATE';
      }
      if (this._dialect.supports.lockOf && options.lock.of && options.lock.of.prototype instanceof Model) {
        query += ` OF ${this.quoteTable(options.lock.of.name)}`;
      }
      if (this._dialect.supports.skipLocked && options.skipLocked) {
        query += ' SKIP LOCKED';
      }
    }

    return `${query};`;
  }

  aliasGrouping(field, model, tableName, options) {
    const src = Array.isArray(field) ? field[0] : field;

    return this.quote(this._getAliasForField(tableName, src, options) || src, model);
  }

  escapeAttributes(attributes, options, mainTableAs) {
    return attributes && attributes.map(attr => {
      let addTable = true;

      if (attr instanceof Utils.SequelizeMethod) {
        return this.handleSequelizeMethod(attr);
      }
      if (Array.isArray(attr)) {
        if (attr.length !== 2) {
          throw new Error(`${JSON.stringify(attr)} is not a valid attribute definition. Please use the following format: ['attribute definition', 'alias']`);
        }
        attr = attr.slice();

        if (attr[0] instanceof Utils.SequelizeMethod) {
          attr[0] = this.handleSequelizeMethod(attr[0]);
          addTable = false;
        } else if (!attr[0].includes('(') && !attr[0].includes(')')) {
          attr[0] = this.quoteIdentifier(attr[0]);
        } else {
          deprecations.noRawAttributes();
        }
        let alias = attr[1];

        if (this.options.minifyAliases) {
          alias = this._getMinifiedAlias(alias, mainTableAs, options);
        }

        attr = [attr[0], this.quoteIdentifier(alias)].join(' AS ');
      } else {
        attr = !attr.includes(Utils.TICK_CHAR) && !attr.includes('"')
          ? this.quoteAttribute(attr, options.model)
          : this.escape(attr);
      }
      if (!_.isEmpty(options.include) && !attr.includes('.') && addTable) {
        attr = `${mainTableAs}.${attr}`;
      }

      return attr;
    });
  }

  generateInclude(include, parentTableName, topLevelInfo) {
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
      include.model._expandAttributes(include);
      Utils.mapFinderOptions(include, include.model);

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
        }
        if (attr instanceof Utils.Literal) {
          return attr.val; // We trust the user to rename the field correctly
        }
        if (attr instanceof Utils.Cast || attr instanceof Utils.Fn) {
          throw new Error(
            'Tried to select attributes using Sequelize.cast or Sequelize.fn without specifying an alias for the result, during eager loading. ' +
            'This means the attribute will not be added to the returned instance'
          );
        }

        let prefix;
        if (verbatim === true) {
          prefix = attr;
        } else if (/#>>|->>/.test(attr)) {
          prefix = `(${this.quoteIdentifier(includeAs.internalAs)}.${attr.replace(/\(|\)/g, '')})`;
        } else if (/json_extract\(/.test(attr)) {
          prefix = attr.replace(/json_extract\(/i, `json_extract(${this.quoteIdentifier(includeAs.internalAs)}.`);
        } else {
          prefix = `${this.quoteIdentifier(includeAs.internalAs)}.${this.quoteIdentifier(attr)}`;
        }
        let alias = `${includeAs.externalAs}.${attrAs}`;

        if (this.options.minifyAliases) {
          alias = this._getMinifiedAlias(alias, includeAs.internalAs, topLevelInfo.options);
        }

        return `${prefix} AS ${this.quoteIdentifier(alias, true)}`;
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
      this._generateSubQueryFilter(include, includeAs, topLevelInfo);
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
  }

  _getMinifiedAlias(alias, tableName, options) {
    // We do not want to re-alias in case of a subquery
    if (options.aliasesByTable[`${tableName}${alias}`]) {
      return options.aliasesByTable[`${tableName}${alias}`];
    }

    // Do not alias custom suquery_orders
    if (alias.match(/subquery_order_[0-9]/)) {
      return alias;
    }

    const minifiedAlias = `_${options.aliasesMapping.size}`;

    options.aliasesMapping.set(minifiedAlias, alias);
    options.aliasesByTable[`${tableName}${alias}`] = minifiedAlias;

    return minifiedAlias;
  }

  _getAliasForField(tableName, field, options) {
    if (this.options.minifyAliases) {
      if (options.aliasesByTable[`${tableName}${field}`]) {
        return options.aliasesByTable[`${tableName}${field}`];
      }
    }
    return null;
  }

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
    const subqueryAttributes = [];

    if (topLevelInfo.options.groupedLimit && parentIsTop || topLevelInfo.subQuery && include.parent.subQuery && !include.subQuery) {
      if (parentIsTop) {
        // The main model attributes is not aliased to a prefix
        const tableName = this.quoteTable(parent.as || parent.model.name);

        // Check for potential aliased JOIN condition
        joinOn = this._getAliasForField(tableName, attrLeft, topLevelInfo.options) || `${tableName}.${this.quoteIdentifier(attrLeft)}`;

        if (topLevelInfo.subQuery) {
          subqueryAttributes.push(`${tableName}.${this.quoteIdentifier(fieldLeft)}`);
        }
      } else {
        const joinSource = `${asLeft.replace(/->/g, '.')}.${attrLeft}`;

        // Check for potential aliased JOIN condition
        joinOn = this._getAliasForField(asLeft, joinSource, topLevelInfo.options) || this.quoteIdentifier(joinSource);
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
        subQuery: subqueryAttributes
      }
    };
  }

  generateThroughJoin(include, includeAs, parentTableName, topLevelInfo) {
    const through = include.through;
    const throughTable = through.model.getTableName();
    const throughAs = `${includeAs.internalAs}->${through.as}`;
    const externalThroughAs = `${includeAs.externalAs}.${through.as}`;
    const throughAttributes = through.attributes.map(attr => {
      let alias = `${externalThroughAs}.${Array.isArray(attr) ? attr[1] : attr}`;

      if (this.options.minifyAliases) {
        alias = this._getMinifiedAlias(alias, throughAs, topLevelInfo.options);
      }

      return `${this.quoteIdentifier(throughAs)}.${this.quoteIdentifier(Array.isArray(attr) ? attr[0] : attr)
      } AS ${
        this.quoteIdentifier(alias)}`;
    });
    const association = include.association;
    const parentIsTop = !include.parent.association && include.parent.model.name === topLevelInfo.options.model.name;
    const tableSource = parentTableName;
    const identSource = association.identifierField;
    const tableTarget = includeAs.internalAs;
    const identTarget = association.foreignIdentifierField;
    const attrTarget = association.targetKeyField;

    const joinType = include.required ? 'INNER JOIN' : 'LEFT OUTER JOIN';
    let joinBody;
    let joinCondition;
    const attributes = {
      main: [],
      subQuery: []
    };
    let attrSource = association.sourceKey;
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
      attrSource = association.sourceKeyField;
    }
    if (topLevelInfo.subQuery && !include.subQuery && !include.parent.subQuery && include.parent.model !== topLevelInfo.options.mainModel) {
      attrSource = association.sourceKeyField;
    }

    // Filter statement for left side of through
    // Used by both join and subquery where
    // If parent include was in a subquery need to join on the aliased attribute
    if (topLevelInfo.subQuery && !include.subQuery && include.parent.subQuery && !parentIsTop) {
      // If we are minifying aliases and our JOIN target has been minified, we need to use the alias instead of the original column name
      const joinSource = this._getAliasForField(tableSource, `${tableSource}.${attrSource}`, topLevelInfo.options) || `${tableSource}.${attrSource}`;

      sourceJoinOn = `${this.quoteIdentifier(joinSource)} = `;
    } else {
      // If we are minifying aliases and our JOIN target has been minified, we need to use the alias instead of the original column name
      const aliasedSource = this._getAliasForField(tableSource, attrSource, topLevelInfo.options) || attrSource;

      sourceJoinOn = `${this.quoteTable(tableSource)}.${this.quoteIdentifier(aliasedSource)} = `;
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
    }

    this._generateSubQueryFilter(include, includeAs, topLevelInfo);

    return {
      join: joinType,
      body: joinBody,
      condition: joinCondition,
      attributes
    };
  }

  /*
   * Generates subQueryFilter - a select nested in the where clause of the subQuery.
   * For a given include a query is generated that contains all the way from the subQuery
   * table to the include table plus everything that's in required transitive closure of the
   * given include.
   */
  _generateSubQueryFilter(include, includeAs, topLevelInfo) {
    if (!topLevelInfo.subQuery || !include.subQueryFilter) {
      return;
    }

    if (!topLevelInfo.options.where) {
      topLevelInfo.options.where = {};
    }
    let parent = include;
    let child = include;
    let nestedIncludes = this._getRequiredClosure(include).include;
    let query;

    while ((parent = parent.parent)) { // eslint-disable-line
      if (parent.parent && !parent.required) {
        return; // only generate subQueryFilter if all the parents of this include are required
      }

      if (parent.subQueryFilter) {
        // the include is already handled as this parent has the include on its required closure
        // skip to prevent duplicate subQueryFilter
        return;
      }

      nestedIncludes = [Object.assign({}, child, { include: nestedIncludes, attributes: [] })];
      child = parent;
    }

    const topInclude = nestedIncludes[0];
    const topParent = topInclude.parent;
    const topAssociation = topInclude.association;
    topInclude.association = undefined;

    if (topInclude.through && Object(topInclude.through.model) === topInclude.through.model) {
      query = this.selectQuery(topInclude.through.model.getTableName(), {
        attributes: [topInclude.through.model.primaryKeyField],
        include: Model._validateIncludedElements({
          model: topInclude.through.model,
          include: [{
            association: topAssociation.toTarget,
            required: true,
            where: topInclude.where,
            include: topInclude.include
          }]
        }).include,
        model: topInclude.through.model,
        where: {
          [Op.and]: [
            this.sequelize.literal([
              `${this.quoteTable(topParent.model.name)}.${this.quoteIdentifier(topParent.model.primaryKeyField)}`,
              `${this.quoteIdentifier(topInclude.through.model.name)}.${this.quoteIdentifier(topAssociation.identifierField)}`
            ].join(' = ')),
            topInclude.through.where
          ]
        },
        limit: 1,
        includeIgnoreAttributes: false
      }, topInclude.through.model);
    } else {
      const isBelongsTo = topAssociation.associationType === 'BelongsTo';
      const sourceField = isBelongsTo ? topAssociation.identifierField : topAssociation.sourceKeyField || topParent.model.primaryKeyField;
      const targetField = isBelongsTo ? topAssociation.sourceKeyField || topInclude.model.primaryKeyField : topAssociation.identifierField;

      const join = [
        `${this.quoteIdentifier(topInclude.as)}.${this.quoteIdentifier(targetField)}`,
        `${this.quoteTable(topParent.as || topParent.model.name)}.${this.quoteIdentifier(sourceField)}`
      ].join(' = ');

      query = this.selectQuery(topInclude.model.getTableName(), {
        attributes: [targetField],
        include: Model._validateIncludedElements(topInclude).include,
        model: topInclude.model,
        where: {
          [Op.and]: [
            topInclude.where,
            { [Op.join]: this.sequelize.literal(join) }
          ]
        },
        limit: 1,
        tableAs: topInclude.as,
        includeIgnoreAttributes: false
      }, topInclude.model);
    }

    if (!topLevelInfo.options.where[Op.and]) {
      topLevelInfo.options.where[Op.and] = [];
    }

    topLevelInfo.options.where[`__${includeAs.internalAs}`] = this.sequelize.literal([
      '(',
      query.replace(/;$/, ''),
      ')',
      'IS NOT NULL'
    ].join(' '));
  }

  /*
   * For a given include hierarchy creates a copy of it where only the required includes
   * are preserved.
   */
  _getRequiredClosure(include) {
    const copy = Object.assign({}, include, { attributes: [], include: [] });

    if (Array.isArray(include.include)) {
      copy.include = include.include
        .filter(i => i.required)
        .map(inc => this._getRequiredClosure(inc));
    }

    return copy;
  }

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

        if (subQuery) {
          // Handle case where sub-query renames attribute we want to order by,
          // see https://github.com/sequelize/sequelize/issues/8739
          const subQueryAttribute = options.attributes.find(a => Array.isArray(a) && a[0] === order[0] && a[1]);
          if (subQueryAttribute) {
            const modelName = this.quoteIdentifier(model.name);

            order[0] = new Utils.Col(this._getAliasForField(modelName, subQueryAttribute[1], options) || subQueryAttribute[1]);
          }
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

    return { mainQueryOrder, subQueryOrder };
  }

  selectFromTableFragment(options, model, attributes, tables, mainTableAs) {
    let fragment = `SELECT ${attributes.join(', ')} FROM ${tables}`;

    if (mainTableAs) {
      fragment += ` AS ${mainTableAs}`;
    }

    if (options.indexHints && this._dialect.supports.indexHints) {
      for (const hint of options.indexHints) {
        if (IndexHints[hint.type]) {
          fragment += ` ${IndexHints[hint.type]} INDEX (${hint.values.map(indexName => this.quoteIdentifiers(indexName)).join(',')})`;
        }
      }
    }

    return fragment;
  }

  /**
   * Returns an SQL fragment for adding result constraints.
   *
   * @param  {Object} options An object with selectQuery options.
   * @returns {string}         The generated sql query.
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
  }

  handleSequelizeMethod(smth, tableName, factory, options, prepend) {
    let result;

    if (Object.prototype.hasOwnProperty.call(this.OperatorMap, smth.comparator)) {
      smth.comparator = this.OperatorMap[smth.comparator];
    }

    if (smth instanceof Utils.Where) {
      let value = smth.logic;
      let key;

      if (smth.attribute instanceof Utils.SequelizeMethod) {
        key = this.getWhereConditions(smth.attribute, tableName, factory, options, prepend);
      } else {
        key = `${this.quoteTable(smth.attribute.Model.name)}.${this.quoteIdentifier(smth.attribute.field || smth.attribute.fieldName)}`;
      }

      if (value && value instanceof Utils.SequelizeMethod) {
        value = this.getWhereConditions(value, tableName, factory, options, prepend);

        return value === 'NULL' ? `${key} IS NULL` : [key, value].join(` ${smth.comparator} `);
      }
      if (_.isPlainObject(value)) {
        return this.whereItemQuery(smth.attribute, value, {
          model: factory
        });
      }
      if (typeof value === 'boolean') {
        value = this.booleanValue(value);
      } else {
        value = this.escape(value);
      }

      return value === 'NULL' ? `${key} IS NULL` : [key, value].join(` ${smth.comparator} `);
    }
    if (smth instanceof Utils.Literal) {
      return smth.val;
    }
    if (smth instanceof Utils.Cast) {
      if (smth.val instanceof Utils.SequelizeMethod) {
        result = this.handleSequelizeMethod(smth.val, tableName, factory, options, prepend);
      } else if (_.isPlainObject(smth.val)) {
        result = this.whereItemsQuery(smth.val);
      } else {
        result = this.escape(smth.val);
      }

      return `CAST(${result} AS ${smth.type.toUpperCase()})`;
    }
    if (smth instanceof Utils.Fn) {
      return `${smth.fn}(${smth.args.map(arg => {
        if (arg instanceof Utils.SequelizeMethod) {
          return this.handleSequelizeMethod(arg, tableName, factory, options, prepend);
        }
        if (_.isPlainObject(arg)) {
          return this.whereItemsQuery(arg);
        }
        return this.escape(arg);
      }).join(', ')})`;
    }
    if (smth instanceof Utils.Col) {
      if (Array.isArray(smth.col) && !factory) {
        throw new Error('Cannot call Sequelize.col() with array outside of order / group clause');
      }
      if (smth.col.startsWith('*')) {
        return '*';
      }
      return this.quote(smth.col, factory);
    }
    return smth.toString(this, factory);
  }

  whereQuery(where, options) {
    const query = this.whereItemsQuery(where, options);
    if (query && query.length) {
      return `WHERE ${query}`;
    }
    return '';
  }

  whereItemsQuery(where, options, binding) {
    if (
      where === null ||
      where === undefined ||
      Utils.getComplexSize(where) === 0
    ) {
      // NO OP
      return '';
    }

    if (typeof where === 'string') {
      throw new Error('Support for `{where: \'raw query\'}` has been removed.');
    }

    const items = [];

    binding = binding || 'AND';
    if (binding[0] !== ' ') binding = ` ${binding} `;

    if (_.isPlainObject(where)) {
      Utils.getComplexKeys(where).forEach(prop => {
        const item = where[prop];
        items.push(this.whereItemQuery(prop, item, options));
      });
    } else {
      items.push(this.whereItemQuery(undefined, where, options));
    }

    return items.length && items.filter(item => item && item.length).join(binding) || '';
  }

  whereItemQuery(key, value, options = {}) {
    if (value === undefined) {
      throw new Error(`WHERE parameter "${key}" has invalid "undefined" value`);
    }

    if (typeof key === 'string' && key.includes('.') && options.model) {
      const keyParts = key.split('.');
      if (options.model.rawAttributes[keyParts[0]] && options.model.rawAttributes[keyParts[0]].type instanceof DataTypes.JSON) {
        const tmp = {};
        const field = options.model.rawAttributes[keyParts[0]];
        _.set(tmp, keyParts.slice(1), value);
        return this.whereItemQuery(field.field || keyParts[0], tmp, Object.assign({ field }, options));
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

    if (value === null) {
      const opValue = options.bindParam ? 'NULL' : this.escape(value, field);
      return this._joinKeyValue(key, opValue, this.OperatorMap[Op.is], options.prefix);
    }

    if (!value) {
      const opValue = options.bindParam ? this.format(value, field, options, options.bindParam) : this.escape(value, field);
      return this._joinKeyValue(key, opValue, this.OperatorMap[Op.eq], options.prefix);
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
      const opValue = options.bindParam ? this.format(value, field, options, options.bindParam) : this.escape(value, field);
      return this._joinKeyValue(key, opValue, this.OperatorMap[Op.eq], options.prefix);
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
      }
      return this._whereParseSingleValueObject(key, field, this.OperatorMap[Op.eq], value, options);
    }

    if (key === Op.placeholder) {
      const opValue = options.bindParam ? this.format(value, field, options, options.bindParam) : this.escape(value, field);
      return this._joinKeyValue(this.OperatorMap[key], opValue, this.OperatorMap[Op.eq], options.prefix);
    }

    const opValue = options.bindParam ? this.format(value, field, options, options.bindParam) : this.escape(value, field);
    return this._joinKeyValue(key, opValue, this.OperatorMap[Op.eq], options.prefix);
  }

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
  }

  // OR/AND/NOT grouping logic
  _whereGroupBind(key, value, options) {
    const binding = key === Op.or ? this.OperatorMap[Op.or] : this.OperatorMap[Op.and];
    const outerBinding = key === Op.not ? 'NOT ' : '';

    if (Array.isArray(value)) {
      value = value.map(item => {
        let itemQuery = this.whereItemsQuery(item, options, this.OperatorMap[Op.and]);
        if (itemQuery && itemQuery.length && (Array.isArray(item) || _.isPlainObject(item)) && Utils.getComplexSize(item) > 1) {
          itemQuery = `(${itemQuery})`;
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

    return value ? `${outerBinding}(${value})` : undefined;
  }

  _whereBind(binding, key, value, options) {
    if (_.isPlainObject(value)) {
      value = Utils.getComplexKeys(value).map(prop => {
        const item = value[prop];
        return this.whereItemQuery(key, { [prop]: item }, options);
      });
    } else {
      value = value.map(item => this.whereItemQuery(key, item, options));
    }

    value = value.filter(item => item && item.length);

    return value.length ? `(${value.join(binding)})` : undefined;
  }

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
      const where = {
        [op]: value[op]
      };
      items.push(this.whereItemQuery(key, where, Object.assign({}, options, { json: false })));
    });

    _.forOwn(value, (item, prop) => {
      this._traverseJSON(items, baseKey, prop, item, [prop]);
    });

    const result = items.join(this.OperatorMap[Op.and]);
    return items.length > 1 ? `(${result})` : result;
  }

  _traverseJSON(items, baseKey, prop, item, path) {
    let cast;

    if (path[path.length - 1].includes('::')) {
      const tmp = path[path.length - 1].split('::');
      cast = tmp[1];
      path[path.length - 1] = tmp[0];
    }

    const pathKey = this.jsonPathExtractionQuery(baseKey, path);

    if (_.isPlainObject(item)) {
      Utils.getOperators(item).forEach(op => {
        const value = this._toJSONValue(item[op]);
        items.push(this.whereItemQuery(this._castKey(pathKey, value, cast), { [op]: value }));
      });
      _.forOwn(item, (value, itemProp) => {
        this._traverseJSON(items, baseKey, itemProp, value, path.concat([itemProp]));
      });

      return;
    }

    item = this._toJSONValue(item);
    items.push(this.whereItemQuery(this._castKey(pathKey, item, cast), { [Op.eq]: item }));
  }

  _toJSONValue(value) {
    return value;
  }

  _castKey(key, value, cast, json) {
    cast = cast || this._getJsonCast(Array.isArray(value) ? value[0] : value);
    if (cast) {
      return new Utils.Literal(this.handleSequelizeMethod(new Utils.Cast(new Utils.Literal(key), cast, json)));
    }

    return new Utils.Literal(key);
  }

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
  }

  _joinKeyValue(key, value, comparator, prefix) {
    if (!key) {
      return value;
    }
    if (comparator === undefined) {
      throw new Error(`${key} and ${value} has no comparator`);
    }
    key = this._getSafeKey(key, prefix);
    return [key, value].join(` ${comparator} `);
  }

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
  }

  _prefixKey(key, prefix) {
    if (prefix) {
      if (prefix instanceof Utils.Literal) {
        return [this.handleSequelizeMethod(prefix), key].join('.');
      }

      return [this.quoteTable(prefix), key].join('.');
    }

    return key;
  }

  _whereParseSingleValueObject(key, field, prop, value, options) {
    if (prop === Op.not) {
      if (Array.isArray(value)) {
        prop = Op.notIn;
      } else if (value !== null && value !== true && value !== false) {
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
        return this._joinKeyValue(key, `${this.escape(value[0], field)} AND ${this.escape(value[1], field)}`, comparator, options.prefix);
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
      case Op.startsWith:
        comparator = this.OperatorMap[Op.like];
        return this._joinKeyValue(key, this.escape(`${value}%`), comparator, options.prefix);
      case Op.endsWith:
        comparator = this.OperatorMap[Op.like];
        return this._joinKeyValue(key, this.escape(`%${value}`), comparator, options.prefix);
      case Op.substring:
        comparator = this.OperatorMap[Op.like];
        return this._joinKeyValue(key, this.escape(`%${value}%`), comparator, options.prefix);
    }

    const escapeOptions = {
      acceptStrings: comparator.includes(this.OperatorMap[Op.like])
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

    if (value === null && comparator === this.OperatorMap[Op.eq]) {
      return this._joinKeyValue(key, this.escape(value, field, escapeOptions), this.OperatorMap[Op.is], options.prefix);
    }
    if (value === null && comparator === this.OperatorMap[Op.ne]) {
      return this._joinKeyValue(key, this.escape(value, field, escapeOptions), this.OperatorMap[Op.not], options.prefix);
    }

    return this._joinKeyValue(key, this.escape(value, field, escapeOptions), comparator, options.prefix);
  }

  /*
    Takes something and transforms it into values of a where condition.
   @private
  */
  getWhereConditions(smth, tableName, factory, options, prepend) {
    const where = {};

    if (Array.isArray(tableName)) {
      tableName = tableName[0];
      if (Array.isArray(tableName)) {
        tableName = tableName[1];
      }
    }

    options = options || {};

    if (prepend === undefined) {
      prepend = true;
    }

    if (smth && smth instanceof Utils.SequelizeMethod) { // Checking a property is cheaper than a lot of instanceof calls
      return this.handleSequelizeMethod(smth, tableName, factory, options, prepend);
    }
    if (_.isPlainObject(smth)) {
      return this.whereItemsQuery(smth, {
        model: factory,
        prefix: prepend && tableName,
        type: options.type
      });
    }
    if (typeof smth === 'number') {
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
    }
    if (typeof smth === 'string') {
      return this.whereItemsQuery(smth, {
        model: factory,
        prefix: prepend && tableName
      });
    }
    if (Buffer.isBuffer(smth)) {
      return this.escape(smth);
    }
    if (Array.isArray(smth)) {
      if (smth.length === 0 || smth.length > 0 && smth[0].length === 0) return '1=1';
      if (Utils.canTreatArrayAsAnd(smth)) {
        const _smth = { [Op.and]: smth };
        return this.getWhereConditions(_smth, tableName, factory, options, prepend);
      }
      throw new Error('Support for literal replacements in the `where` object has been removed.');
    }
    if (smth === null) {
      return this.whereItemsQuery(smth, {
        model: factory,
        prefix: prepend && tableName
      });
    }

    return '1=1';
  }

  // A recursive parser for nested where conditions
  parseConditionObject(conditions, path) {
    path = path || [];
    return _.reduce(conditions, (result, value, key) => {
      if (_.isObject(value)) {
        return result.concat(this.parseConditionObject(value, path.concat(key))); // Recursively parse objects
      }
      result.push({ path: path.concat(key), value });
      return result;
    }, []);
  }

  booleanValue(value) {
    return value;
  }
}

Object.assign(QueryGenerator.prototype, require('./query-generator/operators'));
Object.assign(QueryGenerator.prototype, require('./query-generator/transaction'));

module.exports = QueryGenerator;
