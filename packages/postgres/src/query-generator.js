'use strict';

import { DataTypes } from '@sequelize/core';
import { CREATE_TABLE_QUERY_SUPPORTABLE_OPTIONS } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.js';
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { quoteIdentifier } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/dialect.js';
import { defaultValueSchemable } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/query-builder-utils.js';
import { generateIndexName } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/string.js';
import each from 'lodash/each';
import isEmpty from 'lodash/isEmpty';
import isPlainObject from 'lodash/isPlainObject';
import map from 'lodash/map';
import reduce from 'lodash/reduce';
import { ENUM } from './_internal/data-types-overrides.js';
import { PostgresQueryGeneratorTypeScript } from './query-generator-typescript.internal.js';
import { PostgresQueryGeneratorInternal } from './query-generator.internal.js';

/**
 * list of reserved words in PostgreSQL 10
 * source: https://www.postgresql.org/docs/10/static/sql-keywords-appendix.html
 *
 * @private
 */
const POSTGRES_RESERVED_WORDS =
  'all,analyse,analyze,and,any,array,as,asc,asymmetric,authorization,binary,both,case,cast,check,collate,collation,column,concurrently,constraint,create,cross,current_catalog,current_date,current_role,current_schema,current_time,current_timestamp,current_user,default,deferrable,desc,distinct,do,else,end,except,false,fetch,for,foreign,freeze,from,full,grant,group,having,ilike,in,initially,inner,intersect,into,is,isnull,join,lateral,leading,left,like,limit,localtime,localtimestamp,natural,not,notnull,null,offset,on,only,or,order,outer,overlaps,placing,primary,references,returning,right,select,session_user,similar,some,symmetric,table,tablesample,then,to,trailing,true,union,unique,user,using,variadic,verbose,when,where,window,with'.split(
    ',',
  );

const CREATE_TABLE_QUERY_SUPPORTED_OPTIONS = new Set(['comment', 'uniqueKeys']);

export class PostgresQueryGenerator extends PostgresQueryGeneratorTypeScript {
  #internals;

  constructor(dialect, internals = new PostgresQueryGeneratorInternal(dialect)) {
    super(dialect, internals);

    this.#internals = internals;
  }

  setSearchPath(searchPath) {
    return `SET search_path to ${searchPath};`;
  }

  createTableQuery(tableName, attributes, options) {
    if (options) {
      rejectInvalidOptions(
        'createTableQuery',
        this.dialect,
        CREATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
        CREATE_TABLE_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    options = { ...options };

    const attrStr = [];
    let comments = '';
    let columnComments = '';

    const quotedTable = this.quoteTable(tableName);

    if (options.comment && typeof options.comment === 'string') {
      comments += `; COMMENT ON TABLE ${quotedTable} IS ${this.escape(options.comment)}`;
    }

    for (const attr in attributes) {
      const quotedAttr = this.quoteIdentifier(attr);
      const i = attributes[attr].indexOf('COMMENT ');
      if (i !== -1) {
        // Move comment to a separate query
        const escapedCommentText = this.escape(attributes[attr].slice(Math.max(0, i + 8)));
        columnComments += `; COMMENT ON COLUMN ${quotedTable}.${quotedAttr} IS ${escapedCommentText}`;
        attributes[attr] = attributes[attr].slice(0, Math.max(0, i));
      }

      const dataType = this.dataTypeMapping(tableName, attr, attributes[attr]);
      attrStr.push(`${quotedAttr} ${dataType}`);
    }

    let attributesClause = attrStr.join(', ');

    if (options.uniqueKeys) {
      each(options.uniqueKeys, (index, indexName) => {
        if (typeof indexName !== 'string') {
          indexName = generateIndexName(tableName, index);
        }

        attributesClause += `, CONSTRAINT ${this.quoteIdentifier(indexName)} UNIQUE (${index.fields
          .map(field => this.quoteIdentifier(field))
          .join(', ')})`;
      });
    }

    const pks = reduce(
      attributes,
      (acc, attribute, key) => {
        if (attribute.includes('PRIMARY KEY')) {
          acc.push(this.quoteIdentifier(key));
        }

        return acc;
      },
      [],
    ).join(', ');

    if (pks.length > 0) {
      attributesClause += `, PRIMARY KEY (${pks})`;
    }

    return `CREATE TABLE IF NOT EXISTS ${quotedTable} (${attributesClause})${comments}${columnComments};`;
  }

  addColumnQuery(table, key, attribute, options) {
    options ||= {};

    const dbDataType = this.attributeToSQL(attribute, { context: 'addColumn', table, key });
    const dataType = attribute.type || attribute;
    const definition = this.dataTypeMapping(table, key, dbDataType);
    const quotedKey = this.quoteIdentifier(key);
    const quotedTable = this.quoteTable(table);
    const ifNotExists = options.ifNotExists ? ' IF NOT EXISTS' : '';

    let query = `ALTER TABLE ${quotedTable} ADD COLUMN ${ifNotExists} ${quotedKey} ${definition};`;

    if (dataType instanceof DataTypes.ENUM) {
      query = this.pgEnum(table, key, dataType) + query;
    } else if (
      dataType instanceof DataTypes.ARRAY &&
      dataType.options.type instanceof DataTypes.ENUM
    ) {
      query = this.pgEnum(table, key, dataType.options.type) + query;
    }

    return query;
  }

  changeColumnQuery(tableName, attributes) {
    const query = subQuery => `ALTER TABLE ${this.quoteTable(tableName)} ALTER COLUMN ${subQuery};`;
    const sql = [];
    for (const attributeName in attributes) {
      let definition = this.dataTypeMapping(tableName, attributeName, attributes[attributeName]);
      let attrSql = '';

      if (definition.includes('NOT NULL')) {
        attrSql += query(`${this.quoteIdentifier(attributeName)} SET NOT NULL`);

        definition = definition.replace('NOT NULL', '').trim();
      } else if (!definition.includes('REFERENCES')) {
        attrSql += query(`${this.quoteIdentifier(attributeName)} DROP NOT NULL`);
      }

      if (definition.includes('DEFAULT')) {
        attrSql += query(
          `${this.quoteIdentifier(attributeName)} SET DEFAULT ${definition.match(/DEFAULT ([^;]+)/)[1]}`,
        );

        definition = definition.replace(/(DEFAULT[^;]+)/, '').trim();
      } else if (!definition.includes('REFERENCES')) {
        attrSql += query(`${this.quoteIdentifier(attributeName)} DROP DEFAULT`);
      }

      if (attributes[attributeName].startsWith('ENUM(')) {
        attrSql += this.pgEnum(tableName, attributeName, attributes[attributeName]);
        definition = definition.replace(
          /^ENUM\(.+\)/,
          this.pgEnumName(tableName, attributeName, { schema: false }),
        );
        definition += ` USING (${this.quoteIdentifier(attributeName)}::${this.pgEnumName(tableName, attributeName)})`;
      }

      if (/UNIQUE;*$/.test(definition)) {
        definition = definition.replace(/UNIQUE;*$/, '');
        attrSql += query(`ADD UNIQUE (${this.quoteIdentifier(attributeName)})`).replace(
          'ALTER COLUMN',
          '',
        );
      }

      if (definition.includes('REFERENCES')) {
        definition = definition.replace(/.+?(?=REFERENCES)/, '');
        attrSql += query(
          `ADD FOREIGN KEY (${this.quoteIdentifier(attributeName)}) ${definition}`,
        ).replace('ALTER COLUMN', '');
      } else {
        attrSql += query(`${this.quoteIdentifier(attributeName)} TYPE ${definition}`);
      }

      sql.push(attrSql);
    }

    return sql.join('');
  }

  renameColumnQuery(tableName, attrBefore, attributes) {
    const attrString = [];

    for (const attributeName in attributes) {
      attrString.push(
        `${this.quoteIdentifier(attrBefore)} TO ${this.quoteIdentifier(attributeName)}`,
      );
    }

    return `ALTER TABLE ${this.quoteTable(tableName)} RENAME COLUMN ${attrString.join(', ')};`;
  }

  fn(fnName, tableName, parameters, body, returns, language) {
    fnName ||= 'testfunc';
    language ||= 'plpgsql';
    returns = returns ? `RETURNS ${returns}` : '';
    parameters ||= '';

    return `CREATE OR REPLACE FUNCTION pg_temp.${fnName}(${parameters}) ${returns} AS $func$ BEGIN ${body} END; $func$ LANGUAGE ${language}; SELECT * FROM pg_temp.${fnName}();`;
  }

  attributeToSQL(attribute, options) {
    if (!isPlainObject(attribute)) {
      attribute = {
        type: attribute,
      };
    }

    let type;
    if (
      attribute.type instanceof DataTypes.ENUM ||
      (attribute.type instanceof DataTypes.ARRAY && attribute.type.type instanceof DataTypes.ENUM)
    ) {
      const enumType = attribute.type.type || attribute.type;
      const values = enumType.options.values;

      if (Array.isArray(values) && values.length > 0) {
        type = `ENUM(${values.map(value => this.escape(value)).join(', ')})`;

        if (attribute.type instanceof DataTypes.ARRAY) {
          type += '[]';
        }
      } else {
        throw new Error("Values for ENUM haven't been defined.");
      }
    }

    if (!type) {
      type = attribute.type;
    }

    let sql = type.toString();

    if (attribute.allowNull === false) {
      sql += ' NOT NULL';
    }

    if (attribute.autoIncrement) {
      if (attribute.autoIncrementIdentity) {
        sql += ' GENERATED BY DEFAULT AS IDENTITY';
      } else {
        sql += ' SERIAL';
      }
    }

    if (defaultValueSchemable(attribute.defaultValue, this.dialect)) {
      sql += ` DEFAULT ${this.escape(attribute.defaultValue, { type: attribute.type })}`;
    }

    if (attribute.unique === true) {
      sql += ' UNIQUE';
    }

    if (attribute.primaryKey) {
      sql += ' PRIMARY KEY';
    }

    if (attribute.references) {
      let schema;

      if (options.schema) {
        schema = options.schema;
      } else if (
        (!attribute.references.table || typeof attribute.references.table === 'string') &&
        options.table &&
        options.table.schema
      ) {
        schema = options.table.schema;
      }

      const referencesTable = this.extractTableDetails(attribute.references.table, { schema });

      let referencesKey;

      if (!options.withoutForeignKeyConstraints) {
        if (attribute.references.key) {
          referencesKey = this.quoteIdentifiers(attribute.references.key);
        } else {
          referencesKey = this.quoteIdentifier('id');
        }

        sql += ` REFERENCES ${this.quoteTable(referencesTable)} (${referencesKey})`;

        if (attribute.onDelete) {
          sql += ` ON DELETE ${attribute.onDelete.toUpperCase()}`;
        }

        if (attribute.onUpdate) {
          sql += ` ON UPDATE ${attribute.onUpdate.toUpperCase()}`;
        }

        if (attribute.references.deferrable) {
          sql += ` ${this.#internals.getDeferrableConstraintSnippet(attribute.references.deferrable)}`;
        }
      }
    }

    if (attribute.comment && typeof attribute.comment === 'string') {
      if (options && ['addColumn', 'changeColumn'].includes(options.context)) {
        const quotedAttr = this.quoteIdentifier(options.key);
        const escapedCommentText = this.escape(attribute.comment);
        sql += `; COMMENT ON COLUMN ${this.quoteTable(options.table)}.${quotedAttr} IS ${escapedCommentText}`;
      } else {
        // for createTable event which does it's own parsing
        // TODO: centralize creation of comment statements here
        sql += ` COMMENT ${attribute.comment}`;
      }
    }

    return sql;
  }

  attributesToSQL(attributes, options) {
    const result = {};

    for (const key in attributes) {
      const attribute = attributes[key];
      result[attribute.field || key] = this.attributeToSQL(attribute, { key, ...options });
    }

    return result;
  }

  createTrigger(
    tableName,
    triggerName,
    eventType,
    fireOnSpec,
    functionName,
    functionParams,
    optionsArray,
  ) {
    const decodedEventType = this.decodeTriggerEventType(eventType);
    const eventSpec = this.expandTriggerEventSpec(fireOnSpec);
    const expandedOptions = this.expandOptions(optionsArray);
    const paramList = this._expandFunctionParamList(functionParams);

    return `CREATE ${this.triggerEventTypeIsConstraint(eventType)}TRIGGER ${this.quoteIdentifier(triggerName)} ${decodedEventType} ${eventSpec} ON ${this.quoteTable(tableName)}${expandedOptions ? ` ${expandedOptions}` : ''} EXECUTE PROCEDURE ${functionName}(${paramList});`;
  }

  dropTrigger(tableName, triggerName) {
    return `DROP TRIGGER ${this.quoteIdentifier(triggerName)} ON ${this.quoteTable(tableName)} RESTRICT;`;
  }

  renameTrigger(tableName, oldTriggerName, newTriggerName) {
    return `ALTER TRIGGER ${this.quoteIdentifier(oldTriggerName)} ON ${this.quoteTable(tableName)} RENAME TO ${this.quoteIdentifier(newTriggerName)};`;
  }

  createFunction(functionName, params, returnType, language, body, optionsArray, options) {
    if (!functionName || !returnType || !language || !body) {
      throw new Error(
        'createFunction missing some parameters. Did you pass functionName, returnType, language and body?',
      );
    }

    const paramList = this._expandFunctionParamList(params);
    const variableList =
      options && options.variables ? this._expandFunctionVariableList(options.variables) : '';
    const expandedOptionsArray = this.expandOptions(optionsArray);

    const statement = options && options.force ? 'CREATE OR REPLACE FUNCTION' : 'CREATE FUNCTION';

    return `${statement} ${functionName}(${paramList}) RETURNS ${returnType} AS $func$ ${variableList} BEGIN ${body} END; $func$ language '${language}'${expandedOptionsArray};`;
  }

  dropFunction(functionName, params) {
    if (!functionName) {
      throw new Error('requires functionName');
    }

    // RESTRICT is (currently, as of 9.2) default but we'll be explicit
    const paramList = this._expandFunctionParamList(params);

    return `DROP FUNCTION ${functionName}(${paramList}) RESTRICT;`;
  }

  renameFunction(oldFunctionName, params, newFunctionName) {
    const paramList = this._expandFunctionParamList(params);

    return `ALTER FUNCTION ${oldFunctionName}(${paramList}) RENAME TO ${newFunctionName};`;
  }

  _expandFunctionParamList(params) {
    if (params === undefined || !Array.isArray(params)) {
      throw new Error(
        '_expandFunctionParamList: function parameters array required, including an empty one for no arguments',
      );
    }

    const paramList = [];
    for (const curParam of params) {
      const paramDef = [];
      if (curParam.type) {
        if (curParam.direction) {
          paramDef.push(curParam.direction);
        }

        if (curParam.name) {
          paramDef.push(curParam.name);
        }

        paramDef.push(curParam.type);
      } else {
        throw new Error('function or trigger used with a parameter without any type');
      }

      const joined = paramDef.join(' ');
      if (joined) {
        paramList.push(joined);
      }
    }

    return paramList.join(', ');
  }

  _expandFunctionVariableList(variables) {
    if (!Array.isArray(variables)) {
      throw new TypeError('_expandFunctionVariableList: function variables must be an array');
    }

    const variableDefinitions = [];
    for (const variable of variables) {
      if (!variable.name || !variable.type) {
        throw new Error('function variable must have a name and type');
      }

      let variableDefinition = `DECLARE ${variable.name} ${variable.type}`;
      if (variable.default) {
        variableDefinition += ` := ${variable.default}`;
      }

      variableDefinition += ';';
      variableDefinitions.push(variableDefinition);
    }

    return variableDefinitions.join(' ');
  }

  expandOptions(options) {
    return options === undefined || isEmpty(options) ? '' : options.join(' ');
  }

  decodeTriggerEventType(eventSpecifier) {
    const EVENT_DECODER = {
      after: 'AFTER',
      before: 'BEFORE',
      instead_of: 'INSTEAD OF',
      after_constraint: 'AFTER',
    };

    if (!EVENT_DECODER[eventSpecifier]) {
      throw new Error(`Invalid trigger event specified: ${eventSpecifier}`);
    }

    return EVENT_DECODER[eventSpecifier];
  }

  triggerEventTypeIsConstraint(eventSpecifier) {
    return eventSpecifier === 'after_constraint' ? 'CONSTRAINT ' : '';
  }

  expandTriggerEventSpec(fireOnSpec) {
    if (isEmpty(fireOnSpec)) {
      throw new Error('no table change events specified to trigger on');
    }

    return map(fireOnSpec, (fireValue, fireKey) => {
      const EVENT_MAP = {
        insert: 'INSERT',
        update: 'UPDATE',
        delete: 'DELETE',
        truncate: 'TRUNCATE',
      };

      if (!EVENT_MAP[fireValue]) {
        throw new Error(`parseTriggerEventSpec: undefined trigger event ${fireKey}`);
      }

      let eventSpec = EVENT_MAP[fireValue];
      if (eventSpec === 'UPDATE' && Array.isArray(fireValue) && fireValue.length > 0) {
        eventSpec += ` OF ${fireValue.join(', ')}`;
      }

      return eventSpec;
    }).join(' OR ');
  }

  pgEnumName(tableName, columnName, options = {}) {
    const tableDetails = this.extractTableDetails(tableName, options);

    const enumName = `enum_${tableDetails.tableName}_${columnName}`;
    if (options.noEscape) {
      return enumName;
    }

    const escapedEnumName = this.quoteIdentifier(enumName);

    if (options.schema !== false && tableDetails.schema) {
      return this.quoteIdentifier(tableDetails.schema) + tableDetails.delimiter + escapedEnumName;
    }

    return escapedEnumName;
  }

  pgListEnums(tableName, attrName, options) {
    let enumName = '';
    const tableDetails =
      tableName != null
        ? this.extractTableDetails(tableName, options)
        : { schema: this.options.schema || this.dialect.getDefaultSchema() };

    if (tableDetails.tableName && attrName) {
      // pgEnumName escapes as an identifier, we want to escape it as a string
      enumName = ` AND t.typname=${this.escape(this.pgEnumName(tableDetails.tableName, attrName, { noEscape: true }))}`;
    }

    return (
      'SELECT t.typname enum_name, array_agg(e.enumlabel ORDER BY enumsortorder) enum_value FROM pg_type t ' +
      'JOIN pg_enum e ON t.oid = e.enumtypid ' +
      'JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace ' +
      `WHERE n.nspname = ${this.escape(tableDetails.schema)}${enumName} GROUP BY 1`
    );
  }

  pgEnum(tableName, attr, dataType, options) {
    const enumName = this.pgEnumName(tableName, attr, options);
    let values;

    if (dataType instanceof ENUM && dataType.options.values) {
      values = `ENUM(${dataType.options.values.map(value => this.escape(value)).join(', ')})`;
    } else {
      values = dataType.toString().match(/^ENUM\(.+\)/)[0];
    }

    let sql = `DO ${this.escape(`BEGIN CREATE TYPE ${enumName} AS ${values}; EXCEPTION WHEN duplicate_object THEN null; END`)};`;
    if (Boolean(options) && options.force === true) {
      sql = this.pgEnumDrop(tableName, attr) + sql;
    }

    return sql;
  }

  pgEnumAdd(tableName, attr, value, options) {
    const enumName = this.pgEnumName(tableName, attr);
    let sql = `ALTER TYPE ${enumName} ADD VALUE IF NOT EXISTS `;

    sql += this.escape(value);

    if (options.before) {
      sql += ` BEFORE ${this.escape(options.before)}`;
    } else if (options.after) {
      sql += ` AFTER ${this.escape(options.after)}`;
    }

    return sql;
  }

  pgEnumDrop(tableName, attr, enumName) {
    enumName ||= this.pgEnumName(tableName, attr);

    return `DROP TYPE IF EXISTS ${enumName}; `;
  }

  fromArray(text) {
    if (Array.isArray(text)) {
      return text;
    }

    text = text.replace(/^{/, '').replace(/}$/, '');
    let matches = text.match(/("(?:\\.|[^"\\])*"|[^,]*)(?:\s*,\s*|\s*$)/gi);

    if (matches.length === 0) {
      return [];
    }

    matches = matches.map(m =>
      m
        .replace(/",$/, '')
        .replace(/,$/, '')
        .replaceAll(/(^"|"$)/g, ''),
    );

    return matches.slice(0, -1);
  }

  dataTypeMapping(tableName, attr, dataType) {
    if (dataType.includes('PRIMARY KEY')) {
      dataType = dataType.replace('PRIMARY KEY', '');
    }

    if (dataType.includes('SERIAL')) {
      if (dataType.includes('BIGINT')) {
        dataType = dataType.replace('SERIAL', 'BIGSERIAL');
        dataType = dataType.replace('BIGINT', '');
      } else if (dataType.includes('SMALLINT')) {
        dataType = dataType.replace('SERIAL', 'SMALLSERIAL');
        dataType = dataType.replace('SMALLINT', '');
      } else {
        dataType = dataType.replace('INTEGER', '');
      }

      dataType = dataType.replace('NOT NULL', '');
    }

    if (dataType.startsWith('ENUM(')) {
      dataType = dataType.replace(/^ENUM\(.+\)/, this.pgEnumName(tableName, attr));
    }

    return dataType;
  }

  /**
   * Quote identifier in sql clause
   *
   * @param {string} identifier
   * @param {boolean} force
   *
   * @returns {string}
   */
  quoteIdentifier(identifier, force) {
    const optForceQuote = force || false;
    // TODO [>7]: remove "quoteIdentifiers: false" option
    const optQuoteIdentifiers = this.options.quoteIdentifiers !== false;

    if (
      optForceQuote === true ||
      // TODO [>7]: drop this.options.quoteIdentifiers. Always quote identifiers based on these rules
      optQuoteIdentifiers !== false ||
      identifier.includes('.') ||
      identifier.includes('->') ||
      POSTGRES_RESERVED_WORDS.includes(identifier.toLowerCase())
    ) {
      // In Postgres if tables or attributes are created double-quoted,
      // they are also case sensitive. If they contain any uppercase
      // characters, they must always be double-quoted. This makes it
      // impossible to write queries in portable SQL if tables are created in
      // this way. Hence, we strip quotes if we don't want case sensitivity.
      return quoteIdentifier(identifier, this.dialect.TICK_CHAR_LEFT, this.dialect.TICK_CHAR_RIGHT);
    }

    return identifier;
  }
}
