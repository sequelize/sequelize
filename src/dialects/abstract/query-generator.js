'use strict';

import NodeUtil from 'node:util';
import { getTextDataTypeForDialect } from '../../sql-string';
import { rejectInvalidOptions, isNullish, canTreatArrayAsAnd, isColString } from '../../utils/check';
import { TICK_CHAR } from '../../utils/dialect';
import {
  getComplexKeys,
  getComplexSize,
  getOperators,
  mapFinderOptions,
  removeNullishValuesFromHash,
} from '../../utils/format';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { isModelStatic } from '../../utils/model-utils';
import { Cast, Col, Fn, Literal, SequelizeMethod, Where } from '../../utils/sequelize-method';
import { injectReplacements } from '../../utils/sql';
import { nameIndex, spliceStr } from '../../utils/string';
import { AbstractDataType } from './data-types';
import { attributeTypeToSql, validateDataType } from './data-types-utils';
import { AbstractQueryGeneratorTypeScript } from './query-generator-typescript';

const util = require('node:util');
const _ = require('lodash');
const crypto = require('node:crypto');

const deprecations = require('../../utils/deprecations');
const SqlString = require('../../sql-string');
const DataTypes = require('../../data-types');
const { Model } = require('../../model');
const { Association } = require('../../associations/base');
const { BelongsTo } = require('../../associations/belongs-to');
const { BelongsToMany } = require('../../associations/belongs-to-many');
const { HasMany } = require('../../associations/has-many');
const { Op } = require('../../operators');
const sequelizeError = require('../../errors');
const { IndexHints } = require('../../index-hints');
const { _validateIncludedElements } = require('../../model-internals');

/**
 * List of possible options listed in {@link CreateDatabaseQueryOptions}.
 * It is used to validate the options passed to {@link QueryGenerator#createDatabaseQuery},
 * as not all of them are supported by all dialects.
 */
export const CREATE_DATABASE_QUERY_SUPPORTABLE_OPTIONS = new Set(['collate', 'charset', 'encoding', 'ctype', 'template']);
export const CREATE_SCHEMA_QUERY_SUPPORTABLE_OPTIONS = new Set(['collate', 'charset']);
export const LIST_SCHEMAS_QUERY_SUPPORTABLE_OPTIONS = new Set(['skip']);
export const DROP_TABLE_QUERY_SUPPORTABLE_OPTIONS = new Set(['cascade']);
export const ADD_COLUMN_QUERY_SUPPORTABLE_OPTIONS = new Set(['ifNotExists']);
export const REMOVE_COLUMN_QUERY_SUPPORTABLE_OPTIONS = new Set(['ifExists']);

/**
 * Abstract Query Generator
 *
 * @private
 */
export class AbstractQueryGenerator extends AbstractQueryGeneratorTypeScript {
  createDatabaseQuery() {
    if (this.dialect.supports.multiDatabases) {
      throw new Error(`${this.dialect.name} declares supporting databases but createDatabaseQuery is not implemented.`);
    }

    throw new Error(`Databases are not supported in ${this.dialect.name}.`);
  }

  dropDatabaseQuery() {
    if (this.dialect.supports.multiDatabases) {
      throw new Error(`${this.dialect.name} declares supporting databases but dropDatabaseQuery is not implemented.`);
    }

    throw new Error(`Databases are not supported in ${this.dialect.name}.`);
  }

  listDatabasesQuery() {
    if (this.dialect.supports.multiDatabases) {
      throw new Error(`${this.dialect.name} declares supporting databases but listDatabasesQuery is not implemented.`);
    }

    throw new Error(`Databases are not supported in ${this.dialect.name}.`);
  }

  createSchemaQuery() {
    if (this.dialect.supports.schemas) {
      throw new Error(`${this.dialect.name} declares supporting schema but createSchemaQuery is not implemented.`);
    }

    throw new Error(`Schemas are not supported in ${this.dialect.name}.`);
  }

  dropSchemaQuery() {
    if (this.dialect.supports.schemas) {
      throw new Error(`${this.dialect.name} declares supporting schema but dropSchemaQuery is not implemented.`);
    }

    throw new Error(`Schemas are not supported in ${this.dialect.name}.`);
  }

  listSchemasQuery() {
    if (this.dialect.supports.schemas) {
      throw new Error(`${this.dialect.name} declares supporting schema but listSchemasQuery is not implemented.`);
    }

    throw new Error(`Schemas are not supported in ${this.dialect.name}.`);
  }

  dropTableQuery(tableName, options) {
    const DROP_TABLE_QUERY_SUPPORTED_OPTIONS = new Set();

    if (options) {
      rejectInvalidOptions(
        'dropTableQuery',
        this.dialect.name,
        DROP_TABLE_QUERY_SUPPORTABLE_OPTIONS,
        DROP_TABLE_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    return `DROP TABLE IF EXISTS ${this.quoteTable(tableName)};`;
  }

  renameTableQuery(before, after) {
    return `ALTER TABLE ${this.quoteTable(before)} RENAME TO ${this.quoteTable(after)};`;
  }

  /**
   * Returns an insert into command
   *
   * @param {string} table
   * @param {object} valueHash       attribute value pairs
   * @param {object} modelAttributes
   * @param {object} [options]
   *
   * @private
   */
  insertQuery(table, valueHash, modelAttributes, options) {
    options = options || {};
    _.defaults(options, this.options);

    const modelAttributeMap = {};
    const bind = Object.create(null);
    const fields = [];
    const returningModelAttributes = [];
    const values = [];
    const quotedTable = this.quoteTable(table);
    const bindParam = options.bindParam === undefined ? this.bindParam(bind) : options.bindParam;
    let query;
    let valueQuery = '';
    let emptyQuery = '';
    let outputFragment = '';
    let returningFragment = '';
    let identityWrapperRequired = false;
    let tmpTable = ''; // tmpTable declaration for trigger

    if (modelAttributes) {
      _.each(modelAttributes, (attribute, key) => {
        modelAttributeMap[key] = attribute;
        if (attribute.field) {
          modelAttributeMap[attribute.field] = attribute;
        }
      });
    }

    if (this.dialect.supports['DEFAULT VALUES']) {
      emptyQuery += ' DEFAULT VALUES';
    } else if (this.dialect.supports['VALUES ()']) {
      emptyQuery += ' VALUES ()';
    }

    if (this.dialect.supports.returnValues && options.returning) {
      const returnValues = this.generateReturnValues(modelAttributes, options);

      returningModelAttributes.push(...returnValues.returnFields);
      returningFragment = returnValues.returningFragment;
      tmpTable = returnValues.tmpTable || '';
      outputFragment = returnValues.outputFragment || '';
    }

    if (_.get(this, ['sequelize', 'options', 'dialectOptions', 'prependSearchPath']) || options.searchPath) {
      // Not currently supported with search path (requires output of multiple queries)
      options.bindParam = false;
    }

    if (this.dialect.supports.EXCEPTION && options.exception) {
      // Not currently supported with bind parameters (requires output of multiple queries)
      options.bindParam = false;
    }

    valueHash = removeNullishValuesFromHash(valueHash, this.options.omitNull);
    for (const key in valueHash) {
      if (Object.prototype.hasOwnProperty.call(valueHash, key)) {
        const value = valueHash[key];
        fields.push(this.quoteIdentifier(key));

        // SERIALS' can't be NULL in postgresql, use DEFAULT where supported
        if (modelAttributeMap && modelAttributeMap[key] && modelAttributeMap[key].autoIncrement === true && value == null) {
          if (!this.dialect.supports.autoIncrement.defaultValue) {
            fields.splice(-1, 1);
          } else if (this.dialect.supports.DEFAULT) {
            values.push('DEFAULT');
          } else {
            values.push(this.escape(null));
          }
        } else {
          if (modelAttributeMap && modelAttributeMap[key] && modelAttributeMap[key].autoIncrement === true) {
            identityWrapperRequired = true;
          }

          if (value instanceof SequelizeMethod || options.bindParam === false) {
            values.push(this.escape(value, modelAttributeMap && modelAttributeMap[key] || undefined, { context: 'INSERT', replacements: options.replacements }));
          } else {
            values.push(this.format(value, modelAttributeMap && modelAttributeMap[key] || undefined, { context: 'INSERT' }, bindParam));
          }
        }
      }
    }

    let onDuplicateKeyUpdate = '';

    // `options.updateOnDuplicate` is the list of field names to update if a duplicate key is hit during the insert.  It
    // contains just the field names.  This option is _usually_ explicitly set by the corresponding query-interface
    // upsert function.
    if (this.dialect.supports.inserts.updateOnDuplicate && options.updateOnDuplicate) {
      if (this.dialect.supports.inserts.updateOnDuplicate === ' ON CONFLICT DO UPDATE SET') { // postgres / sqlite
        // If no conflict target columns were specified, use the primary key names from options.upsertKeys
        const conflictKeys = options.upsertKeys.map(attr => this.quoteIdentifier(attr));
        const updateKeys = options.updateOnDuplicate.map(attr => `${this.quoteIdentifier(attr)}=EXCLUDED.${this.quoteIdentifier(attr)}`);
        onDuplicateKeyUpdate = ` ON CONFLICT (${conflictKeys.join(',')})`;
        // if update keys are provided, then apply them here.  if there are no updateKeys provided, then do not try to
        // do an update.  Instead, fall back to DO NOTHING.
        onDuplicateKeyUpdate += _.isEmpty(updateKeys) ? ' DO NOTHING ' : ` DO UPDATE SET ${updateKeys.join(',')}`;
      } else {
        const valueKeys = options.updateOnDuplicate.map(attr => `${this.quoteIdentifier(attr)}=VALUES(${this.quoteIdentifier(attr)})`);
        // the rough equivalent to ON CONFLICT DO NOTHING in mysql, etc is ON DUPLICATE KEY UPDATE id = id
        // So, if no update values were provided, fall back to the identifier columns provided in the upsertKeys array.
        // This will be the primary key in most cases, but it could be some other constraint.
        if (_.isEmpty(valueKeys) && options.upsertKeys) {
          valueKeys.push(...options.upsertKeys.map(attr => `${this.quoteIdentifier(attr)}=${this.quoteIdentifier(attr)}`));
        }

        // edge case... but if for some reason there were no valueKeys, and there were also no upsertKeys... then we
        // can no longer build the requested query without a syntax error.  Let's throw something more graceful here
        // so the devs know what the problem is.
        if (_.isEmpty(valueKeys)) {
          throw new Error('No update values found for ON DUPLICATE KEY UPDATE clause, and no identifier fields could be found to use instead.');
        }

        onDuplicateKeyUpdate += `${this.dialect.supports.inserts.updateOnDuplicate} ${valueKeys.join(',')}`;
      }
    }

    const replacements = {
      ignoreDuplicates: options.ignoreDuplicates ? this.dialect.supports.inserts.ignoreDuplicates : '',
      onConflictDoNothing: options.ignoreDuplicates ? this.dialect.supports.inserts.onConflictDoNothing : '',
      attributes: fields.join(','),
      output: outputFragment,
      values: values.join(','),
      tmpTable,
    };

    valueQuery = `${tmpTable}INSERT${replacements.ignoreDuplicates} INTO ${quotedTable} (${replacements.attributes})${replacements.output} VALUES (${replacements.values})${onDuplicateKeyUpdate}${replacements.onConflictDoNothing}${valueQuery}`;
    emptyQuery = `${tmpTable}INSERT${replacements.ignoreDuplicates} INTO ${quotedTable}${replacements.output}${onDuplicateKeyUpdate}${replacements.onConflictDoNothing}${emptyQuery}`;

    // Mostly for internal use, so we expect the user to know what he's doing!
    // pg_temp functions are private per connection, so we never risk this function interfering with another one.
    if (this.dialect.supports.EXCEPTION && options.exception) {
      const dropFunction = 'DROP FUNCTION IF EXISTS pg_temp.testfunc()';

      if (returningModelAttributes.length === 0) {
        returningModelAttributes.push('*');
      }

      const delimiter = `$func_${crypto.randomUUID().replace(/-/g, '')}$`;
      const selectQuery = `SELECT (testfunc.response).${returningModelAttributes.join(', (testfunc.response).')}, testfunc.sequelize_caught_exception FROM pg_temp.testfunc();`;

      options.exception = 'WHEN unique_violation THEN GET STACKED DIAGNOSTICS sequelize_caught_exception = PG_EXCEPTION_DETAIL;';
      valueQuery = `CREATE OR REPLACE FUNCTION pg_temp.testfunc(OUT response ${quotedTable}, OUT sequelize_caught_exception text) RETURNS RECORD AS ${delimiter} BEGIN ${valueQuery} RETURNING * INTO response; EXCEPTION ${options.exception} END ${delimiter} LANGUAGE plpgsql; ${selectQuery} ${dropFunction}`;
    } else {
      valueQuery += returningFragment;
      emptyQuery += returningFragment;
    }

    query = `${`${replacements.attributes.length > 0 ? valueQuery : emptyQuery}`.trim()};`;
    if (this.dialect.supports.finalTable) {
      query = `SELECT * FROM FINAL TABLE (${replacements.attributes.length > 0 ? valueQuery : emptyQuery});`;
    }

    if (identityWrapperRequired && this.dialect.supports.autoIncrement.identityInsert) {
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
   * @param {object} fieldValueHashes
   * @param {object} options
   * @param {object} fieldMappedAttributes
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
          this.dialect.supports.bulkDefault
          && serials[key] === true
        ) {
          // fieldValueHashes[key] ?? 'DEFAULT'
          return fieldValueHash[key] != null ? fieldValueHash[key] : 'DEFAULT';
        }

        return this.escape(fieldValueHash[key], fieldMappedAttributes[key], { context: 'INSERT', replacements: options.replacements });
      });

      tuples.push(`(${values.join(',')})`);
    }

    // `options.updateOnDuplicate` is the list of field names to update if a duplicate key is hit during the insert.  It
    // contains just the field names.  This option is _usually_ explicitly set by the corresponding query-interface
    // upsert function.
    if (this.dialect.supports.inserts.updateOnDuplicate && options.updateOnDuplicate) {
      if (this.dialect.supports.inserts.updateOnDuplicate === ' ON CONFLICT DO UPDATE SET') { // postgres / sqlite
        // If no conflict target columns were specified, use the primary key names from options.upsertKeys
        const conflictKeys = options.upsertKeys.map(attr => this.quoteIdentifier(attr));
        const updateKeys = options.updateOnDuplicate.map(attr => `${this.quoteIdentifier(attr)}=EXCLUDED.${this.quoteIdentifier(attr)}`);
        onDuplicateKeyUpdate = ` ON CONFLICT (${conflictKeys.join(',')}) DO UPDATE SET ${updateKeys.join(',')}`;
      } else { // mysql / maria
        const valueKeys = options.updateOnDuplicate.map(attr => `${this.quoteIdentifier(attr)}=VALUES(${this.quoteIdentifier(attr)})`);
        onDuplicateKeyUpdate = `${this.dialect.supports.inserts.updateOnDuplicate} ${valueKeys.join(',')}`;
      }
    }

    const ignoreDuplicates = options.ignoreDuplicates ? this.dialect.supports.inserts.ignoreDuplicates : '';
    const attributes = allAttributes.map(attr => this.quoteIdentifier(attr)).join(',');
    const onConflictDoNothing = options.ignoreDuplicates ? this.dialect.supports.inserts.onConflictDoNothing : '';
    let returning = '';

    if (this.dialect.supports.returnValues && options.returning) {
      const returnValues = this.generateReturnValues(fieldMappedAttributes, options);

      returning += returnValues.returningFragment;
    }

    return joinSQLFragments([
      'INSERT',
      ignoreDuplicates,
      'INTO',
      this.quoteTable(tableName),
      `(${attributes})`,
      'VALUES',
      tuples.join(','),
      onDuplicateKeyUpdate,
      onConflictDoNothing,
      returning,
      ';',
    ]);
  }

  /**
   * Returns an update query
   *
   * @param {string} tableName
   * @param {object} attrValueHash
   * @param {object} where A hash with conditions (e.g. {name: 'foo'}) OR an ID as integer
   * @param {object} options
   * @param {object} columnDefinitions
   *
   * @private
   */
  updateQuery(tableName, attrValueHash, where, options, columnDefinitions) {
    options = options || {};
    _.defaults(options, this.options);

    attrValueHash = removeNullishValuesFromHash(attrValueHash, options.omitNull, options);

    const values = [];
    const bind = Object.create(null);
    const modelAttributeMap = {};
    let outputFragment = '';
    let tmpTable = ''; // tmpTable declaration for trigger
    let suffix = '';

    if (_.get(this, ['sequelize', 'options', 'dialectOptions', 'prependSearchPath']) || options.searchPath) {
      // Not currently supported with search path (requires output of multiple queries)
      options.bindParam = false;
    }

    const bindParam = options.bindParam === undefined ? this.bindParam(bind) : options.bindParam;

    if (this.dialect.supports['LIMIT ON UPDATE'] && options.limit && this.dialect.name !== 'mssql' && this.dialect.name !== 'db2') {
      suffix = ` LIMIT ${this.escape(options.limit, undefined, options)} `;
    }

    if (this.dialect.supports.returnValues && options.returning) {
      const returnValues = this.generateReturnValues(columnDefinitions, options);

      suffix += returnValues.returningFragment;
      tmpTable = returnValues.tmpTable || '';
      outputFragment = returnValues.outputFragment || '';

      // ensure that the return output is properly mapped to model fields.
      if (this.dialect.supports.returnValues !== 'output' && options.returning) {
        options.mapToModel = true;
      }
    }

    if (columnDefinitions) {
      _.each(columnDefinitions, (attribute, key) => {
        modelAttributeMap[key] = attribute;
        if (attribute.field) {
          modelAttributeMap[attribute.field] = attribute;
        }
      });
    }

    for (const key in attrValueHash) {
      if (modelAttributeMap && modelAttributeMap[key]
        && modelAttributeMap[key].autoIncrement === true
        && !this.dialect.supports.autoIncrement.update) {
        // not allowed to update identity column
        continue;
      }

      const value = attrValueHash[key];

      if (value instanceof SequelizeMethod || options.bindParam === false) {
        values.push(`${this.quoteIdentifier(key)}=${this.escape(value, modelAttributeMap && modelAttributeMap[key] || undefined, { context: 'UPDATE', replacements: options.replacements })}`);
      } else {
        values.push(`${this.quoteIdentifier(key)}=${this.format(value, modelAttributeMap && modelAttributeMap[key] || undefined, { context: 'UPDATE' }, bindParam)}`);
      }
    }

    const whereOptions = { ...options, bindParam };

    if (values.length === 0) {
      return { query: '' };
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
   * @param {string} operator                    String with the arithmetic operator (e.g. '+' or '-')
   * @param {string} tableName                   Name of the table
   * @param {object} where                       A plain-object with conditions (e.g. {name: 'foo'}) OR an ID as integer
   * @param {object} incrementAmountsByField     A plain-object with attribute-value-pairs
   * @param {object} extraAttributesToBeUpdated  A plain-object with attribute-value-pairs
   * @param {object} options
   *
   * @private
   */
  arithmeticQuery(operator, tableName, where, incrementAmountsByField, extraAttributesToBeUpdated, options) {
    // TODO: this method should delegate to `updateQuery`

    options = options || {};
    _.defaults(options, { returning: true });

    const replacementOptions = _.pick(options, ['replacements']);

    extraAttributesToBeUpdated = removeNullishValuesFromHash(extraAttributesToBeUpdated, this.options.omitNull);

    let outputFragment = '';
    let returningFragment = '';

    if (this.dialect.supports.returnValues && options.returning) {
      const returnValues = this.generateReturnValues(null, options);

      outputFragment = returnValues.outputFragment;
      returningFragment = returnValues.returningFragment;
    }

    const updateSetSqlFragments = [];
    for (const field in incrementAmountsByField) {
      const incrementAmount = incrementAmountsByField[field];
      const quotedField = this.quoteIdentifier(field);
      const escapedAmount = this.escape(incrementAmount, undefined, replacementOptions);
      updateSetSqlFragments.push(`${quotedField}=${quotedField}${operator} ${escapedAmount}`);
    }

    for (const field in extraAttributesToBeUpdated) {
      const newValue = extraAttributesToBeUpdated[field];
      const quotedField = this.quoteIdentifier(field);
      const escapedValue = this.escape(newValue, undefined, replacementOptions);
      updateSetSqlFragments.push(`${quotedField}=${escapedValue}`);
    }

    return joinSQLFragments([
      'UPDATE',
      this.quoteTable(tableName),
      'SET',
      updateSetSqlFragments.join(','),
      outputFragment,
      this.whereQuery(where, replacementOptions),
      returningFragment,
    ]);
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
        - include
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
    }

    const fieldsSql = options.fields.map(field => {
      if (field instanceof SequelizeMethod) {
        return this.handleSequelizeMethod(field);
      }

      if (typeof field === 'string') {
        field = {
          name: field,
        };
      }

      let result = '';

      if (field.attribute) {
        field.name = field.attribute;
      }

      if (!field.name) {
        throw new Error(`The following index field has no name: ${util.inspect(field)}`);
      }

      result += this.quoteIdentifier(field.name);

      if (this.dialect.supports.index.collate && field.collate) {
        result += ` COLLATE ${this.quoteIdentifier(field.collate)}`;
      }

      if (this.dialect.supports.index.operator) {
        const operator = field.operator || options.operator;
        if (operator) {
          result += ` ${operator}`;
        }
      }

      if (this.dialect.supports.index.length > 0 && field.length > 0) {
        result += `(${field.length})`;
      }

      if (field.order) {
        result += ` ${field.order}`;
      }

      return result;
    });

    let includeSql;
    if (options.include) {
      if (!this.dialect.supports.index.include) {
        throw new Error(`The include attribute for indexes is not supported by ${this.dialect.name} dialect`);
      }

      if (options.include instanceof Literal) {
        includeSql = `INCLUDE ${options.include.val}`;
      } else if (Array.isArray(options.include)) {
        includeSql = `INCLUDE (${options.include.map(field => (field instanceof Literal ? field.val : this.quoteIdentifier(field))).join(', ')})`;
      } else {
        throw new TypeError('The include attribute for indexes must be an array or a literal.');
      }
    }

    if (!options.name) {
      // Mostly for cases where addIndex is called directly by the user without an options object (for example in migrations)
      // All calls that go through sequelize should already have a name
      options = nameIndex(options, options.prefix);
    }

    options = Model._conformIndex(options);

    if (!this.dialect.supports.index.type) {
      delete options.type;
    }

    if (options.where) {
      options.where = this.whereQuery(options.where);
    }

    const escapedTableName = this.quoteTable(tableName);

    const concurrently = this.dialect.supports.index.concurrently && options.concurrently ? 'CONCURRENTLY' : undefined;
    let ind;
    if (this.dialect.supports.indexViaAlter) {
      ind = [
        'ALTER TABLE',
        escapedTableName,
        concurrently,
        'ADD',
      ];
    } else {
      ind = ['CREATE'];
    }

    // DB2 incorrectly scopes the index if we don't specify the schema name,
    // which will cause it to error if another schema contains a table that uses an index with an identical name
    const escapedIndexName = tableName.schema && this.dialect.name === 'db2'
      // 'quoteTable' isn't the best name: it quotes any identifier.
      // in this case, the goal is to produce '"schema_name"."index_name"' to scope the index in this schema
      ? this.quoteTable({
        schema: tableName.schema,
        tableName: options.name,
      })
      : this.quoteIdentifiers(options.name);

    ind = ind.concat(
      options.unique ? 'UNIQUE' : '',
      options.type, 'INDEX',
      !this.dialect.supports.indexViaAlter ? concurrently : undefined,
      escapedIndexName,
      this.dialect.supports.index.using === 1 && options.using ? `USING ${options.using}` : '',
      !this.dialect.supports.indexViaAlter ? `ON ${escapedTableName}` : undefined,
      this.dialect.supports.index.using === 2 && options.using ? `USING ${options.using}` : '',
      `(${fieldsSql.join(', ')})`,
      this.dialect.supports.index.parser && options.parser ? `WITH PARSER ${options.parser}` : undefined,
      this.dialect.supports.index.include && options.include ? includeSql : undefined,
      this.dialect.supports.index.where && options.where ? options.where : undefined,
    );

    return _.compact(ind).join(' ');
  }

  addConstraintQuery(tableName, options) {
    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'ADD',
      this.getConstraintSnippet(tableName, options || {}),
      ';',
    ]);
  }

  getConstraintSnippet(tableName, options) {
    let constraintSnippet;
    let constraintName;

    const quotedFields = options.fields.map(field => {
      if (typeof field === 'string') {
        return this.quoteIdentifier(field);
      }

      if (field instanceof SequelizeMethod) {
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

    const constraintNameParts = options.name ? null : options.fields.map(field => {
      if (typeof field === 'string') {
        return field;
      }

      if (field instanceof SequelizeMethod) {
        throw new TypeError(`The constraint name must be provided explicitly if one of Sequelize's method (literal(), col(), etc…) is used in the constraint's fields`);
      }

      if (field.attribute) {
        return field.attribute;
      }

      return field.name;
    });

    const fieldsSqlQuotedString = quotedFields.join(', ');
    const fieldsSqlString = constraintNameParts?.join('_');

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
          throw new Error('Default value must be specified for DEFAULT CONSTRAINT');
        }

        if (this.dialect.name !== 'mssql') {
          throw new Error('Default constraints are supported only for MSSQL dialect.');
        }

        constraintName = this.quoteIdentifier(options.name || `${tableName}_${fieldsSqlString}_df`);
        constraintSnippet = `CONSTRAINT ${constraintName} DEFAULT (${this.escape(options.defaultValue, undefined, options)}) FOR ${quotedFields[0]}`;
        break;
      case 'PRIMARY KEY':
        constraintName = this.quoteIdentifier(options.name || `${tableName}_${fieldsSqlString}_pk`);
        constraintSnippet = `CONSTRAINT ${constraintName} PRIMARY KEY (${fieldsSqlQuotedString})`;
        break;
      case 'FOREIGN KEY': {
        const references = options.references;
        if (!references || !references.table || !(references.field || references.fields)) {
          throw new Error('references object with table and field must be specified');
        }

        constraintName = this.quoteIdentifier(options.name || `${tableName}_${fieldsSqlString}_${references.table}_fk`);
        const quotedReferences
          = typeof references.field !== 'undefined'
          ? this.quoteIdentifier(references.field)
          : references.fields.map(f => this.quoteIdentifier(f)).join(', ');
        const referencesSnippet = `${this.quoteTable(references.table)} (${quotedReferences})`;
        constraintSnippet = `CONSTRAINT ${constraintName} `;
        constraintSnippet += `FOREIGN KEY (${fieldsSqlQuotedString}) REFERENCES ${referencesSnippet}`;
        if (options.onUpdate) {
          if (!this.dialect.supports.constraints.onUpdate) {
            throw new Error(`Constraint onUpdate is not supported by ${this.dialect.name}`);
          }

          constraintSnippet += ` ON UPDATE ${options.onUpdate.toUpperCase()}`;
        }

        if (options.onDelete) {
          constraintSnippet += ` ON DELETE ${options.onDelete.toUpperCase()}`;
        }

        break;
      }

      default: throw new Error(`${options.type} is invalid.`);
    }

    if (options.deferrable && ['UNIQUE', 'PRIMARY KEY', 'FOREIGN KEY'].includes(options.type.toUpperCase())) {
      constraintSnippet += ` ${this.deferConstraintsQuery(options)}`;
    }

    return constraintSnippet;
  }

  removeConstraintQuery(tableName, constraintName) {
    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'DROP CONSTRAINT',
      this.quoteIdentifiers(constraintName),
    ]);
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
  quote(collection, parent, connector = '.', options) {
    // init
    const validOrderOptions = [
      'ASC',
      'DESC',
      'ASC NULLS LAST',
      'DESC NULLS LAST',
      'ASC NULLS FIRST',
      'DESC NULLS FIRST',
      'NULLS FIRST',
      'NULLS LAST',
    ];

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
        if (isModelStatic(previousModel)) {
          let model;
          let as;

          if (isModelStatic(item)) {
            // set
            model = item;
          } else if (_.isPlainObject(item) && item.model && isModelStatic(item.model)) {
            // set
            model = item.model;
            as = item.as;
          }

          if (model) {
            // set the as to either the through name or the model name
            if (!as && previousAssociation && previousAssociation instanceof Association && previousAssociation.through?.model === model) {
              // we get here for cases like
              // [manyToManyAssociation, throughModel]
              // "throughModel" must be replaced by the association from the many to many to the through model
              item = previousAssociation.fromSourceToThroughOne;
            } else {
              // get association from previous model
              item = previousModel.getAssociationWithModel(model, as);
            }

            // make sure we have an association
            if (!(item instanceof Association)) {
              throw new TypeError(`Unable to find a valid association between models "${previousModel.name}" and "${model.name}"`);
            }
          }
        }

        if (typeof item === 'string') {
          // get order index
          const orderIndex = validOrderOptions.indexOf(item.toUpperCase());

          // see if this is an order
          if (index > 0 && orderIndex !== -1) {
            item = this.sequelize.literal(` ${validOrderOptions[orderIndex]}`);
          } else if (previousModel && isModelStatic(previousModel)) {
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
      });

      // loop through array, adding table names of models to quoted
      const collectionLength = collection.length;
      const tableNames = [];
      let item;
      let i = 0;

      for (i = 0; i < collectionLength - 1; i++) {
        item = collection[i];
        if (typeof item === 'string' || item._modelAttribute || item instanceof SequelizeMethod) {
          break;
        } else if (item instanceof Association) {
          const previousAssociation = collection[i - 1];

          // BelongsToMany.throughModel are a special case. We want
          //  through model to be loaded under the model's name instead of the association name,
          //  because we want them to be available under the model's name in the entity's data.
          if (previousAssociation instanceof BelongsToMany && item === previousAssociation.fromSourceToThroughOne) {
            tableNames[i] = previousAssociation.throughModel.name;
          } else {
            tableNames[i] = item.as;
          }
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
      for (const collectionItem of collection.slice(i)) {
        sql += this.quote(collectionItem, parent, connector, options);
      }

      return sql;
    }

    if (collection._modelAttribute) {
      return `${this.quoteTable(collection.Model.name)}.${this.quoteIdentifier(collection.fieldName)}`;
    }

    if (collection instanceof SequelizeMethod) {
      return this.handleSequelizeMethod(collection, undefined, undefined, options);
    }

    if (_.isPlainObject(collection) && collection.raw) {
      // simple objects with raw is no longer supported
      throw new Error('The `{raw: "..."}` syntax is no longer supported.  Use `sequelize.literal` instead.');
    }

    throw new Error(`Unknown structure passed to order / group: ${util.inspect(collection)}`);
  }

  /**
   * Split a list of identifiers by "." and quote each part.
   *
   * ⚠️ You almost certainly want to use `quoteIdentifier` instead!
   * This method splits the identifier by "." into multiple identifiers, and has special meaning for "*".
   * This behavior should never be the default and should be explicitly opted into by using {@link Col}.
   *
   * @param {string} identifiers
   *
   * @returns {string}
   */
  quoteIdentifiers(identifiers) {
    if (identifiers.includes('.')) {
      identifiers = identifiers.split('.');

      const head = identifiers.slice(0, -1).join('->');
      const tail = identifiers[identifiers.length - 1];

      return `${this.quoteIdentifier(head)}.${tail === '*' ? '*' : this.quoteIdentifier(tail)}`;
    }

    if (identifiers === '*') {
      return '*';
    }

    return this.quoteIdentifier(identifiers);
  }

  /**
   * Escape a value (e.g. a string, number or date)
   *
   * @param {unknown} value
   * @param {object} field
   * @param {object} options
   * @private
   */
  escape(value, field, options = {}) {
    if (value instanceof SequelizeMethod) {
      return this.handleSequelizeMethod(value, undefined, undefined, { replacements: options.replacements });
    }

    if (value == null || field?.type == null || typeof field.type === 'string') {
      // use default escape mechanism instead of the DataType's.
      return SqlString.escape(value, this.options.timezone, this.dialect);
    }

    field.type = field.type.toDialectDataType(this.dialect);

    if (options.isList && Array.isArray(value)) {
      const escapeOptions = { ...options, isList: false };

      return `(${value.map(valueItem => {
        return this.escape(valueItem, field, escapeOptions);
      }).join(', ')})`;
    }

    this.validate(value, field, options);

    return field.type.escape(value, {
      field,
      timezone: this.options.timezone,
      operation: options.operation,
      dialect: this.dialect,
    });
  }

  bindParam(bind) {
    let i = 0;

    return value => {
      const bindName = `sequelize_${++i}`;

      bind[bindName] = value;

      return `$${bindName}`;
    };
  }

  /*
    Returns a bind parameter representation of a value (e.g. a string, number or date)
    @private
  */
  format(value, field, options, bindParam) {
    options = options || {};

    if (value instanceof SequelizeMethod) {
      throw new TypeError('Cannot pass SequelizeMethod as a bind parameter - use escape instead');
    }

    if (value == null || !field?.type || typeof field.type === 'string') {
      return bindParam(value);
    }

    this.validate(value, field, options);

    return field.type.getBindParamSql(value, {
      field,
      timezone: this.options.timezone,
      operation: options.operation,
      bindParam,
      dialect: this.dialect,
    });
  }

  /*
    Validate a value against a field specification
    @private
  */
  validate(value, field) {
    if (this.noTypeValidation || isNullish(value)) {
      return;
    }

    const error = field.type instanceof AbstractDataType
      ? validateDataType(field.type, field.fieldName, null, value)
      : null;
    if (error) {
      throw error;
    }
  }

  /**
   * @param {string} identifier
   *
   * @deprecated Do not use this method. A string starting & ending with the identifier quote (", `, []) does
   * not mean that it's already quoted. These characters are valid inside of identifiers and should be properly escaped.
   */
  isIdentifierQuoted(identifier) {
    return /^\s*(?:(["'`])(?:(?!\1).|\1{2})*\1\.?)+\s*$/i.test(identifier);
  }

  /**
   * Generates an SQL query that extract JSON property of given path.
   *
   * @param   {string}               _column   The JSON column
   * @param   {string|Array<string>} [_path]   The path to extract (optional)
   * @param   {boolean}              [_isJson] The value is JSON use alt symbols (optional)
   * @returns {string}                         The generated sql query
   * @private
   */
  jsonPathExtractionQuery(_column, _path, _isJson) {
    throw new Error(`JSON operations are not supported in ${this.dialect.name}.`);
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
      main: options.attributes && [...options.attributes],
      subQuery: null,
    };
    const mainTable = {
      name: tableName,
      quotedName: null,
      as: null,
      quotedAs: null,
      model,
    };
    const topLevelInfo = {
      names: mainTable,
      options,
      subQuery,
    };
    let mainJoinQueries = [];
    let subJoinQueries = [];
    let query;

    // Aliases can be passed through subqueries and we don't want to reset them
    if (this.options.minifyAliases && !options.aliasesMapping) {
      options.aliasesMapping = new Map();
      options.aliasesByTable = {};
      options.includeAliases = new Map();
    }

    // resolve table name options
    if (options.tableAs) {
      mainTable.as = options.tableAs;
    } else if (!Array.isArray(mainTable.name) && mainTable.model) {
      mainTable.as = mainTable.model.name;
    }

    mainTable.quotedAs = mainTable.as && this.quoteIdentifier(mainTable.as);

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
    attributes.main = attributes.main || (options.include ? [`${mainTable.quotedAs}.*`] : ['*']);

    // If subquery, we add the mainAttributes to the subQuery and set the mainAttributes to select * from subquery
    if (subQuery || options.groupedLimit) {
      // We need primary keys
      attributes.subQuery = attributes.main;
      attributes.main = [`${mainTable.quotedAs || mainTable.quotedName}.*`];
    }

    if (options.include) {
      for (const include of options.include) {
        if (include.separate) {
          continue;
        }

        const joinQueries = this.generateInclude(include, { externalAs: mainTable.as, internalAs: mainTable.as }, topLevelInfo, { replacements: options.replacements });

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
      subQueryItems.push(
        this.selectFromTableFragment(options, mainTable.model, attributes.subQuery, mainTable.quotedName, mainTable.quotedAs),
        subJoinQueries.join(''),
      );
    } else {
      if (options.groupedLimit) {
        if (!mainTable.quotedAs) {
          mainTable.quotedAs = mainTable.quotedName;
        }

        if (!mainTable.as) {
          mainTable.as = mainTable.name;
        }

        const where = { ...options.where };
        let groupedLimitOrder;
        let whereKey;
        let include;
        let groupedTableName = mainTable.as;

        if (typeof options.groupedLimit.on === 'string') {
          whereKey = options.groupedLimit.on;
        } else if (options.groupedLimit.on instanceof HasMany) {
          whereKey = options.groupedLimit.on.identifierField;
        }

        if (options.groupedLimit.on instanceof BelongsToMany) {
          // BTM includes needs to join the through table on to check ID
          groupedTableName = options.groupedLimit.on.throughModel.name;

          const groupedLimitOptions = _validateIncludedElements({
            include: [{
              as: options.groupedLimit.on.throughModel.name,
              association: options.groupedLimit.on.fromSourceToThrough,
              duplicating: false, // The UNION'ed query may contain duplicates, but each sub-query cannot
              required: true,
              where: {
                [Op.placeholder]: true,
                ...options.groupedLimit.through?.where,
              },
            }],
            model,
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
              alias = this.sequelize.literal(this.quote(alias, undefined, undefined, options));

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
            model,
          },
          model,
        ).replace(/;$/, '')}) AS sub`; // Every derived table must have its own alias
        const placeHolder = this.whereItemQuery(Op.placeholder, true, { model });
        const splicePos = baseQuery.indexOf(placeHolder);

        mainQueryItems.push(this.selectFromTableFragment(options, mainTable.model, attributes.main, `(${
          options.groupedLimit.values.map(value => {
            let groupWhere;
            if (whereKey) {
              groupWhere = {
                [whereKey]: value,
              };
            }

            if (include) {
              groupWhere = {
                [options.groupedLimit.on.foreignIdentifierField]: value,
              };
            }

            return spliceStr(baseQuery, splicePos, placeHolder.length, this.getWhereConditions(groupWhere, groupedTableName, undefined, options));
          }).join(
            this.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ',
          )
        })`, mainTable.quotedAs));
      } else {
        mainQueryItems.push(this.selectFromTableFragment(options, mainTable.model, attributes.main, mainTable.quotedName, mainTable.quotedAs));
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
          for (const [key, value] of mainQueryItems.entries()) {
            if (value.startsWith('SELECT')) {
              mainQueryItems[key] = this.selectFromTableFragment(options, model, attributes.main, mainTable.quotedName, mainTable.quotedAs, options.where);
            }
          }
        }
      }
    }

    // Add GROUP BY to sub or main query
    if (options.group) {
      options.group = Array.isArray(options.group)
        ? options.group.map(t => this.aliasGrouping(t, model, mainTable.as, options)).join(', ')
        : this.aliasGrouping(options.group, model, mainTable.as, options);

      if (subQuery && options.group) {
        subQueryItems.push(` GROUP BY ${options.group}`);
      } else if (options.group) {
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
      if (orders.mainQueryOrder.length > 0) {
        mainQueryItems.push(` ORDER BY ${orders.mainQueryOrder.join(', ')}`);
      }

      if (orders.subQueryOrder.length > 0) {
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
      this._throwOnEmptyAttributes(attributes.main, { modelName: model && model.name, as: mainTable.quotedAs });
      query = `SELECT ${attributes.main.join(', ')} FROM (${subQueryItems.join('')}) AS ${mainTable.quotedAs}${mainJoinQueries.join('')}${mainQueryItems.join('')}`;
    } else {
      query = mainQueryItems.join('');
    }

    if (options.lock && this.dialect.supports.lock) {
      let lock = options.lock;
      if (typeof options.lock === 'object') {
        lock = options.lock.level;
      }

      if (this.dialect.supports.lockKey && ['KEY SHARE', 'NO KEY UPDATE'].includes(lock)) {
        query += ` FOR ${lock}`;
      } else if (lock === 'SHARE') {
        query += ` ${this.dialect.supports.forShare}`;
      } else {
        query += ' FOR UPDATE';
      }

      if (this.dialect.supports.lockOf && options.lock.of && isModelStatic(options.lock.of)) {
        query += ` OF ${this.quoteTable(options.lock.of.name)}`;
      }

      if (this.dialect.supports.skipLocked && options.skipLocked) {
        query += ' SKIP LOCKED';
      }
    }

    return `${query};`;
  }

  aliasGrouping(field, model, tableName, options) {
    const src = Array.isArray(field) ? field[0] : field;

    return this.quote(this._getAliasForField(tableName, src, options) || src, model, undefined, options);
  }

  escapeAttributes(attributes, options, mainTableAs) {
    const quotedMainTableAs = mainTableAs && this.quoteIdentifier(mainTableAs);

    return attributes && attributes.map(attr => {
      let addTable = true;

      if (attr instanceof SequelizeMethod) {
        return this.handleSequelizeMethod(attr, undefined, undefined, options);
      }

      if (Array.isArray(attr)) {
        if (attr.length !== 2) {
          throw new Error(`${JSON.stringify(attr)} is not a valid attribute definition. Please use the following format: ['attribute definition', 'alias']`);
        }

        attr = [...attr];

        if (attr[0] instanceof SequelizeMethod) {
          attr[0] = this.handleSequelizeMethod(attr[0], undefined, undefined, options);
          addTable = false;
        } else {
          attr[0] = this.quoteIdentifier(attr[0]);
        }

        let alias = attr[1];

        if (this.options.minifyAliases) {
          alias = this._getMinifiedAlias(alias, mainTableAs, options);
        }

        attr = [attr[0], this.quoteIdentifier(alias)].join(' AS ');
      } else {
        attr = this.quoteIdentifier(attr, options.model);
      }

      if (!_.isEmpty(options.include) && (!attr.includes('.') || options.dotNotation) && addTable) {
        attr = `${quotedMainTableAs}.${attr}`;
      }

      return attr;
    });
  }

  generateInclude(include, parentTableName, topLevelInfo, options) {
    const joinQueries = {
      mainQuery: [],
      subQuery: [],
    };
    const mainChildIncludes = [];
    const subChildIncludes = [];
    let requiredMismatch = false;
    const includeAs = {
      internalAs: include.as,
      externalAs: include.as,
    };
    const attributes = {
      main: [],
      subQuery: [],
    };

    topLevelInfo.options.keysEscaped = true;

    if (topLevelInfo.names.name !== parentTableName.externalAs && topLevelInfo.names.as !== parentTableName.externalAs) {
      includeAs.internalAs = `${parentTableName.internalAs}->${include.as}`;
      includeAs.externalAs = `${parentTableName.externalAs}.${include.as}`;
    }

    // includeIgnoreAttributes is used by aggregate functions
    if (topLevelInfo.options.includeIgnoreAttributes !== false) {
      include.model._expandAttributes(include);
      mapFinderOptions(include, include.model);

      const includeAttributes = include.attributes.map(attr => {
        let attrAs = attr;
        let verbatim = false;

        if (Array.isArray(attr) && attr.length === 2) {
          if (attr[0] instanceof SequelizeMethod && (
            attr[0] instanceof Literal
            || attr[0] instanceof Cast
            || attr[0] instanceof Fn
          )) {
            verbatim = true;
          }

          attr = attr.map(attrPart => (attrPart instanceof SequelizeMethod ? this.handleSequelizeMethod(attrPart, undefined, undefined, options) : attrPart));

          attrAs = attr[1];
          attr = attr[0];
        }

        if (attr instanceof Literal) {
          // We trust the user to rename the field correctly
          return this.handleSequelizeMethod(attr, undefined, undefined, options);
        }

        if (attr instanceof Cast || attr instanceof Fn) {
          throw new TypeError(
            'Tried to select attributes using Sequelize.cast or Sequelize.fn without specifying an alias for the result, during eager loading. '
            + 'This means the attribute will not be added to the returned instance',
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

        return joinSQLFragments([
          prefix,
          'AS',
          this.quoteIdentifier(alias, true),
        ]);
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

    let joinQuery;
    if (include.through) {
      joinQuery = this.generateThroughJoin(include, includeAs, parentTableName.internalAs, topLevelInfo);
    } else {
      this._generateSubQueryFilter(include, includeAs, topLevelInfo);
      joinQuery = this.generateJoin(include, topLevelInfo, options);
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

        const childJoinQueries = this.generateInclude(childInclude, includeAs, topLevelInfo, options);

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
      attributes,
    };
  }

  _getMinifiedAlias(alias, tableName, options) {
    // We do not want to re-alias in case of a subquery
    if (options.aliasesByTable[`${tableName}${alias}`]) {
      return options.aliasesByTable[`${tableName}${alias}`];
    }

    // Do not alias custom suquery_orders
    if (/subquery_order_\d/.test(alias)) {
      return alias;
    }

    const minifiedAlias = `_${options.aliasesMapping.size}`;

    options.aliasesMapping.set(minifiedAlias, alias);
    options.aliasesByTable[`${tableName}${alias}`] = minifiedAlias;

    return minifiedAlias;
  }

  _getAliasForField(tableName, field, options) {
    if (this.options.minifyAliases && options.aliasesByTable[`${tableName}${field}`]) {
      return options.aliasesByTable[`${tableName}${field}`];
    }

    return null;
  }

  _getAliasForFieldFromQueryOptions(field, options) {
    return (options.attributes || []).find(
      attr => Array.isArray(attr) && attr[1] && (attr[0] === field || attr[1] === field),
    );
  }

  generateJoin(include, topLevelInfo, options) {
    const association = include.association;
    const parent = include.parent;
    const parentIsTop = Boolean(parent) && !include.parent.association && include.parent.model.name === topLevelInfo.options.model.name;
    let $parent;
    let joinWhere;
    /* Attributes for the left side */
    const left = association.source;
    const attrLeft = association instanceof BelongsTo
      ? association.identifier
      : association.sourceKeyAttribute || left.primaryKeyAttribute;
    const fieldLeft = association instanceof BelongsTo
      ? association.identifierField
      : left.rawAttributes[association.sourceKeyAttribute || left.primaryKeyAttribute].field;
    let asLeft;
    /* Attributes for the right side */
    const right = include.model;
    const tableRight = right.getTableName();
    const fieldRight = association instanceof BelongsTo
      ? right.rawAttributes[association.targetIdentifier || right.primaryKeyAttribute].field
      : association.identifierField;
    let asRight = include.as;

    while (($parent = $parent && $parent.parent || include.parent) && $parent.association) {
      if (asLeft) {
        asLeft = `${$parent.as}->${asLeft}`;
      } else {
        asLeft = $parent.as;
      }
    }

    if (!asLeft) {
      asLeft = parent.as || parent.model.name;
    } else {
      asRight = `${asLeft}->${asRight}`;
    }

    let joinOn = `${this.quoteTable(asLeft)}.${this.quoteIdentifier(fieldLeft)}`;
    const subqueryAttributes = [];

    if (topLevelInfo.options.groupedLimit && parentIsTop || topLevelInfo.subQuery && include.parent.subQuery && !include.subQuery) {
      if (parentIsTop) {
        // The main model attributes is not aliased to a prefix
        const tableName = parent.as || parent.model.name;
        const quotedTableName = this.quoteTable(tableName);

        // Check for potential aliased JOIN condition
        joinOn = this._getAliasForField(tableName, attrLeft, topLevelInfo.options) || `${quotedTableName}.${this.quoteIdentifier(attrLeft)}`;

        if (topLevelInfo.subQuery) {
          const dbIdentifier = `${quotedTableName}.${this.quoteIdentifier(fieldLeft)}`;
          subqueryAttributes.push(dbIdentifier !== joinOn ? `${dbIdentifier} AS ${this.quoteIdentifier(attrLeft)}` : dbIdentifier);
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
        model: include.model,
        replacements: options?.replacements,
      });
    }

    if (include.where) {
      joinWhere = this.whereItemsQuery(include.where, {
        prefix: this.sequelize.literal(this.quoteIdentifier(asRight)),
        model: include.model,
        replacements: options?.replacements,
      });
      if (joinWhere) {
        if (include.or) {
          joinOn += ` OR ${joinWhere}`;
        } else {
          joinOn += ` AND ${joinWhere}`;
        }
      }
    }

    if (this.options.minifyAliases && asRight.length > 63) {
      const alias = `%${topLevelInfo.options.includeAliases.size}`;

      topLevelInfo.options.includeAliases.set(alias, asRight);
    }

    return {
      join: include.required ? 'INNER JOIN' : include.right && this.dialect.supports['RIGHT JOIN'] ? 'RIGHT OUTER JOIN' : 'LEFT OUTER JOIN',
      body: this.quoteTable(tableRight, asRight),
      condition: joinOn,
      attributes: {
        main: [],
        subQuery: subqueryAttributes,
      },
    };
  }

  /**
   * Returns the SQL fragments to handle returning the attributes from an insert/update query.
   *
   * @param  {object} modelAttributes An object with the model attributes.
   * @param  {object} options         An object with options.
   *
   * @private
   */
  generateReturnValues(modelAttributes, options) {
    const returnFields = [];
    const returnTypes = [];
    let outputFragment = '';
    let returningFragment = '';
    let tmpTable = '';

    const returnValuesType = this.dialect.supports.returnValues;

    if (Array.isArray(options.returning)) {
      returnFields.push(...options.returning.map(field => {
        if (typeof field === 'string') {
          return this.quoteIdentifier(field);
        } else if (field instanceof Literal) {
          // Due to how the mssql query is built, using a literal would never result in a properly formed query.
          // It's better to warn early.
          if (returnValuesType === 'output') {
            throw new Error(`literal() cannot be used in the "returning" option array in ${this.dialect.name}. Use col(), or a string instead.`);
          }

          return this.handleSequelizeMethod(field);
        } else if (field instanceof Col) {
          return this.handleSequelizeMethod(field);
        }

        throw new Error(`Unsupported value in "returning" option: ${NodeUtil.inspect(field)}. This option only accepts true, false, or an array of strings, col() or literal().`);
      }));
    } else if (modelAttributes) {
      _.each(modelAttributes, attribute => {
        if (!(attribute.type instanceof DataTypes.VIRTUAL)) {
          returnFields.push(this.quoteIdentifier(attribute.field));
          returnTypes.push(attribute.type);
        }
      });
    }

    if (_.isEmpty(returnFields)) {
      returnFields.push(`*`);
    }

    if (returnValuesType === 'returning') {
      returningFragment = ` RETURNING ${returnFields.join(', ')}`;
    } else if (returnValuesType === 'output') {
      outputFragment = ` OUTPUT ${returnFields.map(field => `INSERTED.${field}`).join(', ')}`;

      // To capture output rows when there is a trigger on MSSQL DB
      if (options.hasTrigger && this.dialect.supports.tmpTableTrigger) {
        const tmpColumns = returnFields.map((field, i) => {
          return `${field} ${attributeTypeToSql(returnTypes[i], { dialect: this.dialect })}`;
        });

        tmpTable = `DECLARE @tmp TABLE (${tmpColumns.join(',')}); `;
        outputFragment += ' INTO @tmp';
        returningFragment = '; SELECT * FROM @tmp';
      }
    }

    return { outputFragment, returnFields, returningFragment, tmpTable };
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

      return joinSQLFragments([
        `${this.quoteIdentifier(throughAs)}.${this.quoteIdentifier(Array.isArray(attr) ? attr[0] : attr)}`,
        'AS',
        this.quoteIdentifier(alias),
      ]);
    });
    const association = include.association;
    const parentIsTop = !include.parent.association && include.parent.model.name === topLevelInfo.options.model.name;
    const tableSource = parentTableName;
    const identSource = association.identifierField;
    const tableTarget = includeAs.internalAs;
    const identTarget = association.foreignIdentifierField;
    const attrTarget = association.targetKeyField;

    const joinType = include.required ? 'INNER JOIN' : include.right && this.dialect.supports['RIGHT JOIN'] ? 'RIGHT OUTER JOIN' : 'LEFT OUTER JOIN';
    let joinBody;
    let joinCondition;
    const attributes = {
      main: [],
      subQuery: [],
    };
    let attrSource = association.sourceKey;
    let sourceJoinOn;
    let targetJoinOn;
    let throughWhere;
    let targetWhere;

    if (this.options.minifyAliases && throughAs.length > 63) {
      topLevelInfo.options.includeAliases.set(`%${topLevelInfo.options.includeAliases.size}`, throughAs);
      if (includeAs.internalAs.length > 63) {
        topLevelInfo.options.includeAliases.set(`%${topLevelInfo.options.includeAliases.size}`, includeAs.internalAs);
      }
    }

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
      throughWhere = this.getWhereConditions(through.where, this.sequelize.literal(this.quoteIdentifier(throughAs)), through.model, topLevelInfo.options);
    }

    // Generate a wrapped join so that the through table join can be dependent on the target join
    joinBody = `( ${this.quoteTable(throughTable, throughAs)} INNER JOIN ${this.quoteTable(include.model.getTableName(), includeAs.internalAs)} ON ${targetJoinOn}`;
    if (throughWhere) {
      joinBody += ` AND ${throughWhere}`;
    }

    joinBody += ')';
    joinCondition = sourceJoinOn;

    if ((include.where || include.through.where) && include.where) {
      targetWhere = this.getWhereConditions(include.where, this.sequelize.literal(this.quoteIdentifier(includeAs.internalAs)), include.model, topLevelInfo.options);
      if (targetWhere) {
        joinCondition += ` AND ${targetWhere}`;
      }
    }

    this._generateSubQueryFilter(include, includeAs, topLevelInfo);

    return {
      join: joinType,
      body: joinBody,
      condition: joinCondition,
      attributes,
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

    while ((parent = parent.parent)) {
      if (parent.parent && !parent.required) {
        return; // only generate subQueryFilter if all the parents of this include are required
      }

      if (parent.subQueryFilter) {
        // the include is already handled as this parent has the include on its required closure
        // skip to prevent duplicate subQueryFilter
        return;
      }

      nestedIncludes = [{ ...child, include: nestedIncludes, attributes: [] }];
      child = parent;
    }

    const topInclude = nestedIncludes[0];
    const topParent = topInclude.parent;
    const topAssociation = topInclude.association;
    topInclude.association = undefined;

    if (topInclude.through && Object(topInclude.through.model) === topInclude.through.model) {
      query = this.selectQuery(topInclude.through.model.getTableName(), {
        attributes: [topInclude.through.model.primaryKeyField],
        include: _validateIncludedElements({
          model: topInclude.through.model,
          include: [{
            association: topAssociation.fromThroughToTarget,
            required: true,
            where: topInclude.where,
            include: topInclude.include,
          }],
        }).include,
        model: topInclude.through.model,
        where: {
          [Op.and]: [
            this.sequelize.literal([
              `${this.quoteTable(topParent.model.name)}.${this.quoteIdentifier(topParent.model.primaryKeyField)}`,
              `${this.quoteIdentifier(topInclude.through.model.name)}.${this.quoteIdentifier(topAssociation.identifierField)}`,
            ].join(' = ')),
            topInclude.through.where,
          ],
        },
        limit: 1,
        includeIgnoreAttributes: false,
      }, topInclude.through.model);
    } else {
      const isBelongsTo = topAssociation.associationType === 'BelongsTo';
      const sourceField = isBelongsTo ? topAssociation.identifierField : topAssociation.sourceKeyField || topParent.model.primaryKeyField;
      const targetField = isBelongsTo ? topAssociation.sourceKeyField || topInclude.model.primaryKeyField : topAssociation.identifierField;

      const join = [
        `${this.quoteIdentifier(topInclude.as)}.${this.quoteIdentifier(targetField)}`,
        `${this.quoteTable(topParent.as || topParent.model.name)}.${this.quoteIdentifier(sourceField)}`,
      ].join(' = ');

      query = this.selectQuery(topInclude.model.getTableName(), {
        attributes: [targetField],
        include: _validateIncludedElements(topInclude).include,
        model: topInclude.model,
        where: {
          [Op.and]: [
            topInclude.where,
            { [Op.join]: this.sequelize.literal(join) },
          ],
        },
        limit: 1,
        tableAs: topInclude.as,
        includeIgnoreAttributes: false,
      }, topInclude.model);
    }

    if (!topLevelInfo.options.where[Op.and]) {
      topLevelInfo.options.where[Op.and] = [];
    }

    topLevelInfo.options.where[`__${includeAs.internalAs}`] = this.sequelize.literal([
      '(',
      query.replace(/;$/, ''),
      ')',
      'IS NOT NULL',
    ].join(' '));
  }

  /*
   * For a given include hierarchy creates a copy of it where only the required includes
   * are preserved.
   */
  _getRequiredClosure(include) {
    const copy = { ...include, attributes: [], include: [] };

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
          && !isModelStatic(order[0])
          && !isModelStatic(order[0].model)
          && !(typeof order[0] === 'string' && model && model.associations !== undefined && model.associations[order[0]])
        ) {
          // TODO - refactor this.quote() to not change the first argument
          const field = model.rawAttributes[order[0]]?.field || order[0];
          const subQueryAlias = this._getAliasForField(model.name, field, options);

          let parent = null;
          let orderToQuote = [];

          // we need to ensure that the parent is null if we use the subquery alias, else we'll get an exception since
          // "model_name"."alias" doesn't exist - only "alias" does. we also need to ensure that we preserve order direction
          // by pushing order[1] to the subQueryOrder as well - in case it doesn't exist, we want to push "ASC"
          if (subQueryAlias === null) {
            orderToQuote = order;
            parent = model;
          } else {
            orderToQuote = [subQueryAlias, order.length > 1 ? order[1] : 'ASC'];
            parent = null;
          }

          subQueryOrder.push(this.quote(orderToQuote, parent, '->', options));
        }

        // Handle case where renamed attributes are used to order by,
        // see https://github.com/sequelize/sequelize/issues/8739
        // need to check if either of the attribute options match the order
        if (options.attributes && model) {
          const aliasedAttribute = this._getAliasForFieldFromQueryOptions(order[0], options);

          if (aliasedAttribute) {
            const alias = this._getAliasForField(model.name, aliasedAttribute[1], options);

            order[0] = new Col(alias || aliasedAttribute[1]);
          }
        }

        mainQueryOrder.push(this.quote(order, model, '->', options));
      }
    } else if (options.order instanceof SequelizeMethod) {
      const sql = this.quote(options.order, model, '->', options);
      if (subQuery) {
        subQueryOrder.push(sql);
      }

      mainQueryOrder.push(sql);
    } else {
      throw new TypeError('Order must be type of array or instance of a valid sequelize method.');
    }

    return { mainQueryOrder, subQueryOrder };
  }

  _throwOnEmptyAttributes(attributes, extraInfo = {}) {
    if (attributes.length > 0) {
      return;
    }

    const asPart = extraInfo.as && `as ${extraInfo.as}` || '';
    const namePart = extraInfo.modelName && `for model '${extraInfo.modelName}'` || '';
    const message = `Attempted a SELECT query ${namePart} ${asPart} without selecting any columns`;
    throw new sequelizeError.QueryError(message.replace(/ +/g, ' '));
  }

  selectFromTableFragment(options, model, attributes, tables, mainTableAs) {
    this._throwOnEmptyAttributes(attributes, { modelName: model && model.name, as: mainTableAs });

    let fragment = `SELECT ${attributes.join(', ')} FROM ${tables}`;

    if (mainTableAs) {
      fragment += ` AS ${mainTableAs}`;
    }

    if (options.indexHints && this.dialect.supports.indexHints) {
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
   * @param  {object} options An object with selectQuery options.
   * @param {ModelStatic} model
   * @returns {string}         The generated sql query.
   * @private
   */
  addLimitAndOffset(options, model) {
    let fragment = '';
    if (options.limit != null) {
      fragment += ` LIMIT ${this.escape(options.limit, undefined, options)}`;
    } else if (options.offset) {
      // limit must be specified if offset is specified.
      fragment += ` LIMIT 18446744073709551615`;
    }

    if (options.offset) {
      fragment += ` OFFSET ${this.escape(options.offset, undefined, options)}`;
    }

    return fragment;
  }

  handleSequelizeMethod(smth, tableName, factory, options, prepend) {
    let result;

    if (Object.prototype.hasOwnProperty.call(this.OperatorMap, smth.comparator)) {
      smth.comparator = this.OperatorMap[smth.comparator];
    }

    if (smth instanceof Where) {
      let value = smth.logic;
      let key;

      if (smth.attribute instanceof SequelizeMethod) {
        key = this.getWhereConditions(smth.attribute, tableName, factory, options, prepend);
      } else {
        key = `${this.quoteTable(smth.attribute.Model.name)}.${this.quoteIdentifier(smth.attribute.field || smth.attribute.fieldName)}`;
      }

      if (value && value instanceof SequelizeMethod) {
        value = this.getWhereConditions(value, tableName, factory, options, prepend);

        if (value === 'NULL') {
          if (smth.comparator === '=') {
            smth.comparator = 'IS';
          }

          if (smth.comparator === '!=') {
            smth.comparator = 'IS NOT';
          }
        }

        return [key, value].join(` ${smth.comparator} `);
      }

      if (_.isPlainObject(value)) {
        return this.whereItemQuery(smth.attribute, value, {
          model: factory,
        });
      }

      if ([this.OperatorMap[Op.between], this.OperatorMap[Op.notBetween]].includes(smth.comparator)) {
        value = `${this.escape(value[0], undefined, options)} AND ${this.escape(value[1], undefined, options)}`;
      } else if (typeof value === 'boolean') {
        value = this.booleanValue(value);
      } else {
        value = this.escape(value, undefined, options);
      }

      if (value === 'NULL') {
        if (smth.comparator === '=') {
          smth.comparator = 'IS';
        }

        if (smth.comparator === '!=') {
          smth.comparator = 'IS NOT';
        }
      }

      return [key, value].join(` ${smth.comparator} `);
    }

    if (smth instanceof Literal) {
      if (options?.replacements) {
        return injectReplacements(smth.val, this.dialect, options.replacements, {
          onPositionalReplacement: () => {
            throw new TypeError(`The following literal includes positional replacements (?).
Only named replacements (:name) are allowed in literal() because we cannot guarantee the order in which they will be evaluated:
➜ literal(${JSON.stringify(smth.val)})`);
          },
        });
      }

      return smth.val;

    }

    if (smth instanceof Cast) {
      if (smth.val instanceof SequelizeMethod) {
        result = this.handleSequelizeMethod(smth.val, tableName, factory, options, prepend);
      } else if (_.isPlainObject(smth.val)) {
        result = this.whereItemsQuery(smth.val);
      } else {
        result = this.escape(smth.val, undefined, options);
      }

      return `CAST(${result} AS ${smth.type.toUpperCase()})`;
    }

    if (smth instanceof Fn) {
      return `${smth.fn}(${
        smth.args.map(arg => {
          if (arg instanceof SequelizeMethod) {
            return this.handleSequelizeMethod(arg, tableName, factory, options, prepend);
          }

          if (_.isPlainObject(arg)) {
            return this.whereItemsQuery(arg);
          }

          return this.escape(arg, undefined, options);
        }).join(', ')
      })`;
    }

    if (smth instanceof Col) {
      if (Array.isArray(smth.col) && !factory) {
        throw new Error('Cannot call Sequelize.col() with array outside of order / group clause');
      }

      if (smth.col.startsWith('*')) {
        return '*';
      }

      return this.quote(smth.col, factory, undefined, options);
    }

    return smth.toString(this, factory);
  }

  whereQuery(where, options) {
    const query = this.whereItemsQuery(where, options);
    if (query && query.length > 0) {
      return `WHERE ${query}`;
    }

    return '';
  }

  whereItemsQuery(where, options, binding) {
    if (
      where === null
      || where === undefined
      || getComplexSize(where) === 0
    ) {
      // NO OP
      return '';
    }

    if (typeof where === 'string') {
      throw new TypeError('Support for `{where: \'raw query\'}` has been removed.');
    }

    const items = [];

    binding = binding || 'AND';
    if (binding[0] !== ' ') {
      binding = ` ${binding} `;
    }

    if (_.isPlainObject(where)) {
      for (const prop of getComplexKeys(where)) {
        const item = where[prop];
        items.push(this.whereItemQuery(prop, item, options));
      }
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

        return this.whereItemQuery(field.field || keyParts[0], tmp, { field, ...options });
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

    const valueKeys = isPlainObject && getComplexKeys(value);

    if (key === undefined) {
      if (typeof value === 'string') {
        return value;
      }

      if (isPlainObject && valueKeys.length === 1) {
        return this.whereItemQuery(valueKeys[0], value[valueKeys[0]], options);
      }
    }

    if (value === null) {
      const opValue = options.bindParam ? 'NULL' : this.escape(value, field, options);

      return this._joinKeyValue(key, opValue, this.OperatorMap[Op.is], options.prefix);
    }

    if (!value) {
      const opValue = options.bindParam ? this.format(value, field, options, options.bindParam) : this.escape(value, field, options);

      return this._joinKeyValue(key, opValue, this.OperatorMap[Op.eq], options.prefix);
    }

    if (value instanceof SequelizeMethod && !(key !== undefined && value instanceof Fn)) {
      return this.handleSequelizeMethod(value, undefined, undefined, options);
    }

    // Convert where: [] to Op.and if possible, else treat as literal/replacements
    if (key === undefined && isArray) {
      if (canTreatArrayAsAnd(value)) {
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
      const opValue = options.bindParam ? this.format(value, field, options, options.bindParam) : this.escape(value, field, options);

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
      const opValue = options.bindParam ? this.format(value, field, options, options.bindParam) : this.escape(value, field, options);

      return this._joinKeyValue(this.OperatorMap[key], opValue, this.OperatorMap[Op.eq], options.prefix);
    }

    const opValue = options.bindParam ? this.format(value, field, options, options.bindParam) : this.escape(value, field, options);

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
        if (itemQuery && itemQuery.length > 0 && (Array.isArray(item) || _.isPlainObject(item)) && getComplexSize(item) > 1) {
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
      value = getComplexKeys(value).map(prop => {
        const item = value[prop];

        return this.whereItemQuery(key, { [prop]: item }, options);
      });
    } else {
      value = value.map(item => this.whereItemQuery(key, item, options));
    }

    value = value.filter(item => item && item.length);

    return value.length > 0 ? `(${value.join(binding)})` : undefined;
  }

  _whereJSON(key, value, options) {
    const items = [];
    let baseKey = this.quoteIdentifier(key);
    if (options.prefix) {
      if (options.prefix instanceof Literal) {
        baseKey = `${this.handleSequelizeMethod(options.prefix)}.${baseKey}`;
      } else {
        baseKey = `${this.quoteTable(options.prefix)}.${baseKey}`;
      }
    }

    for (const op of getOperators(value)) {
      const where = {
        [op]: value[op],
      };
      items.push(this.whereItemQuery(key, where, { ...options, json: false }));
    }

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

    let pathKey = this.jsonPathExtractionQuery(baseKey, path);

    if (_.isPlainObject(item)) {
      for (const op of getOperators(item)) {
        const value = this._toJSONValue(item[op]);
        let isJson = false;
        if (typeof value === 'string' && op === Op.contains) {
          try {
            JSON.stringify(value);
            isJson = true;
          } catch {
            // failed to parse, is not json so isJson remains false
          }
        }

        pathKey = this.jsonPathExtractionQuery(baseKey, path, isJson);
        items.push(this.whereItemQuery(this._castKey(pathKey, value, cast), { [op]: value }));
      }

      _.forOwn(item, (value, itemProp) => {
        this._traverseJSON(items, baseKey, itemProp, value, [...path, itemProp]);
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
      return new Literal(this.handleSequelizeMethod(new Cast(new Literal(key), cast, json)));
    }

    return new Literal(key);
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
    if (key instanceof SequelizeMethod) {
      key = this.handleSequelizeMethod(key);

      return this._prefixKey(this.handleSequelizeMethod(key), prefix);
    }

    if (isColString(key)) {
      key = key.slice(1, 1 + key.length - 2).split('.');

      if (key.length > 2) {
        key = [
          // join the tables by -> to match out internal namings
          key.slice(0, -1).join('->'),
          key[key.length - 1],
        ];
      }

      return key.map(identifier => this.quoteIdentifier(identifier)).join('.');
    }

    return this._prefixKey(this.quoteIdentifier(key), prefix);
  }

  _prefixKey(key, prefix) {
    if (prefix) {
      if (prefix instanceof Literal) {
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
        if (value instanceof Literal) {
          return this._joinKeyValue(key, value.val, comparator, options.prefix);
        }

        if (value.length > 0) {
          return this._joinKeyValue(key, `(${value.map(item => this.escape(item, field, { where: true, replacements: options.replacements })).join(', ')})`, comparator, options.prefix);
        }

        if (comparator === this.OperatorMap[Op.in]) {
          return this._joinKeyValue(key, '(NULL)', comparator, options.prefix);
        }

        return '';
      case Op.any:
      case Op.all:
        comparator = `${this.OperatorMap[Op.eq]} ${comparator}`;
        if (value[Op.values]) {
          return this._joinKeyValue(key, `(VALUES ${value[Op.values].map(item => `(${this.escape(item, undefined, options)})`).join(', ')})`, comparator, options.prefix);
        }

        return this._joinKeyValue(key, `(${this.escape(value, field, options)})`, comparator, options.prefix);
      case Op.between:
      case Op.notBetween:
        return this._joinKeyValue(key, `${this.escape(value[0], field, options)} AND ${this.escape(value[1], field, options)}`, comparator, options.prefix);
      case Op.raw:
        throw new Error('The `$raw` where property is no longer supported.  Use `sequelize.literal` instead.');
      case Op.col:
        comparator = this.OperatorMap[Op.eq];
        value = value.split('.');

        if (value.length > 2) {
          value = [
            // join the tables by -> to match out internal namings
            value.slice(0, -1).join('->'),
            value[value.length - 1],
          ];
        }

        return this._joinKeyValue(key, value.map(identifier => this.quoteIdentifier(identifier)).join('.'), comparator, options.prefix);
      case Op.startsWith:
      case Op.endsWith:
      case Op.substring:
        comparator = this.OperatorMap[Op.like];
      case Op.notStartsWith:
      case Op.notEndsWith:
      case Op.notSubstring: {
        if (comparator !== this.OperatorMap[Op.like]) {
          comparator = this.OperatorMap[Op.notLike];
        }

        if (value instanceof Literal) {
          value = value.val;
        }

        let pattern = `${value}%`;

        if (prop === Op.endsWith || prop === Op.notEndsWith) {
          pattern = `%${value}`;
        }

        if (prop === Op.substring || prop === Op.notSubstring) {
          pattern = `%${value}%`;
        }

        return this._joinKeyValue(key, this.escape(pattern, undefined, options), comparator, options.prefix);
      }
    }

    const escapeOptions = {
      replacements: options.replacements,
    };

    // because UUID is implemented as CHAR() in most dialects (except postgres)
    //  we accept comparing to non-uuid values when using LIKE and similar operators.
    // TODO: https://github.com/sequelize/sequelize/issues/13828 - in postgres, automatically cast to CHAR(36)
    //  to have the same behavior as the others dialects.
    if (comparator.includes(this.OperatorMap[Op.like]) && field?.type) {
      field = {
        ...field,
        // replace DataType with DataTypes.TEXT() to accept all string values.
        type: getTextDataTypeForDialect(this.dialect),
      };
    }

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

    // In postgres, Op.contains has multiple signatures:
    // - RANGE<VALUE> Op.contains RANGE<VALUE> (both represented by fixed-size arrays in JS)
    // - RANGE<VALUE> Op.contains VALUE
    // - ARRAY<VALUE> Op.contains ARRAY<VALUE>
    // Since the left operand is a RANGE, the type validation must allow the right operand to be either RANGE or VALUE.
    if (prop === Op.contains && field?.type instanceof DataTypes.RANGE && !Array.isArray(value)) {
      // Since the right operand is not an array, it must be a value.
      // We'll serialize using the range's subtype (i.e. if a range of integers, we'll serialize "value" as an integer).
      return this._joinKeyValue(key, this.escape(value, {
        ...field,
        type: field.type.options.subtype,
      }, escapeOptions), comparator, options.prefix);

      // The case where "value" is a 'RANGE<VALUE>' is not a special case and is handled by the default case below.
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

    if (smth && smth instanceof SequelizeMethod) { // Checking a property is cheaper than a lot of instanceof calls
      return this.handleSequelizeMethod(smth, tableName, factory, options, prepend);
    }

    if (_.isPlainObject(smth)) {
      return this.whereItemsQuery(smth, {
        model: factory,
        prefix: prepend && tableName,
        type: options.type,
        replacements: options.replacements,
      });
    }

    if (typeof smth === 'number' || typeof smth === 'bigint') {
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
        prefix: prepend && tableName,
        replacements: options.replacements,
      });
    }

    if (typeof smth === 'string') {
      return this.whereItemsQuery(smth, {
        model: factory,
        prefix: prepend && tableName,
        replacements: options.replacements,
      });
    }

    if (Buffer.isBuffer(smth)) {
      return this.escape(smth, undefined, options);
    }

    if (Array.isArray(smth)) {
      if (smth.length === 0 || smth.length > 0 && smth[0].length === 0) {
        return '1=1';
      }

      if (canTreatArrayAsAnd(smth)) {
        const _smth = { [Op.and]: smth };

        return this.getWhereConditions(_smth, tableName, factory, options, prepend);
      }

      throw new Error('Support for literal replacements in the `where` object has been removed.');
    }

    if (smth === null) {
      return this.whereItemsQuery(smth, {
        model: factory,
        prefix: prepend && tableName,
        replacements: options.replacements,
      });
    }

    throw new Error(`Unsupported where option value: ${NodeUtil.inspect(smth)}. Please refer to the Sequelize documentation to learn more about which values are accepted as part of the where option.`);
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

Object.assign(AbstractQueryGenerator.prototype, require('./query-generator/operators'));
Object.assign(AbstractQueryGenerator.prototype, require('./query-generator/transaction'));
