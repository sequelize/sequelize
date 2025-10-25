'use strict';

import compact from 'lodash/compact';
import defaults from 'lodash/defaults';
import each from 'lodash/each';
import forOwn from 'lodash/forOwn';
import get from 'lodash/get';
import isEmpty from 'lodash/isEmpty';
import isObject from 'lodash/isObject';
import isPlainObject from 'lodash/isPlainObject';
import pick from 'lodash/pick';
import reduce from 'lodash/reduce';
import uniq from 'lodash/uniq';
import NodeUtil from 'node:util';
import { Association } from '../associations/base';
import { BelongsToAssociation } from '../associations/belongs-to';
import { BelongsToManyAssociation } from '../associations/belongs-to-many';
import { HasManyAssociation } from '../associations/has-many';
import { ParameterStyle } from '../enums.js';
import { BaseSqlExpression } from '../expression-builders/base-sql-expression.js';
import { Col } from '../expression-builders/col.js';
import { Literal } from '../expression-builders/literal.js';
import { conformIndex } from '../model-internals';
import { and } from '../sequelize';
import { mapFinderOptions, removeNullishValuesFromHash } from '../utils/format';
import { joinSQLFragments } from '../utils/join-sql-fragments';
import { isModelStatic } from '../utils/model-utils';
import { createBindParamGenerator } from '../utils/sql.js';
import { nameIndex, spliceStr } from '../utils/string';
import { attributeTypeToSql } from './data-types-utils';
import { AbstractQueryGeneratorInternal } from './query-generator-internal.js';
import { AbstractQueryGeneratorTypeScript } from './query-generator-typescript';
import { joinWithLogicalOperator } from './where-sql-builder';

const util = require('node:util');
const crypto = require('node:crypto');

const DataTypes = require('../data-types');
const { Op } = require('../operators');
const sequelizeError = require('../errors');
const { _validateIncludedElements } = require('../model-internals');

export const CREATE_TABLE_QUERY_SUPPORTABLE_OPTIONS = new Set([
  'collate',
  'charset',
  'engine',
  'rowFormat',
  'comment',
  'initialAutoIncrement',
  'uniqueKeys',
]);
export const ADD_COLUMN_QUERY_SUPPORTABLE_OPTIONS = new Set(['ifNotExists']);

/**
 * Abstract Query Generator
 *
 * @private
 */
export class AbstractQueryGenerator extends AbstractQueryGeneratorTypeScript {
  #internals;

  constructor(dialect, internals = new AbstractQueryGeneratorInternal(dialect)) {
    super(dialect, internals);
    this.#internals = internals;
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
    options ||= {};
    defaults(options, this.options);
    if ('bindParam' in options) {
      throw new Error('The bindParam option has been removed. Use parameterStyle instead.');
    }

    const modelAttributeMap = {};
    const fields = [];
    const returningModelAttributes = [];
    const values = Object.create(null);
    const quotedTable = this.quoteTable(table);
    let bind;
    let bindParam;
    let parameterStyle = options?.parameterStyle ?? ParameterStyle.BIND;
    let query;
    let valueQuery = '';
    let emptyQuery = '';
    let outputFragment = '';
    let returningFragment = '';
    let identityWrapperRequired = false;
    let tmpTable = ''; // tmpTable declaration for trigger

    if (modelAttributes) {
      each(modelAttributes, (attribute, key) => {
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

    if (get(this, ['sequelize', 'options', 'prependSearchPath']) || options.searchPath) {
      // Not currently supported with search path (requires output of multiple queries)
      parameterStyle = ParameterStyle.REPLACEMENT;
    }

    if (this.dialect.supports.EXCEPTION && options.exception) {
      // Not currently supported with bind parameters (requires output of multiple queries)
      parameterStyle = ParameterStyle.REPLACEMENT;
    }

    if (parameterStyle === ParameterStyle.BIND) {
      bind = Object.create(null);
      bindParam = createBindParamGenerator(bind);
    }

    valueHash = removeNullishValuesFromHash(valueHash, this.options.omitNull);
    for (const key in valueHash) {
      if (Object.hasOwn(valueHash, key)) {
        // if value is undefined, we replace it with null
        const value = valueHash[key] ?? null;
        fields.push(this.quoteIdentifier(key));

        // SERIALS' can't be NULL in postgresql, use DEFAULT where supported
        if (
          modelAttributeMap[key] &&
          modelAttributeMap[key].autoIncrement === true &&
          value == null
        ) {
          if (!this.dialect.supports.autoIncrement.defaultValue) {
            fields.splice(-1, 1);
          } else if (this.dialect.supports.DEFAULT) {
            values[key] = 'DEFAULT';
          } else {
            values[key] = this.escape(null);
          }
        } else {
          if (modelAttributeMap[key] && modelAttributeMap[key].autoIncrement === true) {
            identityWrapperRequired = true;
          }

          values[key] = this.escape(value, {
            model: options.model,
            type: modelAttributeMap[key]?.type,
            replacements: options.replacements,
            bindParam,
          });
        }
      }
    }

    let onDuplicateKeyUpdate = '';

    if (!isEmpty(options.conflictWhere) && !this.dialect.supports.inserts.onConflictWhere) {
      throw new Error('missing dialect support for conflictWhere option');
    }

    // `options.updateOnDuplicate` is the list of field names to update if a duplicate key is hit during the insert.  It
    // contains just the field names.  This option is _usually_ explicitly set by the corresponding query-interface
    // upsert function.
    if (this.dialect.supports.inserts.updateOnDuplicate && options.updateOnDuplicate) {
      if (this.dialect.supports.inserts.updateOnDuplicate === ' ON CONFLICT DO UPDATE SET') {
        // postgres / sqlite
        // If no conflict target columns were specified, use the primary key names from options.upsertKeys
        const conflictKeys = options.upsertKeys.map(attr => this.quoteIdentifier(attr));
        const updateKeys = options.updateOnDuplicate.map(
          attr => `${this.quoteIdentifier(attr)}=EXCLUDED.${this.quoteIdentifier(attr)}`,
        );

        const fragments = ['ON CONFLICT', '(', conflictKeys.join(','), ')'];

        if (!isEmpty(options.conflictWhere)) {
          fragments.push(this.whereQuery(options.conflictWhere, options));
        }

        // if update keys are provided, then apply them here.  if there are no updateKeys provided, then do not try to
        // do an update.  Instead, fall back to DO NOTHING.
        if (isEmpty(updateKeys)) {
          fragments.push('DO NOTHING');
        } else {
          fragments.push('DO UPDATE SET', updateKeys.join(','));
        }

        onDuplicateKeyUpdate = ` ${joinSQLFragments(fragments)}`;
      } else {
        const valueKeys = options.updateOnDuplicate.map(
          attr => `${this.quoteIdentifier(attr)}=${values[attr]}`,
        );
        // the rough equivalent to ON CONFLICT DO NOTHING in mysql, etc is ON DUPLICATE KEY UPDATE id = id
        // So, if no update values were provided, fall back to the identifier columns provided in the upsertKeys array.
        // This will be the primary key in most cases, but it could be some other constraint.
        if (isEmpty(valueKeys) && options.upsertKeys) {
          valueKeys.push(
            ...options.upsertKeys.map(
              attr => `${this.quoteIdentifier(attr)}=${this.quoteIdentifier(attr)}`,
            ),
          );
        }

        // edge case... but if for some reason there were no valueKeys, and there were also no upsertKeys... then we
        // can no longer build the requested query without a syntax error.  Let's throw something more graceful here
        // so the devs know what the problem is.
        if (isEmpty(valueKeys)) {
          throw new Error(
            'No update values found for ON DUPLICATE KEY UPDATE clause, and no identifier fields could be found to use instead.',
          );
        }

        onDuplicateKeyUpdate += `${this.dialect.supports.inserts.updateOnDuplicate} ${valueKeys.join(',')}`;
      }
    }

    const replacements = {
      ignoreDuplicates: options.ignoreDuplicates
        ? this.dialect.supports.inserts.ignoreDuplicates
        : '',
      onConflictDoNothing: options.ignoreDuplicates
        ? this.dialect.supports.inserts.onConflictDoNothing
        : '',
      attributes: fields.join(','),
      output: outputFragment,
      values: Object.values(values).join(','),
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

      const delimiter = `$func_${crypto.randomUUID().replaceAll('-', '')}$`;
      const selectQuery = `SELECT (testfunc.response).${returningModelAttributes.join(', (testfunc.response).')}, testfunc.sequelize_caught_exception FROM pg_temp.testfunc();`;

      options.exception =
        'WHEN unique_violation THEN GET STACKED DIAGNOSTICS sequelize_caught_exception = PG_EXCEPTION_DETAIL;';
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
    if (parameterStyle === ParameterStyle.BIND) {
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
    options ||= {};
    fieldMappedAttributes ||= {};

    const tuples = [];
    const serials = {};
    const allAttributes = [];
    let onDuplicateKeyUpdate = '';

    for (const fieldValueHash of fieldValueHashes) {
      forOwn(fieldValueHash, (value, key) => {
        if (!allAttributes.includes(key)) {
          allAttributes.push(key);
        }

        if (fieldMappedAttributes[key] && fieldMappedAttributes[key].autoIncrement === true) {
          serials[key] = true;
        }
      });
    }

    for (const fieldValueHash of fieldValueHashes) {
      const values = allAttributes.map(key => {
        if (this.dialect.supports.bulkDefault && serials[key] === true) {
          // fieldValueHashes[key] ?? 'DEFAULT'
          return fieldValueHash[key] != null ? fieldValueHash[key] : 'DEFAULT';
        }

        return this.escape(fieldValueHash[key] ?? null, {
          // model // TODO: make bulkInsertQuery accept model instead of fieldValueHashes
          // bindParam // TODO: support bind params
          type: fieldMappedAttributes[key]?.type,
          replacements: options.replacements,
        });
      });

      tuples.push(`(${values.join(',')})`);
    }

    // `options.updateOnDuplicate` is the list of field names to update if a duplicate key is hit during the insert.  It
    // contains just the field names.  This option is _usually_ explicitly set by the corresponding query-interface
    // upsert function.
    if (this.dialect.supports.inserts.updateOnDuplicate && options.updateOnDuplicate) {
      if (this.dialect.supports.inserts.updateOnDuplicate === ' ON CONFLICT DO UPDATE SET') {
        // postgres / sqlite
        // If no conflict target columns were specified, use the primary key names from options.upsertKeys
        const conflictKeys = options.upsertKeys.map(attr => this.quoteIdentifier(attr));
        const updateKeys = options.updateOnDuplicate.map(
          attr => `${this.quoteIdentifier(attr)}=EXCLUDED.${this.quoteIdentifier(attr)}`,
        );

        let whereClause = false;
        if (options.conflictWhere) {
          if (!this.dialect.supports.inserts.onConflictWhere) {
            throw new Error(`conflictWhere not supported for dialect ${this.dialect.name}`);
          }

          whereClause = this.whereQuery(options.conflictWhere, options);
        }

        // The Utils.joinSQLFragments later on will join this as it handles nested arrays.
        onDuplicateKeyUpdate = [
          'ON CONFLICT',
          '(',
          conflictKeys.join(','),
          ')',
          whereClause,
          'DO UPDATE SET',
          updateKeys.join(','),
        ];
      } else {
        // mysql / maria
        if (options.conflictWhere) {
          throw new Error(`conflictWhere not supported for dialect ${this.dialect.name}`);
        }

        const valueKeys = options.updateOnDuplicate.map(
          attr => `${this.quoteIdentifier(attr)}=VALUES(${this.quoteIdentifier(attr)})`,
        );
        onDuplicateKeyUpdate = `${this.dialect.supports.inserts.updateOnDuplicate} ${valueKeys.join(',')}`;
      }
    }

    const ignoreDuplicates = options.ignoreDuplicates
      ? this.dialect.supports.inserts.ignoreDuplicates
      : '';
    const attributes = allAttributes.map(attr => this.quoteIdentifier(attr)).join(',');
    const onConflictDoNothing = options.ignoreDuplicates
      ? this.dialect.supports.inserts.onConflictDoNothing
      : '';
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
    options ||= {};
    defaults(options, this.options);
    if ('bindParam' in options) {
      throw new Error('The bindParam option has been removed. Use parameterStyle instead.');
    }

    attrValueHash = removeNullishValuesFromHash(attrValueHash, options.omitNull, options);

    const values = [];
    const modelAttributeMap = {};
    let bind;
    let bindParam;
    let parameterStyle = options?.parameterStyle ?? ParameterStyle.BIND;
    let outputFragment = '';
    let tmpTable = ''; // tmpTable declaration for trigger
    let suffix = '';

    if (get(this, ['sequelize', 'options', 'prependSearchPath']) || options.searchPath) {
      // Not currently supported with search path (requires output of multiple queries)
      parameterStyle = ParameterStyle.REPLACEMENT;
    }

    if (parameterStyle === ParameterStyle.BIND) {
      bind = Object.create(null);
      bindParam = createBindParamGenerator(bind);
    }

    if (
      this.dialect.supports['LIMIT ON UPDATE'] &&
      options.limit &&
      this.dialect.name !== 'mssql' &&
      this.dialect.name !== 'db2'
    ) {
      // TODO: use bind parameter
      suffix = ` LIMIT ${this.escape(options.limit, options)} `;
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
      each(columnDefinitions, (attribute, key) => {
        modelAttributeMap[key] = attribute;
        if (attribute.field) {
          modelAttributeMap[attribute.field] = attribute;
        }
      });
    }

    for (const key in attrValueHash) {
      if (
        modelAttributeMap &&
        modelAttributeMap[key] &&
        modelAttributeMap[key].autoIncrement === true &&
        !this.dialect.supports.autoIncrement.update
      ) {
        // not allowed to update identity column
        continue;
      }

      const value = attrValueHash[key] ?? null;

      values.push(
        `${this.quoteIdentifier(key)}=${this.escape(value, {
          // model // TODO: receive modelDefinition instead of columnDefinitions
          type: modelAttributeMap?.[key]?.type,
          replacements: options.replacements,
          bindParam,
        })}`,
      );
    }

    const whereOptions = { ...options, bindParam };

    if (values.length === 0) {
      return { query: '' };
    }

    const query =
      `${tmpTable}UPDATE ${this.quoteTable(tableName)} SET ${values.join(',')}${outputFragment} ${this.whereQuery(where, whereOptions)}${suffix}`.trim();

    // Used by Postgres upsertQuery and calls to here with options.exception set to true
    const result = { query };
    if (parameterStyle === ParameterStyle.BIND) {
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
   * @param {object} incrementAmountsByAttribute     A plain-object with attribute-value-pairs
   * @param {object} extraAttributesToBeUpdated  A plain-object with attribute-value-pairs
   * @param {object} options
   *
   * @private
   */
  arithmeticQuery(
    operator,
    tableName,
    where,
    incrementAmountsByAttribute,
    extraAttributesToBeUpdated,
    options,
  ) {
    // TODO: this method should delegate to `updateQuery`

    options ||= {};
    defaults(options, { returning: true });
    const { model } = options;

    // TODO: add attribute DataType
    // TODO: add model
    const escapeOptions = pick(options, ['replacements', 'model']);

    extraAttributesToBeUpdated = removeNullishValuesFromHash(
      extraAttributesToBeUpdated,
      this.options.omitNull,
    );

    let outputFragment = '';
    let returningFragment = '';

    if (this.dialect.supports.returnValues && options.returning) {
      const returnValues = this.generateReturnValues(null, options);

      outputFragment = returnValues.outputFragment;
      returningFragment = returnValues.returningFragment;
    }

    const updateSetSqlFragments = [];
    for (const attributeName in incrementAmountsByAttribute) {
      const columnName = model
        ? model.modelDefinition.getColumnNameLoose(attributeName)
        : attributeName;
      const incrementAmount = incrementAmountsByAttribute[columnName];
      const quotedField = this.quoteIdentifier(columnName);
      const escapedAmount = this.escape(incrementAmount, escapeOptions);
      updateSetSqlFragments.push(`${quotedField}=${quotedField}${operator} ${escapedAmount}`);
    }

    for (const attributeName in extraAttributesToBeUpdated) {
      const columnName = model
        ? model.modelDefinition.getColumnNameLoose(attributeName)
        : attributeName;

      const newValue = extraAttributesToBeUpdated[columnName];
      const quotedField = this.quoteIdentifier(columnName);
      const escapedValue = this.escape(newValue, escapeOptions);
      updateSetSqlFragments.push(`${quotedField}=${escapedValue}`);
    }

    return joinSQLFragments([
      'UPDATE',
      this.quoteTable(tableName),
      'SET',
      updateSetSqlFragments.join(','),
      outputFragment,
      this.whereQuery(where, escapeOptions),
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
    options ||= {};

    if (!Array.isArray(attributes)) {
      options = attributes;
      attributes = undefined;
    } else {
      options.fields = attributes;
    }

    options.prefix = options.prefix || rawTablename || tableName;
    if (options.prefix && typeof options.prefix === 'string') {
      options.prefix = options.prefix.replaceAll('.', '_');
    }

    const fieldsSql = options.fields.map(field => {
      if (field instanceof BaseSqlExpression) {
        return this.formatSqlExpression(field);
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
        throw new Error(
          `The include attribute for indexes is not supported by ${this.dialect.name} dialect`,
        );
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

    options = conformIndex(options);

    if (!this.dialect.supports.index.type) {
      delete options.type;
    }

    if (options.where) {
      options.where = this.whereQuery(options.where);
    }

    const escapedTableName = this.quoteTable(tableName);

    const concurrently =
      this.dialect.supports.index.concurrently && options.concurrently ? 'CONCURRENTLY' : undefined;
    let ind;
    if (this.dialect.supports.indexViaAlter) {
      ind = ['ALTER TABLE', escapedTableName, concurrently, 'ADD'];
    } else {
      ind = ['CREATE'];
    }

    // DB2 incorrectly scopes the index if we don't specify the schema name,
    // which will cause it to error if another schema contains a table that uses an index with an identical name
    const escapedIndexName =
      tableName.schema && this.dialect.name === 'db2'
        ? // 'quoteTable' isn't the best name: it quotes any identifier.
          // in this case, the goal is to produce '"schema_name"."index_name"' to scope the index in this schema
          this.quoteTable({
            schema: tableName.schema,
            tableName: options.name,
          })
        : this.quoteIdentifiers(options.name);

    ind = ind.concat(
      options.unique ? 'UNIQUE' : '',
      options.type,
      'INDEX',
      !this.dialect.supports.indexViaAlter ? concurrently : undefined,
      escapedIndexName,
      this.dialect.supports.index.using === 1 && options.using ? `USING ${options.using}` : '',
      !this.dialect.supports.indexViaAlter ? `ON ${escapedTableName}` : undefined,
      this.dialect.supports.index.using === 2 && options.using ? `USING ${options.using}` : '',
      `(${fieldsSql.join(', ')})`,
      this.dialect.supports.index.parser && options.parser
        ? `WITH PARSER ${options.parser}`
        : undefined,
      this.dialect.supports.index.include && options.include ? includeSql : undefined,
      this.dialect.supports.index.where && options.where ? options.where : undefined,
    );

    return compact(ind).join(' ');
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
          } else if (isPlainObject(item) && item.model && isModelStatic(item.model)) {
            // set
            model = item.model;
            as = item.as;
          }

          if (model) {
            // set the as to either the through name or the model name
            if (
              !as &&
              previousAssociation &&
              previousAssociation instanceof Association &&
              previousAssociation.through?.model === model
            ) {
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
              throw new TypeError(
                `Unable to find a valid association between models "${previousModel.name}" and "${model.name}"`,
              );
            }
          }
        }

        if (typeof item === 'string') {
          // get order index
          const orderIndex = validOrderOptions.indexOf(item.toUpperCase());

          // see if this is an order
          if (index > 0 && orderIndex !== -1) {
            item = new Literal(` ${validOrderOptions[orderIndex]}`);
          } else if (isModelStatic(previousModel)) {
            const { modelDefinition: previousModelDefinition } = previousModel;

            // only go down this path if we have previous model and check only once
            if (previousModel.associations?.[item]) {
              // convert the item to an association
              item = previousModel.associations[item];
            } else if (previousModelDefinition.attributes.has(item)) {
              // convert the item attribute from its alias
              item = previousModelDefinition.attributes.get(item).columnName;
            } else if (item.includes('.')) {
              const itemSplit = item.split('.');

              const jsonAttribute = previousModelDefinition.attributes.get(itemSplit[0]);
              if (jsonAttribute.type instanceof DataTypes.JSON) {
                // just quote identifiers for now
                const identifier = this.quoteIdentifiers(
                  `${previousModel.name}.${jsonAttribute.columnName}`,
                );

                // get path
                const path = itemSplit.slice(1);

                // extract path
                item = this.jsonPathExtractionQuery(identifier, path);

                // literal because we don't want to append the model name when string
                item = new Literal(item);
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
        if (typeof item === 'string' || item._modelAttribute || item instanceof BaseSqlExpression) {
          break;
        } else if (item instanceof Association) {
          const previousAssociation = collection[i - 1];

          // BelongsToManyAssociation.throughModel are a special case. We want
          //  through model to be loaded under the model's name instead of the association name,
          //  because we want them to be available under the model's name in the entity's data.
          if (
            previousAssociation instanceof BelongsToManyAssociation &&
            item === previousAssociation.fromSourceToThroughOne
          ) {
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

    if (collection instanceof BaseSqlExpression) {
      return this.formatSqlExpression(collection, options);
    }

    if (isPlainObject(collection) && collection.raw) {
      // simple objects with raw is no longer supported
      throw new Error(
        'The `{raw: "..."}` syntax is no longer supported.  Use `sequelize.literal` instead.',
      );
    }

    throw new Error(`Unknown structure passed to order / group: ${util.inspect(collection)}`);
  }

  /**
   * Split a list of identifiers by "." and quote each part.
   *
   * ⚠️ You almost certainly want to use `quoteIdentifier` instead!
   * This method splits the identifier by "." into multiple identifiers, and has special meaning for "*".
   * This behavior should never be the default and should be explicitly opted into by using {@link sql.col}.
   *
   * @param {string} identifiers
   *
   * @returns {string}
   */
  quoteIdentifiers(identifiers) {
    if (identifiers.includes('.')) {
      identifiers = identifiers.split('.');

      const head = identifiers.slice(0, -1).join('->');
      const tail = identifiers.at(-1);

      return `${this.quoteIdentifier(head)}.${tail === '*' ? '*' : this.quoteIdentifier(tail)}`;
    }

    if (identifiers === '*') {
      return '*';
    }

    return this.quoteIdentifier(identifiers);
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
    options ||= {};
    const limit = options.limit;
    const mainQueryItems = [];
    const subQueryItems = [];
    const subQuery =
      options.subQuery === undefined ? limit && options.hasMultiAssociation : options.subQuery;
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
    if (options.minifyAliases && !options.aliasesMapping) {
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

    mainTable.quotedName = !Array.isArray(mainTable.name)
      ? this.quoteTable(mainTable.name, { ...options, alias: mainTable.as ?? false })
      : tableName
          .map(t => {
            return Array.isArray(t)
              ? this.quoteTable(t[0], { ...options, alias: t[1] })
              : this.quoteTable(t, { ...options, alias: true });
          })
          .join(', ');

    const mainModelDefinition = mainTable.model?.modelDefinition;
    const mainModelAttributes = mainModelDefinition?.attributes;

    if (subQuery && attributes.main) {
      for (const pkAttrName of mainModelDefinition.primaryKeysAttributeNames) {
        // Check if mainAttributes contain the primary key of the model either as a field or an aliased field
        if (
          !attributes.main.some(
            attr => pkAttrName === attr || pkAttrName === attr[0] || pkAttrName === attr[1],
          )
        ) {
          const attribute = mainModelAttributes.get(pkAttrName);
          attributes.main.push(
            attribute.columnName !== pkAttrName ? [pkAttrName, attribute.columnName] : pkAttrName,
          );
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

        const joinQueries = this.generateInclude(
          include,
          { externalAs: mainTable.as, internalAs: mainTable.as },
          topLevelInfo,
          { replacements: options.replacements, minifyAliases: options.minifyAliases },
        );

        subJoinQueries = subJoinQueries.concat(joinQueries.subQuery);
        mainJoinQueries = mainJoinQueries.concat(joinQueries.mainQuery);

        if (joinQueries.attributes.main.length > 0) {
          attributes.main = uniq(attributes.main.concat(joinQueries.attributes.main));
        }

        if (joinQueries.attributes.subQuery.length > 0) {
          attributes.subQuery = uniq(attributes.subQuery.concat(joinQueries.attributes.subQuery));
        }
      }
    }

    if (subQuery) {
      subQueryItems.push(
        this.selectFromTableFragment(
          options,
          mainTable.model,
          attributes.subQuery,
          mainTable.quotedName,
          mainTable.quotedAs,
        ),
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

        let where = { ...options.where };
        let groupedLimitOrder;
        let whereKey;
        let include;
        let groupedTableName = mainTable.as;

        if (typeof options.groupedLimit.on === 'string') {
          whereKey = options.groupedLimit.on;
        } else if (options.groupedLimit.on instanceof HasManyAssociation) {
          whereKey = options.groupedLimit.on.identifierField;
        }

        // TODO: do not use a placeholder!
        const placeholder = '"$PLACEHOLDER$" = true';

        if (options.groupedLimit.on instanceof BelongsToManyAssociation) {
          // BTM includes needs to join the through table on to check ID
          groupedTableName = options.groupedLimit.on.throughModel.name;

          const groupedLimitOptions = _validateIncludedElements({
            include: [
              {
                as: options.groupedLimit.on.throughModel.name,
                association: options.groupedLimit.on.fromSourceToThrough,
                duplicating: false, // The UNION'ed query may contain duplicates, but each sub-query cannot
                required: true,
                where: and(new Literal(placeholder), options.groupedLimit.through?.where),
              },
            ],
            model,
          });

          // Make sure attributes from the join table are mapped back to models
          options.hasJoin = true;
          options.hasMultiAssociation = true;
          options.includeMap = Object.assign(groupedLimitOptions.includeMap, options.includeMap);
          options.includeNames = groupedLimitOptions.includeNames.concat(
            options.includeNames || [],
          );
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
              alias = new Literal(this.quote(alias, undefined, undefined, options));

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
          where = and(new Literal(placeholder), where);
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
            minifyAliases: options.minifyAliases,
            aliasesMapping: options.aliasesMapping,
            aliasesByTable: options.aliasesByTable,
            where,
            include,
            model,
          },
          model,
        ).replace(/;$/, '')}) AS sub`; // Every derived table must have its own alias
        const splicePos = baseQuery.indexOf(placeholder);

        mainQueryItems.push(
          this.selectFromTableFragment(
            options,
            mainTable.model,
            attributes.main,
            `(${options.groupedLimit.values
              .map(value => {
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

                return spliceStr(
                  baseQuery,
                  splicePos,
                  placeholder.length,
                  this.whereItemsQuery(groupWhere, { ...options, mainAlias: groupedTableName }),
                );
              })
              .join(this.dialect.supports['UNION ALL'] ? ' UNION ALL ' : ' UNION ')})`,
            mainTable.quotedAs,
          ),
        );
      } else {
        mainQueryItems.push(
          this.selectFromTableFragment(
            options,
            mainTable.model,
            attributes.main,
            mainTable.quotedName,
            mainTable.quotedAs,
          ),
        );
      }

      mainQueryItems.push(mainJoinQueries.join(''));
    }

    // Add WHERE to sub or main query
    if (Object.hasOwn(options, 'where') && !options.groupedLimit) {
      options.where = this.whereItemsQuery(options.where, {
        ...options,
        model,
        mainAlias: mainTable.as || tableName,
      });

      if (options.where) {
        if (subQuery) {
          subQueryItems.push(` WHERE ${options.where}`);
        } else {
          mainQueryItems.push(` WHERE ${options.where}`);
          // Walk the main query to update all selects
          for (const [key, value] of mainQueryItems.entries()) {
            if (value.startsWith('SELECT')) {
              mainQueryItems[key] = this.selectFromTableFragment(
                options,
                model,
                attributes.main,
                mainTable.quotedName,
                mainTable.quotedAs,
                options.where,
              );
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
    if (Object.hasOwn(options, 'having')) {
      options.having = this.whereItemsQuery(options.having, {
        ...options,
        model,
        mainAlias: mainTable.as || tableName,
      });

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
      } else if (!subQuery && (options.limit != null || options.offset)) {
        if (!isModelStatic(model)) {
          throw new Error('Cannot use offset or limit without a model or order being set');
        }

        // Always order by primary key if order is not specified and limit/offset is not null
        const pks = [];
        for (const pkAttrName of mainModelDefinition.primaryKeysAttributeNames) {
          const attribute = mainModelAttributes.get(pkAttrName);
          pks.push(attribute.columnName !== pkAttrName ? attribute.columnName : pkAttrName);
        }

        mainQueryItems.push(
          ` ORDER BY ${pks.map(pk => `${mainTable.quotedAs}.${this.quoteIdentifier(pk)}`).join(', ')}`,
        );
      }

      if (orders.subQueryOrder.length > 0) {
        subQueryItems.push(` ORDER BY ${orders.subQueryOrder.join(', ')}`);
      } else if (subQuery && (options.limit != null || options.offset)) {
        if (!isModelStatic(model)) {
          throw new Error('Cannot use offset or limit without a model or order being set');
        }

        // Always order by primary key if order is not specified and limit/offset is not null
        const pks = [];
        for (const pkAttrName of mainModelDefinition.primaryKeysAttributeNames) {
          const attribute = mainModelAttributes.get(pkAttrName);
          pks.push(attribute.columnName !== pkAttrName ? attribute.columnName : pkAttrName);
        }

        subQueryItems.push(
          ` ORDER BY ${pks.map(pk => `${mainTable.quotedAs}.${this.quoteIdentifier(pk)}`).join(', ')}`,
        );
      }
    } else if (options.limit != null || options.offset) {
      if (!isModelStatic(model)) {
        throw new Error('Cannot use offset or limit without a model or order being set');
      }

      // Always order by primary key if order is not specified and limit/offset is not null
      const pks = [];
      for (const pkAttrName of mainModelDefinition.primaryKeysAttributeNames) {
        const attribute = mainModelAttributes.get(pkAttrName);
        pks.push(attribute.columnName !== pkAttrName ? attribute.columnName : pkAttrName);
      }

      if (subQuery) {
        subQueryItems.push(
          ` ORDER BY ${pks.map(pk => `${mainTable.quotedAs}.${this.quoteIdentifier(pk)}`).join(', ')}`,
        );
      } else {
        mainQueryItems.push(
          ` ORDER BY ${pks.map(pk => `${mainTable.quotedAs}.${this.quoteIdentifier(pk)}`).join(', ')}`,
        );
      }
    }

    // Add LIMIT, OFFSET to sub or main query
    const limitOrder = this.#internals.addLimitAndOffset(options);
    if (limitOrder && !options.groupedLimit) {
      if (subQuery) {
        subQueryItems.push(limitOrder);
      } else {
        mainQueryItems.push(limitOrder);
      }
    }

    if (subQuery) {
      this._throwOnEmptyAttributes(attributes.main, {
        modelName: model && model.name,
        as: mainTable.quotedAs,
      });
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

    return this.quote(
      this._getAliasForField(tableName, src, options) || src,
      model,
      undefined,
      options,
    );
  }

  escapeAttributes(attributes, options, mainTableAs) {
    const quotedMainTableAs = mainTableAs && this.quoteIdentifier(mainTableAs);

    return (
      attributes &&
      attributes.map(attr => {
        let addTable = true;

        if (attr instanceof BaseSqlExpression) {
          return this.formatSqlExpression(attr, options);
        }

        if (Array.isArray(attr)) {
          if (attr.length !== 2) {
            throw new Error(
              `${JSON.stringify(attr)} is not a valid attribute definition. Please use the following format: ['attribute definition', 'alias']`,
            );
          }

          attr = [...attr];

          if (attr[0] instanceof BaseSqlExpression) {
            attr[0] = this.formatSqlExpression(attr[0], options);
            addTable = false;
          } else {
            attr[0] = this.quoteIdentifier(attr[0]);
          }

          let alias = attr[1];

          if (options.minifyAliases) {
            alias = this._getMinifiedAlias(alias, mainTableAs, options);
          }

          attr = [attr[0], this.quoteIdentifier(alias)].join(' AS ');
        } else {
          attr = this.quoteIdentifier(attr, options.model);
        }

        if (!isEmpty(options.include) && (!attr.includes('.') || options.dotNotation) && addTable) {
          attr = `${quotedMainTableAs}.${attr}`;
        }

        return attr;
      })
    );
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

    // Index hints should not be passed down to any include subqueries
    if (topLevelInfo.options && topLevelInfo.options.indexHints) {
      delete topLevelInfo.options.indexHints;
    }

    if (
      topLevelInfo.names.name !== parentTableName.externalAs &&
      topLevelInfo.names.as !== parentTableName.externalAs
    ) {
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
          if (attr[0] instanceof BaseSqlExpression) {
            verbatim = true;
          }

          attr = attr.map(attrPart => {
            return attrPart instanceof BaseSqlExpression
              ? this.formatSqlExpression(attrPart, options)
              : attrPart;
          });

          attrAs = attr[1];
          attr = attr[0];
        }

        if (attr instanceof Literal) {
          // We trust the user to rename the field correctly
          return this.#internals.formatLiteral(attr, options);
        }

        if (attr instanceof BaseSqlExpression) {
          throw new TypeError(
            `Tried to select attributes using ${attr.constructor.name} without specifying an alias for the result, during eager loading. This means the attribute will not be added to the returned instance`,
          );
        }

        let prefix;
        if (verbatim === true) {
          prefix = attr;
        } else if (/#>>|->>/.test(attr)) {
          prefix = `(${this.quoteIdentifier(includeAs.internalAs)}.${attr.replaceAll(/\(|\)/g, '')})`;
        } else if (/json_extract\(/.test(attr)) {
          prefix = attr.replace(
            /json_extract\(/i,
            `json_extract(${this.quoteIdentifier(includeAs.internalAs)}.`,
          );
        } else {
          prefix = `${this.quoteIdentifier(includeAs.internalAs)}.${this.quoteIdentifier(attr)}`;
        }

        let alias = `${includeAs.externalAs}.${attrAs}`;

        if (options.minifyAliases) {
          alias = this._getMinifiedAlias(alias, includeAs.internalAs, topLevelInfo.options);
        }

        return joinSQLFragments([prefix, 'AS', this.quoteIdentifier(alias, true)]);
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
      joinQuery = this.generateThroughJoin(
        include,
        includeAs,
        parentTableName.internalAs,
        topLevelInfo,
        { minifyAliases: options.minifyAliases },
      );
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

        const childOriginalSubQuery = childInclude.subQuery;

        if (childInclude.subQuery && (!include.subQuery || !topLevelInfo.subQuery)) {
          childInclude.subQuery = false;
        }

        const childJoinQueries = this.generateInclude(
          childInclude,
          includeAs,
          topLevelInfo,
          options,
        );

        childInclude.subQuery = childOriginalSubQuery;

        if (include.required === false && childInclude.required === true) {
          requiredMismatch = true;
        }

        // if the child is a sub query we just give it to the
        if (childOriginalSubQuery && include.subQuery && topLevelInfo.subQuery) {
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
        joinQueries.subQuery.push(
          ` ${joinQuery.join} ( ${joinQuery.body}${subChildIncludes.join('')} ) ON ${joinQuery.condition}`,
        );
      } else {
        joinQueries.subQuery.push(` ${joinQuery.join} ${joinQuery.body} ON ${joinQuery.condition}`);
        if (subChildIncludes.length > 0) {
          joinQueries.subQuery.push(subChildIncludes.join(''));
        }
      }

      joinQueries.mainQuery.push(mainChildIncludes.join(''));
    } else {
      if (requiredMismatch && mainChildIncludes.length > 0) {
        joinQueries.mainQuery.push(
          ` ${joinQuery.join} ( ${joinQuery.body}${mainChildIncludes.join('')} ) ON ${joinQuery.condition}`,
        );
      } else {
        joinQueries.mainQuery.push(
          ` ${joinQuery.join} ${joinQuery.body} ON ${joinQuery.condition}`,
        );
        if (mainChildIncludes.length > 0) {
          joinQueries.mainQuery.push(mainChildIncludes.join(''));
        }
      }

      if (subChildIncludes.length > 0) {
        if (topLevelInfo.subQuery) {
          const subFragments = [];

          if (requiredMismatch) {
            subFragments.push(
              ` ${joinQuery.join} ( ${joinQuery.body}${subChildIncludes.join('')} ) ON ${joinQuery.condition}`,
            );
          } else {
            subFragments.push(
              ` ${joinQuery.join} ${joinQuery.body} ON ${joinQuery.condition}`,
              subChildIncludes.join(''),
            );
          }

          joinQueries.subQuery.push(...subFragments);
        } else {
          joinQueries.subQuery.push(subChildIncludes.join(''));
        }
      }
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
    if (!options.minifyAliases || !options.aliasesByTable) {
      return null;
    }

    const candidates = new Set();
    const tableNameString = typeof tableName === 'string' ? tableName : undefined;
    const tableVariants = [];

    if (tableNameString) {
      tableVariants.push(tableNameString);

      const normalizedTable = tableNameString.replaceAll('->', '.');
      if (normalizedTable !== tableNameString) {
        tableVariants.push(normalizedTable);
      }
    }

    const fieldVariants = new Set();

    if (typeof field === 'string') {
      fieldVariants.add(field);

      const dotVariant = field.replaceAll('->', '.');
      const arrowVariant = field.replaceAll('.', '->');

      fieldVariants.add(dotVariant);
      fieldVariants.add(arrowVariant);

      if (field.includes('.')) {
        fieldVariants.add(field.slice(field.lastIndexOf('.') + 1));
      }
    } else if (field != null) {
      fieldVariants.add(field);
    }

    for (const variant of fieldVariants) {
      candidates.add(variant);
    }

    if (tableVariants.length > 0) {
      for (const tableVariant of tableVariants) {
        for (const fieldVariant of fieldVariants) {
          if (typeof fieldVariant === 'string' && fieldVariant.length > 0) {
            candidates.add(`${tableVariant}.${fieldVariant}`);
          }
        }
      }
    }

    for (const candidate of candidates) {
      const alias = options.aliasesByTable[`${tableName}${candidate}`];

      if (alias) {
        return alias;
      }
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
    const parentIsTop =
      Boolean(parent) &&
      !include.parent.association &&
      include.parent.model.name === topLevelInfo.options.model.name;
    let $parent;
    let joinWhere;
    /* Attributes for the left side */
    const left = association.source;
    const leftAttributes = left.modelDefinition.attributes;

    const attrNameLeft =
      association instanceof BelongsToAssociation
        ? association.foreignKey
        : association.sourceKeyAttribute;
    const columnNameLeft =
      association instanceof BelongsToAssociation
        ? association.identifierField
        : leftAttributes.get(association.sourceKeyAttribute).columnName;
    let asLeft;
    /* Attributes for the right side */
    const right = include.model;
    const rightAttributes = right.modelDefinition.attributes;
    const tableRight = right.table;
    const fieldRight =
      association instanceof BelongsToAssociation
        ? rightAttributes.get(association.targetKey).columnName
        : association.identifierField;
    let asRight = include.as;

    while (($parent = ($parent && $parent.parent) || include.parent) && $parent.association) {
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

    // TODO: use whereItemsQuery to generate the entire "ON" condition.
    let joinOn = `${this.quoteTable(asLeft)}.${this.quoteIdentifier(columnNameLeft)}`;
    const subqueryAttributes = [];

    if (
      (topLevelInfo.options.groupedLimit && parentIsTop) ||
      (topLevelInfo.subQuery && include.parent.subQuery && !include.subQuery)
    ) {
      if (parentIsTop) {
        // The main model attributes is not aliased to a prefix
        const tableName = parent.as || parent.model.name;
        const quotedTableName = this.quoteTable(tableName);

        // Check for potential aliased JOIN condition
        joinOn =
          this._getAliasForField(tableName, attrNameLeft, topLevelInfo.options) ||
          `${quotedTableName}.${this.quoteIdentifier(attrNameLeft)}`;

        if (topLevelInfo.subQuery) {
          const dbIdentifier = `${quotedTableName}.${this.quoteIdentifier(columnNameLeft)}`;
          subqueryAttributes.push(
            dbIdentifier !== joinOn
              ? `${dbIdentifier} AS ${this.quoteIdentifier(attrNameLeft)}`
              : dbIdentifier,
          );
        }
      } else {
        const joinSource = `${asLeft.replaceAll('->', '.')}.${attrNameLeft}`;

        // Check for potential aliased JOIN condition
        joinOn =
          this._getAliasForField(asLeft, joinSource, topLevelInfo.options) ||
          this.quoteIdentifier(joinSource);
      }
    }

    joinOn += ` = ${this.quoteIdentifier(asRight)}.${this.quoteIdentifier(fieldRight)}`;

    if (include.on) {
      joinOn = this.whereItemsQuery(include.on, {
        mainAlias: asRight,
        model: include.model,
        replacements: options?.replacements,
      });
    }

    if (include.where) {
      joinWhere = this.whereItemsQuery(include.where, {
        mainAlias: asRight,
        model: include.model,
        replacements: options?.replacements,
      });
      if (joinWhere) {
        joinOn = joinWithLogicalOperator([joinOn, joinWhere], include.or ? Op.or : Op.and);
      }
    }

    if (options?.minifyAliases && asRight.length > 63) {
      const alias = `%${topLevelInfo.options.includeAliases.size}`;

      topLevelInfo.options.includeAliases.set(alias, asRight);
    }

    return {
      join: include.required
        ? 'INNER JOIN'
        : include.right && this.dialect.supports['RIGHT JOIN']
          ? 'RIGHT OUTER JOIN'
          : 'LEFT OUTER JOIN',
      body: this.quoteTable(tableRight, { ...topLevelInfo.options, ...include, alias: asRight }),
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
      returnFields.push(
        ...options.returning.map(field => {
          if (typeof field === 'string') {
            return this.quoteIdentifier(field);
          } else if (field instanceof Literal) {
            // Due to how the mssql query is built, using a literal would never result in a properly formed query.
            // It's better to warn early.
            if (returnValuesType === 'output') {
              throw new Error(
                `literal() cannot be used in the "returning" option array in ${this.dialect.name}. Use col(), or a string instead.`,
              );
            }

            return this.formatSqlExpression(field);
          } else if (field instanceof Col) {
            return this.formatSqlExpression(field);
          }

          throw new Error(
            `Unsupported value in "returning" option: ${NodeUtil.inspect(field)}. This option only accepts true, false, or an array of strings, col() or literal().`,
          );
        }),
      );
    } else if (modelAttributes) {
      each(modelAttributes, attribute => {
        if (!(attribute.type instanceof DataTypes.VIRTUAL)) {
          returnFields.push(this.quoteIdentifier(attribute.field));
          returnTypes.push(attribute.type);
        }
      });
    }

    if (isEmpty(returnFields)) {
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

  generateThroughJoin(include, includeAs, parentTableName, topLevelInfo, options) {
    const isRootParent =
      !include.parent.association && include.parent.model.name === topLevelInfo.options.model.name;
    const isMinified = topLevelInfo.options.minifyAliases;

    const through = include.through;
    const throughTable = through.model.table;
    const throughAs = `${includeAs.internalAs}->${through.as}`;
    const externalThroughAs = `${includeAs.externalAs}.${through.as}`;

    const throughAttributes = through.attributes.map(attr => {
      let alias = `${externalThroughAs}.${Array.isArray(attr) ? attr[1] : attr}`;

      if (options.minifyAliases) {
        alias = this._getMinifiedAlias(alias, throughAs, topLevelInfo.options);
      }

      return joinSQLFragments([
        `${this.quoteIdentifier(throughAs)}.${this.quoteIdentifier(Array.isArray(attr) ? attr[0] : attr)}`,
        'AS',
        this.quoteIdentifier(alias),
      ]);
    });

    const association = include.association;
    const tableSource = parentTableName;
    const identSource = association.identifierField;
    const tableTarget = includeAs.internalAs;
    const identTarget = association.foreignIdentifierField;
    const attrTarget = association.targetKeyField;

    const joinType = include.required
      ? 'INNER JOIN'
      : include.right && this.dialect.supports['RIGHT JOIN']
        ? 'RIGHT OUTER JOIN'
        : 'LEFT OUTER JOIN';
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

    if (options.minifyAliases && throughAs.length > 63) {
      topLevelInfo.options.includeAliases.set(
        `%${topLevelInfo.options.includeAliases.size}`,
        throughAs,
      );
      if (includeAs.internalAs.length > 63) {
        topLevelInfo.options.includeAliases.set(
          `%${topLevelInfo.options.includeAliases.size}`,
          includeAs.internalAs,
        );
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

    if (
      topLevelInfo.subQuery &&
      !include.subQuery &&
      !include.parent.subQuery &&
      include.parent.model !== topLevelInfo.options.mainModel
    ) {
      attrSource = association.sourceKeyField;
    }

    // Build source side of the JOIN predicate for the through association.
    // This condition is reused by the actual JOIN and any subquery WHERE filters.

    if (topLevelInfo.subQuery && !include.subQuery && include.parent.subQuery && isMinified) {
      // When the parent include is also part of a subquery (especially with minified aliases),
      // the source key may only be available under a projected alias. Thus, we resolve
      // and reference the aliased attribute (or project it if missing) instead of the raw column
      // name to avoid referencing a missing column.
      const aliasCandidates = new Set();

      const dottedTableSource = tableSource.replaceAll('->', '.');

      if (attrSource) {
        aliasCandidates.add(attrSource);
        aliasCandidates.add(`${tableSource}.${attrSource}`);
        aliasCandidates.add(`${dottedTableSource}.${attrSource}`);
      }

      if (association.sourceKeyField && association.sourceKeyField !== attrSource) {
        aliasCandidates.add(association.sourceKeyField);
        aliasCandidates.add(`${tableSource}.${association.sourceKeyField}`);
        aliasCandidates.add(`${dottedTableSource}.${association.sourceKeyField}`);
      }

      let aliasedSource = null;

      for (const candidate of aliasCandidates) {
        aliasedSource = this._getAliasForField(tableSource, candidate, topLevelInfo.options);

        if (aliasedSource) {
          break;
        }
      }

      if (!aliasedSource) {
        const joinColumn = association.sourceKeyField || attrSource || identSource;

        if (isRootParent) {
          sourceJoinOn = `${this.quoteTable(tableSource)}.${this.quoteIdentifier(joinColumn)} = `;
        } else {
          const aliasBase = `${dottedTableSource}.${joinColumn}`;

          aliasedSource = this._getMinifiedAlias(aliasBase, tableSource, topLevelInfo.options);

          const projection = `${this.quoteTable(tableSource)}.${this.quoteIdentifier(joinColumn)} AS ${this.quoteIdentifier(aliasedSource)}`;

          if (!attributes.subQuery.includes(projection)) {
            attributes.subQuery.push(projection);
          }
        }
      }

      if (!sourceJoinOn) {
        sourceJoinOn = `${this.quoteIdentifier(aliasedSource)} = `;
      }
    } else if (
      topLevelInfo.subQuery &&
      !include.subQuery &&
      include.parent.subQuery &&
      !isRootParent
    ) {
      // Subquery + non-root parent: when alias minification is enabled,
      // the parent path's source key may have been projected under a generated alias.
      // Resolve and use the projected alias for the source side of the JOIN;
      // If no alias is found, fall back to the table-qualified column, prefixed
      // by the main subquery alias when available.
      const aliasedSource = this._getAliasForField(
        tableSource,
        `${tableSource}.${attrSource}`,
        topLevelInfo.options,
      );

      if (aliasedSource) {
        sourceJoinOn = `${this.quoteIdentifier(aliasedSource)} = `;
      } else {
        const mainAlias = topLevelInfo.names.quotedAs || topLevelInfo.names.quotedName;

        if (mainAlias) {
          sourceJoinOn = `${mainAlias}.${this.quoteIdentifier(`${tableSource}.${attrSource}`)} = `;
        } else {
          sourceJoinOn = `${this.quoteTable(tableSource)}.${this.quoteIdentifier(attrSource)} = `;
        }
      }
    } else {
      sourceJoinOn = `${this.quoteTable(tableSource)}.${this.quoteIdentifier(attrSource)} = `;
    }

    sourceJoinOn += `${this.quoteIdentifier(throughAs)}.${this.quoteIdentifier(identSource)}`;

    // Filter statement for right side of through
    // Used by both join and subquery where
    targetJoinOn = `${this.quoteIdentifier(tableTarget)}.${this.quoteIdentifier(attrTarget)} = `;
    targetJoinOn += `${this.quoteIdentifier(throughAs)}.${this.quoteIdentifier(identTarget)}`;

    if (through.where) {
      throughWhere = this.whereItemsQuery(through.where, {
        ...topLevelInfo.options,
        model: through.model,
        mainAlias: throughAs,
      });
    }

    // Generate a wrapped join so that the through table join can be dependent on the target join
    joinBody = `( ${this.quoteTable(throughTable, { ...topLevelInfo.options, ...include, alias: throughAs })} INNER JOIN ${this.quoteTable(include.model.table, { ...topLevelInfo.options, ...include, alias: includeAs.internalAs })} ON ${targetJoinOn}`;
    if (throughWhere) {
      joinBody += ` AND ${throughWhere}`;
    }

    joinBody += ')';
    joinCondition = sourceJoinOn;

    if ((include.where || include.through.where) && include.where) {
      targetWhere = this.whereItemsQuery(include.where, {
        ...topLevelInfo.options,
        model: include.model,
        mainAlias: includeAs.internalAs,
      });
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
      query = this.selectQuery(
        topInclude.through.model.table,
        {
          attributes: [topInclude.through.model.primaryKeyField],
          include: _validateIncludedElements({
            model: topInclude.through.model,
            include: [
              {
                association: topAssociation.fromThroughToTarget,
                required: true,
                where: topInclude.where,
                include: topInclude.include,
              },
            ],
          }).include,
          model: topInclude.through.model,
          where: {
            [Op.and]: [
              new Literal(
                [
                  `${this.quoteTable(topParent.model.name)}.${this.quoteIdentifier(topParent.model.primaryKeyField)}`,
                  `${this.quoteIdentifier(topInclude.through.model.name)}.${this.quoteIdentifier(topAssociation.identifierField)}`,
                ].join(' = '),
              ),
              topInclude.through.where,
            ],
          },
          includeIgnoreAttributes: false,
        },
        topInclude.through.model,
      );
    } else {
      const isBelongsTo = topAssociation.associationType === 'BelongsTo';
      const sourceField = isBelongsTo
        ? topAssociation.identifierField
        : topAssociation.sourceKeyField || topParent.model.primaryKeyField;
      const targetField = isBelongsTo
        ? topAssociation.sourceKeyField || topInclude.model.primaryKeyField
        : topAssociation.identifierField;

      const join = [
        `${this.quoteIdentifier(topInclude.as)}.${this.quoteIdentifier(targetField)}`,
        `${this.quoteTable(topParent.as || topParent.model.name)}.${this.quoteIdentifier(sourceField)}`,
      ].join(' = ');

      query = this.selectQuery(
        topInclude.model.table,
        {
          attributes: [targetField],
          include: _validateIncludedElements(topInclude).include,
          model: topInclude.model,
          where: {
            [Op.and]: [topInclude.where, new Literal(join)],
          },
          tableAs: topInclude.as,
          includeIgnoreAttributes: false,
        },
        topInclude.model,
      );
    }

    topLevelInfo.options.where = and(
      topLevelInfo.options.where,
      new Literal(['EXISTS (', query.replace(/;$/, ''), ')'].join(' ')),
    );
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
          subQuery &&
          Array.isArray(order) &&
          order[0] &&
          !(order[0] instanceof Association) &&
          !isModelStatic(order[0]) &&
          !isModelStatic(order[0].model) &&
          !(
            typeof order[0] === 'string' &&
            model &&
            model.associations !== undefined &&
            model.associations[order[0]]
          )
        ) {
          // TODO - refactor this.quote() to not change the first argument
          const columnName = model.modelDefinition.getColumnNameLoose(order[0]);
          const subQueryAlias = this._getAliasForField(model.name, columnName, options);

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
    } else if (options.order instanceof BaseSqlExpression) {
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

    const asPart = (extraInfo.as && `as ${extraInfo.as}`) || '';
    const namePart = (extraInfo.modelName && `for model '${extraInfo.modelName}'`) || '';
    const message = `Attempted a SELECT query ${namePart} ${asPart} without selecting any columns`;
    throw new sequelizeError.QueryError(message.replaceAll(/ +/g, ' '));
  }

  _validateSelectOptions(options) {
    if (
      options.maxExecutionTimeHintMs != null &&
      !this.dialect.supports.maxExecutionTimeHint.select
    ) {
      throw new Error(`The maxExecutionTimeMs option is not supported by ${this.dialect.name}`);
    }
  }

  _getBeforeSelectAttributesFragment(_options) {
    return '';
  }

  selectFromTableFragment(options, model, attributes, tables, mainTableAs) {
    this._throwOnEmptyAttributes(attributes, { modelName: model && model.name, as: mainTableAs });

    this._validateSelectOptions(options);

    let fragment = 'SELECT';
    fragment += this._getBeforeSelectAttributesFragment(options);
    fragment += ` ${attributes.join(', ')} FROM ${tables}`;

    if (options.groupedLimit) {
      fragment += ` AS ${mainTableAs}`;
    }

    return fragment;
  }

  // A recursive parser for nested where conditions
  parseConditionObject(conditions, path) {
    path ||= [];

    return reduce(
      conditions,
      (result, value, key) => {
        if (isObject(value)) {
          return result.concat(this.parseConditionObject(value, path.concat(key))); // Recursively parse objects
        }

        result.push({ path: path.concat(key), value });

        return result;
      },
      [],
    );
  }
}
