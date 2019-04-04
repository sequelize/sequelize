'use strict';

const util = require('util');
const _ = require('lodash');

const Utils = require('../../utils');
const { logger } = require('../../utils/logger');
const deprecations = require('../../utils/deprecations');
const SqlString = require('../../sql-string');
const DataTypes = require('../../data-types');
const TableHints = require('../../table-hints');
const Model = require('../../model');
const Association = require('../../associations/base');
const BelongsTo = require('../../associations/belongs-to');
const BelongsToMany = require('../../associations/belongs-to-many');
const HasMany = require('../../associations/has-many');
const Op = require('../../operators');
const sequelizeError = require('../../errors');

const QuoteHelper = require('./query-generator/helpers/quote');

const { Slot, Composition, CompositionGroup } = require('./query-generator/composition');
const { SelectProto, InsertProto, UpdateProto } = require('./query-generator/query-proto');

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

    // template config
    this._templateSettings = require('lodash').runInContext().templateSettings;
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
  insertProto(table, valueHash, modelAttributes, options) {
    options = options || {};
    _.defaults(options, this.options);

    const quotedTable = this.quoteTable(table);
    const insertProto = new InsertProto();

    // Table
    insertProto.table.set(quotedTable);

    // Attributes and values
    const itemsToInsert = this.getItemsToInsert(valueHash, modelAttributes);
    const identityWrapperRequired = itemsToInsert.identityWrapperRequired;

    if (itemsToInsert.fields.length) insertProto.attributes.set(itemsToInsert.fields);

    if (itemsToInsert.values.length) {
      insertProto.values.set('VALUES (', itemsToInsert.values, ')');
    } else if (this._dialect.supports['DEFAULT VALUES']) {
      insertProto.values.set('DEFAULT VALUES');
    } else if (this._dialect.supports['VALUES ()']) {
      insertProto.values.set('VALUES ()');
    }

    // Return values
    if (this._dialect.supports.returnValues && options.returning) {
      if (this._dialect.supports.returnValues.returning) {
        insertProto.return.set('RETURNING *');
      } else if (this._dialect.supports.returnValues.output) {
        insertProto.output.set('OUTPUT INSERTED.*');

        //To capture output rows when there is a trigger on MSSQL DB
        if (modelAttributes && options.hasTrigger && this._dialect.supports.tmpTableTrigger) {

          const tmpColumns = new CompositionGroup();
          const outputColumns = new CompositionGroup();

          for (const modelKey in modelAttributes) {
            const attribute = modelAttributes[modelKey];

            if (!(attribute.type instanceof DataTypes.VIRTUAL)) {
              tmpColumns.add(`${this.quoteIdentifier(attribute.field)} ${attribute.type.toSql()}`);
              outputColumns.add(`INSERTED.${this.quoteIdentifier(attribute.field)}`);
            }
          }

          // pre-insert, create @tmp table
          insertProto.preQuery.prepend('declare @tmp table (',
            tmpColumns.space(',').toComposition(), ');');

          // At insert, output inserted rows into @tmp
          insertProto.output.set('OUTPUT ', outputColumns.space(',').toComposition(),
            ' into @tmp');

          // post-insert, select @tmp table and return
          insertProto.postQuery.add(';select * from @tmp');
        }
      }
    }

    // Conflict handling
    if (options.onDuplicate && this._dialect.supports['ON DUPLICATE KEY']) {
      if (insertProto.onConflict.length) insertProto.onConflict.add(' ');
      insertProto.onConflict.add('ON DUPLICATE KEY ', options.onDuplicate);
    }

    if (options.ignoreDuplicates) {
      if (this._dialect.supports.inserts.onConflictDoNothing) {
        if (insertProto.onConflict.length) insertProto.onConflict.add(' ');
        insertProto.onConflict.add(this._dialect.supports.inserts.onConflictDoNothing);
      }
      if (this._dialect.supports.inserts.ignoreDuplicates) {
        if (insertProto.flags.length) insertProto.flags.add(' ');
        insertProto.flags.add(this._dialect.supports.inserts.ignoreDuplicates);
      }
    }

    // Identity wrapper
    if (identityWrapperRequired && this._dialect.supports.autoIncrement.identityInsert) {
      insertProto.preQuery.prepend(`SET IDENTITY_INSERT ${quotedTable} ON; `);
      insertProto.postQuery.add(`; SET IDENTITY_INSERT ${quotedTable} OFF`);
    }

    return insertProto;
  }
  insertQuery(table, valueHash, modelAttributes, options = {}) {
    const insertProto = this.insertProto(table, valueHash, modelAttributes, options);

    return insertProto.toComposition();
  }
  getItemsToInsert(valueHash, modelAttributes) {
    valueHash = Utils.removeNullValuesFromHash(valueHash, this.options.omitNull);
    const fields = [];
    const values = new CompositionGroup();
    let identityWrapperRequired = false;

    const modelAttributeMap = {};
    if (modelAttributes) {
      _.each(modelAttributes, (attribute, key) => {
        modelAttributeMap[key] = attribute;
        if (attribute.field) {
          modelAttributeMap[attribute.field] = attribute;
        }
      });
    }


    for (const key in valueHash) {
      if (valueHash.hasOwnProperty(key)) {
        const value = valueHash[key];
        const autoIncrement = modelAttributeMap && modelAttributeMap[key] && modelAttributeMap[key].autoIncrement === true;

        if (autoIncrement && !value &&
          !this._dialect.supports.autoIncrement.defaultValue) {
          continue;
        }

        fields.push(this.quoteIdentifier(key));

        // SERIALS' can't be NULL in postgresql, use DEFAULT where supported
        if (autoIncrement && !value) {
          values.add(this._dialect.supports.DEFAULT ? 'DEFAULT' : 'NULL');
        } else {
          if (autoIncrement) {
            identityWrapperRequired = true;
          }

          if (value instanceof Utils.SequelizeMethod) {
            values.add(this.handleSequelizeMethod(value));
          } else if (value === null || value === undefined) {
            values.add('NULL');
          } else {
            values.add(new Slot(value, modelAttributeMap && modelAttributeMap[key] || undefined, { context: 'INSERT' }));
          }
        }
      }
    }

    return {
      fields: fields.join(','),
      values: values.space(',').toComposition(),
      identityWrapperRequired
    };
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

    const tuples = new CompositionGroup();
    const serials = {};
    const allAttributes = [];
    const insertProto = new InsertProto();

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
      const values = CompositionGroup.from(allAttributes.map(key => {
        if (this._dialect.supports.bulkDefault && serials[key] === true &&
          !fieldValueHash[key]) {
          return 'DEFAULT';
        }

        if (fieldValueHash[key] instanceof Utils.SequelizeMethod) {
          return this.handleSequelizeMethod(fieldValueHash[key]);
        }

        if (fieldValueHash[key] === null || fieldValueHash[key] === undefined) return 'NULL';

        return new Slot(fieldValueHash[key], fieldMappedAttributes[key],
          { context: 'INSERT' });
      }));

      tuples.add(new Composition('(', values.space(',').toComposition(), ')'));
    }

    // Table
    insertProto.table.set(this.quoteTable(tableName));

    // Attributes
    insertProto.attributes.set(allAttributes.map(attr => this.quoteIdentifier(attr)).join(','));

    // Insert
    insertProto.values.set('VALUES ', tuples.space(',').toComposition());

    // Return
    if (options.returning && this._dialect.supports.returnValues && this._dialect.supports.returnValues.returning) {
      insertProto.return.set('RETURNING *');
    }

    // Conflict handling
    if (options.updateOnDuplicate && this._dialect.supports.inserts.updateOnDuplicate) {
      if (insertProto.onConflict.length) insertProto.onConflict.add(' ');
      insertProto.onConflict.add(`ON DUPLICATE KEY UPDATE ${options.updateOnDuplicate.map(attr => {
        const key = this.quoteIdentifier(attr);
        return `${key}=VALUES(${key})`;
      }).join(',')}`);
    }

    if (options.ignoreDuplicates) {
      if (this._dialect.supports.inserts.onConflictDoNothing) {
        if (insertProto.onConflict.length) insertProto.onConflict.add(' ');
        insertProto.onConflict.add(this._dialect.supports.inserts.onConflictDoNothing);
      }
      if (this._dialect.supports.inserts.ignoreDuplicates) {
        if (insertProto.flags.length) insertProto.flags.add(' ');
        insertProto.flags.add(this._dialect.supports.inserts.ignoreDuplicates);
      }
    }

    return insertProto.toComposition();
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
  updateProto(tableName, attrValueHash, where, options, attributes) {
    options = options || {};
    _.defaults(options, this.options);

    attrValueHash = Utils.removeNullValuesFromHash(attrValueHash, options.omitNull, options);

    const modelAttributeMap = {};
    const values = new CompositionGroup();
    const updateProto = new UpdateProto();

    // Table
    updateProto.table.set(this.quoteTable(tableName));

    // Values
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

      let value;
      
      if (attrValueHash[key] instanceof Utils.SequelizeMethod) {
        value = this.handleSequelizeMethod(attrValueHash[key]);
      } else {
        value = new Slot(attrValueHash[key],
          modelAttributeMap && modelAttributeMap[key] || undefined,
          { context: 'UPDATE' });
      }

      values.add(new Composition(this.quoteIdentifier(key), '=', value));
    }

    if (values.length === 0) {
      return '';
    }

    updateProto.values.set(values.space(',').toComposition());

    // Return values
    if (this._dialect.supports.returnValues) {
      if (this._dialect.supports.returnValues.output) {
        // we always need this for mssql
        updateProto.output.set('OUTPUT INSERTED.*');

        //To capture output rows when there is a trigger on MSSQL DB
        if (attributes && options.hasTrigger && this._dialect.supports.tmpTableTrigger) {
          const tmpColumns = new CompositionGroup();
          const outputColumns = new CompositionGroup();

          for (const modelKey in attributes) {
            const attribute = attributes[modelKey];

            if (!(attribute.type instanceof DataTypes.VIRTUAL)) {
              tmpColumns.add(new Composition(this.quoteIdentifier(attribute.field), ' ', attribute.type.toSql()));
              outputColumns.add(`INSERTED.${this.quoteIdentifier(attribute.field)}`);
            }
          }

          updateProto.preQuery.prepend('declare @tmp table (', tmpColumns.space(',').toComposition(), ');');
          updateProto.output.set('OUTPUT ', outputColumns.space(',').toComposition(), ' into @tmp');
          updateProto.postQuery.add(';select * from @tmp');
        }
      } else if (options.returning && this._dialect.supports.returnValues.returning) {
        // ensure that the return output is properly mapped to model fields.
        options.mapToModel = true;
        updateProto.return.set('RETURNING *');
      }
    }

    // Where
    updateProto.where.set(this.whereItemsQuery(where, options));

    // Limit
    if (options.limit) {
      if (this._dialect.supports['LIMIT ON UPDATE']) {
        if (this.dialect === 'mssql') {
          updateProto.flags.set('TOP(', new Slot(options.limit), ')');
        } else {
          updateProto.limit.set('LIMIT ', new Slot(options.limit));
        }
      } else if (this.dialect === 'sqlite') {
        updateProto.where.set('rowid IN (SELECT rowid FROM ',
          this.quoteTable(tableName),
          updateProto.where.length ? ' WHERE ' : '',  updateProto.where,
          ' LIMIT ', new Slot(options.limit), ')');
      }
    }

    return updateProto;
  }
  updateQuery(tableName, attrValueHash, where, options = {}, attributes) {
    const updateProto = this.updateProto(tableName, attrValueHash, where, options, attributes);

    return updateProto.toComposition();
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

    const values = new CompositionGroup();
    const updateProto = new UpdateProto();

    // Table
    updateProto.table.set(this.quoteTable(tableName));

    // Values
    for (const key in attrValueHash) {
      const value = attrValueHash[key];
      values.add(new Composition(this.quoteIdentifier(key), '=',
        this.quoteIdentifier(key), operator, ' ', new Slot(value)));
    }

    attributes = attributes || {};
    for (const key in attributes) {
      const value = attributes[key];
      values.add(new Composition(this.quoteIdentifier(key), '=', new Slot(value)));
    }

    updateProto.values.set(values.space(',').toComposition());

    // Return
    if (this._dialect.supports.returnValues && options.returning) {
      if (this._dialect.supports.returnValues.returning) {
        options.mapToModel = true;
        updateProto.return.set('RETURNING *');
      } else if (this._dialect.supports.returnValues.output) {
        updateProto.output.set('OUTPUT INSERTED.*');
      }
    }
    
    // Where
    updateProto.where.set(this.whereItemsQuery(where, options));

    return updateProto.toComposition();
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

    const fieldsSql = CompositionGroup.from(options.fields.map(field => {
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
        throw new Error(`The following index field has no name: ${logger.inspect(field)}`);
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
    }));

    if (!options.name) {
      // Mostly for cases where addIndex is called directly by the user without an options object (for example in migrations)
      // All calls that go through sequelize should already have a name
      options = Utils.nameIndex(options, options.prefix);
    }

    options = Model._conformIndex(options);

    if (!this._dialect.supports.index.type) {
      delete options.type;
    }

    const where = new Composition();
    if (options.where) where.add(this.whereItemsQuery(options.where));

    if (typeof tableName === 'string') {
      tableName = this.quoteIdentifiers(tableName);
    } else {
      tableName = this.quoteTable(tableName);
    }

    const concurrently = this._dialect.supports.index.concurrently && options.concurrently ? 'CONCURRENTLY' : undefined;
    const ind = new Composition();
    if (this._dialect.supports.indexViaAlter) {
      ind.add('ALTER TABLE ', tableName);
      if (concurrently) ind.add(' ', concurrently);
      ind.add(' ADD');
    } else {
      ind.add('CREATE');
    }

    if (options.unique) ind.add(' UNIQUE');
    if (options.type) ind.add(' ', options.type);
    ind.add(' INDEX');
    if (!this._dialect.supports.indexViaAlter && concurrently) ind.add(' ', concurrently);
    ind.add(' ', this.quoteIdentifiers(options.name));
    if (this._dialect.supports.index.using === 1 && options.using) {
      ind.add(` USING ${options.using}`);
    }
    if (!this._dialect.supports.indexViaAlter) ind.add(` ON ${tableName}`);
    if (this._dialect.supports.index.using === 2 && options.using) {
      ind.add(` USING ${options.using}`);
    }
    ind.add(' (', fieldsSql.space(', ').toComposition());
    if (options.operator) ind.add(` ${options.operator}`);
    ind.add(')');
    if (this._dialect.supports.index.parser && options.parser) {
      ind.add(` WITH PARSER ${options.parser}`);
    }
    if (this._dialect.supports.index.where && where.length) {
      ind.add(' WHERE ', where);
    }

    return this.composeString(ind.add(';'));
  }

  addConstraintQuery(tableName, options) {
    options = options || {};
    const constraintSnippet = this.getConstraintSnippet(tableName, options);

    if (typeof tableName === 'string') {
      tableName = this.quoteIdentifiers(tableName);
    } else {
      tableName = this.quoteTable(tableName);
    }

    return this.composeString(new Composition('ALTER TABLE ', tableName, ' ADD ',
      constraintSnippet, ';'));
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
        constraintSnippet = new Composition('CONSTRAINT ', constraintName, ' CHECK (', options.where, ')');
        break;
      case 'DEFAULT':
        if (options.defaultValue === undefined) {
          throw new Error('Default value must be specifed for DEFAULT CONSTRAINT');
        }

        if (this._dialect.name !== 'mssql') {
          throw new Error('Default constraints are supported only for MSSQL dialect.');
        }

        constraintName = this.quoteIdentifier(options.name || `${tableName}_${fieldsSqlString}_df`);
        constraintSnippet = new Composition(`CONSTRAINT ${constraintName} DEFAULT (`,
          new Slot(options.defaultValue), `) FOR ${fieldsSql[0]}`);
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

    Outputs a Composition object because it can use handleSequelizeMethod
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
                item = this.sequelize.composition(item);
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
      const sql = new Composition();

      if (i > 0) {
        sql.add(`${this.quoteIdentifier(tableNames.join(connector))}.`);
      } else if (typeof collection[0] === 'string' && parent) {
        sql.add(`${this.quoteIdentifier(parent.name)}.`);
      }

      // loop through everything past i and append to the sql
      collection.slice(i).forEach(collectionItem => {
        sql.add(this.quote(collectionItem, parent, connector));
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
    throw new Error(`Unknown structure passed to order / group: ${logger.inspect(collection)}`);
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
        return this.composeString(this.handleSequelizeMethod(value));
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

  /*
   * Returns a function that binds query values to an array of binded parameters
   *
   * @param {array} bind
   * @private
  */
  bindParam(bind) {
    return value => {
      bind.push(value);
      return `$${bind.length}`;
    };
  }

  /*
   * Converts an array of binded parameters to the format required by the dialect
   *
   * @param {array} array
   * @private
  */
  outputBind(bind) {
    return bind;
  }

  /*
    Returns a bind parameter representation of a value (e.g. a string, number or date)
    @private
  */
  format(value, field, options, bindParam) {
    options = options || {};

    if (value !== null && value !== undefined) {
      if (value instanceof Utils.SequelizeMethod) {
        throw new Error(`Cannot pass SequelizeMethod as a bind parameter.\nValue: ${logger.inspect(value)}`);
      }
      if (field && field.type) {
        this.validate(value, field, options);

        if (field.type.bindParam) {
          return field.type.bindParam(value, {
            escape: _.identity,
            field,
            timezone: this.options.timezone,
            operation: options.operation,
            bindParam });
        }
      }
      // Applies options.timeZone to dates not covered by a field
      if (value instanceof Date) {
        return bindParam(DataTypes[this.dialect].DATE.prototype.stringify(value, { timezone: this.options.timezone }));
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

  composeQuery(composition) {
    if (!(composition instanceof Composition)) composition = new Composition(composition);

    const result = {};
    const bind = [];
    const bindParam = this.bindParam(bind);

    const queryItems = composition.items.map(item => {
      if (item instanceof Slot) {
        // Really binds, returns only acompaning sql string with bind placeholder
        return this.format(item.value, item.field, item.options, bindParam);
      }

      if (typeof item !== 'string') {
        throw new sequelizeError.CompositionError(`Query item is not a slot or a string:\n${logger.inspect(item)}`);
      }

      return item;
    });

    queryItems.push(';');
    result.query = queryItems.join('');

    result.bind = this.outputBind(bind);
    return result;
  }

  composeString(composition) {
    if (!(composition instanceof Composition)) composition = new Composition(composition);

    // For each query item, get sql parts and join them
    return composition.items.map(item => {
      if (item instanceof Slot) {
        return this.escape(item.value, item.field, item.options);
      }

      if (typeof item !== 'string') {
        throw new sequelizeError.CompositionError(`Query item is not a slot or a string:\n${logger.inspect(item)}`);
      }

      return item;
    }).join('');
  }

  isIdentifierQuoted(identifier) {
    return QuoteHelper.isIdentifierQuoted(identifier);
  }

  /**
   * Generates an SQL query that extract JSON property of given path.
   *
   * @param   {string}               column       The JSON column
   * @param   {string|Array<string>} [path]       The path to extract (optional)
   * @param   {string}               [tableName]  The name of the table (optional)
   * @returns {string}                            The generated sql query
   * @private
   */
  jsonPathExtractionQuery(column, path, tableName) {
    let paths = _.toPath(path);
    let pathStr;
    const quotedColumn = this.isIdentifierQuoted(column) ?
      column : `${tableName ? `${this.quoteIdentifier(tableName)}.` : ''}${this.quoteIdentifier(column)}`;

    switch (this.dialect) {
      case 'mysql':
        /**
         * Sub paths need to be quoted as ECMAScript identifiers
         * https://bugs.mysql.com/bug.php?id=81896
         */
        paths = paths.map(subPath => Utils.addTicks(subPath, '"'));
        pathStr = ['$'].concat(paths).join('.');

        // ->> operator does not allow to bind path
        return new Composition('json_unquote(json_extract(', quotedColumn, ',', new Slot(pathStr), '))');

      case 'mariadb':
        pathStr = ['$'].concat(paths).join('.');
        return new Composition('json_unquote(json_extract(', quotedColumn, ',', new Slot(pathStr), '))');

      case 'sqlite':
        pathStr = ['$']
          .concat(paths)
          .join('.')
          .replace(/\.(\d+)(?:(?=\.)|$)/g, (_, digit) => `[${digit}]`);

        return new Composition(`json_extract(${quotedColumn}, `, new Slot(pathStr), ')');

      case 'postgres':
        return new Composition(`(${quotedColumn}#>>`, new Slot(`{${paths.join(',')}}`), ')');

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
    const selectProto = new SelectProto();
    const subSelectProto = new SelectProto();
    const subQuery = options.subQuery === undefined ? limit && options.hasMultiAssociation : options.subQuery;
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
    const mainJoinQueries = new Composition();
    const subJoinQueries = new Composition();

    // resolve table name options
    if (options.tableAs) {
      mainTable.as = this.quoteIdentifier(options.tableAs);
    } else if (!Array.isArray(mainTable.name) && mainTable.model) {
      mainTable.as = this.quoteIdentifier(mainTable.model.name);
    }

    mainTable.quotedName = !Array.isArray(mainTable.name) ? this.quoteTable(mainTable.name) : tableName.map(t => {
      return Array.isArray(t) ? this.quoteTable(t[0], t[1]) : this.quoteTable(t, true);
    }).join(', ');

    // Process attributes
    const attributesOpts = options.attributes && options.attributes.slice();

    if (subQuery && attributesOpts) {
      for (const keyAtt of mainTable.model.primaryKeyAttributes) {
        // Check if mainAttributes contain the primary key of the model either as a field or an aliased field
        if (!attributesOpts.some(attr => keyAtt === attr || keyAtt === attr[0] || keyAtt === attr[1])) {
          attributesOpts.push(mainTable.model.rawAttributes[keyAtt].field ? [keyAtt, mainTable.model.rawAttributes[keyAtt].field] : keyAtt);
        }
      }
    }

    // Convert attributes args to query composition
    const attributes = {
      main: new Composition(),
      subQuery: new Composition()
    };

    if (attributesOpts) {
      attributes.main.set(this.escapeAttributes(attributesOpts, options, mainTable.as));
    } else {
      attributes.main.set(options.include ? `${mainTable.as}.*` : '*');
    }

    // If subquery, we add the mainAttributes to the subQuery and set the mainAttributes to select * from subquery
    if (subQuery || options.groupedLimit) {
      // We need primary keys
      attributes.subQuery.set(attributes.main);
      attributes.main.set(`${mainTable.as || mainTable.quotedName}.*`);
    }

    // Process joins
    if (options.include) {
      for (const include of options.include) {
        if (include.separate) {
          continue;
        }
        const joinQueries = this.generateInclude(include, { externalAs: mainTable.as, internalAs: mainTable.as }, topLevelInfo);

        if (subJoinQueries.length) subJoinQueries.add(' ');
        subJoinQueries.add(joinQueries.subQuery);

        if (mainJoinQueries.length) mainJoinQueries.add(' ');
        mainJoinQueries.add(joinQueries.mainQuery);

        if (joinQueries.attributes.main.length > 0) {
          if (attributes.main.length) attributes.main.add(', ');
          attributes.main.add(joinQueries.attributes.main);
        }
        if (joinQueries.attributes.subQuery.length > 0) {
          if (attributes.subQuery.length) attributes.subQuery.add(', ');
          attributes.subQuery.add(joinQueries.attributes.subQuery);
        }
      }
    }

    // Start building query. Attributes, FROM and joins 
    if (subQuery) {
      if (attributes.subQuery.length) subSelectProto.attributes.set(attributes.subQuery);
      subSelectProto.from.set(mainTable.quotedName);
      if (mainTable.as) subSelectProto.from.add(' AS ', mainTable.as);
      if (options.tableHint && TableHints[options.tableHint]) {
        subSelectProto.from.add(' WITH (', TableHints[options.tableHint], ')');
      }
      if (subJoinQueries.length) subSelectProto.join.add(subJoinQueries);
    } else {
      if (attributes.main.length) selectProto.attributes.set(attributes.main);
      selectProto.from.set(mainTable.quotedName);
      if (mainTable.as) selectProto.from.add(' AS ', mainTable.as);
      if (options.tableHint && TableHints[options.tableHint]) {
        selectProto.from.add(' WITH (', TableHints[options.tableHint], ')');
      }
      if (mainJoinQueries.length) selectProto.join.add(mainJoinQueries);

      // Overrides FROM with groupedLimit subqueries
      if (options.groupedLimit) {
        if (!mainTable.as) {
          mainTable.as = mainTable.quotedName;
        }
        let where = Object.assign({}, options.where);
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

          const whereInclude = { [Op.and]: [this.sequelize.composition(this.sequelize.placeholder())] };
          if (options.groupedLimit.through && options.groupedLimit.through.where) {
            whereInclude[Op.and].push(options.groupedLimit.through.where);
          } 

          const groupedLimitOptions = Model._validateIncludedElements({
            include: [{
              association: options.groupedLimit.on.manyFromSource,
              duplicating: false, // The UNION'ed query may contain duplicates, but each sub-query cannot
              required: true,
              where: whereInclude 
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
              alias = this.sequelize.composition(this.quote(alias));

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
          where = { [Op.and]: [this.sequelize.composition(this.sequelize.placeholder()), where] };
        }

        // Caching the base query and splicing the where part into it is consistently > twice
        // as fast than generating from scratch each time for values.length >= 5
        const baseComposition = this.selectQuery(
          tableName,
          {
            attributes: options.attributes,
            offset: options.offset,
            limit: options.groupedLimit.limit,
            order: groupedLimitOrder,
            where,
            include,
            model
          },
          model
        );

        const unionKey = this._dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ';

        const from = options.groupedLimit.values.reduce((a, value, idx) => {
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

          // Join by unionKey
          if (idx !== 0) a.add(unionKey);

          // Expand where condition on cached baseComposition without mutating
          // Every derived table must have its own alias
          a.add('SELECT * FROM (', Utils.replacePlaceholder(baseComposition,
            this.getWhereConditions(groupWhere, groupedTableName)), ') AS sub');
          return a;
        }, new Composition('(')).add(')');

        selectProto.from.set(from, ' AS ', mainTable.as);

        if (options.tableHint && TableHints[options.tableHint]) {
          selectProto.from.add(' WITH (', TableHints[options.tableHint], ')');
        }
      }
    }

    // Add WHERE to sub or main query
    if (options.hasOwnProperty('where') && !options.groupedLimit) {
      const where = this.getWhereConditions(options.where,
        mainTable.as || tableName, model, options);

      if (where.length) {
        if (subQuery) {
          subSelectProto.where.set(where);
        } else {
          selectProto.where.set(where);
        }
      }
    }

    // Add GROUP BY to sub or main query
    if (options.group) {
      const group = this.getGroups(options, model);

      if (subQuery) {
        subSelectProto.group.set(group);
      } else {
        selectProto.group.set(group);
      }
    }

    // Add HAVING to sub or main query
    if (options.hasOwnProperty('having')) {
      const having = this.getWhereConditions(options.having, tableName, model, options, false);

      if (having.length) {
        if (subQuery) {
          subSelectProto.having.add(having);
        } else {
          selectProto.having.add(having);
        }
      }
    }

    // Add ORDER to sub and main query. Order may be required despite !options.order
    const orders = this.getQueryOrders(options, model, subQuery);

    if (orders.mainQueryOrder.length) {
      selectProto.order.set(orders.mainQueryOrder);
    }
    if (orders.subQueryOrder.length) {
      subSelectProto.order.set(orders.subQueryOrder);
    }

    // Add LIMIT, OFFSET to sub or main query
    const limitOrder = this.addLimitAndOffset(options, mainTable.model);
    if (limitOrder.length && !options.groupedLimit) {
      if (subQuery) {
        subSelectProto.page.set(limitOrder);
      } else {
        selectProto.page.set(limitOrder);
      }
    }

    if (subQuery) {
      selectProto.attributes.set(attributes.main);
      selectProto.from.set('(', subSelectProto.toComposition(), ') AS ', mainTable.as);
      selectProto.join.set(mainJoinQueries);
    }

    if (options.lock && this._dialect.supports.lock) {
      let lock = options.lock;
      if (typeof options.lock === 'object') {
        lock = options.lock.level;
      }
      const lockComposition = new Composition();
      if (this._dialect.supports.lockKey &&
        (lock === 'KEY SHARE' || lock === 'NO KEY UPDATE')) {
        lockComposition.add(`FOR ${lock}`);
      } else if (lock === 'SHARE') {
        lockComposition.add(this._dialect.supports.forShare);
      } else {
        lockComposition.add('FOR UPDATE');
      }
      if (this._dialect.supports.lockOf && options.lock.of &&
        options.lock.of.prototype instanceof Model) {
        lockComposition.add(` OF ${this.quoteTable(options.lock.of.name)}`);
      }
      if (this._dialect.supports.skipLocked && options.skipLocked) {
        lockComposition.add(' SKIP LOCKED');
      }

      selectProto.lock.set(lockComposition);
    }

    return selectProto.toComposition();
  }

  escapeAttributes(attributes, options, mainTableAs) {
    const group = new CompositionGroup();

    if (attributes) {
      group.add(...attributes.map(attr => {
        if (attr instanceof Utils.SequelizeMethod) {
          return this.handleSequelizeMethod(attr);
        }
        if (Array.isArray(attr)) {
          if (attr.length !== 2) {
            throw new Error(`${logger.inspect(attr)} is not a valid attribute definition. Please use the following format: ['attribute definition', 'alias']`);
          }
          attr = attr.slice();

          if (attr[0] instanceof Utils.SequelizeMethod) {
            return new Composition(this.handleSequelizeMethod(attr[0]),
              ' AS ', this.quoteIdentifier(attr[1]));
          }
          if (!attr[0].includes('(') && !attr[0].includes(')')) {
            attr[0] = this.quoteIdentifier(attr[0]);
          } else {
            deprecations.noRawAttributes();
          }
          attr = `${attr[0]} AS ${this.quoteIdentifier(attr[1])}`;
        } else {
          attr = !attr.includes(Utils.TICK_CHAR) && !attr.includes('"')
            ? this.quoteAttribute(attr, options.model)
            : this.escape(attr);
        }
        if (!_.isEmpty(options.include) && !attr.includes('.')) {
          attr = new Composition(mainTableAs, '.', attr);
        }

        return attr;
      }));
    }

    return group.space(', ').toComposition();
  }

  generateInclude(include, parentTableName, topLevelInfo) {
    const joinQueries = {
      mainQuery: new Composition(),
      subQuery: new Composition()
    };
    const mainChildIncludes = new Composition();
    const subChildIncludes = new Composition();
    let requiredMismatch = false;
    const includeAs = {
      internalAs: include.as,
      externalAs: include.as
    };
    const attributes = {
      main: new CompositionGroup(),
      subQuery: new CompositionGroup()
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
      const includeAttributes = include.attributes.map(attr => {
        let attrAs = attr;
        let verbatim = false;

        if (Array.isArray(attr) && attr.length === 2) {
          if (attr[0] instanceof Utils.SequelizeMethod) {
            if (! (attr[0] instanceof Utils.Col)) {
              verbatim = true;
            }

            attr[0] = this.handleSequelizeMethod(attr[0], includeAs.internalAs);
          }

          attrAs = attr[1];
          attr = attr[0];
        }
        if (attr instanceof Utils.Literal || attr instanceof Utils.Composition) {
          return this.handleSequelizeMethod(attr); // We trust the user to rename the field correctly
        }
        if (attr instanceof Utils.Cast || attr instanceof Utils.Fn) {
          throw new Error(
            'Tried to select attributes using Sequelize.cast or Sequelize.fn without specifying an alias for the result, during eager loading. ' +
            'This means the attribute will not be added to the returned instance'
          );
        }

        let prefix;
        if (verbatim === true || typeof attr !== 'string') {
          prefix = attr;
        } else {
          prefix = `${this.quoteIdentifier(includeAs.internalAs)}.${this.quoteIdentifier(attr)}`;
        }
        return new Composition(prefix, ' AS ',
          this.quoteIdentifier(`${includeAs.externalAs}.${attrAs}`, true));
      });
      if (include.subQuery && topLevelInfo.subQuery) {
        for (const attr of includeAttributes) {
          attributes.subQuery.add(attr);
        }
      } else {
        for (const attr of includeAttributes) {
          attributes.main.add(attr);
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
    if (joinQuery.attributes.main.length) {
      attributes.main.add(joinQuery.attributes.main);
    }

    if (joinQuery.attributes.subQuery.length) {
      attributes.subQuery.add(joinQuery.attributes.subQuery);
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
          if (subChildIncludes.length) subChildIncludes.add(' ');
          subChildIncludes.add(childJoinQueries.subQuery);
        }
        if (childJoinQueries.mainQuery.length) {
          if (mainChildIncludes.length) mainChildIncludes.add(' ');
          mainChildIncludes.add(childJoinQueries.mainQuery);
        }
        if (childJoinQueries.attributes.main.length) {
          attributes.main.add(childJoinQueries.attributes.main);
        }
        if (childJoinQueries.attributes.subQuery.length) {
          attributes.subQuery.add(childJoinQueries.attributes.subQuery);
        }
      }
    }

    if (include.subQuery && topLevelInfo.subQuery) {
      if (joinQueries.subQuery.length) joinQueries.subQuery.add(' ');

      if (requiredMismatch && subChildIncludes.length) {
        joinQueries.subQuery.add(joinQuery.join, ' ( ', joinQuery.body,
          ' ', subChildIncludes, ' ) ON ', joinQuery.condition);
      } else {
        joinQueries.subQuery.add(joinQuery.join, ' ', joinQuery.body,
          ' ON ', joinQuery.condition);
        if (subChildIncludes.length) {
          joinQueries.subQuery.add(' ', subChildIncludes);
        }
      }

      if (joinQueries.mainQuery.length) joinQueries.mainQuery.add(' ');
      joinQueries.mainQuery.add(mainChildIncludes);
    } else {
      if (joinQueries.mainQuery.length) joinQueries.mainQuery.add(' ');

      if (requiredMismatch && mainChildIncludes.length) {
        joinQueries.mainQuery.add(joinQuery.join, ' ( ', joinQuery.body,
          ' ', mainChildIncludes, ' ) ON ', joinQuery.condition);
      } else {
        joinQueries.mainQuery.add(joinQuery.join, ' ', joinQuery.body,
          ' ON ', joinQuery.condition);
        if (mainChildIncludes.length) {
          joinQueries.mainQuery.add(' ', mainChildIncludes);
        }
      }

      if (joinQueries.subQuery.length) joinQueries.subQuery.add(' ');
      joinQueries.subQuery.add(subChildIncludes);
    }

    return {
      mainQuery: joinQueries.mainQuery,
      subQuery: joinQueries.subQuery,
      attributes: {
        main: attributes.main.space(', ').toComposition(),
        subQuery: attributes.subQuery.space(', ').toComposition()
      }
    };
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

    const joinOn = new Composition(`${this.quoteTable(asLeft)}.${this.quoteIdentifier(fieldLeft)}`);

    if (topLevelInfo.options.groupedLimit && parentIsTop || topLevelInfo.subQuery && include.parent.subQuery && !include.subQuery) {
      if (parentIsTop) {
        // The main model attributes is not aliased to a prefix
        joinOn.set(`${this.quoteTable(parent.as || parent.model.name)}.${this.quoteIdentifier(attrLeft)}`);
      } else {
        joinOn.set(this.quoteIdentifier(`${asLeft.replace(/->/g, '.')}.${attrLeft}`));
      }
    }

    joinOn.add(` = ${this.quoteIdentifier(asRight)}.${this.quoteIdentifier(fieldRight)}`);

    if (include.on) {
      joinOn.set(this.whereItemsQuery(include.on, {
        prefix: this.sequelize.literal(this.quoteIdentifier(asRight)),
        model: include.model
      }));
    }

    if (include.where) {
      joinWhere = this.whereItemsQuery(include.where, {
        prefix: this.sequelize.literal(this.quoteIdentifier(asRight)),
        model: include.model
      });
      if (joinWhere.length) {
        if (include.or) {
          joinOn.add(' OR ', joinWhere);
        } else {
          joinOn.add(' AND ', joinWhere);
        }
      }
    }

    return {
      join: include.required ? 'INNER JOIN' : 'LEFT OUTER JOIN',
      body: this.quoteTable(tableRight, asRight),
      condition: joinOn,
      attributes: {
        main: new Composition(),
        subQuery: new Composition()
      }
    };
  }

  generateThroughJoin(include, includeAs, parentTableName, topLevelInfo) {
    const through = include.through;
    const throughTable = through.model.getTableName();
    const throughAs = `${includeAs.internalAs}->${through.as}`;
    const externalThroughAs = `${includeAs.externalAs}.${through.as}`;
    const throughAttributes = through.attributes.map(attr => {
      if (attr instanceof Utils.Literal || attr instanceof Utils.Composition) {
        // We trust the user to rename the field correctly
        return this.handleSequelizeMethod(attr);
      }
      if (Array.isArray(attr)) {
        if (attr[0] instanceof Utils.Literal || attr[0] instanceof Utils.Composition) {
          attr[0] = this.handleSequelizeMethod(attr[0]);
        }
        return new Composition(this.quoteIdentifier(throughAs), '.',
          this.quoteIdentifier(attr[0]), ' AS ',
          this.quoteIdentifier(`${externalThroughAs}.${attr[1]}`));
      }
      return new Composition(this.quoteIdentifier(throughAs), '.',
        this.quoteIdentifier(attr), ' AS ',
        this.quoteIdentifier(`${externalThroughAs}.${attr}`));
    });
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
    const joinBody = new Composition();
    let joinCondition;
    const attributes = {
      main: new CompositionGroup(),
      subQuery: new CompositionGroup()
    };
    let attrSource = primaryKeysSource[0];
    const sourceJoinOn = new Composition();
    let throughWhere;
    let targetWhere;

    if (topLevelInfo.options.includeIgnoreAttributes !== false) {
      // Through includes are always hasMany, so we need to add the attributes to the mainAttributes no matter what (Real join will never be executed in subquery)
      attributes.main.add(...throughAttributes);
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
      sourceJoinOn.add(`${this.quoteIdentifier(`${tableSource}.${attrSource}`)} = `);
    } else {
      sourceJoinOn.add(`${this.quoteTable(tableSource)}.${this.quoteIdentifier(attrSource)} = `);
    }
    sourceJoinOn.add(`${this.quoteIdentifier(throughAs)}.${this.quoteIdentifier(identSource)}`);

    // Filter statement for right side of through
    // Used by both join and subquery where
    const targetJoinOn = new Composition(`${this.quoteIdentifier(tableTarget)}.${this.quoteIdentifier(attrTarget)} = `);
    targetJoinOn.add(`${this.quoteIdentifier(throughAs)}.${this.quoteIdentifier(identTarget)}`);

    if (through.where) {
      throughWhere = this.getWhereConditions(through.where, this.sequelize.literal(this.quoteIdentifier(throughAs)), through.model);
    }

    if (this._dialect.supports.joinTableDependent) {
      // Generate a wrapped join so that the through table join can be dependent on the target join
      joinBody.add(`( ${this.quoteTable(throughTable, throughAs)} INNER JOIN ${this.quoteTable(include.model.getTableName(), includeAs.internalAs)} ON `,
        targetJoinOn);
      if (throughWhere && throughWhere.length) {
        joinBody.add(' AND ', throughWhere);
      }
      joinBody.add(')');
      joinCondition = sourceJoinOn;
    } else {
      // Generate join SQL for left side of through
      joinBody.add(`${this.quoteTable(throughTable, throughAs)} ON `,
        sourceJoinOn, ` ${joinType} ${this.quoteTable(include.model.getTableName(), includeAs.internalAs)}`);
      joinCondition = targetJoinOn;
      if (throughWhere && throughWhere.length) {
        joinCondition.add(' AND ', throughWhere);
      }
    }

    if (include.where || include.through.where) {
      if (include.where) {
        targetWhere = this.getWhereConditions(include.where, this.sequelize.literal(this.quoteIdentifier(includeAs.internalAs)), include.model, topLevelInfo.options);
        if (targetWhere.length) {
          joinCondition.add(' AND ', targetWhere);
        }
      }
    }

    this._generateSubQueryFilter(include, includeAs, topLevelInfo);

    return {
      join: joinType,
      body: joinBody,
      condition: joinCondition,
      attributes: {
        main: attributes.main.space(', ').toComposition(),
        subQuery: attributes.subQuery.space(', ').toComposition()
      }
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

    topLevelInfo.options.where[`__${includeAs.internalAs}`] = this.sequelize.composition(
      '( ', query, ' )', ' IS NOT NULL');
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
    // Array of ordering elements(strings or QueryElements)
    const mainQueryOrder = new CompositionGroup();
    const subQueryOrder = new CompositionGroup();

    if (Array.isArray(options.order)) {
      for (let order of options.order) {
        // wrap if not array
        if (!Array.isArray(order)) {
          order = [order];
        }

        if (subQuery && Array.isArray(order) && order[0]
          && !(order[0] instanceof Association)
          && !(typeof order[0] === 'function' && order[0].prototype instanceof Model)
          && !(typeof order[0].model === 'function'
          && order[0].model.prototype instanceof Model)
          && !(typeof order[0] === 'string' && model
          && model.associations !== undefined && model.associations[order[0]])
        ) {
          subQueryOrder.add(this.quote(order, model, '->'));
        }

        if (subQuery) {
          // Handle case where sub-query renames attribute we want to order by,
          // see https://github.com/sequelize/sequelize/issues/8739
          const subQueryAttribute = options.attributes.find(a => Array.isArray(a) && a[0] === order[0] && a[1]);
          if (subQueryAttribute) {
            order[0] = new Utils.Col(subQueryAttribute[1]);
          }
        }

        mainQueryOrder.add(this.quote(order, model, '->'));
      }
    } else if (options.order instanceof Utils.SequelizeMethod) {
      const sql = this.quote(options.order, model, '->');
      if (subQuery) {
        subQueryOrder.add(sql);
      }
      mainQueryOrder.add(sql);
    } else if (options.order) {
      throw new Error('Order must be type of array or instance of a valid sequelize method.');
    }

    if (options.limit || options.offset) {
      // Order of paginated query (Object passed by reference)
      const pageQueryOrder = subQuery ? subQueryOrder : mainQueryOrder;
      if (!pageQueryOrder.length) {
        logger.warn('Limit or offset was used without ordering. This will produce inconsistent pagination');
      }

      // mssql requires ORDER clause if limit or offset are used
      if (this.dialect === 'mssql' && model && model.primaryKeyField) {
        const pkOrder = `${this.quoteTable(options.tableAs || model.name)}.${this.quoteIdentifier(model.primaryKeyField)}`;
        // In this case, mssql guys just like it ordered by PK
        const preferPk = options.include && !subQueryOrder.length;

        if (!pageQueryOrder.length || preferPk) pageQueryOrder.add(pkOrder);
      }
    }

    return {
      mainQueryOrder: mainQueryOrder.space(', ').toComposition(),
      subQueryOrder: subQueryOrder.space(', ').toComposition()
    };
  }

  /**
   * Returns an SQL fragment for adding result constraints.
   *
   * @param  {Object} options An object with selectQuery options.
   * @returns {string}         The generated sql composition.
   * @private
   */
  addLimitAndOffset(options) {
    const composition = new Composition();
    const isLimit = options.limit !== null && options.limit !== undefined;

    if (options.offset !== null && options.offset !== undefined) {
      if (isLimit) {
        composition.add('LIMIT ', new Slot(options.offset), ', ', new Slot(options.limit));
      } else {
        logger.warn('options.offset was used without options.limit. Most likely this was unintended.');
        composition.add('LIMIT ', new Slot(options.offset), ', 10000000000000');
      }
    } else if (isLimit) {
      composition.add('LIMIT ', new Slot(options.limit));
    }

    return composition;
  }

  handleSequelizeMethod(smth, tableName, factory, options, prepend) {
    let result;

    if (this.OperatorMap.hasOwnProperty(smth.comparator)) {
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

        return new Composition(key, ` ${smth.comparator} `, value);
      }
      if (_.isPlainObject(value)) {
        return this.whereItemQuery(smth.attribute, value, {
          model: factory
        });
      }

      // Override default comparator
      if (value === null && smth.comparator === '=') {
        return new Composition(key, ` ${this.OperatorMap[Op.is]} `, 'NULL');
      }

      return new Composition(key, ` ${smth.comparator} `, new Slot(value));
    }
    if (smth instanceof Utils.Literal || smth instanceof Utils.Composition) {
      return smth.val;
    }
    if (smth instanceof Utils.Cast) {
      if (smth.val instanceof Utils.SequelizeMethod) {
        result = this.handleSequelizeMethod(smth.val, tableName, factory, options, prepend);
      } else if (_.isPlainObject(smth.val)) {
        result = this.whereItemsQuery(smth.val);
      } else {
        result = new Slot(smth.val);
      }

      return new Composition('CAST(', result, ' AS ', smth.type.toUpperCase(), ')');
    }
    if (smth instanceof Utils.Fn) {
      const argItems = CompositionGroup.from(smth.args.map(arg => {
        if (arg instanceof Utils.SequelizeMethod) {
          return this.handleSequelizeMethod(arg, tableName, factory, options, prepend);
        }
        if (_.isPlainObject(arg)) {
          return this.whereItemsQuery(arg);
        }
        return new Slot(arg);
      }));
      return new Composition(smth.fn, '(', argItems.space(', ').toComposition(), ')');
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
    const composition = new Composition(this.whereItemsQuery(where, options));
    if (composition.length) composition.prepend('WHERE ');

    return composition;
  }

  whereItemsQuery(where, options, binding) {
    if (
      where === null ||
      where === undefined ||
      Utils.getComplexSize(where) === 0
    ) {
      // NO OP
      return new Composition();
    }

    if (typeof where === 'string') {
      throw new Error('Support for `{where: \'raw query\'}` has been removed.');
    }

    binding = binding || 'AND';
    if (binding[0] !== ' ') binding = ` ${binding} `;

    const group = new CompositionGroup();

    if (_.isPlainObject(where)) {
      Utils.getComplexKeys(where).forEach(prop => {
        const item = where[prop];
        const condition = new Composition(this.whereItemQuery(prop, item, options));
        if (condition.length) group.add(condition);
      });
    } else {
      const condition = new Composition(this.whereItemQuery(undefined, where, options));
      if (condition.length) group.add(condition);
    }

    return group.space(binding).toComposition();
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
      return this._joinKeyValue(key, 'NULL', this.OperatorMap[Op.is], options.prefix);
    }

    if (!value) {
      const opValue = new Slot(value, field, options);
      return this._joinKeyValue(key, opValue, this.OperatorMap[Op.eq], options.prefix);
    }

    if (key !== undefined && value instanceof Utils.Fn) {
      return this._joinKeyValue(key, this.handleSequelizeMethod(value),
        this.OperatorMap[Op.eq], options.prefix);
    }
    if (value instanceof Utils.SequelizeMethod) {
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
      const opValue = new Slot(value, field, options);
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

    const opValue = new Slot(value, field, options);
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
    const outerBinding = key === Op.not ? 'NOT ': '';

    if (Array.isArray(value)) {
      value = value.map(item => {
        let itemQuery = new Composition(this.whereItemsQuery(item, options, this.OperatorMap[Op.and]));
        if (itemQuery && itemQuery.length && (Array.isArray(item) || _.isPlainObject(item)) && Utils.getComplexSize(item) > 1) {
          itemQuery = new Composition('(', itemQuery, ')');
        }
        return itemQuery;
      }).filter(item => item && item.length);

      value = CompositionGroup.from(value).space(binding).toComposition();
    } else {
      value = new Composition(this.whereItemsQuery(value, options, binding));
    }
    // Op.or: [] should return no data.
    // Op.not of no restriction should also return no data
    if ((key === Op.or || key === Op.not) && !value.length) {
      return new Composition('0 = 1');
    }

    if (! value.length) return new Composition();
    return new Composition(outerBinding, '(', value, ')');
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

    if (!value.length) return new Composition();
    return new Composition('(', CompositionGroup.from(value).space(binding).toComposition(), ')');
  }

  _whereJSON(key, value, options) {
    const group = new CompositionGroup();
    let baseKey = this.quoteIdentifier(key);
    if (options.prefix) {
      if (options.prefix instanceof Utils.Literal) {
        baseKey = `${this.handleSequelizeMethod(options.prefix)}.${baseKey}`;
      } else {
        baseKey = `${this.quoteTable(options.prefix)}.${baseKey}`;
      }
    }

    Utils.getOperators(value).forEach(op => {
      const where = { [op]: value[op] };
      group.add(this.whereItemQuery(key, where, Object.assign({}, options, { json: false })));
    });

    _.forOwn(value, (item, prop) => {
      // Add _traverseJSON group
      group.merge(this._traverseJSON(baseKey, prop, item, [prop]));
    });

    const result = group.space(this.OperatorMap[Op.and]).toComposition();

    if (group.length > 1) return new Composition('(', result, ')');
    return new Composition(result);
  }

  _traverseJSON(baseKey, prop, item, path) {
    let cast;
    const group = new CompositionGroup();

    if (path[path.length - 1].includes('::')) {
      const tmp = path[path.length - 1].split('::');
      cast = tmp[1];
      path[path.length - 1] = tmp[0];
    }

    const pathKey = this.jsonPathExtractionQuery(baseKey, path);

    if (_.isPlainObject(item)) {
      Utils.getOperators(item).forEach(op => {
        const value = this._toJSONValue(item[op]);
        group.add(this.whereItemQuery(this._castKey(pathKey, value, cast), { [op]: value }));
      });
      _.forOwn(item, (value, itemProp) => {
        // Recursively add _traverseJSON group
        group.merge(this._traverseJSON(baseKey, itemProp, value, path.concat([itemProp])));
      });

      return group;
    }

    item = this._toJSONValue(item);
    group.add(this.whereItemQuery(this._castKey(pathKey, item, cast), { [Op.eq]: item }));
    // returns query group
    return group;
  }

  _toJSONValue(value) {
    return value;
  }

  _castKey(key, value, cast, json) {
    cast = cast || this._getJsonCast(Array.isArray(value) ? value[0] : value);
    if (cast) {
      return new Utils.Composition(this.handleSequelizeMethod(new Utils.Cast(new Utils.Composition(key), cast, json)));
    }

    return new Utils.Composition(key);
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
    if (! (value instanceof Composition)) value = new Composition(value);
    if (!key) {
      return value;
    }
    if (comparator === undefined) {
      throw new Error(`${key} and ${JSON.stirngify(value)} has no comparator`);
    }
    key = this._getSafeKey(key, prefix);
    return new Composition(key, ` ${comparator} `, value);
  }

  _getSafeKey(key, prefix) {
    if (key instanceof Utils.SequelizeMethod) {
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
        if (value instanceof Utils.Literal || value instanceof Utils.Composition) {
          return this._joinKeyValue(key, value.val, comparator, options.prefix);
        }

        if (value.length) {
          const values = CompositionGroup.from(value.map(item => {
            if (item === null || item === undefined) return 'NULL';
            return new Slot(item, field);
          }));

          return this._joinKeyValue(key, new Composition('(', values.space(', ').toComposition(), ')'), comparator, options.prefix);
        }

        if (comparator === this.OperatorMap[Op.in]) {
          return this._joinKeyValue(key, '(NULL)', comparator, options.prefix);
        }

        return '';
      case Op.any:
      case Op.all:
        comparator = `${this.OperatorMap[Op.eq]} ${comparator}`;
        if (value[Op.values]) {
          return this._joinKeyValue(key,
            new Composition('(VALUES ', CompositionGroup.from(value[Op.values].map(item =>
              new Composition('(', new Slot(item), ')'))).space(', ').toComposition(), ')'),
            comparator, options.prefix);
        }

        return this._joinKeyValue(key, new Composition('(', new Slot(value, field), ')'),
          comparator, options.prefix);
      case Op.between:
      case Op.notBetween:
        return this._joinKeyValue(key,
          new Composition(new Slot(value[0], field), ' AND ',
            new Slot(value[1], field)), comparator, options.prefix);
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
        return this._joinKeyValue(key, new Slot(`%${value}`), comparator, options.prefix);
      case Op.endsWith:
        comparator = this.OperatorMap[Op.like];
        return this._joinKeyValue(key, new Slot(`${value}%`), comparator, options.prefix);
      case Op.substring:
        comparator = this.OperatorMap[Op.like];
        return this._joinKeyValue(key, new Slot(`%${value}%`), comparator, options.prefix);
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
        return this._joinKeyValue(key, new Composition('(', new Slot(value[Op.any], field, escapeOptions), ')'), `${comparator} ${this.OperatorMap[Op.any]}`, options.prefix);
      }
      if (value[Op.all]) {
        escapeOptions.isList = true;
        return this._joinKeyValue(key, new Composition('(', new Slot(value[Op.all], field, escapeOptions), ')'), `${comparator} ${this.OperatorMap[Op.all]}`, options.prefix);
      }
    }

    if (value === null && (comparator === this.OperatorMap[Op.eq] || comparator === this.OperatorMap[Op.is])) {
      return this._joinKeyValue(key, 'NULL', this.OperatorMap[Op.is], options.prefix);
    }
    if (value === null && (comparator === this.OperatorMap[Op.ne] || comparator === this.OperatorMap[Op.not])) {
      return this._joinKeyValue(key, 'NULL', this.OperatorMap[Op.not], options.prefix);
    }

    return this._joinKeyValue(key, new Slot(value, field, escapeOptions), comparator, options.prefix);
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
      return new Composition(new Slot(smth));
    }
    if (Array.isArray(smth)) {
      if (smth.length === 0 || smth.length > 0 && smth[0].length === 0) {
        return new Composition('1=1');
      }
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

    return new Composition('1=1');
  }
  // Get GROUP BY
  getGroups(options, model) {
    const group = new CompositionGroup();

    if (Array.isArray(options.group)) {
      group.add(...options.group.map(t => this.quote(t, model)));
    } else {
      group.add(this.quote(options.group, model));
    }

    return group.space(', ').toComposition();
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
