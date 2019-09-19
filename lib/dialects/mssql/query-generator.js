'use strict';

const _ = require('lodash');
const Utils = require('../../utils');
const DataTypes = require('../../data-types');
const TableHints = require('../../table-hints');
const AbstractQueryGenerator = require('../abstract/query-generator');
const randomBytes = require('crypto').randomBytes;
const semver = require('semver');
const Op = require('../../operators');

/* istanbul ignore next */
const throwMethodUndefined = function(methodName) {
  throw new Error(`The method "${methodName}" is not defined! Please add it to your sql dialect.`);
};

class MSSQLQueryGenerator extends AbstractQueryGenerator {
  createDatabaseQuery(databaseName, options) {
    options = Object.assign({
      collate: null
    }, options || {});

    const collation = options.collate ? `COLLATE ${this.escape(options.collate)}` : '';

    return [
      'IF NOT EXISTS (SELECT * FROM sys.databases WHERE name =', wrapSingleQuote(databaseName), ')',
      'BEGIN',
      'CREATE DATABASE', this.quoteIdentifier(databaseName),
      `${collation};`,
      'END;'
    ].join(' ');
  }

  dropDatabaseQuery(databaseName) {
    return [
      'IF EXISTS (SELECT * FROM sys.databases WHERE name =', wrapSingleQuote(databaseName), ')',
      'BEGIN',
      'DROP DATABASE', this.quoteIdentifier(databaseName), ';',
      'END;'
    ].join(' ');
  }

  createSchema(schema) {
    return [
      'IF NOT EXISTS (SELECT schema_name',
      'FROM information_schema.schemata',
      'WHERE schema_name =', wrapSingleQuote(schema), ')',
      'BEGIN',
      "EXEC sp_executesql N'CREATE SCHEMA",
      this.quoteIdentifier(schema),
      ";'",
      'END;'
    ].join(' ');
  }

  dropSchema(schema) {
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
      "SELECT CASE WHEN o.type IN ('F','PK')",
      "THEN N'ALTER TABLE ['+ s.name + N'].[' + p.name + N'] DROP CONSTRAINT [' + o.name + N']'",
      "ELSE N'DROP TABLE ['+ s.name + N'].[' + o.name + N']' END",
      'FROM sys.objects o',
      'JOIN sys.schemas s on o.schema_id = s.schema_id',
      'LEFT OUTER JOIN sys.objects p on o.parent_object_id = p.object_id',
      "WHERE o.type IN ('F', 'PK', 'U') AND s.name = ", quotedSchema,
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
      "EXEC sp_executesql N'DROP SCHEMA", this.quoteIdentifier(schema), ";'",
      'END;'
    ].join(' ');
  }

  showSchemasQuery() {
    return [
      'SELECT "name" as "schema_name" FROM sys.schemas as s',
      'WHERE "s"."name" NOT IN (',
      "'INFORMATION_SCHEMA', 'dbo', 'guest', 'sys', 'archive'",
      ')', 'AND', '"s"."name" NOT LIKE', "'db_%'"
    ].join(' ');
  }

  versionQuery() {
    // Uses string manipulation to convert the MS Maj.Min.Patch.Build to semver Maj.Min.Patch
    return [
      'DECLARE @ms_ver NVARCHAR(20);',
      "SET @ms_ver = REVERSE(CONVERT(NVARCHAR(20), SERVERPROPERTY('ProductVersion')));",
      "SELECT REVERSE(SUBSTRING(@ms_ver, CHARINDEX('.', @ms_ver)+1, 20)) AS 'version'"
    ].join(' ');
  }

  createTableQuery(tableName, attributes, options) {
    const query = (table, attrs) => `IF OBJECT_ID('${table}', 'U') IS NULL CREATE TABLE ${table} (${attrs})`,
      primaryKeys = [],
      foreignKeys = {},
      attrStr = [];

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
            attrStr.push(`${this.quoteIdentifier(attr)} ${match[1].replace('PRIMARY KEY', '')}`);
            foreignKeys[attr] = match[2];
          } else {
            attrStr.push(`${this.quoteIdentifier(attr)} ${dataType.replace('PRIMARY KEY', '')}`);
          }
        } else if (dataType.includes('REFERENCES')) {
          // MSSQL doesn't support inline REFERENCES declarations: move to the end
          match = dataType.match(/^(.+) (REFERENCES.*)$/);
          attrStr.push(`${this.quoteIdentifier(attr)} ${match[1]}`);
          foreignKeys[attr] = match[2];
        } else {
          attrStr.push(`${this.quoteIdentifier(attr)} ${dataType}`);
        }
      }
    }


    let attributesClause = attrStr.join(', ');
    const pkString = primaryKeys.map(pk => this.quoteIdentifier(pk)).join(', ');

    if (options.uniqueKeys) {
      _.each(options.uniqueKeys, (columns, indexName) => {
        if (columns.customIndex) {
          if (typeof indexName !== 'string') {
            indexName = `uniq_${tableName}_${columns.fields.join('_')}`;
          }
          attributesClause += `, CONSTRAINT ${this.quoteIdentifier(indexName)} UNIQUE (${columns.fields.map(field => this.quoteIdentifier(field)).join(', ')})`;
        }
      });
    }

    if (pkString.length > 0) {
      attributesClause += `, PRIMARY KEY (${pkString})`;
    }

    for (const fkey in foreignKeys) {
      if (Object.prototype.hasOwnProperty.call(foreignKeys, fkey)) {
        attributesClause += `, FOREIGN KEY (${this.quoteIdentifier(fkey)}) ${foreignKeys[fkey]}`;
      }
    }

    return `${query(this.quoteTable(tableName), attributesClause)};${commentStr}`;
  }

  describeTableQuery(tableName, schema) {
    let sql = [
      'SELECT',
      "c.COLUMN_NAME AS 'Name',",
      "c.DATA_TYPE AS 'Type',",
      "c.CHARACTER_MAXIMUM_LENGTH AS 'Length',",
      "c.IS_NULLABLE as 'IsNull',",
      "COLUMN_DEFAULT AS 'Default',",
      "pk.CONSTRAINT_TYPE AS 'Constraint',",
      "COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA+'.'+c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') as 'IsIdentity',",
      "prop.value AS 'Comment'",
      'FROM',
      'INFORMATION_SCHEMA.TABLES t',
      'INNER JOIN',
      'INFORMATION_SCHEMA.COLUMNS c ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA',
      'LEFT JOIN (SELECT tc.table_schema, tc.table_name, ',
      'cu.column_name, tc.constraint_type ',
      'FROM information_schema.TABLE_CONSTRAINTS tc ',
      'JOIN information_schema.KEY_COLUMN_USAGE  cu ',
      'ON tc.table_schema=cu.table_schema and tc.table_name=cu.table_name ',
      'and tc.constraint_name=cu.constraint_name ',
      'and tc.constraint_type=\'PRIMARY KEY\') pk ',
      'ON pk.table_schema=c.table_schema ',
      'AND pk.table_name=c.table_name ',
      'AND pk.column_name=c.column_name ',
      'INNER JOIN sys.columns AS sc',
      "ON sc.object_id = object_id(t.table_schema + '.' + t.table_name) AND sc.name = c.column_name",
      'LEFT JOIN sys.extended_properties prop ON prop.major_id = sc.object_id',
      'AND prop.minor_id = sc.column_id',
      "AND prop.name = 'MS_Description'",
      'WHERE t.TABLE_NAME =', wrapSingleQuote(tableName)
    ].join(' ');

    if (schema) {
      sql += `AND t.TABLE_SCHEMA =${wrapSingleQuote(schema)}`;
    }

    return sql;
  }

  renameTableQuery(before, after) {
    return `EXEC sp_rename ${this.quoteTable(before)}, ${this.quoteTable(after)};`;
  }

  showTablesQuery() {
    return "SELECT TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';";
  }

  dropTableQuery(tableName) {
    const qouteTbl = this.quoteTable(tableName);
    return `IF OBJECT_ID('${qouteTbl}', 'U') IS NOT NULL DROP TABLE ${qouteTbl};`;
  }

  addColumnQuery(table, key, dataType) {
    // FIXME: attributeToSQL SHOULD be using attributes in addColumnQuery
    //        but instead we need to pass the key along as the field here
    dataType.field = key;
    let commentStr = '';

    if (dataType.comment && _.isString(dataType.comment)) {
      commentStr = this.commentTemplate(dataType.comment, table, key);
      // attributeToSQL will try to include `COMMENT 'Comment Text'` when it returns if the comment key
      // is present. This is needed for createTable statement where that part is extracted with regex.
      // Here we can intercept the object and remove comment property since we have the original object.
      delete dataType['comment'];
    }

    const def = this.attributeToSQL(dataType, {
      context: 'addColumn'
    });
    return `ALTER TABLE ${this.quoteTable(table)} ADD ${this.quoteIdentifier(key)} ${def};${commentStr}`;
  }

  commentTemplate(comment, table, column) {
    return ' EXEC sp_addextendedproperty ' +
        `@name = N'MS_Description', @value = ${this.escape(comment)}, ` +
        '@level0type = N\'Schema\', @level0name = \'dbo\', ' +
        `@level1type = N'Table', @level1name = ${this.quoteIdentifier(table)}, ` +
        `@level2type = N'Column', @level2name = ${this.quoteIdentifier(column)};`;
  }

  removeColumnQuery(tableName, attributeName) {
    return `ALTER TABLE ${this.quoteTable(tableName)} DROP COLUMN ${this.quoteIdentifier(attributeName)};`;
  }

  changeColumnQuery(tableName, attributes) {
    const attrString = [],
      constraintString = [];
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

    let finalQuery = '';
    if (attrString.length) {
      finalQuery += `ALTER COLUMN ${attrString.join(', ')}`;
      finalQuery += constraintString.length ? ' ' : '';
    }
    if (constraintString.length) {
      finalQuery += `ADD ${constraintString.join(', ')}`;
    }

    return `ALTER TABLE ${this.quoteTable(tableName)} ${finalQuery};${commentString}`;
  }

  renameColumnQuery(tableName, attrBefore, attributes) {
    const newName = Object.keys(attributes)[0];
    return `EXEC sp_rename '${this.quoteTable(tableName)}.${attrBefore}', '${newName}', 'COLUMN';`;
  }

  bulkInsertQuery(tableName, attrValueHashes, options, attributes) {
    const quotedTable = this.quoteTable(tableName);
    options = options || {};
    attributes = attributes || {};

    const tuples = [];
    const allAttributes = [];
    const allQueries = [];



    let needIdentityInsertWrapper = false,
      outputFragment = '';

    if (options.returning) {
      outputFragment = ' OUTPUT INSERTED.*';
    }

    const emptyQuery = `INSERT INTO ${quotedTable}${outputFragment} DEFAULT VALUES`;

    attrValueHashes.forEach(attrValueHash => {
      // special case for empty objects with primary keys
      const fields = Object.keys(attrValueHash);
      const firstAttr = attributes[fields[0]];
      if (fields.length === 1 && firstAttr && firstAttr.autoIncrement && attrValueHash[fields[0]] === null) {
        allQueries.push(emptyQuery);
        return;
      }

      // normal case
      _.forOwn(attrValueHash, (value, key) => {
        if (value !== null && attributes[key] && attributes[key].autoIncrement) {
          needIdentityInsertWrapper = true;
        }

        if (!allAttributes.includes(key)) {
          if (value === null && attributes[key] && attributes[key].autoIncrement)
            return;

          allAttributes.push(key);
        }
      });
    });

    if (allAttributes.length > 0) {
      attrValueHashes.forEach(attrValueHash => {
        tuples.push(`(${
          allAttributes.map(key =>
            this.escape(attrValueHash[key])).join(',')
        })`);
      });

      const quotedAttributes = allAttributes.map(attr => this.quoteIdentifier(attr)).join(',');
      allQueries.push(tupleStr => `INSERT INTO ${quotedTable} (${quotedAttributes})${outputFragment} VALUES ${tupleStr};`);
    }
    const commands = [];
    let offset = 0;
    const batch = Math.floor(250 / (allAttributes.length + 1)) + 1;
    while (offset < Math.max(tuples.length, 1)) {
      const tupleStr = tuples.slice(offset, Math.min(tuples.length, offset + batch));
      let generatedQuery = allQueries.map(v => typeof v === 'string' ? v : v(tupleStr)).join(';');
      if (needIdentityInsertWrapper) {
        generatedQuery = `SET IDENTITY_INSERT ${quotedTable} ON; ${generatedQuery}; SET IDENTITY_INSERT ${quotedTable} OFF;`;
      }
      commands.push(generatedQuery);
      offset += batch;
    }
    return commands.join(';');
  }

  updateQuery(tableName, attrValueHash, where, options, attributes) {
    const sql = super.updateQuery(tableName, attrValueHash, where, options, attributes);
    if (options.limit) {
      const updateArgs = `UPDATE TOP(${this.escape(options.limit)})`;
      sql.query = sql.query.replace('UPDATE', updateArgs);
    }
    return sql;
  }

  upsertQuery(tableName, insertValues, updateValues, where, model) {
    const targetTableAlias = this.quoteTable(`${tableName}_target`);
    const sourceTableAlias = this.quoteTable(`${tableName}_source`);
    const primaryKeysAttrs = [];
    const identityAttrs = [];
    const uniqueAttrs = [];
    const tableNameQuoted = this.quoteTable(tableName);
    let needIdentityInsertWrapper = false;

    //Obtain primaryKeys, uniquekeys and identity attrs from rawAttributes as model is not passed
    for (const key in model.rawAttributes) {
      if (model.rawAttributes[key].primaryKey) {
        primaryKeysAttrs.push(model.rawAttributes[key].field || key);
      }
      if (model.rawAttributes[key].unique) {
        uniqueAttrs.push(model.rawAttributes[key].field || key);
      }
      if (model.rawAttributes[key].autoIncrement) {
        identityAttrs.push(model.rawAttributes[key].field || key);
      }
    }

    //Add unique indexes defined by indexes option to uniqueAttrs
    for (const index of model._indexes) {
      if (index.unique && index.fields) {
        for (const field of index.fields) {
          const fieldName = typeof field === 'string' ? field : field.name || field.attribute;
          if (!uniqueAttrs.includes(fieldName) && model.rawAttributes[fieldName]) {
            uniqueAttrs.push(fieldName);
          }
        }
      }
    }

    const updateKeys = Object.keys(updateValues);
    const insertKeys = Object.keys(insertValues);
    const insertKeysQuoted = insertKeys.map(key => this.quoteIdentifier(key)).join(', ');
    const insertValuesEscaped = insertKeys.map(key => this.escape(insertValues[key])).join(', ');
    const sourceTableQuery = `VALUES(${insertValuesEscaped})`; //Virtual Table
    let joinCondition;

    //IDENTITY_INSERT Condition
    identityAttrs.forEach(key => {
      if (updateValues[key] && updateValues[key] !== null) {
        needIdentityInsertWrapper = true;
        /*
         * IDENTITY_INSERT Column Cannot be updated, only inserted
         * http://stackoverflow.com/a/30176254/2254360
         */
      }
    });

    //Filter NULL Clauses
    const clauses = where[Op.or].filter(clause => {
      let valid = true;
      /*
       * Exclude NULL Composite PK/UK. Partial Composite clauses should also be excluded as it doesn't guarantee a single row
       */
      for (const key in clause) {
        if (!clause[key]) {
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
        if (primaryKeysAttrs.includes(keys[0])) {
          joinCondition = getJoinSnippet(primaryKeysAttrs).join(' AND ');
          break;
        }
      }
      if (!joinCondition) {
        joinCondition = getJoinSnippet(uniqueAttrs).join(' AND ');
      }
    }

    // Remove the IDENTITY_INSERT Column from update
    const updateSnippet = updateKeys.filter(key => !identityAttrs.includes(key))
      .map(key => {
        const value = this.escape(updateValues[key]);
        key = this.quoteIdentifier(key);
        return `${targetTableAlias}.${key} = ${value}`;
      }).join(', ');

    const insertSnippet = `(${insertKeysQuoted}) VALUES(${insertValuesEscaped})`;
    let query = `MERGE INTO ${tableNameQuoted} WITH(HOLDLOCK) AS ${targetTableAlias} USING (${sourceTableQuery}) AS ${sourceTableAlias}(${insertKeysQuoted}) ON ${joinCondition}`;
    query += ` WHEN MATCHED THEN UPDATE SET ${updateSnippet} WHEN NOT MATCHED THEN INSERT ${insertSnippet} OUTPUT $action, INSERTED.*;`;
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

    let whereClause = this.getWhereConditions(where, null, model, options);
    let limit = '';

    if (options.limit) {
      limit = ` TOP(${this.escape(options.limit)})`;
    }

    if (whereClause) {
      whereClause = ` WHERE ${whereClause}`;
    }

    return `DELETE${limit} FROM ${table}${whereClause}; SELECT @@ROWCOUNT AS AFFECTEDROWS;`;
  }

  showIndexesQuery(tableName) {
    return `EXEC sys.sp_helpindex @objname = N'${this.quoteTable(tableName)}';`;
  }

  showConstraintsQuery(tableName) {
    return `EXEC sp_helpconstraint @objname = ${this.escape(this.quoteTable(tableName))};`;
  }

  removeIndexQuery(tableName, indexNameOrAttributes) {
    let indexName = indexNameOrAttributes;

    if (typeof indexName !== 'string') {
      indexName = Utils.underscore(`${tableName}_${indexNameOrAttributes.join('_')}`);
    }

    return `DROP INDEX ${this.quoteIdentifiers(indexName)} ON ${this.quoteIdentifiers(tableName)}`;
  }

  attributeToSQL(attribute) {
    if (!_.isPlainObject(attribute)) {
      attribute = {
        type: attribute
      };
    }

    // handle self referential constraints
    if (attribute.references) {

      if (attribute.Model && attribute.Model.tableName === attribute.references.model) {
        this.sequelize.log('MSSQL does not support self referencial constraints, '
          + 'we will remove it but we recommend restructuring your query');
        attribute.onDelete = '';
        attribute.onUpdate = '';
      }
    }

    let template;

    if (attribute.type instanceof DataTypes.ENUM) {
      if (attribute.type.values && !attribute.values) attribute.values = attribute.type.values;

      // enums are a special case
      template = attribute.type.toSql();
      template += ` CHECK (${this.quoteIdentifier(attribute.field)} IN(${attribute.values.map(value => {
        return this.escape(value);
      }).join(', ')  }))`;
      return template;
    }
    template = attribute.type.toString();

    if (attribute.allowNull === false) {
      template += ' NOT NULL';
    } else if (!attribute.primaryKey && !Utils.defaultValueSchemable(attribute.defaultValue)) {
      template += ' NULL';
    }

    if (attribute.autoIncrement) {
      template += ' IDENTITY(1,1)';
    }

    // Blobs/texts cannot have a defaultValue
    if (attribute.type !== 'TEXT' && attribute.type._binary !== true &&
        Utils.defaultValueSchemable(attribute.defaultValue)) {
      template += ` DEFAULT ${this.escape(attribute.defaultValue)}`;
    }

    if (attribute.unique === true) {
      template += ' UNIQUE';
    }

    if (attribute.primaryKey) {
      template += ' PRIMARY KEY';
    }

    if (attribute.references) {
      template += ` REFERENCES ${this.quoteTable(attribute.references.model)}`;

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
    const result = {},
      existingConstraints = [];
    let key,
      attribute;

    for (key in attributes) {
      attribute = attributes[key];

      if (attribute.references) {

        if (existingConstraints.includes(attribute.references.model.toString())) {
          // no cascading constraints to a table more than once
          attribute.onDelete = '';
          attribute.onUpdate = '';
        } else {
          existingConstraints.push(attribute.references.model.toString());

          // NOTE: this really just disables cascading updates for all
          //       definitions. Can be made more robust to support the
          //       few cases where MSSQL actually supports them
          attribute.onUpdate = '';
        }

      }

      if (key && !attribute.field) attribute.field = key;
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
    return `${'SELECT ' +
        'constraint_name = OBJ.NAME, ' +
        'constraintName = OBJ.NAME, '}${
      catalogName ? `constraintCatalog = '${catalogName}', ` : ''
    }constraintSchema = SCHEMA_NAME(OBJ.SCHEMA_ID), ` +
        'tableName = TB.NAME, ' +
        `tableSchema = SCHEMA_NAME(TB.SCHEMA_ID), ${
          catalogName ? `tableCatalog = '${catalogName}', ` : ''
        }columnName = COL.NAME, ` +
        `referencedTableSchema = SCHEMA_NAME(RTB.SCHEMA_ID), ${
          catalogName ? `referencedCatalog = '${catalogName}', ` : ''
        }referencedTableName = RTB.NAME, ` +
        'referencedColumnName = RCOL.NAME ' +
      'FROM sys.foreign_key_columns FKC ' +
        'INNER JOIN sys.objects OBJ ON OBJ.OBJECT_ID = FKC.CONSTRAINT_OBJECT_ID ' +
        'INNER JOIN sys.tables TB ON TB.OBJECT_ID = FKC.PARENT_OBJECT_ID ' +
        'INNER JOIN sys.columns COL ON COL.COLUMN_ID = PARENT_COLUMN_ID AND COL.OBJECT_ID = TB.OBJECT_ID ' +
        'INNER JOIN sys.tables RTB ON RTB.OBJECT_ID = FKC.REFERENCED_OBJECT_ID ' +
        'INNER JOIN sys.columns RCOL ON RCOL.COLUMN_ID = REFERENCED_COLUMN_ID AND RCOL.OBJECT_ID = RTB.OBJECT_ID';
  }

  /**
   * Generates an SQL query that returns all foreign keys details of a table.
   *
   * @param {string|Object} table
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
    let sql = `${this._getForeignKeysQueryPrefix()
    } WHERE TB.NAME =${wrapSingleQuote(tableName)
    } AND COL.NAME =${wrapSingleQuote(attributeName)}`;

    if (table.schema) {
      sql += ` AND SCHEMA_NAME(TB.SCHEMA_ID) =${wrapSingleQuote(table.schema)}`;
    }

    return sql;
  }

  getPrimaryKeyConstraintQuery(table, attributeName) {
    const tableName = wrapSingleQuote(table.tableName || table);
    return [
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
      `AND K.TABLE_NAME = ${tableName};`
    ].join(' ');
  }

  dropForeignKeyQuery(tableName, foreignKey) {
    return `ALTER TABLE ${this.quoteTable(tableName)} DROP ${this.quoteIdentifier(foreignKey)}`;
  }

  getDefaultConstraintQuery(tableName, attributeName) {
    const quotedTable = this.quoteTable(tableName);
    return 'SELECT name FROM sys.default_constraints ' +
      `WHERE PARENT_OBJECT_ID = OBJECT_ID('${quotedTable}', 'U') ` +
      `AND PARENT_COLUMN_ID = (SELECT column_id FROM sys.columns WHERE NAME = ('${attributeName}') ` +
      `AND object_id = OBJECT_ID('${quotedTable}', 'U'));`;
  }

  dropConstraintQuery(tableName, constraintName) {
    return `ALTER TABLE ${this.quoteTable(tableName)} DROP CONSTRAINT ${this.quoteIdentifier(constraintName)};`;
  }

  setIsolationLevelQuery() {

  }

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
    let topFragment = '';
    let mainFragment = `SELECT ${attributes.join(', ')} FROM ${tables}`;

    // Handle SQL Server 2008 with TOP instead of LIMIT
    if (semver.valid(this.sequelize.options.databaseVersion) && semver.lt(this.sequelize.options.databaseVersion, '11.0.0')) {
      if (options.limit) {
        topFragment = `TOP ${options.limit} `;
      }
      if (options.offset) {
        const offset = options.offset || 0,
          isSubQuery = options.hasIncludeWhere || options.hasIncludeRequired || options.hasMultiAssociation;
        let orders = { mainQueryOrder: [] };
        if (options.order) {
          orders = this.getQueryOrders(options, model, isSubQuery);
        }

        if (!orders.mainQueryOrder.length) {
          orders.mainQueryOrder.push(this.quoteIdentifier(model.primaryKeyField));
        }

        const tmpTable = mainTableAs ? mainTableAs : 'OffsetTable';
        const whereFragment = where ? ` WHERE ${where}` : '';

        /*
         * For earlier versions of SQL server, we need to nest several queries
         * in order to emulate the OFFSET behavior.
         *
         * 1. The outermost query selects all items from the inner query block.
         *    This is due to a limitation in SQL server with the use of computed
         *    columns (e.g. SELECT ROW_NUMBER()...AS x) in WHERE clauses.
         * 2. The next query handles the LIMIT and OFFSET behavior by getting
         *    the TOP N rows of the query where the row number is > OFFSET
         * 3. The innermost query is the actual set we want information from
         */
        const fragment = `SELECT TOP 100 PERCENT ${attributes.join(', ')} FROM ` +
                        `(SELECT ${topFragment}*` +
                          ` FROM (SELECT ROW_NUMBER() OVER (ORDER BY ${orders.mainQueryOrder.join(', ')}) as row_num, * ` +
                            ` FROM ${tables} AS ${tmpTable}${whereFragment})` +
                          ` AS ${tmpTable} WHERE row_num > ${offset})` +
                        ` AS ${tmpTable}`;
        return fragment;
      }
      mainFragment = `SELECT ${topFragment}${attributes.join(', ')} FROM ${tables}`;
    }

    if (mainTableAs) {
      mainFragment += ` AS ${mainTableAs}`;
    }

    if (options.tableHint && TableHints[options.tableHint]) {
      mainFragment += ` WITH (${TableHints[options.tableHint]})`;
    }

    return mainFragment;
  }

  addLimitAndOffset(options, model) {
    // Skip handling of limit and offset as postfixes for older SQL Server versions
    if (semver.valid(this.sequelize.options.databaseVersion) && semver.lt(this.sequelize.options.databaseVersion, '11.0.0')) {
      return '';
    }

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
      if (!options.order || options.include && !orders.subQueryOrder.length) {
        fragment += options.order && !isSubQuery ? ', ' : ' ORDER BY ';
        fragment += `${this.quoteTable(options.tableAs || model.name)}.${this.quoteIdentifier(model.primaryKeyField)}`;
      }

      if (options.offset || options.limit) {
        fragment += ` OFFSET ${this.escape(offset)} ROWS`;
      }

      if (options.limit) {
        fragment += ` FETCH NEXT ${this.escape(options.limit)} ROWS ONLY`;
      }
    }

    return fragment;
  }

  booleanValue(value) {
    return value ? 1 : 0;
  }
}

// private methods
function wrapSingleQuote(identifier) {
  return Utils.addTicks(Utils.removeTicks(identifier, "'"), "'");
}

module.exports = MSSQLQueryGenerator;
