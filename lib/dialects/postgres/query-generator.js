'use strict';

const Utils = require('../../utils');
const util = require('util');
const DataTypes = require('../../data-types');
const AbstractQueryGenerator = require('../abstract/query-generator');
const semver = require('semver');
const _ = require('lodash');

class PostgresQueryGenerator extends AbstractQueryGenerator {
  setSearchPath(searchPath) {
    return `SET search_path to ${searchPath};`;
  }

  createDatabaseQuery(databaseName, options) {
    options = {
      encoding: null,
      collate: null,
      ...options
    };

    const values = {
      database: this.quoteTable(databaseName),
      encoding: options.encoding ? ` ENCODING = ${this.escape(options.encoding)}` : '',
      collation: options.collate ? ` LC_COLLATE = ${this.escape(options.collate)}` : '',
      ctype: options.ctype ? ` LC_CTYPE = ${this.escape(options.ctype)}` : '',
      template: options.template ? ` TEMPLATE = ${this.escape(options.template)}` : ''
    };

    return `CREATE DATABASE ${values.database}${values.encoding}${values.collation}${values.ctype}${values.template};`;
  }

  dropDatabaseQuery(databaseName) {
    return `DROP DATABASE IF EXISTS ${this.quoteTable(databaseName)};`;
  }

  createSchema(schema) {
    const databaseVersion = _.get(this, 'sequelize.options.databaseVersion', 0);

    if (databaseVersion && semver.gte(databaseVersion, '9.2.0')) {
      return `CREATE SCHEMA IF NOT EXISTS ${schema};`;
    }

    return `CREATE SCHEMA ${schema};`;
  }

  dropSchema(schema) {
    return `DROP SCHEMA IF EXISTS ${schema} CASCADE;`;
  }

  showSchemasQuery() {
    return "SELECT schema_name FROM information_schema.schemata WHERE schema_name <> 'information_schema' AND schema_name != 'public' AND schema_name !~ E'^pg_';";
  }

  versionQuery() {
    return 'SHOW SERVER_VERSION';
  }

  createTableQuery(tableName, attributes, options) {
    options = { ...options };

    //Postgres 9.0 does not support CREATE TABLE IF NOT EXISTS, 9.1 and above do
    const databaseVersion = _.get(this, 'sequelize.options.databaseVersion', 0);
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
        const escapedCommentText = this.escape(attributes[attr].substring(i + 8));
        columnComments += `; COMMENT ON COLUMN ${quotedTable}.${quotedAttr} IS ${escapedCommentText}`;
        attributes[attr] = attributes[attr].substring(0, i);
      }

      const dataType = this.dataTypeMapping(tableName, attr, attributes[attr]);
      attrStr.push(`${quotedAttr} ${dataType}`);
    }


    let attributesClause = attrStr.join(', ');

    if (options.uniqueKeys) {
      _.each(options.uniqueKeys, columns => {
        if (columns.customIndex) {
          attributesClause += `, UNIQUE (${columns.fields.map(field => this.quoteIdentifier(field)).join(', ')})`;
        }
      });
    }

    const pks = _.reduce(attributes, (acc, attribute, key) => {
      if (attribute.includes('PRIMARY KEY')) {
        acc.push(this.quoteIdentifier(key));
      }
      return acc;
    }, []).join(',');

    if (pks.length > 0) {
      attributesClause += `, PRIMARY KEY (${pks})`;
    }

    return `CREATE TABLE ${databaseVersion === 0 || semver.gte(databaseVersion, '9.1.0') ? 'IF NOT EXISTS ' : ''}${quotedTable} (${attributesClause})${comments}${columnComments};`;
  }

  dropTableQuery(tableName, options) {
    options = options || {};
    return `DROP TABLE IF EXISTS ${this.quoteTable(tableName)}${options.cascade ? ' CASCADE' : ''};`;
  }

  showTablesQuery() {
    return "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type LIKE '%TABLE' AND table_name != 'spatial_ref_sys';";
  }

  describeTableQuery(tableName, schema) {
    if (!schema) schema = 'public';

    return 'SELECT ' +
      'pk.constraint_type as "Constraint",' +
      'c.column_name as "Field", ' +
      'c.column_default as "Default",' +
      'c.is_nullable as "Null", ' +
      '(CASE WHEN c.udt_name = \'hstore\' THEN c.udt_name ELSE c.data_type END) || (CASE WHEN c.character_maximum_length IS NOT NULL THEN \'(\' || c.character_maximum_length || \')\' ELSE \'\' END) as "Type", ' +
      '(SELECT array_agg(e.enumlabel) FROM pg_catalog.pg_type t JOIN pg_catalog.pg_enum e ON t.oid=e.enumtypid WHERE t.typname=c.udt_name) AS "special", ' +
      '(SELECT pgd.description FROM pg_catalog.pg_statio_all_tables AS st INNER JOIN pg_catalog.pg_description pgd on (pgd.objoid=st.relid) WHERE c.ordinal_position=pgd.objsubid AND c.table_name=st.relname) AS "Comment" ' +
      'FROM information_schema.columns c ' +
      'LEFT JOIN (SELECT tc.table_schema, tc.table_name, ' +
      'cu.column_name, tc.constraint_type ' +
      'FROM information_schema.TABLE_CONSTRAINTS tc ' +
      'JOIN information_schema.KEY_COLUMN_USAGE  cu ' +
      'ON tc.table_schema=cu.table_schema and tc.table_name=cu.table_name ' +
      'and tc.constraint_name=cu.constraint_name ' +
      'and tc.constraint_type=\'PRIMARY KEY\') pk ' +
      'ON pk.table_schema=c.table_schema ' +
      'AND pk.table_name=c.table_name ' +
      'AND pk.column_name=c.column_name ' +
      `WHERE c.table_name = ${this.escape(tableName)} AND c.table_schema = ${this.escape(schema)} `;
  }

  /**
   * Check whether the statmement is json function or simple path
   *
   * @param   {string}  stmt  The statement to validate
   * @returns {boolean}       true if the given statement is json function
   * @throws  {Error}         throw if the statement looks like json function but has invalid token
   */
  _checkValidJsonStatement(stmt) {
    if (typeof stmt !== 'string') {
      return false;
    }

    // https://www.postgresql.org/docs/current/static/functions-json.html
    const jsonFunctionRegex = /^\s*((?:[a-z]+_){0,2}jsonb?(?:_[a-z]+){0,2})\([^)]*\)/i;
    const jsonOperatorRegex = /^\s*(->>?|#>>?|@>|<@|\?[|&]?|\|{2}|#-)/i;
    const tokenCaptureRegex = /^\s*((?:([`"'])(?:(?!\2).|\2{2})*\2)|[\w\d\s]+|[().,;+-])/i;

    let currentIndex = 0;
    let openingBrackets = 0;
    let closingBrackets = 0;
    let hasJsonFunction = false;
    let hasInvalidToken = false;

    while (currentIndex < stmt.length) {
      const string = stmt.substr(currentIndex);
      const functionMatches = jsonFunctionRegex.exec(string);
      if (functionMatches) {
        currentIndex += functionMatches[0].indexOf('(');
        hasJsonFunction = true;
        continue;
      }

      const operatorMatches = jsonOperatorRegex.exec(string);
      if (operatorMatches) {
        currentIndex += operatorMatches[0].length;
        hasJsonFunction = true;
        continue;
      }

      const tokenMatches = tokenCaptureRegex.exec(string);
      if (tokenMatches) {
        const capturedToken = tokenMatches[1];
        if (capturedToken === '(') {
          openingBrackets++;
        } else if (capturedToken === ')') {
          closingBrackets++;
        } else if (capturedToken === ';') {
          hasInvalidToken = true;
          break;
        }
        currentIndex += tokenMatches[0].length;
        continue;
      }

      break;
    }

    // Check invalid json statement
    hasInvalidToken |= openingBrackets !== closingBrackets;
    if (hasJsonFunction && hasInvalidToken) {
      throw new Error(`Invalid json statement: ${stmt}`);
    }

    // return true if the statement has valid json function
    return hasJsonFunction;
  }

  handleSequelizeMethod(smth, tableName, factory, options, prepend) {
    if (smth instanceof Utils.Json) {
      // Parse nested object
      if (smth.conditions) {
        const conditions = this.parseConditionObject(smth.conditions).map(condition =>
          `${this.jsonPathExtractionQuery(condition.path[0], _.tail(condition.path))} = '${condition.value}'`
        );

        return conditions.join(' AND ');
      }
      if (smth.path) {
        let str;

        // Allow specifying conditions using the postgres json syntax
        if (this._checkValidJsonStatement(smth.path)) {
          str = smth.path;
        } else {
          // Also support json property accessors
          const paths = _.toPath(smth.path);
          const column = paths.shift();
          str = this.jsonPathExtractionQuery(column, paths);
        }

        if (smth.value) {
          str += util.format(' = %s', this.escape(smth.value));
        }

        return str;
      }
    }
    return super.handleSequelizeMethod.call(this, smth, tableName, factory, options, prepend);
  }

  addColumnQuery(table, key, attribute) {
    const dbDataType = this.attributeToSQL(attribute, { context: 'addColumn', table, key });
    const dataType = attribute.type || attribute;
    const definition = this.dataTypeMapping(table, key, dbDataType);
    const quotedKey = this.quoteIdentifier(key);
    const quotedTable = this.quoteTable(this.extractTableDetails(table));

    let query = `ALTER TABLE ${quotedTable} ADD COLUMN ${quotedKey} ${definition};`;

    if (dataType instanceof DataTypes.ENUM) {
      query = this.pgEnum(table, key, dataType) + query;
    } else if (dataType.type && dataType.type instanceof DataTypes.ENUM) {
      query = this.pgEnum(table, key, dataType.type) + query;
    }

    return query;
  }

  removeColumnQuery(tableName, attributeName) {
    const quotedTableName = this.quoteTable(this.extractTableDetails(tableName));
    const quotedAttributeName = this.quoteIdentifier(attributeName);
    return `ALTER TABLE ${quotedTableName} DROP COLUMN ${quotedAttributeName};`;
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
        attrSql += query(`${this.quoteIdentifier(attributeName)} SET DEFAULT ${definition.match(/DEFAULT ([^;]+)/)[1]}`);

        definition = definition.replace(/(DEFAULT[^;]+)/, '').trim();
      } else if (!definition.includes('REFERENCES')) {
        attrSql += query(`${this.quoteIdentifier(attributeName)} DROP DEFAULT`);
      }

      if (attributes[attributeName].startsWith('ENUM(')) {
        attrSql += this.pgEnum(tableName, attributeName, attributes[attributeName]);
        definition = definition.replace(/^ENUM\(.+\)/, this.pgEnumName(tableName, attributeName, { schema: false }));
        definition += ` USING (${this.quoteIdentifier(attributeName)}::${this.pgEnumName(tableName, attributeName)})`;
      }

      if (definition.match(/UNIQUE;*$/)) {
        definition = definition.replace(/UNIQUE;*$/, '');
        attrSql += query(`ADD UNIQUE (${this.quoteIdentifier(attributeName)})`).replace('ALTER COLUMN', '');
      }

      if (definition.includes('REFERENCES')) {
        definition = definition.replace(/.+?(?=REFERENCES)/, '');
        attrSql += query(`ADD FOREIGN KEY (${this.quoteIdentifier(attributeName)}) ${definition}`).replace('ALTER COLUMN', '');
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
      attrString.push(`${this.quoteIdentifier(attrBefore)} TO ${this.quoteIdentifier(attributeName)}`);
    }

    return `ALTER TABLE ${this.quoteTable(tableName)} RENAME COLUMN ${attrString.join(', ')};`;
  }

  fn(fnName, tableName, parameters, body, returns, language) {
    fnName = fnName || 'testfunc';
    language = language || 'plpgsql';
    returns = returns ? `RETURNS ${returns}` : '';
    parameters = parameters || '';

    return `CREATE OR REPLACE FUNCTION pg_temp.${fnName}(${parameters}) ${returns} AS $func$ BEGIN ${body} END; $func$ LANGUAGE ${language}; SELECT * FROM pg_temp.${fnName}();`;
  }

  truncateTableQuery(tableName, options = {}) {
    return [
      `TRUNCATE ${this.quoteTable(tableName)}`,
      options.restartIdentity ? ' RESTART IDENTITY' : '',
      options.cascade ? ' CASCADE' : ''
    ].join('');
  }

  deleteQuery(tableName, where, options = {}, model) {
    const table = this.quoteTable(tableName);
    let whereClause = this.getWhereConditions(where, null, model, options);
    const limit = options.limit ? ` LIMIT ${this.escape(options.limit)}` : '';
    let primaryKeys = '';
    let primaryKeysSelection = '';

    if (whereClause) {
      whereClause = ` WHERE ${whereClause}`;
    }

    if (options.limit) {
      if (!model) {
        throw new Error('Cannot LIMIT delete without a model.');
      }

      const pks = Object.values(model.primaryKeys).map(pk => this.quoteIdentifier(pk.field)).join(',');

      primaryKeys = model.primaryKeyAttributes.length > 1 ? `(${pks})` : pks;
      primaryKeysSelection = pks;

      return `DELETE FROM ${table} WHERE ${primaryKeys} IN (SELECT ${primaryKeysSelection} FROM ${table}${whereClause}${limit})`;
    }
    return `DELETE FROM ${table}${whereClause}`;
  }

  showIndexesQuery(tableName) {
    let schemaJoin = '';
    let schemaWhere = '';
    if (typeof tableName !== 'string') {
      schemaJoin = ', pg_namespace s';
      schemaWhere = ` AND s.oid = t.relnamespace AND s.nspname = '${tableName.schema}'`;
      tableName = tableName.tableName;
    }

    // This is ARCANE!
    return 'SELECT i.relname AS name, ix.indisprimary AS primary, ix.indisunique AS unique, ix.indkey AS indkey, ' +
      'array_agg(a.attnum) as column_indexes, array_agg(a.attname) AS column_names, pg_get_indexdef(ix.indexrelid) ' +
      `AS definition FROM pg_class t, pg_class i, pg_index ix, pg_attribute a${schemaJoin} ` +
      'WHERE t.oid = ix.indrelid AND i.oid = ix.indexrelid AND a.attrelid = t.oid AND ' +
      `t.relkind = 'r' and t.relname = '${tableName}'${schemaWhere} ` +
      'GROUP BY i.relname, ix.indexrelid, ix.indisprimary, ix.indisunique, ix.indkey ORDER BY i.relname;';
  }

  showConstraintsQuery(tableName) {
    //Postgres converts camelCased alias to lowercase unless quoted
    return [
      'SELECT constraint_catalog AS "constraintCatalog",',
      'constraint_schema AS "constraintSchema",',
      'constraint_name AS "constraintName",',
      'table_catalog AS "tableCatalog",',
      'table_schema AS "tableSchema",',
      'table_name AS "tableName",',
      'constraint_type AS "constraintType",',
      'is_deferrable AS "isDeferrable",',
      'initially_deferred AS "initiallyDeferred"',
      'from INFORMATION_SCHEMA.table_constraints',
      `WHERE table_name='${tableName}';`
    ].join(' ');
  }

  removeIndexQuery(tableName, indexNameOrAttributes) {
    let indexName = indexNameOrAttributes;

    if (typeof indexName !== 'string') {
      indexName = Utils.underscore(`${tableName}_${indexNameOrAttributes.join('_')}`);
    }

    return `DROP INDEX IF EXISTS ${this.quoteIdentifiers(indexName)}`;
  }

  addLimitAndOffset(options) {
    let fragment = '';
    /* eslint-disable */
    if (options.limit != null) {
      fragment += ' LIMIT ' + this.escape(options.limit);
    }
    if (options.offset != null) {
      fragment += ' OFFSET ' + this.escape(options.offset);
    }
    /* eslint-enable */

    return fragment;
  }

  attributeToSQL(attribute, options) {
    if (!_.isPlainObject(attribute)) {
      attribute = {
        type: attribute
      };
    }

    let type;
    if (
      attribute.type instanceof DataTypes.ENUM ||
      attribute.type instanceof DataTypes.ARRAY && attribute.type.type instanceof DataTypes.ENUM
    ) {
      const enumType = attribute.type.type || attribute.type;
      let values = attribute.values;

      if (enumType.values && !attribute.values) {
        values = enumType.values;
      }

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

    if (Object.prototype.hasOwnProperty.call(attribute, 'allowNull') && !attribute.allowNull) {
      sql += ' NOT NULL';
    }

    if (attribute.autoIncrement) {
      if (attribute.autoIncrementIdentity) {
        sql += ' GENERATED BY DEFAULT AS IDENTITY';
      } else {
        sql += ' SERIAL';
      }
    }

    if (Utils.defaultValueSchemable(attribute.defaultValue)) {
      sql += ` DEFAULT ${this.escape(attribute.defaultValue, attribute)}`;
    }

    if (attribute.unique === true) {
      sql += ' UNIQUE';
    }

    if (attribute.primaryKey) {
      sql += ' PRIMARY KEY';
    }

    if (attribute.references) {
      let referencesTable = this.quoteTable(attribute.references.model);
      let schema;

      if (options.schema) {
        schema = options.schema;
      } else if (
        (!attribute.references.model || typeof attribute.references.model == 'string')
        && options.table
        && options.table.schema
      ) {
        schema = options.table.schema;
      }

      if (schema) {
        referencesTable = this.quoteTable(this.addSchema({
          tableName: referencesTable,
          _schema: schema
        }));
      }

      let referencesKey;

      if (attribute.references.key) {
        referencesKey = this.quoteIdentifiers(attribute.references.key);
      } else {
        referencesKey = this.quoteIdentifier('id');
      }

      sql += ` REFERENCES ${referencesTable} (${referencesKey})`;

      if (attribute.onDelete) {
        sql += ` ON DELETE ${attribute.onDelete.toUpperCase()}`;
      }

      if (attribute.onUpdate) {
        sql += ` ON UPDATE ${attribute.onUpdate.toUpperCase()}`;
      }

      if (attribute.references.deferrable) {
        sql += ` ${attribute.references.deferrable.toString(this)}`;
      }
    }

    if (attribute.comment && typeof attribute.comment === 'string') {
      if (options && (options.context === 'addColumn' || options.context === 'changeColumn')) {
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

  deferConstraintsQuery(options) {
    return options.deferrable.toString(this);
  }

  setConstraintQuery(columns, type) {
    let columnFragment = 'ALL';

    if (columns) {
      columnFragment = columns.map(column => this.quoteIdentifier(column)).join(', ');
    }

    return `SET CONSTRAINTS ${columnFragment} ${type}`;
  }

  setDeferredQuery(columns) {
    return this.setConstraintQuery(columns, 'DEFERRED');
  }

  setImmediateQuery(columns) {
    return this.setConstraintQuery(columns, 'IMMEDIATE');
  }

  attributesToSQL(attributes, options) {
    const result = {};

    for (const key in attributes) {
      const attribute = attributes[key];
      result[attribute.field || key] = this.attributeToSQL(attribute, { key, ...options });
    }

    return result;
  }

  createTrigger(tableName, triggerName, eventType, fireOnSpec, functionName, functionParams, optionsArray) {
    const decodedEventType = this.decodeTriggerEventType(eventType);
    const eventSpec = this.expandTriggerEventSpec(fireOnSpec);
    const expandedOptions = this.expandOptions(optionsArray);
    const paramList = this._expandFunctionParamList(functionParams);

    return `CREATE ${this.triggerEventTypeIsConstraint(eventType)}TRIGGER ${this.quoteIdentifier(triggerName)} ${decodedEventType} ${
      eventSpec} ON ${this.quoteTable(tableName)}${expandedOptions ? ` ${expandedOptions}` : ''} EXECUTE PROCEDURE ${functionName}(${paramList});`;
  }

  dropTrigger(tableName, triggerName) {
    return `DROP TRIGGER ${this.quoteIdentifier(triggerName)} ON ${this.quoteTable(tableName)} RESTRICT;`;
  }

  renameTrigger(tableName, oldTriggerName, newTriggerName) {
    return `ALTER TRIGGER ${this.quoteIdentifier(oldTriggerName)} ON ${this.quoteTable(tableName)} RENAME TO ${this.quoteIdentifier(newTriggerName)};`;
  }

  createFunction(functionName, params, returnType, language, body, optionsArray, options) {
    if (!functionName || !returnType || !language || !body) throw new Error('createFunction missing some parameters. Did you pass functionName, returnType, language and body?');

    const paramList = this._expandFunctionParamList(params);
    const variableList = options && options.variables ? this._expandFunctionVariableList(options.variables) : '';
    const expandedOptionsArray = this.expandOptions(optionsArray);

    const statement = options && options.force ? 'CREATE OR REPLACE FUNCTION' : 'CREATE FUNCTION';

    return `${statement} ${functionName}(${paramList}) RETURNS ${returnType} AS $func$ ${variableList} BEGIN ${body} END; $func$ language '${language}'${expandedOptionsArray};`;
  }

  dropFunction(functionName, params) {
    if (!functionName) throw new Error('requires functionName');
    // RESTRICT is (currently, as of 9.2) default but we'll be explicit
    const paramList = this._expandFunctionParamList(params);
    return `DROP FUNCTION ${functionName}(${paramList}) RESTRICT;`;
  }

  renameFunction(oldFunctionName, params, newFunctionName) {
    const paramList = this._expandFunctionParamList(params);
    return `ALTER FUNCTION ${oldFunctionName}(${paramList}) RENAME TO ${newFunctionName};`;
  }

  pgEscapeAndQuote(val) {
    return this.quoteIdentifier(Utils.removeTicks(this.escape(val), "'"));
  }

  _expandFunctionParamList(params) {
    if (params === undefined || !Array.isArray(params)) {
      throw new Error('_expandFunctionParamList: function parameters array required, including an empty one for no arguments');
    }

    const paramList = [];
    params.forEach(curParam => {
      const paramDef = [];
      if (curParam.type) {
        if (curParam.direction) { paramDef.push(curParam.direction); }
        if (curParam.name) { paramDef.push(curParam.name); }
        paramDef.push(curParam.type);
      } else {
        throw new Error('function or trigger used with a parameter without any type');
      }

      const joined = paramDef.join(' ');
      if (joined) paramList.push(joined);

    });

    return paramList.join(', ');
  }

  _expandFunctionVariableList(variables) {
    if (!Array.isArray(variables)) {
      throw new Error('_expandFunctionVariableList: function variables must be an array');
    }
    const variableDefinitions = [];
    variables.forEach(variable => {
      if (!variable.name || !variable.type) {
        throw new Error('function variable must have a name and type');
      }
      let variableDefinition = `DECLARE ${variable.name} ${variable.type}`;
      if (variable.default) {
        variableDefinition += ` := ${variable.default}`;
      }
      variableDefinition += ';';
      variableDefinitions.push(variableDefinition);
    });
    return variableDefinitions.join(' ');
  }

  expandOptions(options) {
    return options === undefined || _.isEmpty(options) ?
      '' : options.join(' ');
  }

  decodeTriggerEventType(eventSpecifier) {
    const EVENT_DECODER = {
      'after': 'AFTER',
      'before': 'BEFORE',
      'instead_of': 'INSTEAD OF',
      'after_constraint': 'AFTER'
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
    if (_.isEmpty(fireOnSpec)) {
      throw new Error('no table change events specified to trigger on');
    }

    return _.map(fireOnSpec, (fireValue, fireKey) => {
      const EVENT_MAP = {
        'insert': 'INSERT',
        'update': 'UPDATE',
        'delete': 'DELETE',
        'truncate': 'TRUNCATE'
      };

      if (!EVENT_MAP[fireValue]) {
        throw new Error(`parseTriggerEventSpec: undefined trigger event ${fireKey}`);
      }

      let eventSpec = EVENT_MAP[fireValue];
      if (eventSpec === 'UPDATE') {
        if (Array.isArray(fireValue) && fireValue.length > 0) {
          eventSpec += ` OF ${fireValue.join(', ')}`;
        }
      }

      return eventSpec;
    }).join(' OR ');
  }

  pgEnumName(tableName, attr, options) {
    options = options || {};

    const tableDetails = this.extractTableDetails(tableName, options);
    let enumName = Utils.addTicks(Utils.generateEnumName(tableDetails.tableName, attr), '"');

    // pgListEnums requires the enum name only, without the schema
    if (options.schema !== false && tableDetails.schema) {
      enumName = this.quoteIdentifier(tableDetails.schema) + tableDetails.delimiter + enumName;
    }

    return enumName;
  }

  pgListEnums(tableName, attrName, options) {
    let enumName = '';
    const tableDetails = this.extractTableDetails(tableName, options);

    if (tableDetails.tableName && attrName) {
      enumName = ` AND t.typname=${this.pgEnumName(tableDetails.tableName, attrName, { schema: false }).replace(/"/g, "'")}`;
    }

    return 'SELECT t.typname enum_name, array_agg(e.enumlabel ORDER BY enumsortorder) enum_value FROM pg_type t ' +
      'JOIN pg_enum e ON t.oid = e.enumtypid ' +
      'JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace ' +
      `WHERE n.nspname = '${tableDetails.schema}'${enumName} GROUP BY 1`;
  }

  pgEnum(tableName, attr, dataType, options) {
    const enumName = this.pgEnumName(tableName, attr, options);
    let values;

    if (dataType.values) {
      values = `ENUM(${dataType.values.map(value => this.escape(value)).join(', ')})`;
    } else {
      values = dataType.toString().match(/^ENUM\(.+\)/)[0];
    }

    let sql = `CREATE TYPE ${enumName} AS ${values};`;
    if (!!options && options.force === true) {
      sql = this.pgEnumDrop(tableName, attr) + sql;
    }
    return sql;
  }

  pgEnumAdd(tableName, attr, value, options) {
    const enumName = this.pgEnumName(tableName, attr);
    let sql = `ALTER TYPE ${enumName} ADD VALUE `;

    if (semver.gte(this.sequelize.options.databaseVersion, '9.3.0')) {
      sql += 'IF NOT EXISTS ';
    }
    sql += this.escape(value);

    if (options.before) {
      sql += ` BEFORE ${this.escape(options.before)}`;
    } else if (options.after) {
      sql += ` AFTER ${this.escape(options.after)}`;
    }

    return sql;
  }

  pgEnumDrop(tableName, attr, enumName) {
    enumName = enumName || this.pgEnumName(tableName, attr);
    return `DROP TYPE IF EXISTS ${enumName}; `;
  }

  fromArray(text) {
    text = text.replace(/^{/, '').replace(/}$/, '');
    let matches = text.match(/("(?:\\.|[^"\\\\])*"|[^,]*)(?:\s*,\s*|\s*$)/ig);

    if (matches.length < 1) {
      return [];
    }

    matches = matches.map(m => m.replace(/",$/, '').replace(/,$/, '').replace(/(^"|"$)/g, ''));

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
   * Generates an SQL query that returns all foreign keys of a table.
   *
   * @param  {string} tableName  The name of the table.
   * @returns {string}            The generated sql query.
   * @private
   */
  getForeignKeysQuery(tableName) {
    return 'SELECT conname as constraint_name, pg_catalog.pg_get_constraintdef(r.oid, true) as condef FROM pg_catalog.pg_constraint r ' +
      `WHERE r.conrelid = (SELECT oid FROM pg_class WHERE relname = '${tableName}' LIMIT 1) AND r.contype = 'f' ORDER BY 1;`;
  }

  /**
   * Generate common SQL prefix for getForeignKeyReferencesQuery.
   *
   * @returns {string}
   */
  _getForeignKeyReferencesQueryPrefix() {
    return 'SELECT ' +
      'DISTINCT tc.constraint_name as constraint_name, ' +
      'tc.constraint_schema as constraint_schema, ' +
      'tc.constraint_catalog as constraint_catalog, ' +
      'tc.table_name as table_name,' +
      'tc.table_schema as table_schema,' +
      'tc.table_catalog as table_catalog,' +
      'kcu.column_name as column_name,' +
      'ccu.table_schema  AS referenced_table_schema,' +
      'ccu.table_catalog  AS referenced_table_catalog,' +
      'ccu.table_name  AS referenced_table_name,' +
      'ccu.column_name AS referenced_column_name ' +
      'FROM information_schema.table_constraints AS tc ' +
      'JOIN information_schema.key_column_usage AS kcu ' +
      'ON tc.constraint_name = kcu.constraint_name ' +
      'JOIN information_schema.constraint_column_usage AS ccu ' +
      'ON ccu.constraint_name = tc.constraint_name ';
  }

  /**
   * Generates an SQL query that returns all foreign keys details of a table.
   *
   * As for getForeignKeysQuery is not compatible with getForeignKeyReferencesQuery, so add a new function.
   *
   * @param {string} tableName
   * @param {string} catalogName
   * @param {string} schemaName
   */
  getForeignKeyReferencesQuery(tableName, catalogName, schemaName) {
    return `${this._getForeignKeyReferencesQueryPrefix()
    }WHERE constraint_type = 'FOREIGN KEY' AND tc.table_name = '${tableName}'${
      catalogName ? ` AND tc.table_catalog = '${catalogName}'` : ''
    }${schemaName ? ` AND tc.table_schema = '${schemaName}'` : ''}`;
  }

  getForeignKeyReferenceQuery(table, columnName) {
    const tableName = table.tableName || table;
    const schema = table.schema;
    return `${this._getForeignKeyReferencesQueryPrefix()
    }WHERE constraint_type = 'FOREIGN KEY' AND tc.table_name='${tableName}' AND  kcu.column_name = '${columnName}'${
      schema ? ` AND tc.table_schema = '${schema}'` : ''}`;
  }

  /**
   * Generates an SQL query that removes a foreign key from a table.
   *
   * @param  {string} tableName  The name of the table.
   * @param  {string} foreignKey The name of the foreign key constraint.
   * @returns {string}            The generated sql query.
   * @private
   */
  dropForeignKeyQuery(tableName, foreignKey) {
    return `ALTER TABLE ${this.quoteTable(tableName)} DROP CONSTRAINT ${this.quoteIdentifier(foreignKey)};`;
  }
}

module.exports = PostgresQueryGenerator;
