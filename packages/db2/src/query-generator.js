'use strict';

import { DataTypes, Op, ParameterStyle } from '@sequelize/core';
import { normalizeDataType } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types-utils.js';
import {
  ADD_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
  CREATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.js';
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { removeNullishValuesFromHash } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/format.js';
import { EMPTY_SET } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import { createBindParamGenerator } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import { removeTrailingSemicolon } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/string.js';
import { pojo } from '@sequelize/utils';
import defaults from 'lodash/defaults';
import each from 'lodash/each';
import forEach from 'lodash/forEach';
import forOwn from 'lodash/forOwn';
import includes from 'lodash/includes';
import isString from 'lodash/isString';
import startsWith from 'lodash/startsWith';
import template from 'lodash/template';
import { Db2QueryGeneratorTypeScript } from './query-generator-typescript.internal.js';

const CREATE_TABLE_QUERY_SUPPORTED_OPTIONS = new Set(['uniqueKeys']);

/* istanbul ignore next */
function throwMethodUndefined(methodName) {
  throw new Error(`The method "${methodName}" is not defined! Please add it to your sql dialect.`);
}

export class Db2QueryGenerator extends Db2QueryGeneratorTypeScript {
  constructor(dialect, internals) {
    super(dialect, internals);

    this.autoGenValue = 1;
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

    const query = 'CREATE TABLE IF NOT EXISTS <%= table %> (<%= attributes %>)';
    const primaryKeys = [];
    const foreignKeys = {};
    const attrStr = [];
    const commentTemplate = ` -- <%= comment %>, TableName = <%= table %>, ColumnName = <%= column %>;`;

    let commentStr = '';

    for (const attr in attributes) {
      if (Object.hasOwn(attributes, attr)) {
        let dataType = attributes[attr];
        let match;

        if (dataType.includes('COMMENT ')) {
          const commentMatch = dataType.match(/^(.+) (COMMENT.*)$/);
          if (commentMatch && commentMatch.length > 2) {
            const commentText = commentMatch[2].replace(/COMMENT/, '').trim();
            commentStr += template(
              commentTemplate,
              this._templateSettings,
            )({
              table: this.quoteTable(tableName),
              comment: this.escape(commentText),
              column: this.quoteIdentifier(attr),
            });
            // remove comment related substring from dataType
            dataType = commentMatch[1];
          }
        }

        if (includes(dataType, 'PRIMARY KEY')) {
          primaryKeys.push(attr);

          if (includes(dataType, 'REFERENCES')) {
            // Db2 doesn't support inline REFERENCES declarations: move to the end
            match = dataType.match(/^(.+) (REFERENCES.*)$/);
            attrStr.push(`${this.quoteIdentifier(attr)} ${match[1].replace(/PRIMARY KEY/, '')}`);
            foreignKeys[attr] = match[2];
          } else {
            attrStr.push(`${this.quoteIdentifier(attr)} ${dataType.replace(/PRIMARY KEY/, '')}`);
          }
        } else if (includes(dataType, 'REFERENCES')) {
          // Db2 doesn't support inline REFERENCES declarations: move to the end
          match = dataType.match(/^(.+) (REFERENCES.*)$/);
          attrStr.push(`${this.quoteIdentifier(attr)} ${match[1]}`);
          foreignKeys[attr] = match[2];
        } else {
          if (options && options.uniqueKeys) {
            for (const ukey in options.uniqueKeys) {
              if (
                options.uniqueKeys[ukey].fields.includes(attr) &&
                !includes(dataType, 'NOT NULL')
              ) {
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
    const pkString = primaryKeys
      .map(pk => {
        return this.quoteIdentifier(pk);
      })
      .join(', ');

    if (options && options.uniqueKeys) {
      each(options.uniqueKeys, (columns, indexName) => {
        if (!isString(indexName)) {
          indexName = `uniq_${tableName}_${columns.fields.join('_')}`;
        }

        values.attributes += `, CONSTRAINT ${this.quoteIdentifier(indexName)} UNIQUE (${columns.fields.map(field => this.quoteIdentifier(field)).join(', ')})`;
      });
    }

    if (pkString.length > 0) {
      values.attributes += `, PRIMARY KEY (${pkString})`;
    }

    for (const fkey in foreignKeys) {
      if (Object.hasOwn(foreignKeys, fkey)) {
        values.attributes += `, FOREIGN KEY (${this.quoteIdentifier(fkey)}) ${foreignKeys[fkey]}`;
      }
    }

    return `${template(query, this._templateSettings)(values).trim()};${commentStr}`;
  }

  addColumnQuery(table, key, dataType, options) {
    if (options) {
      rejectInvalidOptions(
        'addColumnQuery',
        this.dialect,
        ADD_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
        EMPTY_SET,
        options,
      );
    }

    dataType = {
      ...dataType,
      // TODO: attributeToSql SHOULD be using attributes in addColumnQuery
      //       but instead we need to pass the key along as the field here
      field: key,
      type: normalizeDataType(dataType.type, this.dialect),
    };

    const query = 'ALTER TABLE <%= table %> ADD <%= attribute %>;';
    const attribute = template(
      '<%= key %> <%= definition %>',
      this._templateSettings,
    )({
      key: this.quoteIdentifier(key),
      definition: this.attributeToSql(dataType, {
        context: 'addColumn',
        tableOrModel: table,
      }),
    });

    return template(
      query,
      this._templateSettings,
    )({
      table: this.quoteTable(table),
      attribute,
    });
  }

  changeColumnQuery(tableName, attributes, columns) {
    const query = 'ALTER TABLE <%= tableName %> <%= query %>;';
    const attrString = [];
    const constraintString = [];

    for (const attributeName in attributes) {
      const defs = [attributes[attributeName]];

      // db2 cannot change the type and the nullability of a column in one ALTER COLUMN clause
      const { allowNull } = columns?.[attributeName] ?? {};
      if (allowNull !== undefined) {
        defs.push(allowNull ? 'DROP NOT NULL' : 'NOT NULL');
      }

      for (const definition of defs) {
        if (/REFERENCES/.test(definition)) {
          constraintString.push(
            template(
              '<%= fkName %> FOREIGN KEY (<%= attrName %>) <%= definition %>',
              this._templateSettings,
            )({
              fkName: this.quoteIdentifier(`${attributeName}_foreign_idx`),
              attrName: this.quoteIdentifier(attributeName),
              definition: definition.replace(/.+?(?=REFERENCES)/, ''),
            }),
          );
        } else if (startsWith(definition, 'DROP ')) {
          attrString.push(
            template(
              '<%= attrName %> <%= definition %>',
              this._templateSettings,
            )({
              attrName: this.quoteIdentifier(attributeName),
              definition,
            }),
          );
        } else {
          attrString.push(
            template(
              '<%= attrName %> SET <%= definition %>',
              this._templateSettings,
            )({
              attrName: this.quoteIdentifier(attributeName),
              definition,
            }),
          );
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

    return template(
      query,
      this._templateSettings,
    )({
      tableName: this.quoteTable(tableName),
      query: finalQuery,
    });
  }

  renameColumnQuery(tableName, attrBefore, attributes) {
    const query = 'ALTER TABLE <%= tableName %> RENAME COLUMN <%= before %> TO <%= after %>;';
    const newName = Object.keys(attributes)[0];

    return template(
      query,
      this._templateSettings,
    )({
      tableName: this.quoteTable(tableName),
      before: this.quoteIdentifier(attrBefore),
      after: this.quoteIdentifier(newName),
    });
  }

  bulkInsertQuery(tableName, attrValueHashes, options, attributes) {
    options ||= {};
    attributes ||= {};
    let query = 'INSERT INTO <%= table %> (<%= attributes %>)<%= output %> VALUES <%= tuples %>;';
    if (options.returning) {
      query =
        'SELECT * FROM FINAL TABLE (INSERT INTO <%= table %> (<%= attributes %>)<%= output %> VALUES <%= tuples %>);';
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

    forEach(attrValueHashes, attrValueHash => {
      // special case for empty objects with primary keys
      const fields = Object.keys(attrValueHash);
      const firstAttr = attributes[fields[0]];
      if (
        fields.length === 1 &&
        firstAttr &&
        firstAttr.autoIncrement &&
        attrValueHash[fields[0]] === null
      ) {
        valuesForEmptyQuery.push(`(${this.autoGenValue++})`);

        return;
      }

      // normal case
      forOwn(attrValueHash, (value, key) => {
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
      forEach(attrValueHashes, attrValueHash => {
        tuples.push(
          `(${
            // TODO: pass type of attribute & model
            allAttributes
              .map(key =>
                this.escape(attrValueHash[key] ?? null, { replacements: options.replacements }),
              )
              .join(',')
          })`,
        );
      });
      allQueries.push(query);
    }

    const replacements = {
      table: this.quoteTable(tableName),
      attributes: allAttributes.map(attr => this.quoteIdentifier(attr)).join(','),
      tuples,
      output: outputFragment,
    };

    const generatedQuery = template(allQueries.join(';'), this._templateSettings)(replacements);

    return generatedQuery;
  }

  updateQuery(tableName, attrValueHash, where, options, attributes) {
    const sql = super.updateQuery(tableName, attrValueHash, where, options, attributes);
    options ||= {};
    defaults(options, this.options);
    if (!options.limit) {
      sql.query = `SELECT * FROM FINAL TABLE (${removeTrailingSemicolon(sql.query)});`;

      return sql;
    }

    attrValueHash = removeNullishValuesFromHash(attrValueHash, options.omitNull, options);

    let bind;
    let bindParam;
    const parameterStyle = options?.parameterStyle ?? ParameterStyle.BIND;
    const modelAttributeMap = {};
    const values = [];

    if (parameterStyle === ParameterStyle.BIND) {
      bind = pojo();
      bindParam = createBindParamGenerator(bind);
    }

    if (attributes) {
      each(attributes, (attribute, key) => {
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
    const whereOptions = defaults({ bindParam }, options);

    query = `UPDATE (SELECT * FROM ${this.quoteTable(tableName)} ${this.whereQuery(where, whereOptions)} FETCH NEXT ${this.escape(options.limit, undefined, { replacements: options.replacements })} ROWS ONLY) SET ${values.join(',')}`;
    query = `SELECT * FROM FINAL TABLE (${query});`;

    const result = { query };
    if (parameterStyle === ParameterStyle.BIND) {
      result.bind = bind;
    }

    return result;
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
    const insertValuesEscaped = insertKeys
      .map(key => {
        return this.escape(insertValues[key], {
          // TODO: pass type
          // TODO: bind param
          replacements: options.replacements,
          model,
        });
      })
      .join(', ');
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
    const filteredUpdateClauses = updateKeys
      .filter(key => {
        if (!identityColumns.includes(key)) {
          return true;
        }

        return false;
      })
      .map(key => {
        const value = this.escape(updateValues[key], undefined, {
          replacements: options.replacements,
        });
        key = this.quoteIdentifier(key);

        return `${targetTableAlias}.${key} = ${value}`;
      })
      .join(', ');
    const updateSnippet =
      filteredUpdateClauses.length > 0
        ? `WHEN MATCHED THEN UPDATE SET ${filteredUpdateClauses}`
        : '';

    const insertSnippet = `(${insertKeysQuoted}) VALUES(${insertValuesEscaped})`;

    let query = `MERGE INTO ${tableNameQuoted} AS ${targetTableAlias} USING (${sourceTableQuery}) AS ${sourceTableAlias}(${insertKeysQuoted}) ON ${joinCondition}`;
    query += ` ${updateSnippet} WHEN NOT MATCHED THEN INSERT ${insertSnippet};`;

    return query;
  }

  addIndexQuery(tableName, attributes, options, rawTablename) {
    if ('include' in attributes && !attributes.unique) {
      throw new Error('DB2 does not support non-unique indexes with INCLUDE syntax.');
    }

    return super.addIndexQuery(tableName, attributes, options, rawTablename);
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
