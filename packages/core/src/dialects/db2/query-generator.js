'use strict';

import { rejectInvalidOptions } from '../../utils/check';
import { removeNullishValuesFromHash } from '../../utils/format';
import { removeTrailingSemicolon } from '../../utils/string';
import { defaultValueSchemable } from '../../utils/query-builder-utils';
import { attributeTypeToSql, normalizeDataType } from '../abstract/data-types-utils';
import {
  ADD_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
  CREATE_SCHEMA_QUERY_SUPPORTABLE_OPTIONS,
  REMOVE_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
} from '../abstract/query-generator';
import { Db2QueryGeneratorTypeScript } from './query-generator-typescript';

const _ = require('lodash');
const DataTypes = require('../../data-types');
const randomBytes = require('node:crypto').randomBytes;
const { Op } = require('../../operators');

const CREATE_SCHEMA_QUERY_SUPPORTED_OPTIONS = new Set();
const ADD_COLUMN_QUERY_SUPPORTED_OPTIONS = new Set();
const REMOVE_COLUMN_QUERY_SUPPORTED_OPTIONS = new Set();

/* istanbul ignore next */
function throwMethodUndefined(methodName) {
  throw new Error(`The method "${methodName}" is not defined! Please add it to your sql dialect.`);
}

export class Db2QueryGenerator extends Db2QueryGeneratorTypeScript {
  constructor(options) {
    super(options);

    this.whereSqlBuilder.setOperatorKeyword(Op.regexp, 'REGEXP_LIKE');
    this.whereSqlBuilder.setOperatorKeyword(Op.notRegexp, 'NOT REGEXP_LIKE');

    this.autoGenValue = 1;
  }

  createSchemaQuery(schema, options) {
    if (options) {
      rejectInvalidOptions(
        'createSchemaQuery',
        this.dialect.name,
        CREATE_SCHEMA_QUERY_SUPPORTABLE_OPTIONS,
        CREATE_SCHEMA_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    return `CREATE SCHEMA ${this.quoteIdentifier(schema)};`;
  }

  _errorTableCount = 0;

  dropSchemaQuery(schema) {
    // DROP SCHEMA Can't drop schema if it is not empty.
    // DROP SCHEMA Can't drop objects belonging to the schema
    // So, call the admin procedure to drop schema.
    const query = `CALL SYSPROC.ADMIN_DROP_SCHEMA(${wrapSingleQuote(schema.trim())}, NULL, $sequelize_errorSchema, $sequelize_errorTable)`;

    if (this._errorTableCount >= Number.MAX_SAFE_INTEGER) {
      this._errorTableCount = 0;
    }

    return {
      query,
      bind: {
        sequelize_errorSchema: { ParamType: 'INOUT', Data: 'ERRORSCHEMA' },
        sequelize_errorTable: { ParamType: 'INOUT', Data: `ERRORTABLE${this._errorTableCount++}` },
      },
    };
  }

  listSchemasQuery(options) {
    const schemasToSkip = ['NULLID', 'SQLJ', 'ERRORSCHEMA'];
    if (options?.skip) {
      schemasToSkip.push(...options.skip);
    }

    return `SELECT SCHEMANAME AS "schema_name" FROM SYSCAT.SCHEMATA WHERE (SCHEMANAME NOT LIKE 'SYS%') AND SCHEMANAME NOT IN (${schemasToSkip.map(schema => this.escape(schema)).join(', ')});`;
  }

  versionQuery() {
    return 'select service_level as VERSION from TABLE (sysproc.env_get_inst_info()) as A';
  }

  createTableQuery(tableName, attributes, options) {
    const query = 'CREATE TABLE IF NOT EXISTS <%= table %> (<%= attributes %>)';
    const primaryKeys = [];
    const foreignKeys = {};
    const attrStr = [];
    const commentTemplate = ' -- <%= comment %>, '
          + 'TableName = <%= table %>, ColumnName = <%= column %>;';

    let commentStr = '';

    for (const attr in attributes) {
      if (Object.prototype.hasOwnProperty.call(attributes, attr)) {
        let dataType = attributes[attr];
        let match;

        if (dataType.includes('COMMENT ')) {
          const commentMatch = dataType.match(/^(.+) (COMMENT.*)$/);
          if (commentMatch && commentMatch.length > 2) {
            const commentText = commentMatch[2].replace(/COMMENT/, '').trim();
            commentStr += _.template(commentTemplate, this._templateSettings)({
              table: this.quoteTable(tableName),
              comment: this.escape(commentText),
              column: this.quoteIdentifier(attr),
            });
            // remove comment related substring from dataType
            dataType = commentMatch[1];
          }
        }

        if (_.includes(dataType, 'PRIMARY KEY')) {
          primaryKeys.push(attr);

          if (_.includes(dataType, 'REFERENCES')) {
            // Db2 doesn't support inline REFERENCES declarations: move to the end
            match = dataType.match(/^(.+) (REFERENCES.*)$/);
            attrStr.push(`${this.quoteIdentifier(attr)} ${match[1].replace(/PRIMARY KEY/, '')}`);
            foreignKeys[attr] = match[2];
          } else {
            attrStr.push(`${this.quoteIdentifier(attr)} ${dataType.replace(/PRIMARY KEY/, '')}`);
          }
        } else if (_.includes(dataType, 'REFERENCES')) {
          // Db2 doesn't support inline REFERENCES declarations: move to the end
          match = dataType.match(/^(.+) (REFERENCES.*)$/);
          attrStr.push(`${this.quoteIdentifier(attr)} ${match[1]}`);
          foreignKeys[attr] = match[2];
        } else {
          if (options && options.uniqueKeys) {
            for (const ukey in options.uniqueKeys) {
              if (options.uniqueKeys[ukey].fields.includes(attr)
                  && !_.includes(dataType, 'NOT NULL')) {
                dataType += ' NOT NULL';
                break;
              }
            }
          }

          attrStr.push(`${this.quoteIdentifier(attr)} ${dataType}`);
        }

      }
    }

    const values = {
      table: this.quoteTable(tableName),
      attributes: attrStr.join(', '),
    };
    const pkString = primaryKeys.map(pk => {
      return this.quoteIdentifier(pk);
    }).join(', ');

    if (options && options.uniqueKeys) {
      _.each(options.uniqueKeys, (columns, indexName) => {
        if (!_.isString(indexName)) {
          indexName = `uniq_${tableName}_${columns.fields.join('_')}`;
        }

        values.attributes += `, CONSTRAINT ${this.quoteIdentifier(indexName)} UNIQUE (${columns.fields.map(field => this.quoteIdentifier(field)).join(', ')})`;
      });
    }

    if (pkString.length > 0) {
      values.attributes += `, PRIMARY KEY (${pkString})`;
    }

    for (const fkey in foreignKeys) {
      if (Object.prototype.hasOwnProperty.call(foreignKeys, fkey)) {
        values.attributes += `, FOREIGN KEY (${this.quoteIdentifier(fkey)}) ${foreignKeys[fkey]}`;
      }
    }

    return `${_.template(query, this._templateSettings)(values).trim()};${commentStr}`;
  }

  renameTableQuery(before, after) {
    const query = 'RENAME TABLE <%= before %> TO <%= after %>;';

    return _.template(query, this._templateSettings)({
      before: this.quoteTable(before),
      after: this.quoteTable(after),
    });
  }

  showTablesQuery() {
    return 'SELECT TABNAME AS "tableName", TRIM(TABSCHEMA) AS "tableSchema" FROM SYSCAT.TABLES WHERE TABSCHEMA = USER AND TYPE = \'T\' ORDER BY TABSCHEMA, TABNAME';
  }

  tableExistsQuery(table) {
    const tableName = table.tableName || table;
    // The default schema is the authorization ID of the owner of the plan or package.
    // https://www.ibm.com/docs/en/db2-for-zos/12?topic=concepts-db2-schemas-schema-qualifiers
    const schemaName = table.schema || this.sequelize.config.username.toUpperCase();

    // https://www.ibm.com/docs/en/db2-for-zos/11?topic=tables-systables
    return `SELECT name FROM sysibm.systables WHERE NAME = ${wrapSingleQuote(tableName)} AND CREATOR = ${wrapSingleQuote(schemaName)}`;
  }

  addColumnQuery(table, key, dataType, options) {
    if (options) {
      rejectInvalidOptions(
        'addColumnQuery',
        this.dialect.name,
        ADD_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
        ADD_COLUMN_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    dataType = {
      ...dataType,
      // TODO: attributeToSQL SHOULD be using attributes in addColumnQuery
      //       but instead we need to pass the key along as the field here
      field: key,
      type: normalizeDataType(dataType.type, this.dialect),
    };

    const query = 'ALTER TABLE <%= table %> ADD <%= attribute %>;';
    const attribute = _.template('<%= key %> <%= definition %>', this._templateSettings)({
      key: this.quoteIdentifier(key),
      definition: this.attributeToSQL(dataType, {
        context: 'addColumn',
      }),
    });

    return _.template(query, this._templateSettings)({
      table: this.quoteTable(table),
      attribute,
    });
  }

  removeColumnQuery(tableName, attributeName, options) {
    if (options) {
      rejectInvalidOptions(
        'removeColumnQuery',
        this.dialect.name,
        REMOVE_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
        REMOVE_COLUMN_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    const query = 'ALTER TABLE <%= tableName %> DROP COLUMN <%= attributeName %>;';

    return _.template(query, this._templateSettings)({
      tableName: this.quoteTable(tableName),
      attributeName: this.quoteIdentifier(attributeName),
    });
  }

  changeColumnQuery(tableName, attributes) {
    const query = 'ALTER TABLE <%= tableName %> <%= query %>;';
    const attrString = [];
    const constraintString = [];

    for (const attributeName in attributes) {
      const attrValue = attributes[attributeName];
      let defs = [attrValue];
      if (Array.isArray(attrValue)) {
        defs = attrValue;
      }

      for (const definition of defs) {
        if (/REFERENCES/.test(definition)) {
          constraintString.push(_.template('<%= fkName %> FOREIGN KEY (<%= attrName %>) <%= definition %>', this._templateSettings)({
            fkName: this.quoteIdentifier(`${attributeName}_foreign_idx`),
            attrName: this.quoteIdentifier(attributeName),
            definition: definition.replace(/.+?(?=REFERENCES)/, ''),
          }));
        } else if (_.startsWith(definition, 'DROP ')) {
          attrString.push(_.template('<%= attrName %> <%= definition %>', this._templateSettings)({
            attrName: this.quoteIdentifier(attributeName),
            definition,
          }));
        } else {
          attrString.push(_.template('<%= attrName %> SET <%= definition %>', this._templateSettings)({
            attrName: this.quoteIdentifier(attributeName),
            definition,
          }));
        }
      }
    }

    let finalQuery = '';
    if (attrString.length > 0) {
      finalQuery += `ALTER COLUMN ${attrString.join(' ALTER COLUMN ')}`;
      finalQuery += constraintString.length > 0 ? ' ' : '';
    }

    if (constraintString.length > 0) {
      finalQuery += `ADD CONSTRAINT ${constraintString.join(' ADD CONSTRAINT ')}`;
    }

    return _.template(query, this._templateSettings)({
      tableName: this.quoteTable(tableName),
      query: finalQuery,
    });
  }

  renameColumnQuery(tableName, attrBefore, attributes) {
    const query = 'ALTER TABLE <%= tableName %> RENAME COLUMN <%= before %> TO <%= after %>;';
    const newName = Object.keys(attributes)[0];

    return _.template(query, this._templateSettings)({
      tableName: this.quoteTable(tableName),
      before: this.quoteIdentifier(attrBefore),
      after: this.quoteIdentifier(newName),
    });
  }

  addConstraintQuery(tableName, options) {
    options = options || {};
    if (options.onUpdate && options.onUpdate.toUpperCase() === 'CASCADE') {
      // Db2 does not support ON UPDATE CASCADE, remove it.
      delete options.onUpdate;
    }

    const constraintSnippet = this.getConstraintSnippet(tableName, options);

    if (typeof tableName === 'string') {
      tableName = this.quoteIdentifiers(tableName);
    } else {
      tableName = this.quoteTable(tableName);
    }

    return `ALTER TABLE ${tableName} ADD ${constraintSnippet};`;
  }

  bulkInsertQuery(tableName, attrValueHashes, options, attributes) {
    options = options || {};
    attributes = attributes || {};
    let query = 'INSERT INTO <%= table %> (<%= attributes %>)<%= output %> VALUES <%= tuples %>;';
    if (options.returning) {
      query = 'SELECT * FROM FINAL TABLE (INSERT INTO <%= table %> (<%= attributes %>)<%= output %> VALUES <%= tuples %>);';
    }

    const emptyQuery = 'INSERT INTO <%= table %>';
    const tuples = [];
    const allAttributes = [];
    const allQueries = [];

    let outputFragment;
    const valuesForEmptyQuery = [];

    if (options.returning) {
      outputFragment = '';
    }

    _.forEach(attrValueHashes, attrValueHash => {
      // special case for empty objects with primary keys
      const fields = Object.keys(attrValueHash);
      const firstAttr = attributes[fields[0]];
      if (fields.length === 1 && firstAttr && firstAttr.autoIncrement && attrValueHash[fields[0]] === null) {
        valuesForEmptyQuery.push(`(${this.autoGenValue++})`);

        return;
      }

      // normal case
      _.forOwn(attrValueHash, (value, key) => {
        if (!allAttributes.includes(key)) {
          if (value === null && attributes[key] && attributes[key].autoIncrement) {
            return;
          }

          allAttributes.push(key);
        }
      });
    });
    if (valuesForEmptyQuery.length > 0) {
      allQueries.push(`${emptyQuery} VALUES ${valuesForEmptyQuery.join(',')}`);
    }

    if (allAttributes.length > 0) {
      _.forEach(attrValueHashes, attrValueHash => {
        tuples.push(`(${
          // TODO: pass type of attribute & model
          allAttributes.map(key => this.escape(attrValueHash[key] ?? null, { replacements: options.replacements })).join(',')})`);
      });
      allQueries.push(query);
    }

    const replacements = {
      table: this.quoteTable(tableName),
      attributes: allAttributes.map(attr => this.quoteIdentifier(attr)).join(','),
      tuples,
      output: outputFragment,
    };

    const generatedQuery = _.template(allQueries.join(';'), this._templateSettings)(replacements);

    return generatedQuery;
  }

  updateQuery(tableName, attrValueHash, where, options, attributes) {
    const sql = super.updateQuery(tableName, attrValueHash, where, options, attributes);
    options = options || {};
    _.defaults(options, this.options);
    if (!options.limit) {
      sql.query = `SELECT * FROM FINAL TABLE (${removeTrailingSemicolon(sql.query)});`;

      return sql;
    }

    attrValueHash = removeNullishValuesFromHash(attrValueHash, options.omitNull, options);

    const modelAttributeMap = {};
    const values = [];
    const bind = {};
    const bindParam = options.bindParam || this.bindParam(bind);

    if (attributes) {
      _.each(attributes, (attribute, key) => {
        modelAttributeMap[key] = attribute;
        if (attribute.field) {
          modelAttributeMap[attribute.field] = attribute;
        }
      });
    }

    for (const key in attrValueHash) {
      const value = attrValueHash[key] ?? null;
      const escapedValue = this.escape(value, {
        // TODO: pass model
        type: modelAttributeMap[key]?.type,
        replacements: options.replacements,
        bindParam,
      });

      values.push(`${this.quoteIdentifier(key)}=${escapedValue}`);
    }

    let query;
    const whereOptions = _.defaults({ bindParam }, options);

    query = `UPDATE (SELECT * FROM ${this.quoteTable(tableName)} ${this.whereQuery(where, whereOptions)} FETCH NEXT ${this.escape(options.limit, undefined, { replacements: options.replacements })} ROWS ONLY) SET ${values.join(',')}`;
    query = `SELECT * FROM FINAL TABLE (${query});`;

    return { query, bind };
  }

  upsertQuery(tableName, insertValues, updateValues, where, model, options) {
    const targetTableAlias = this.quoteTable(`${tableName}_target`);
    const sourceTableAlias = this.quoteTable(`${tableName}_source`);
    const primaryKeysColumns = [];
    const identityColumns = [];
    const uniqueAttrs = [];
    const tableNameQuoted = this.quoteTable(tableName);

    const modelDefinition = model.modelDefinition;
    // Obtain primaryKeys, uniquekeys and identity attrs from rawAttributes as model is not passed
    const attributes = modelDefinition.attributes;
    for (const attribute of attributes.values()) {
      if (attribute.primaryKey) {
        primaryKeysColumns.push(attribute.columnName);
      }

      if (attribute.autoIncrement) {
        identityColumns.push(attribute.columnName);
      }
    }

    // Add unique indexes defined by indexes option to uniqueAttrs
    for (const index of model.getIndexes()) {
      if (index.unique && index.fields) {
        for (const field of index.fields) {
          const fieldName = typeof field === 'string' ? field : field.name || field.attribute;
          // TODO: "index.fields" are column names, not an attribute name. This is a bug.
          if (!uniqueAttrs.includes(fieldName) && attributes.has(fieldName)) {
            uniqueAttrs.push(fieldName);
          }
        }
      }
    }

    const updateKeys = Object.keys(updateValues);
    const insertKeys = Object.keys(insertValues);
    const insertKeysQuoted = insertKeys.map(key => this.quoteIdentifier(key)).join(', ');
    const insertValuesEscaped = insertKeys.map(key => {
      return this.escape(insertValues[key], {
        // TODO: pass type
        // TODO: bind param
        replacements: options.replacements,
        model,
      });
    }).join(', ');
    const sourceTableQuery = `VALUES(${insertValuesEscaped})`; // Virtual Table
    let joinCondition;

    // Filter NULL Clauses
    const clauses = where[Op.or].filter(clause => {
      let valid = true;
      /*
       * Exclude NULL Composite PK/UK. Partial Composite clauses should also be excluded as it doesn't guarantee a single row
       */
      for (const key of Object.keys(clause)) {
        if (clause[key] == null) {
          valid = false;
          break;
        }
      }

      return valid;
    });

    /*
     * Generate ON condition using PK(s).
     * If not, generate using UK(s). Else throw error
     */
    const getJoinSnippet = array => {
      return array.map(key => {
        key = this.quoteIdentifier(key);

        return `${targetTableAlias}.${key} = ${sourceTableAlias}.${key}`;
      });
    };

    if (clauses.length === 0) {
      throw new Error('Primary Key or Unique key should be passed to upsert query');
    } else {
      // Search for primary key attribute in clauses -- Model can have two separate unique keys
      for (const key in clauses) {
        const keys = Object.keys(clauses[key]);
        const columnName = modelDefinition.getColumnNameLoose(keys[0]);

        if (primaryKeysColumns.includes(columnName)) {
          joinCondition = getJoinSnippet(primaryKeysColumns).join(' AND ');
          break;
        }
      }

      if (!joinCondition) {
        joinCondition = getJoinSnippet(uniqueAttrs).join(' AND ');
      }
    }

    // Remove the IDENTITY_INSERT Column from update
    const filteredUpdateClauses = updateKeys.filter(key => {
      if (!identityColumns.includes(key)) {
        return true;
      }

      return false;
    })
      .map(key => {
        const value = this.escape(updateValues[key], undefined, { replacements: options.replacements });
        key = this.quoteIdentifier(key);

        return `${targetTableAlias}.${key} = ${value}`;
      }).join(', ');
    const updateSnippet = filteredUpdateClauses.length > 0 ? `WHEN MATCHED THEN UPDATE SET ${filteredUpdateClauses}` : '';

    const insertSnippet = `(${insertKeysQuoted}) VALUES(${insertValuesEscaped})`;

    let query = `MERGE INTO ${tableNameQuoted} AS ${targetTableAlias} USING (${sourceTableQuery}) AS ${sourceTableAlias}(${insertKeysQuoted}) ON ${joinCondition}`;
    query += ` ${updateSnippet} WHEN NOT MATCHED THEN INSERT ${insertSnippet};`;

    return query;
  }

  truncateTableQuery(tableName) {
    return `TRUNCATE TABLE ${this.quoteTable(tableName)} IMMEDIATE`;
  }

  deleteQuery(tableName, where, options = {}, model) {
    const table = this.quoteTable(tableName);
    let query = `DELETE FROM ${table}`;

    const whereSql = this.whereQuery(where, { ...options, model });
    if (whereSql) {
      query += ` ${whereSql}`;
    }

    query += this.addLimitAndOffset(options);

    return query;
  }

  addIndexQuery(tableName, attributes, options, rawTablename) {
    if ('include' in attributes && !attributes.unique) {
      throw new Error('DB2 does not support non-unique indexes with INCLUDE syntax.');
    }

    return super.addIndexQuery(tableName, attributes, options, rawTablename);
  }

  showConstraintsQuery(tableName, constraintName) {
    let sql = `SELECT CONSTNAME AS "constraintName", TRIM(TABSCHEMA) AS "schemaName", TABNAME AS "tableName" FROM SYSCAT.TABCONST WHERE TABNAME = '${tableName}'`;

    if (constraintName) {
      sql += ` AND CONSTNAME LIKE '%${constraintName}%'`;
    }

    return `${sql} ORDER BY CONSTNAME;`;
  }

  attributeToSQL(attribute, options) {
    if (!_.isPlainObject(attribute)) {
      attribute = {
        type: attribute,
      };
    }

    let template;
    let changeNull = 1;

    if (attribute.type instanceof DataTypes.ENUM) {
      // enums are a special case
      template = attribute.type.toSql({ dialect: this.dialect });
      template += ` CHECK (${this.quoteIdentifier(attribute.field)} IN(${attribute.type.options.values.map(value => {
        return this.escape(value, undefined, { replacements: options?.replacements });
      }).join(', ')}))`;
    } else {
      template = attributeTypeToSql(attribute.type, { dialect: this.dialect });
    }

    if (options && options.context === 'changeColumn' && attribute.type) {
      template = `DATA TYPE ${template}`;
    } else if (attribute.allowNull === false || attribute.primaryKey === true) {
      template += ' NOT NULL';
      changeNull = 0;
    }

    if (attribute.autoIncrement) {
      let initialValue = 1;
      if (attribute.initialAutoIncrement) {
        initialValue = attribute.initialAutoIncrement;
      }

      template += ` GENERATED BY DEFAULT AS IDENTITY(START WITH ${initialValue}, INCREMENT BY 1)`;
    }

    // Blobs/texts cannot have a defaultValue
    if (attribute.type !== 'TEXT' && attribute.type._binary !== true
        && defaultValueSchemable(attribute.defaultValue)) {
      template += ` DEFAULT ${this.escape(attribute.defaultValue, { replacements: options?.replacements, type: attribute.type })}`;
    }

    if (attribute.unique === true && (options?.context !== 'changeColumn' || this.dialect.supports.alterColumn.unique)) {
      template += ' UNIQUE';
    }

    if (attribute.primaryKey) {
      template += ' PRIMARY KEY';
    }

    if ((!options || !options.withoutForeignKeyConstraints) && attribute.references) {
      if (options && options.context === 'addColumn' && options.foreignKey) {
        const attrName = this.quoteIdentifier(options.foreignKey);
        const fkName = `${options.tableName}_${attrName}_fidx`;
        template += `, CONSTRAINT ${fkName} FOREIGN KEY (${attrName})`;
      }

      template += ` REFERENCES ${this.quoteTable(attribute.references.table)}`;

      if (attribute.references.key) {
        template += ` (${this.quoteIdentifier(attribute.references.key)})`;
      } else {
        template += ` (${this.quoteIdentifier('id')})`;
      }

      if (attribute.onDelete) {
        template += ` ON DELETE ${attribute.onDelete.toUpperCase()}`;
      }

      if (attribute.onUpdate && attribute.onUpdate.toUpperCase() !== 'CASCADE') {
        // Db2 do not support CASCADE option for ON UPDATE clause.
        template += ` ON UPDATE ${attribute.onUpdate.toUpperCase()}`;
      }
    }

    if (options && options.context === 'changeColumn' && changeNull === 1
        && attribute.allowNull !== undefined) {
      template = [template];
      if (attribute.allowNull) {
        template.push('DROP NOT NULL');
      } else {
        template.push('NOT NULL');
      }
    }

    if (attribute.comment && typeof attribute.comment === 'string') {
      template += ` COMMENT ${attribute.comment}`;
    }

    return template;
  }

  attributesToSQL(attributes, options) {
    const result = {};
    const existingConstraints = [];
    let key;
    let attribute;

    for (key in attributes) {
      attribute = attributes[key];

      if (attribute.references) {

        if (existingConstraints.includes(this.quoteTable(attribute.references.table))) {
          // no cascading constraints to a table more than once
          attribute.onDelete = '';
          attribute.onUpdate = '';
        } else if (attribute.unique && attribute.unique === true) {
          attribute.onDelete = '';
          attribute.onUpdate = '';
        } else {
          existingConstraints.push(this.quoteTable(attribute.references.table));
        }
      }

      if (key && !attribute.field && typeof attribute === 'object') {
        attribute.field = key;
      }

      result[attribute.field || key] = this.attributeToSQL(attribute, options);
    }

    return result;
  }

  createTrigger() {
    throwMethodUndefined('createTrigger');
  }

  dropTrigger() {
    throwMethodUndefined('dropTrigger');
  }

  renameTrigger() {
    throwMethodUndefined('renameTrigger');
  }

  createFunction() {
    throwMethodUndefined('createFunction');
  }

  dropFunction() {
    throwMethodUndefined('dropFunction');
  }

  renameFunction() {
    throwMethodUndefined('renameFunction');
  }

  /**
   * Generate SQL for ForeignKeysQuery.
   *
   * @param {string} condition   The condition string for query.
   * @returns {string}
   */
  _getForeignKeysQuerySQL(condition) {
    return 'SELECT R.CONSTNAME AS "constraintName", '
        + 'TRIM(R.TABSCHEMA) AS "constraintSchema", '
        + 'R.TABNAME AS "tableName", '
        + 'TRIM(R.TABSCHEMA) AS "tableSchema", LISTAGG(C.COLNAME,\', \') '
        + 'WITHIN GROUP (ORDER BY C.COLNAME) AS "columnName", '
        + 'TRIM(R.REFTABSCHEMA) AS "referencedTableSchema", '
        + 'R.REFTABNAME AS "referencedTableName", '
        + 'TRIM(R.PK_COLNAMES) AS "referencedColumnName" '
        + 'FROM SYSCAT.REFERENCES R, SYSCAT.KEYCOLUSE C '
        + 'WHERE R.CONSTNAME = C.CONSTNAME AND R.TABSCHEMA = C.TABSCHEMA '
        + `AND R.TABNAME = C.TABNAME${condition} GROUP BY R.REFTABSCHEMA, `
        + 'R.REFTABNAME, R.TABSCHEMA, R.TABNAME, R.CONSTNAME, R.PK_COLNAMES';
  }

  /**
   * Generates an SQL query that returns all foreign keys of a table.
   *
   * @param {Stirng|object} table The name of the table.
   * @param {string} schemaName   The name of the schema.
   * @returns {string}            The generated sql query.
   */
  getForeignKeysQuery(table, schemaName) {
    const tableName = table.tableName || table;
    schemaName = table.schema || schemaName;
    let sql = '';
    if (tableName) {
      sql = ` AND R.TABNAME = ${wrapSingleQuote(tableName)}`;
    }

    if (schemaName) {
      sql += ` AND R.TABSCHEMA = ${wrapSingleQuote(schemaName)}`;
    }

    return this._getForeignKeysQuerySQL(sql);
  }

  getForeignKeyQuery(table, columnName) {
    const tableName = table.tableName || table;
    const schemaName = table.schema;
    let sql = '';
    if (tableName) {
      sql = ` AND R.TABNAME = ${wrapSingleQuote(tableName)}`;
    }

    if (schemaName) {
      sql += ` AND R.TABSCHEMA = ${wrapSingleQuote(schemaName)}`;
    }

    if (columnName) {
      sql += ` AND C.COLNAME = ${wrapSingleQuote(columnName)}`;
    }

    return this._getForeignKeysQuerySQL(sql);
  }

  dropForeignKeyQuery(tableName, foreignKey) {
    return _.template('ALTER TABLE <%= table %> DROP FOREIGN KEY <%= key %>;', this._templateSettings)({
      table: this.quoteTable(tableName),
      key: this.quoteIdentifier(foreignKey),
    });
  }

  setAutocommitQuery() {
    return '';
  }

  setIsolationLevelQuery() {}

  generateTransactionId() {
    return randomBytes(10).toString('hex');
  }

  startTransactionQuery(transaction) {
    if (transaction.parent) {
      return `SAVE TRANSACTION ${this.quoteIdentifier(transaction.name)};`;
    }

    return 'BEGIN TRANSACTION;';
  }

  commitTransactionQuery(transaction) {
    if (transaction.parent) {
      return;
    }

    return 'COMMIT TRANSACTION;';
  }

  rollbackTransactionQuery(transaction) {
    if (transaction.parent) {
      return `ROLLBACK TRANSACTION ${this.quoteIdentifier(transaction.name)};`;
    }

    return 'ROLLBACK TRANSACTION;';
  }

  addLimitAndOffset(options) {
    const offset = options.offset || 0;
    let fragment = '';

    if (offset) {
      fragment += ` OFFSET ${this.escape(offset, { replacements: options.replacements })} ROWS`;
    }

    if (options.limit) {
      fragment += ` FETCH NEXT ${this.escape(options.limit, { replacements: options.replacements })} ROWS ONLY`;
    }

    return fragment;
  }

  addUniqueFields(dataValues, rawAttributes, uniqno) {
    uniqno = uniqno === undefined ? 1 : uniqno;
    for (const key in rawAttributes) {
      if (rawAttributes[key].unique && dataValues[key] === undefined) {
        if (rawAttributes[key].type instanceof DataTypes.DATE) {
          dataValues[key] = new Date();
        } else if (rawAttributes[key].type instanceof DataTypes.STRING) {
          dataValues[key] = `unique${uniqno++}`;
        } else if (rawAttributes[key].type instanceof DataTypes.INTEGER) {
          dataValues[key] = uniqno++;
        } else if (rawAttributes[key].type instanceof DataTypes.BOOLEAN) {
          dataValues[key] = new DataTypes.BOOLEAN(false);
        }
      }
    }

    return uniqno;
  }
}

/**
 * @param {string} identifier
 * @deprecated use "escape" or "escapeString" on QueryGenerator
 */
function wrapSingleQuote(identifier) {
  if (identifier) {
    return `'${identifier}'`;
    // return addTicks("'"); // It removes quote from center too.
  }

  return '';
}
