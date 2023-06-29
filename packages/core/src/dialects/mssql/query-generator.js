'use strict';

import { rejectInvalidOptions } from '../../utils/check';
import { addTicks, removeTicks } from '../../utils/dialect';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { defaultValueSchemable } from '../../utils/query-builder-utils';
import { Col, Literal } from '../../utils/sequelize-method';
import { generateIndexName, underscore } from '../../utils/string';
import { attributeTypeToSql, normalizeDataType } from '../abstract/data-types-utils';
import {
  ADD_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
  CREATE_DATABASE_QUERY_SUPPORTABLE_OPTIONS,
  CREATE_SCHEMA_QUERY_SUPPORTABLE_OPTIONS,
  DROP_TABLE_QUERY_SUPPORTABLE_OPTIONS,
} from '../abstract/query-generator';

const _ = require('lodash');
const DataTypes = require('../../data-types');
const { TableHints } = require('../../table-hints');
const { MsSqlQueryGeneratorTypeScript } = require('./query-generator-typescript');
const randomBytes = require('node:crypto').randomBytes;
const semver = require('semver');
const { Op } = require('../../operators');

/* istanbul ignore next */
function throwMethodUndefined(methodName) {
  throw new Error(`The method "${methodName}" is not defined! Please add it to your sql dialect.`);
}

const CREATE_DATABASE_QUERY_SUPPORTED_OPTIONS = new Set(['collate']);
const CREATE_SCHEMA_QUERY_SUPPORTED_OPTIONS = new Set();
const DROP_TABLE_QUERY_SUPPORTED_OPTIONS = new Set();
const ADD_COLUMN_QUERY_SUPPORTED_OPTIONS = new Set();

export class MsSqlQueryGenerator extends MsSqlQueryGeneratorTypeScript {
  createDatabaseQuery(databaseName, options) {
    if (options) {
      rejectInvalidOptions(
        'createDatabaseQuery',
        this.dialect.name,
        CREATE_DATABASE_QUERY_SUPPORTABLE_OPTIONS,
        CREATE_DATABASE_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    const collation = options?.collate ? `COLLATE ${this.escape(options.collate)}` : '';

    return [
      'IF NOT EXISTS (SELECT * FROM sys.databases WHERE name =', wrapSingleQuote(databaseName), ')',
      'BEGIN',
      'CREATE DATABASE', this.quoteIdentifier(databaseName),
      `${collation};`,
      'END;',
    ].join(' ');
  }

  dropDatabaseQuery(databaseName) {
    return [
      'IF EXISTS (SELECT * FROM sys.databases WHERE name =', wrapSingleQuote(databaseName), ')',
      'BEGIN',
      'DROP DATABASE', this.quoteIdentifier(databaseName), ';',
      'END;',
    ].join(' ');
  }

  listDatabasesQuery() {
    return `SELECT name FROM sys.databases;`;
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

    return [
      'IF NOT EXISTS (SELECT schema_name',
      'FROM information_schema.schemata',
      'WHERE schema_name =', wrapSingleQuote(schema), ')',
      'BEGIN',
      'EXEC sp_executesql N\'CREATE SCHEMA',
      this.quoteIdentifier(schema),
      ';\'',
      'END;',
    ].join(' ');
  }

  dropSchemaQuery(schema) {
    // Mimics Postgres CASCADE, will drop objects belonging to the schema
    const quotedSchema = wrapSingleQuote(schema);

    return [
      'IF EXISTS (SELECT schema_name',
      'FROM information_schema.schemata',
      'WHERE schema_name =', quotedSchema, ')',
      'BEGIN',
      'DECLARE @id INT, @ms_sql NVARCHAR(2000);',
      'DECLARE @cascade TABLE (',
      'id INT NOT NULL IDENTITY PRIMARY KEY,',
      'ms_sql NVARCHAR(2000) NOT NULL );',
      'INSERT INTO @cascade ( ms_sql )',
      'SELECT CASE WHEN o.type IN (\'F\',\'PK\')',
      'THEN N\'ALTER TABLE [\'+ s.name + N\'].[\' + p.name + N\'] DROP CONSTRAINT [\' + o.name + N\']\'',
      'ELSE N\'DROP TABLE [\'+ s.name + N\'].[\' + o.name + N\']\' END',
      'FROM sys.objects o',
      'JOIN sys.schemas s on o.schema_id = s.schema_id',
      'LEFT OUTER JOIN sys.objects p on o.parent_object_id = p.object_id',
      'WHERE o.type IN (\'F\', \'PK\', \'U\') AND s.name = ', quotedSchema,
      'ORDER BY o.type ASC;',
      'SELECT TOP 1 @id = id, @ms_sql = ms_sql FROM @cascade ORDER BY id;',
      'WHILE @id IS NOT NULL',
      'BEGIN',
      'BEGIN TRY EXEC sp_executesql @ms_sql; END TRY',
      'BEGIN CATCH BREAK; THROW; END CATCH;',
      'DELETE FROM @cascade WHERE id = @id;',
      'SELECT @id = NULL, @ms_sql = NULL;',
      'SELECT TOP 1 @id = id, @ms_sql = ms_sql FROM @cascade ORDER BY id;',
      'END',
      'EXEC sp_executesql N\'DROP SCHEMA', this.quoteIdentifier(schema), ';\'',
      'END;',
    ].join(' ');
  }

  listSchemasQuery(options) {
    const schemasToSkip = ['INFORMATION_SCHEMA', 'dbo', 'guest', 'sys', 'archive'];
    if (options?.skip) {
      schemasToSkip.push(...options.skip);
    }

    return [
      'SELECT "name" as "schema_name" FROM sys.schemas as s',
      'WHERE "s"."name" NOT IN (',
      schemasToSkip.map(schema => this.escape(schema)).join(', '),
      `) AND "s"."name" NOT LIKE 'db_%'`,
    ].join(' ');
  }

  versionQuery() {
    // Uses string manipulation to convert the MS Maj.Min.Patch.Build to semver Maj.Min.Patch
    return [
      'DECLARE @ms_ver NVARCHAR(20);',
      'SET @ms_ver = REVERSE(CONVERT(NVARCHAR(20), SERVERPROPERTY(\'ProductVersion\')));',
      'SELECT REVERSE(SUBSTRING(@ms_ver, CHARINDEX(\'.\', @ms_ver)+1, 20)) AS \'version\'',
    ].join(' ');
  }

  createTableQuery(tableName, attributes, options) {
    const primaryKeys = [];
    const foreignKeys = {};
    const attributesClauseParts = [];

    let commentStr = '';

    for (const attr in attributes) {
      if (Object.prototype.hasOwnProperty.call(attributes, attr)) {
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
            attributesClauseParts.push(`${this.quoteIdentifier(attr)} ${match[1].replace('PRIMARY KEY', '')}`);
            foreignKeys[attr] = match[2];
          } else {
            attributesClauseParts.push(`${this.quoteIdentifier(attr)} ${dataType.replace('PRIMARY KEY', '')}`);
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

    if (options.uniqueKeys) {
      _.each(options.uniqueKeys, (columns, indexName) => {
        if (typeof indexName !== 'string') {
          indexName = generateIndexName(tableName, columns);
        }

        attributesClauseParts.push(`CONSTRAINT ${
          this.quoteIdentifier(indexName)
        } UNIQUE (${
          columns.fields.map(field => this.quoteIdentifier(field)).join(', ')
        })`);
      });
    }

    if (pkString.length > 0) {
      attributesClauseParts.push(`PRIMARY KEY (${pkString})`);
    }

    for (const fkey in foreignKeys) {
      if (Object.prototype.hasOwnProperty.call(foreignKeys, fkey)) {
        attributesClauseParts.push(`FOREIGN KEY (${this.quoteIdentifier(fkey)}) ${foreignKeys[fkey]}`);
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

  renameTableQuery(before, after) {
    return `EXEC sp_rename ${this.quoteTable(before)}, ${this.quoteTable(after)};`;
  }

  showTablesQuery() {
    return 'SELECT TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = \'BASE TABLE\';';
  }

  tableExistsQuery(table) {
    const tableName = table.tableName || table;
    const schemaName = table.schema || 'dbo';

    return `SELECT TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = ${this.escape(tableName)} AND TABLE_SCHEMA = ${this.escape(schemaName)}`;
  }

  dropTableQuery(tableName, options) {
    if (options) {
      rejectInvalidOptions(
        'dropTableQuery',
        this.dialect.name,
        DROP_TABLE_QUERY_SUPPORTABLE_OPTIONS,
        DROP_TABLE_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    const quoteTbl = this.quoteTable(tableName);

    return joinSQLFragments([
      `IF OBJECT_ID('${quoteTbl}', 'U') IS NOT NULL`,
      'DROP TABLE',
      quoteTbl,
      ';',
    ]);
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

    let commentStr = '';

    if (dataType.comment && _.isString(dataType.comment)) {
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
    return ' EXEC sp_addextendedproperty '
        + `@name = N'MS_Description', @value = ${this.escape(comment)}, `
        + '@level0type = N\'Schema\', @level0name = \'dbo\', '
        + `@level1type = N'Table', @level1name = ${this.quoteTable(table)}, `
        + `@level2type = N'Column', @level2name = ${this.quoteIdentifier(column)};`;
  }

  removeColumnQuery(tableName, attributeName, options = {}) {
    const ifExists = options.ifExists ? 'IF EXISTS' : '';

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'DROP COLUMN',
      ifExists,
      this.quoteIdentifier(attributeName),
      ';',
    ]);
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
        constraintString.push(`FOREIGN KEY (${quotedAttrName}) ${definition.replace(/.+?(?=REFERENCES)/, '')}`);
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
      '\'COLUMN\'',
      ';',
    ]);
  }

  bulkInsertQuery(tableName, attrValueHashes, options, attributes) {
    const quotedTable = this.quoteTable(tableName);
    options = options || {};
    attributes = attributes || {};

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
      if (fields.length === 1 && firstAttr && firstAttr.autoIncrement && attrValueHash[fields[0]] === null) {
        allQueries.push(emptyQuery);
        continue;
      }

      // normal case
      _.forOwn(attrValueHash, (value, key) => {
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
        tuples.push(`(${
          allAttributes.map(key => this.escape(attrValueHash[key], undefined, options)).join(',')
        })`);
      }

      const quotedAttributes = allAttributes.map(attr => this.quoteIdentifier(attr)).join(',');
      allQueries.push(tupleStr => `INSERT INTO ${quotedTable} (${quotedAttributes})${outputFragment} VALUES ${tupleStr}`);
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
    const insertValuesEscaped = insertKeys.map(key => this.escape(insertValues[key], undefined, options)).join(', ');
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
        if (primaryKeysColumns.includes(keys[0])) {
          joinCondition = getJoinSnippet(primaryKeysColumns).join(' AND ');
          break;
        }
      }

      if (!joinCondition) {
        joinCondition = getJoinSnippet(uniqueColumns).join(' AND ');
      }
    }

    // Remove the IDENTITY_INSERT Column from update
    const filteredUpdateClauses = updateKeys.filter(key => !identityColumns.includes(key))
      .map(key => {
        const value = this.escape(updateValues[key], undefined, options);
        key = this.quoteIdentifier(key);

        return `${targetTableAlias}.${key} = ${value}`;
      });
    const updateSnippet = filteredUpdateClauses.length > 0 ? `WHEN MATCHED THEN UPDATE SET ${filteredUpdateClauses.join(', ')}` : '';

    const insertSnippet = `(${insertKeysQuoted}) VALUES(${insertValuesEscaped})`;

    let query = `MERGE INTO ${tableNameQuoted} WITH(HOLDLOCK) AS ${targetTableAlias} USING (${sourceTableQuery}) AS ${sourceTableAlias}(${insertKeysQuoted}) ON ${joinCondition}`;
    query += ` ${updateSnippet} WHEN NOT MATCHED THEN INSERT ${insertSnippet} OUTPUT $action, INSERTED.*;`;
    if (needIdentityInsertWrapper) {
      query = `SET IDENTITY_INSERT ${tableNameQuoted} ON; ${query} SET IDENTITY_INSERT ${tableNameQuoted} OFF;`;
    }

    return query;
  }

  truncateTableQuery(tableName) {
    return `TRUNCATE TABLE ${this.quoteTable(tableName)}`;
  }

  deleteQuery(tableName, where, options = {}, model) {
    const table = this.quoteTable(tableName);
    const whereClause = this.getWhereConditions(where, null, model, options);

    return joinSQLFragments([
      'DELETE',
      options.limit && `TOP(${this.escape(options.limit, undefined, options)})`,
      'FROM',
      table,
      whereClause && `WHERE ${whereClause}`,
      ';',
      'SELECT @@ROWCOUNT AS AFFECTEDROWS',
      ';',
    ]);
  }

  showConstraintsQuery(tableName) {
    return `EXEC sp_helpconstraint @objname = ${this.escape(this.quoteTable(tableName))};`;
  }

  attributeToSQL(attribute, options) {
    if (!_.isPlainObject(attribute)) {
      attribute = {
        type: attribute,
      };
    }

    // handle self-referential constraints
    if (attribute.references && attribute.Model && this.isSameTable(attribute.Model.tableName, attribute.references.table)) {
      this.sequelize.log('MSSQL does not support self-referential constraints, '
          + 'we will remove it but we recommend restructuring your query');
      attribute.onDelete = '';
      attribute.onUpdate = '';
    }

    let template;

    if (attribute.type instanceof DataTypes.ENUM) {
      // enums are a special case
      template = attribute.type.toSql({ dialect: this.dialect });
      template += ` CHECK (${this.quoteIdentifier(attribute.field)} IN(${attribute.type.options.values.map(value => {
        return this.escape(value, undefined, options);
      }).join(', ')}))`;

      return template;
    }

    template = attributeTypeToSql(attribute.type, { dialect: this.dialect });

    if (attribute.allowNull === false) {
      template += ' NOT NULL';
    } else if (!attribute.primaryKey && !defaultValueSchemable(attribute.defaultValue)) {
      template += ' NULL';
    }

    if (attribute.autoIncrement) {
      template += ' IDENTITY(1,1)';
    }

    // Blobs/texts cannot have a defaultValue
    if (attribute.type !== 'TEXT' && attribute.type._binary !== true
        && defaultValueSchemable(attribute.defaultValue)) {
      template += ` DEFAULT ${this.escape(attribute.defaultValue, attribute, options)}`;
    }

    if (attribute.unique === true && (options?.context !== 'changeColumn' || this.dialect.supports.alterColumn.unique)) {
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

  /**
   * Generate common SQL prefix for ForeignKeysQuery.
   *
   * @param {string} catalogName
   * @returns {string}
   */
  _getForeignKeysQueryPrefix(catalogName) {
    return `SELECT constraint_name = OBJ.NAME, constraintName = OBJ.NAME, ${
      catalogName ? `constraintCatalog = '${catalogName}', ` : ''
    }constraintSchema = SCHEMA_NAME(OBJ.SCHEMA_ID), `
      + 'tableName = TB.NAME, '
      + `tableSchema = SCHEMA_NAME(TB.SCHEMA_ID), ${
        catalogName ? `tableCatalog = '${catalogName}', ` : ''
      }columnName = COL.NAME, `
      + `referencedTableSchema = SCHEMA_NAME(RTB.SCHEMA_ID), ${
        catalogName ? `referencedCatalog = '${catalogName}', ` : ''
      }referencedTableName = RTB.NAME, `
      + 'referencedColumnName = RCOL.NAME '
      + 'FROM sys.foreign_key_columns FKC '
      + 'INNER JOIN sys.objects OBJ ON OBJ.OBJECT_ID = FKC.CONSTRAINT_OBJECT_ID '
      + 'INNER JOIN sys.tables TB ON TB.OBJECT_ID = FKC.PARENT_OBJECT_ID '
      + 'INNER JOIN sys.columns COL ON COL.COLUMN_ID = PARENT_COLUMN_ID AND COL.OBJECT_ID = TB.OBJECT_ID '
      + 'INNER JOIN sys.tables RTB ON RTB.OBJECT_ID = FKC.REFERENCED_OBJECT_ID '
      + 'INNER JOIN sys.columns RCOL ON RCOL.COLUMN_ID = REFERENCED_COLUMN_ID AND RCOL.OBJECT_ID = RTB.OBJECT_ID';
  }

  /**
   * Generates an SQL query that returns all foreign keys details of a table.
   *
   * @param {string|object} table
   * @param {string} catalogName database name
   * @returns {string}
   */
  getForeignKeysQuery(table, catalogName) {
    const tableName = table.tableName || table;
    let sql = `${this._getForeignKeysQueryPrefix(catalogName)
    } WHERE TB.NAME =${wrapSingleQuote(tableName)}`;

    if (table.schema) {
      sql += ` AND SCHEMA_NAME(TB.SCHEMA_ID) =${wrapSingleQuote(table.schema)}`;
    }

    return sql;
  }

  getForeignKeyQuery(table, attributeName) {
    const tableName = table.tableName || table;

    return joinSQLFragments([
      this._getForeignKeysQueryPrefix(),
      'WHERE',
      `TB.NAME =${wrapSingleQuote(tableName)}`,
      'AND',
      `COL.NAME =${wrapSingleQuote(attributeName)}`,
      table.schema && `AND SCHEMA_NAME(TB.SCHEMA_ID) =${wrapSingleQuote(table.schema)}`,
    ]);
  }

  getPrimaryKeyConstraintQuery(table, attributeName) {
    const tableName = wrapSingleQuote(table.tableName || table);

    return joinSQLFragments([
      'SELECT K.TABLE_NAME AS tableName,',
      'K.COLUMN_NAME AS columnName,',
      'K.CONSTRAINT_NAME AS constraintName',
      'FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS AS C',
      'JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS K',
      'ON C.TABLE_NAME = K.TABLE_NAME',
      'AND C.CONSTRAINT_CATALOG = K.CONSTRAINT_CATALOG',
      'AND C.CONSTRAINT_SCHEMA = K.CONSTRAINT_SCHEMA',
      'AND C.CONSTRAINT_NAME = K.CONSTRAINT_NAME',
      'WHERE C.CONSTRAINT_TYPE = \'PRIMARY KEY\'',
      `AND K.COLUMN_NAME = ${wrapSingleQuote(attributeName)}`,
      `AND K.TABLE_NAME = ${tableName}`,
      ';',
    ]);
  }

  dropForeignKeyQuery(tableName, foreignKey) {
    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'DROP',
      this.quoteIdentifier(foreignKey),
    ]);
  }

  getDefaultConstraintQuery(tableName, attributeName) {
    const quotedTable = this.quoteTable(tableName);

    return joinSQLFragments([
      'SELECT name FROM sys.default_constraints',
      `WHERE PARENT_OBJECT_ID = OBJECT_ID('${quotedTable}', 'U')`,
      `AND PARENT_COLUMN_ID = (SELECT column_id FROM sys.columns WHERE NAME = ('${attributeName}')`,
      `AND object_id = OBJECT_ID('${quotedTable}', 'U'))`,
      ';',
    ]);
  }

  dropConstraintQuery(tableName, constraintName) {
    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'DROP CONSTRAINT',
      this.quoteIdentifier(constraintName),
      ';',
    ]);
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

  selectFromTableFragment(options, model, attributes, tables, mainTableAs, where) {
    this._throwOnEmptyAttributes(attributes, { modelName: model && model.name, as: mainTableAs });

    return joinSQLFragments([
      'SELECT',
      attributes.join(', '),
      `FROM ${tables}`,
      mainTableAs && `AS ${mainTableAs}`,
      options.tableHint && TableHints[options.tableHint] && `WITH (${TableHints[options.tableHint]})`,
    ]);
  }

  addLimitAndOffset(options, model) {
    const offset = options.offset || 0;
    const isSubQuery = options.subQuery === undefined
      ? options.hasIncludeWhere || options.hasIncludeRequired || options.hasMultiAssociation
      : options.subQuery;

    let fragment = '';
    let orders = {};

    if (options.order) {
      orders = this.getQueryOrders(options, model, isSubQuery);
    }

    if (options.limit || options.offset) {
      // TODO: document why this is adding the primary key of the model in ORDER BY if options.include is set
      if (!options.order || options.order.length === 0 || options.include && orders.subQueryOrder.length === 0) {
        let primaryKey = model.primaryKeyField;
        const tablePkFragment = `${this.quoteTable(options.tableAs || model.name)}.${this.quoteIdentifier(primaryKey)}`;
        const aliasedAttribute = this._getAliasForFieldFromQueryOptions(primaryKey, options);

        if (aliasedAttribute) {
          const modelName = this.quoteIdentifier(options.tableAs || model.name);
          const alias = this._getAliasForField(modelName, aliasedAttribute[1], options);

          primaryKey = alias || aliasedAttribute[1];
        }

        if (!orders.mainQueryOrder || orders.mainQueryOrder.length === 0) {
          fragment += ` ORDER BY ${tablePkFragment}`;
        } else {
          const orderFieldNames = (options.order || []).map(order => {
            const value = Array.isArray(order) ? order[0] : order;

            if (value instanceof Col) {
              return value.col;
            }

            if (value instanceof Literal) {
              return value.val;
            }

            return value;
          });
          const primaryKeyFieldAlreadyPresent = orderFieldNames.includes(
            (primaryKey.col || primaryKey),
          );

          if (!primaryKeyFieldAlreadyPresent) {
            fragment += options.order && !isSubQuery ? ', ' : ' ORDER BY ';
            fragment += tablePkFragment;
          }
        }
      }

      if (options.offset || options.limit) {
        fragment += ` OFFSET ${this.escape(offset, undefined, options)} ROWS`;
      }

      if (options.limit) {
        fragment += ` FETCH NEXT ${this.escape(options.limit, undefined, options)} ROWS ONLY`;
      }
    }

    return fragment;
  }

  booleanValue(value) {
    return value ? 1 : 0;
  }
}

/**
 * @param {string} identifier
 * @deprecated use "escape" or "escapeString" on QueryGenerator
 */
function wrapSingleQuote(identifier) {
  return addTicks(removeTicks(identifier, '\''), '\'');
}
