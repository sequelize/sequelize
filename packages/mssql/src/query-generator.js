'use strict';

import { DataTypes, Op } from '@sequelize/core';
import {
  attributeTypeToSql,
  normalizeDataType,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types-utils.js';
import {
  ADD_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
  CREATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.js';
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { joinSQLFragments } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/join-sql-fragments.js';
import { EMPTY_SET } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import { defaultValueSchemable } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/query-builder-utils.js';
import { generateIndexName } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/string.js';
import each from 'lodash/each';
import forOwn from 'lodash/forOwn';
import isPlainObject from 'lodash/isPlainObject';
import isString from 'lodash/isString';
import { MsSqlQueryGeneratorTypeScript } from './query-generator-typescript.internal.js';

/* istanbul ignore next */
function throwMethodUndefined(methodName) {
  throw new Error(`The method "${methodName}" is not defined! Please add it to your sql dialect.`);
}

const CREATE_TABLE_QUERY_SUPPORTED_OPTIONS = new Set(['uniqueKeys']);

export class MsSqlQueryGenerator extends MsSqlQueryGeneratorTypeScript {
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

    const primaryKeys = [];
    const foreignKeys = {};
    const attributesClauseParts = [];

    let commentStr = '';

    for (const attr in attributes) {
      if (Object.hasOwn(attributes, attr)) {
        let dataType = attributes[attr];
        let match;

        if (dataType.includes('COMMENT ')) {
          const commentMatch = dataType.match(/^(.+) (COMMENT.*)$/);
          const commentText = commentMatch[2].replace('COMMENT', '').trim();
          commentStr += this.commentTemplate(commentText, tableName, attr);
          // remove comment related substring from dataType
          dataType = commentMatch[1];
        }

        if (dataType.includes('PRIMARY KEY')) {
          primaryKeys.push(attr);

          if (dataType.includes('REFERENCES')) {
            // MSSQL doesn't support inline REFERENCES declarations: move to the end
            match = dataType.match(/^(.+) (REFERENCES.*)$/);
            attributesClauseParts.push(
              `${this.quoteIdentifier(attr)} ${match[1].replace('PRIMARY KEY', '')}`,
            );
            foreignKeys[attr] = match[2];
          } else {
            attributesClauseParts.push(
              `${this.quoteIdentifier(attr)} ${dataType.replace('PRIMARY KEY', '')}`,
            );
          }
        } else if (dataType.includes('REFERENCES')) {
          // MSSQL doesn't support inline REFERENCES declarations: move to the end
          match = dataType.match(/^(.+) (REFERENCES.*)$/);
          attributesClauseParts.push(`${this.quoteIdentifier(attr)} ${match[1]}`);
          foreignKeys[attr] = match[2];
        } else {
          attributesClauseParts.push(`${this.quoteIdentifier(attr)} ${dataType}`);
        }
      }
    }

    const pkString = primaryKeys.map(pk => this.quoteIdentifier(pk)).join(', ');

    if (options?.uniqueKeys) {
      each(options.uniqueKeys, (columns, indexName) => {
        if (typeof indexName !== 'string') {
          indexName = generateIndexName(tableName, columns);
        }

        attributesClauseParts.push(
          `CONSTRAINT ${this.quoteIdentifier(indexName)} UNIQUE (${columns.fields
            .map(field => this.quoteIdentifier(field))
            .join(', ')})`,
        );
      });
    }

    if (pkString.length > 0) {
      attributesClauseParts.push(`PRIMARY KEY (${pkString})`);
    }

    for (const fkey in foreignKeys) {
      if (Object.hasOwn(foreignKeys, fkey)) {
        attributesClauseParts.push(
          `FOREIGN KEY (${this.quoteIdentifier(fkey)}) ${foreignKeys[fkey]}`,
        );
      }
    }

    const quotedTableName = this.quoteTable(tableName);

    return joinSQLFragments([
      `IF OBJECT_ID(${this.escape(quotedTableName)}, 'U') IS NULL`,
      `CREATE TABLE ${quotedTableName} (${attributesClauseParts.join(', ')})`,
      ';',
      commentStr,
    ]);
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
      // TODO: attributeToSQL SHOULD be using attributes in addColumnQuery
      //       but instead we need to pass the key along as the field here
      field: key,
      type: normalizeDataType(dataType.type, this.dialect),
    };

    let commentStr = '';

    if (dataType.comment && isString(dataType.comment)) {
      commentStr = this.commentTemplate(dataType.comment, table, key);
      // attributeToSQL will try to include `COMMENT 'Comment Text'` when it returns if the comment key
      // is present. This is needed for createTable statement where that part is extracted with regex.
      // Here we can intercept the object and remove comment property since we have the original object.
      delete dataType.comment;
    }

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(table),
      'ADD',
      this.quoteIdentifier(key),
      this.attributeToSQL(dataType, { context: 'addColumn' }),
      ';',
      commentStr,
    ]);
  }

  commentTemplate(comment, table, column) {
    const tableDetails = this.extractTableDetails(table);
    const tableName = tableDetails.tableName;
    const tableSchema = tableDetails.schema;

    return ` EXEC sp_addextendedproperty @name = N'MS_Description', @value = ${this.escape(comment)}, @level0type = N'Schema', @level0name = ${this.escape(tableSchema)}, @level1type = N'Table', @level1name = ${this.quoteIdentifier(tableName)}, @level2type = N'Column', @level2name = ${this.quoteIdentifier(column)};`;
  }

  changeColumnQuery(tableName, attributes) {
    const attrString = [];
    const constraintString = [];
    let commentString = '';

    for (const attributeName in attributes) {
      const quotedAttrName = this.quoteIdentifier(attributeName);
      let definition = attributes[attributeName];
      if (definition.includes('COMMENT ')) {
        const commentMatch = definition.match(/^(.+) (COMMENT.*)$/);
        const commentText = commentMatch[2].replace('COMMENT', '').trim();
        commentString += this.commentTemplate(commentText, tableName, attributeName);
        // remove comment related substring from dataType
        definition = commentMatch[1];
      }

      if (definition.includes('REFERENCES')) {
        constraintString.push(
          `FOREIGN KEY (${quotedAttrName}) ${definition.replace(/.+?(?=REFERENCES)/, '')}`,
        );
      } else {
        attrString.push(`${quotedAttrName} ${definition}`);
      }
    }

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      attrString.length && `ALTER COLUMN ${attrString.join(', ')}`,
      constraintString.length && `ADD ${constraintString.join(', ')}`,
      ';',
      commentString,
    ]);
  }

  renameColumnQuery(tableName, attrBefore, attributes) {
    const newName = Object.keys(attributes)[0];

    return joinSQLFragments([
      'EXEC sp_rename',
      `'${this.quoteTable(tableName)}.${attrBefore}',`,
      `'${newName}',`,
      "'COLUMN'",
      ';',
    ]);
  }

  bulkInsertQuery(tableName, attrValueHashes, options, attributes) {
    const quotedTable = this.quoteTable(tableName);
    options ||= {};
    attributes ||= {};

    const tuples = [];
    const allAttributes = [];
    const allQueries = [];

    let needIdentityInsertWrapper = false;
    let outputFragment = '';

    if (options.returning) {
      const returnValues = this.generateReturnValues(attributes, options);

      outputFragment = returnValues.outputFragment;
    }

    const emptyQuery = `INSERT INTO ${quotedTable}${outputFragment} DEFAULT VALUES`;

    for (const attrValueHash of attrValueHashes) {
      // special case for empty objects with primary keys
      const fields = Object.keys(attrValueHash);
      const firstAttr = attributes[fields[0]];
      if (
        fields.length === 1 &&
        firstAttr &&
        firstAttr.autoIncrement &&
        attrValueHash[fields[0]] === null
      ) {
        allQueries.push(emptyQuery);
        continue;
      }

      // normal case
      forOwn(attrValueHash, (value, key) => {
        if (value !== null && attributes[key] && attributes[key].autoIncrement) {
          needIdentityInsertWrapper = true;
        }

        if (!allAttributes.includes(key)) {
          if (value === null && attributes[key] && attributes[key].autoIncrement) {
            return;
          }

          allAttributes.push(key);
        }
      });
    }

    if (allAttributes.length > 0) {
      for (const attrValueHash of attrValueHashes) {
        tuples.push(
          `(${allAttributes
            .map(key => {
              // TODO: bindParam
              // TODO: pass "model"
              return this.escape(attrValueHash[key] ?? null, {
                type: attributes[key]?.type,
                replacements: options.replacements,
              });
            })
            .join(',')})`,
        );
      }

      const quotedAttributes = allAttributes.map(attr => this.quoteIdentifier(attr)).join(',');
      allQueries.push(
        tupleStr =>
          `INSERT INTO ${quotedTable} (${quotedAttributes})${outputFragment} VALUES ${tupleStr}`,
      );
    }

    const commands = [];
    let offset = 0;
    while (offset < Math.max(tuples.length, 1)) {
      // SQL Server can insert a maximum of 1000 rows at a time,
      // This splits the insert in multiple statements to respect that limit
      const tupleStr = tuples.slice(offset, Math.min(tuples.length, offset + 1000));
      let generatedQuery = allQueries.map(v => (typeof v === 'string' ? v : v(tupleStr))).join(';');
      if (needIdentityInsertWrapper) {
        generatedQuery = `SET IDENTITY_INSERT ${quotedTable} ON; ${generatedQuery}; SET IDENTITY_INSERT ${quotedTable} OFF`;
      }

      commands.push(generatedQuery);
      offset += 1000;
    }

    return `${commands.join(';')};`;
  }

  updateQuery(tableName, attrValueHash, where, options = {}, attributes) {
    const sql = super.updateQuery(tableName, attrValueHash, where, options, attributes);

    if (options.limit) {
      const updateArgs = `UPDATE TOP(${this.escape(options.limit, undefined, options)})`;
      sql.query = sql.query.replace('UPDATE', updateArgs);
    }

    return sql;
  }

  upsertQuery(tableName, insertValues, updateValues, where, model, options) {
    // TODO: support TableNameWithSchema objects
    const targetTableAlias = this.quoteTable(`${tableName}_target`);
    const sourceTableAlias = this.quoteTable(`${tableName}_source`);
    const primaryKeysColumns = [];
    const identityColumns = [];
    const uniqueColumns = [];
    const tableNameQuoted = this.quoteTable(tableName);
    let needIdentityInsertWrapper = false;

    const modelDefinition = model.modelDefinition;
    // Obtain primaryKeys, uniquekeys and identity attrs from rawAttributes as model is not passed
    for (const attribute of modelDefinition.attributes.values()) {
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
          const columnName = typeof field === 'string' ? field : field.name || field.attribute;
          // TODO: columnName can't be used to get an attribute from modelDefinition.attributes, this is a bug
          if (!uniqueColumns.includes(columnName) && modelDefinition.attributes.has(columnName)) {
            uniqueColumns.push(columnName);
          }
        }
      }
    }

    const updateKeys = Object.keys(updateValues);
    const insertKeys = Object.keys(insertValues);
    const insertKeysQuoted = insertKeys.map(key => this.quoteIdentifier(key)).join(', ');
    const insertValuesEscaped = insertKeys
      .map(key => {
        // TODO: pass "model", "type" and "bindParam" options
        return this.escape(insertValues[key], options);
      })
      .join(', ');
    const sourceTableQuery = `VALUES(${insertValuesEscaped})`; // Virtual Table
    let joinCondition;

    // IDENTITY_INSERT Condition
    for (const key of identityColumns) {
      if (insertValues[key] && insertValues[key] !== null) {
        needIdentityInsertWrapper = true;
        /*
         * IDENTITY_INSERT Column Cannot be updated, only inserted
         * http://stackoverflow.com/a/30176254/2254360
         */
      }
    }

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
        joinCondition = getJoinSnippet(uniqueColumns).join(' AND ');
      }
    }

    // Remove the IDENTITY_INSERT Column from update
    const filteredUpdateClauses = updateKeys
      .filter(key => !identityColumns.includes(key))
      .map(key => {
        const value = this.escape(updateValues[key], undefined, options);
        key = this.quoteIdentifier(key);

        return `${targetTableAlias}.${key} = ${value}`;
      });
    const updateSnippet =
      filteredUpdateClauses.length > 0
        ? `WHEN MATCHED THEN UPDATE SET ${filteredUpdateClauses.join(', ')}`
        : '';

    const insertSnippet = `(${insertKeysQuoted}) VALUES(${insertValuesEscaped})`;

    let query = `MERGE INTO ${tableNameQuoted} WITH(HOLDLOCK) AS ${targetTableAlias} USING (${sourceTableQuery}) AS ${sourceTableAlias}(${insertKeysQuoted}) ON ${joinCondition}`;
    query += ` ${updateSnippet} WHEN NOT MATCHED THEN INSERT ${insertSnippet} OUTPUT $action, INSERTED.*;`;
    if (needIdentityInsertWrapper) {
      query = `SET IDENTITY_INSERT ${tableNameQuoted} ON; ${query} SET IDENTITY_INSERT ${tableNameQuoted} OFF;`;
    }

    return query;
  }

  attributeToSQL(attribute, options) {
    if (!isPlainObject(attribute)) {
      attribute = {
        type: attribute,
      };
    }

    // handle self-referential constraints
    if (
      attribute.references &&
      attribute.Model &&
      this.isSameTable(attribute.Model.tableName, attribute.references.table)
    ) {
      this.sequelize.log(
        'MSSQL does not support self-referential constraints, ' +
          'we will remove it but we recommend restructuring your query',
      );
      attribute.onDelete = '';
      attribute.onUpdate = '';
    }

    let template;

    if (attribute.type instanceof DataTypes.ENUM) {
      // enums are a special case
      template = attribute.type.toSql({ dialect: this.dialect });
      template += ` CHECK (${this.quoteIdentifier(attribute.field)} IN(${attribute.type.options.values
        .map(value => {
          return this.escape(value, options);
        })
        .join(', ')}))`;

      return template;
    }

    template = attributeTypeToSql(attribute.type, { dialect: this.dialect });

    if (attribute.allowNull === false) {
      template += ' NOT NULL';
    } else if (
      !attribute.primaryKey &&
      !defaultValueSchemable(attribute.defaultValue, this.dialect)
    ) {
      template += ' NULL';
    }

    if (attribute.autoIncrement) {
      template += ' IDENTITY(1,1)';
    }

    // Blobs/texts cannot have a defaultValue
    if (
      attribute.type !== 'TEXT' &&
      attribute.type._binary !== true &&
      defaultValueSchemable(attribute.defaultValue, this.dialect)
    ) {
      template += ` DEFAULT ${this.escape(attribute.defaultValue, { ...options, type: attribute.type })}`;
    }

    if (
      attribute.unique === true &&
      (options?.context !== 'changeColumn' || this.dialect.supports.alterColumn.unique)
    ) {
      template += ' UNIQUE';
    }

    if (attribute.primaryKey) {
      template += ' PRIMARY KEY';
    }

    if ((!options || !options.withoutForeignKeyConstraints) && attribute.references) {
      template += ` REFERENCES ${this.quoteTable(attribute.references.table)}`;

      if (attribute.references.key) {
        template += ` (${this.quoteIdentifier(attribute.references.key)})`;
      } else {
        template += ` (${this.quoteIdentifier('id')})`;
      }

      if (attribute.onDelete) {
        template += ` ON DELETE ${attribute.onDelete.toUpperCase()}`;
      }

      if (attribute.onUpdate) {
        template += ` ON UPDATE ${attribute.onUpdate.toUpperCase()}`;
      }
    }

    if (attribute.comment && typeof attribute.comment === 'string') {
      template += ` COMMENT ${attribute.comment}`;
    }

    return template;
  }

  attributesToSQL(attributes, options) {
    const result = Object.create(null);
    const existingConstraints = [];

    for (const key of Object.keys(attributes)) {
      const attribute = { ...attributes[key] };

      if (attribute.references) {
        if (existingConstraints.includes(this.quoteTable(attribute.references.table))) {
          // no cascading constraints to a table more than once
          attribute.onDelete = '';
          attribute.onUpdate = '';
        } else {
          existingConstraints.push(this.quoteTable(attribute.references.table));

          // NOTE: this really just disables cascading updates for all
          //       definitions. Can be made more robust to support the
          //       few cases where MSSQL actually supports them
          attribute.onUpdate = '';
        }
      }

      if (key && !attribute.field) {
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
}
