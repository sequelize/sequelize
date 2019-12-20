'use strict';

const Utils = require('../../utils');
const util = require('util');
//const Transaction = require('../../transaction');
const _ = require('lodash');
const AbstractQueryGenerator = require('../abstract/query-generator');
const DataTypes = require('../../data-types');
const Model = require('../../model');

const typeWithoutDefault = new Set(['BLOB']);

class IBMiQueryGenerator extends AbstractQueryGenerator {

  // Version queries
  versionQuery() {
    return 'SELECT CONCAT(OS_VERSION, CONCAT(\'.\', OS_RELEASE)) AS VERSION FROM SYSIBMADM.ENV_SYS_INFO';
  }

  // Schema queries
  createSchema(schema) {
    return `CREATE SCHEMA "${schema}"`;
  }

  dropSchema(schema) {
    // return `DROP SCHEMA "${schema}"`;
    return `BEGIN IF EXISTS (SELECT * FROM SYSIBM.SQLSCHEMAS WHERE TABLE_SCHEM = '${schema}') THEN SET TRANSACTION ISOLATION LEVEL NO COMMIT; DROP SCHEMA "${schema}"; COMMIT; END IF; END`;
  }

  showSchemasQuery() {
    return 'SELECT DISTINCT SCHEMA_NAME AS "schema_name" FROM QSYS2.SYSSCHEMAAUTH WHERE GRANTEE = CURRENT USER';
  }

  // Table queries
  createTableQuery(tableName, attributes, options) {
    const primaryKeys = [];
    const foreignKeys = {};
    const attrStr = [];

    for (const attr in attributes) {
      if (!Object.prototype.hasOwnProperty.call(attributes, attr)) continue;
      const dataType = attributes[attr];

      if (dataType.includes('PRIMARY KEY')) {
        primaryKeys.push(attr);
        attrStr.push(`${this.quoteIdentifier(attr)} ${dataType.replace('PRIMARY KEY', '')}`);
      } else {
        attrStr.push(`${this.quoteIdentifier(attr)} ${dataType}`);
      }
    }

    let attributesClause = attrStr.join(', ');
    const pkString = primaryKeys.map(pk => this.quoteIdentifier(pk)).join(', ');

    if (options.uniqueKeys) {
      _.each(options.uniqueKeys, (columns, indexName) => {
        // if primary keys === unique keys, then skip adding new constraint
        const uniqueIsPrimary = columns.fields.length === primaryKeys.length && columns.fields.sort().every((value, index) => { return value === primaryKeys.sort()[index]; });
        if (uniqueIsPrimary) {
          return true;
        }
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

    let tableObject = {};
    if (typeof tableName === 'string') {
      tableObject.table = tableName;
    } else {
      tableObject = tableName;
    }
    return `CREATE TABLE ${tableName.schema ? `"${tableObject.schema}".` : '' }"${tableObject.table}" (${attributesClause})`;

    // return `BEGIN IF NOT EXISTS (SELECT * FROM SYSIBM.SQLTABLES WHERE TABLE_SCHEM = '${schema}' AND TABLE_NAME = '${table}') THEN CREATE TABLE "${schema}"."${table}" (${attributesClause}); COMMIT; END IF; END`;
    // return `BEGIN IF NOT EXISTS (SELECT * FROM SYSIBM.SQLTABLES WHERE TABLE_SCHEM = '${tableName.schema}' AND TABLE_NAME = '${tableName.table}') THEN CREATE TABLE ${this.quoteTable(tableName)} (${attributesClause}); COMMIT; END IF; END`;
  }

  dropTableQuery(tableName, options) {
    let table = tableName;
    let schema = undefined;

    if (typeof table === 'object') {
      schema = table.schema || undefined;
      table = table.table;
    } else if (options.schema) {
      schema = options.schema;
    }

    return `BEGIN
    DECLARE CONTINUE HANDLER FOR SQLSTATE VALUE '42704'
      BEGIN END;
      DROP TABLE ${schema ? `"${schema}".` : ''}"${table}";
    END`;
  }

  describeTableQuery(tableName, schema) {
    return `SELECT * FROM SYSIBM.COLUMNS WHERE ${schema ? `TABLE_SCHEMA = '${schema}' AND ` : ''} TABLE_NAME = '${tableName}'`;
  }

  showTablesQuery(schema) {
    return `SELECT TABLE_NAME FROM SYSIBM.SQLTABLES WHERE TABLE_TYPE = 'TABLE'${schema ? ` AND TABLE_SCHEM = '${schema}'` : ''}`;
  }

  addColumnQuery(table, key, dataType) {
    const definition = this.attributeToSQL(dataType, {
      context: 'addColumn',
      tableName: table,
      foreignKey: key
    });

    return `ALTER TABLE ${this.quoteTable(table)} ADD ${this.quoteIdentifier(key)} ${definition}`;
  }

  removeColumnQuery(tableName, attributeName) {
    return `ALTER TABLE ${this.quoteTable(tableName)} DROP COLUMN ${this.quoteIdentifier(attributeName)}`;
  }

  changeColumnQuery(tableName, attributes) {
    const attrString = [];
    const constraintString = [];

    for (const attributeName in attributes) {
      let definition = attributes[attributeName];
      if (definition.includes('REFERENCES')) {
        const attrName = this.quoteIdentifier(attributeName);
        definition = definition.replace(/.+?(?=REFERENCES)/, '');
        const foreignKey = this.quoteIdentifier(`${attributeName}_foreign_idx`);
        constraintString.push(`${foreignKey} FOREIGN KEY (${attrName}) ${definition}`);
      } else {
        attrString.push(`"${attributeName}" SET DATA TYPE ${definition}`);
      }
    }

    let finalQuery = '';
    if (attrString.length) {
      finalQuery += `ALTER COLUMN ${attrString.join(', ')}`;
      finalQuery += constraintString.length ? ' ' : '';
    }
    if (constraintString.length) {
      finalQuery += `ADD CONSTRAINT ${constraintString.join(', ')}`;
    }

    return `ALTER TABLE ${this.quoteTable(tableName)} ${finalQuery};`;
  }

  renameTableQuery(before, after) {
    return `RENAME TABLE ${this.quoteTable(before)} TO ${this.quoteTable(after)};`;
  }

  renameColumnQuery(tableName, attrBefore, attributes) {
    const attrString = [];

    for (const attrName in attributes) {
      const definition = attributes[attrName];
      attrString.push(`\`${attrBefore}\` \`${attrName}\` ${definition}`);
    }

    return `ALTER TABLE ${this.quoteTable(tableName)} RENAME COLUMN ${attrString.join(', ')};`;
  }

  handleSequelizeMethod(smth, tableName, factory, options, prepend) {
    if (smth instanceof Utils.Json) {
      // Parse nested object
      if (smth.conditions) {
        const conditions = this.parseConditionObject(smth.conditions).map(condition =>
          `${this.quoteIdentifier(condition.path[0])}->>'$.${_.tail(condition.path).join('.')}' = '${condition.value}'`
        );

        return conditions.join(' and ');
      }
      if (smth.path) {
        let str;

        // Allow specifying conditions using the sqlite json functions
        if (this._checkValidJsonStatement(smth.path)) {
          str = smth.path;
        } else {
          // Also support json dot notation
          let path = smth.path;
          let startWithDot = true;

          // Convert .number. to [number].
          path = path.replace(/\.(\d+)\./g, '[$1].');
          // Convert .number$ to [number]
          path = path.replace(/\.(\d+)$/, '[$1]');

          path = path.split('.');

          let columnName = path.shift();
          const match = columnName.match(/\[\d+\]$/);
          // If columnName ends with [\d+]
          if (match !== null) {
            path.unshift(columnName.substr(match.index));
            columnName = columnName.substr(0, match.index);
            startWithDot = false;
          }

          str = `${this.quoteIdentifier(columnName)}->>'$${startWithDot ? '.' : ''}${path.join('.')}'`;
        }

        if (smth.value) {
          str += util.format(' = %s', this.escape(smth.value));
        }

        return str;
      }
    } else if (smth instanceof Utils.Cast) {
      if (/timestamp/i.test(smth.type)) {
        smth.type = 'timestamp';
      } else if (smth.json && /boolean/i.test(smth.type)) {
        // true or false cannot be casted as booleans within a JSON structure
        smth.type = 'char';
      } else if (/double precision/i.test(smth.type) || /boolean/i.test(smth.type) || /integer/i.test(smth.type)) {
        smth.type = 'integer';
      } else if (/text/i.test(smth.type)) {
        smth.type = 'char';
      }
    }

    return super.handleSequelizeMethod(smth, tableName, factory, options, prepend);
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

    const fieldsSql = options.fields.map(field => {
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
        throw new Error(`The following index field has no name: ${util.inspect(field)}`);
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
    });

    if (!options.name) {
      // Mostly for cases where addIndex is called directly by the user without an options object (for example in migrations)
      // All calls that go through sequelize should already have a name
      options = Utils.nameIndex(options, options.prefix);
    }

    options = Model._conformIndex(options);

    if (!this._dialect.supports.index.type) {
      delete options.type;
    }

    if (options.where) {
      options.where = this.whereQuery(options.where);
    }

    if (typeof tableName === 'string') {
      tableName = this.quoteIdentifiers(tableName);
    } else {
      tableName = this.quoteTable(tableName);
    }

    // Although the function is 'addIndex', and the values are passed through
    // the 'indexes' key of a table, Db2 for i doesn't allow REFERENCES to
    // work against a UNIQUE INDEX, only a UNIQUE constraint. 
    if (options.unique) {
      return `ALTER TABLE ${tableName} ADD CONSTRAINT ${this.quoteIdentifiers(options.name)} UNIQUE (${fieldsSql.join(', ')}${options.operator ? ` ${options.operator}` : ''})`;
    }


    // TODO: No longer needed?
    return `CREATE ${options.unique ? 'UNIQUE' : ''} INDEX ${this.quoteIdentifiers(options.name)} ON ${tableName} (${fieldsSql.join(', ')}${options.operator ? ` ${options.operator}` : ''})`;


    // let ind;
    // if (this._dialect.supports.indexViaAlter) {
    //   ind = [
    //     'ALTER TABLE',
    //     tableName,
    //     `ADD INDEX ${this.quoteIdentifiers(options.name)}`
    //   ];
    // } else {
    //   ind = ['CREATE'];
    // }

    // ind = ind.concat(
    //   options.unique ? 'UNIQUE' : '',
    //   // options.type, 'INDEX',
    //   // !this._dialect.supports.indexViaAlter ? concurrently : undefined,
    //   // this.quoteIdentifiers(options.name),
    //   this._dialect.supports.index.using === 1 && options.using ? `USING ${options.using}` : '',
    //   !this._dialect.supports.indexViaAlter ? `ON ${tableName}` : undefined,
    //   this._dialect.supports.index.using === 2 && options.using ? `USING ${options.using}` : '',
    //   `(${fieldsSql.join(', ')}${options.operator ? ` ${options.operator}` : ''})`,
    //   this._dialect.supports.index.parser && options.parser ? `WITH PARSER ${options.parser}` : undefined,
    //   this._dialect.supports.index.where && options.where ? options.where : undefined
    // );

    // return _.compact(ind).join(' ');
  }

  _toJSONValue(value) {
    // true/false are stored as strings in mysql
    if (typeof value === 'boolean') {
      return value.toString();
    }
    // null is stored as a string in mysql
    if (value === null) {
      return 'null';
    }
    return value;
  }

  upsertQuery(tableName, insertValues, updateValues, where, model, options) {
    const aliasTable = `temp_${this.quoteTable(tableName)}`;
    
    let query = `MERGE INTO ${this.quoteTable(tableName)} `;

    const usingClause = `USING (
      SELECT * FROM (${this.quoteTable(tableName)}
      VALUES(42)
      ) AS ${aliasTable}("id") ON (${aliasTable}."id" = ${this.quoteTable(tableName)}."id")`;

    query += usingClause;
    query += ` WHEN MATCHED THEN ${this.updateQuery(tableName, tableName, where, options, updateValues)}
    WHEN NOT MATCHED THEN ${this.insertQuery(tableName, insertValues, model, options).sql}`;

    // where = this.getWhereConditions(where, null, model, options);

    // if (where) {
    //   query += `ON ${where}`;
    // }

    return query;
  }

  insertQuery(table, valueHash, modelAttributes, options) {
    // remove the final semi-colon 
    const query = super.insertQuery(table, valueHash, modelAttributes, options);
    if (query.query[query.query.length - 1] === ';') {
      query.query = query.query.slice(0, -1);
      query.query = `SELECT * FROM FINAL TABLE (${query.query})`;
    }
    return query;
  }

  selectQuery(tableName, options, model) {
    // remove the final semi-colon 
    let query = super.selectQuery(tableName, options, model);
    if (query[query.length - 1] === ';') {
      query = query.slice(0, -1);
    }
    return query;
  }

  bulkInsertQuery(tableName, fieldValueHashes, options, fieldMappedAttributes) {
    // remove the final semi-colon 
    let query = super.bulkInsertQuery(tableName, fieldValueHashes, options, fieldMappedAttributes);
    if (query[query.length - 1] === ';') {
      query = query.slice(0, -1);
      query = `SELECT * FROM FINAL TABLE (${query})`;
    }
    return query;
  }

  truncateTableQuery(tableName) {
    return `TRUNCATE TABLE ${this.quoteTable(tableName)} IMMEDIATE`;
  }

  deleteQuery(tableName, where, options = {}, model) {
    let limit = '';
    if (options.offset || options.limit) {
      limit = this.addLimitAndOffset(options);
    }
    let query = `DELETE FROM ${this.quoteTable(tableName)}`;

    where = this.getWhereConditions(where, null, model, options);

    if (where) {
      query += ` WHERE ${where}`;
    }

    return query + limit;
  }

  /**
   * Returns an SQL fragment for adding result constraints.
   *
   * @param  {Object} options An object with selectQuery options.
   * @returns {string}         The generated sql query.
   * @private
   */
  addLimitAndOffset(options) {
    let fragment = '';
    const offset = options.offset;
    const limit = options.limit;

    if (offset) {
      if (typeof offset === 'number' && Number.isInteger(offset)) {
        fragment += ` OFFSET ${offset} ROWS`;
      } else {
        console.warn('"offset" must be an integer. Offset is not added');
      }
    }

    if (limit) {
      if (typeof limit === 'number' && Number.isInteger(limit)) {
        fragment += ` FETCH FIRST ${limit} ROWS ONLY`;
      } else {
        console.warn('"limit" must be an integer. Limit is not added');
      }
    }

    return fragment;
  }

  // Indexes and constraints

  showIndexesQuery(tableName) {
    let table;
    let schema;
    if (typeof tableName === 'string') {
      table = tableName;
    } else {
      table = tableName.tableName || tableName.table;
      schema = tableName.schema;
    }
    return `SELECT INDEX_NAME AS "name" FROM QSYS2.SYSINDEXES WHERE ${schema ? `TABLE_SCHEMA = '${schema}' AND` : ''} TABLE_NAME = '${table}'`;
  }

  showConstraintsQuery(table, constraintName) {
    const tableName = table.tableName || table;
    const schemaName = table.schema;

    let sql = [
      'SELECT CONSTRAINT_NAME AS "constraintName",',
      'CONSTRAINT_SCHEMA AS "constraintSchema",',
      'CONSTRAINT_TYPE AS "constraintType",',
      'TABLE_NAME AS "tableName",',
      'TABLE_SCHEMA AS "tableSchema"',
      'from QSYS2.SYSCST',
      `WHERE table_name='${tableName}'`
    ].join(' ');

    if (constraintName) {
      sql += ` AND CONSTRAINT_NAME = '${constraintName}'`;
    }

    if (schemaName) {
      sql += ` AND TABLE_SCHEMA = '${schemaName}'`;
    }

    return sql;
  }

  removeIndexQuery(tableName, indexNameOrAttributes) {
    let indexName = indexNameOrAttributes;

    if (typeof indexName !== 'string') {
      indexName = Utils.underscore(`${tableName}_${indexNameOrAttributes.join('_')}`);
    }

    return `BEGIN IF EXISTS (SELECT * FROM QSYS2.SYSINDEXES WHERE INDEX_NAME = '${indexName}') THEN DROP INDEX "${indexName}"; COMMIT; END IF; END`;
  }

  bindParam(bind) {
    return value => {
      bind.push(value);
      return '?';
    };
  }

  attributeToSQL(attribute, options) {
    if (!_.isPlainObject(attribute)) {
      attribute = {
        type: attribute
      };
    }

    const attributeString = attribute.type.toString({ escape: this.escape.bind(this) });
    let template = attributeString;

    if (attribute.type instanceof DataTypes.ENUM) {
      if (attribute.type.values && !attribute.values) attribute.values = attribute.type.values;

      // enums are a special case
      template = attribute.type.toSql();
      template += ` CHECK (${this.quoteIdentifier(attribute.field)} IN(${attribute.values.map(value => {
        return this.escape(value);
      }).join(', ') }))`;
    } else {
      template = attribute.type.toString(options);
    }

    if (attribute.allowNull === false) {
      template += ' NOT NULL';
    }

    if (attribute.autoIncrement) {
      template += ' GENERATED BY DEFAULT AS IDENTITY (START WITH 1, INCREMENT BY 1)';
    }

    // BLOB cannot have a default value
    if (!typeWithoutDefault.has(attributeString)
      && attribute.type._binary !== true
      && Utils.defaultValueSchemable(attribute.defaultValue)) {
      if (attribute.defaultValue === true) {
        attribute.defaultValue = 1;
      } else if (attribute.defaultValue === false) {
        attribute.defaultValue = 0;
      }
      template += ` DEFAULT ${this.escape(attribute.defaultValue)}`;
    }

    if (attribute.unique === true && !attribute.primaryKey) {
      template += ' UNIQUE';
    }

    if (attribute.primaryKey) {
      template += ' PRIMARY KEY';
    }

    if (attribute.comment) {
      template += ` COMMENT ${this.escape(attribute.comment)}`;
    }

    if (attribute.first) {
      template += ' FIRST';
    }
    if (attribute.after) {
      template += ` AFTER ${this.quoteIdentifier(attribute.after)}`;
    }

    if (attribute.references) {

      if (options && options.context === 'addColumn' && options.foreignKey) {
        const attrName = this.quoteIdentifier(options.foreignKey);
        const fkName = this.quoteIdentifier(`${options.tableName}_${attrName}_foreign_idx`);

        template += ` ADD CONSTRAINT ${fkName} FOREIGN KEY (${attrName})`;
      }

      template += ` REFERENCES ${this.quoteTable(attribute.references.model)}`;

      if (attribute.references.key) {
        template += ` (${this.quoteIdentifier(attribute.references.key)})`;
      } else {
        template += ` (${this.quoteIdentifier('id')})`;
      }

      if (attribute.onDelete) {
        template += ` ON DELETE ${attribute.onDelete.toUpperCase()}`;
      }

      if (attribute.onUpdate && attribute.onUpdate.toUpperCase() !== 'CASCADE') {
        template += ` ON UPDATE ${attribute.onUpdate.toUpperCase()}`;
      }
    }

    return template;
  }

  attributesToSQL(attributes, options) {
    const result = {};

    for (const key in attributes) {
      const attribute = attributes[key];
      result[attribute.field || key] = this.attributeToSQL(attribute, options);
    }

    return result;
  }

  /**
   * Generates an SQL query that returns all foreign keys of a table.
   *
   * @param  {Object} table  The table.
   * @param  {string} schemaName The name of the schema.
   * @returns {string}            The generated sql query.
   * @private
   */
  getForeignKeysQuery(table, schemaName) {
    const quotedSchemaName = schemaName ? wrapSingleQuote(schemaName) : '';
    const quotedTableName = wrapSingleQuote(table.tableName || table);

    const sql = [
      'SELECT FK_NAME AS "constraintName",',
      'PKTABLE_CAT AS "referencedTableCatalog",',
      'PKTABLE_SCHEM AS "referencedTableSchema",',
      'PKTABLE_NAME AS "referencedTableName",',
      'PKCOLUMN_NAME AS "referencedColumnName",',
      'FKTABLE_CAT AS "tableCatalog",',
      'FKTABLE_SCHEM AS "tableSchema",',
      'FKTABLE_NAME AS "tableName",',
      'FKTABLE_SCHEM AS "tableSchema",',
      'FKCOLUMN_NAME AS "columnName"',
      'FROM SYSIBM.SQLFOREIGNKEYS',
      `WHERE FKTABLE_SCHEM = ${quotedSchemaName}`,
      `AND FKTABLE_NAME = ${quotedTableName}`
    ].join(' ');
    return sql;
  }

  /**
   * Generates an SQL query that returns the foreign key constraint of a given column.
   *
   * @param  {Object} table  The table.
   * @param  {string} columnName The name of the column.
   * @returns {string}            The generated sql query.
   * @private
   */
  getForeignKeyQuery(table, columnName) {
    const quotedSchemaName = table.schema ? wrapSingleQuote(table.schema) : '';
    const quotedTableName = wrapSingleQuote(table.tableName || table);
    const quotedColumnName = wrapSingleQuote(columnName);

    const sql = [
      'SELECT FK_NAME AS "constraintName",',
      'PKTABLE_CAT AS "referencedTableCatalog",',
      'PKTABLE_SCHEM AS "referencedTableSchema",',
      'PKTABLE_NAME AS "referencedTableName",',
      'PKCOLUMN_NAME AS "referencedColumnName",',
      'FKTABLE_CAT AS "tableCatalog",',
      'FKTABLE_SCHEM AS "tableSchema",',
      'FKTABLE_NAME AS "tableName",',
      'FKTABLE_SCHEM AS "tableSchema",',
      'FKCOLUMN_NAME AS "columnName"',
      'FROM SYSIBM.SQLFOREIGNKEYS',
      `WHERE FKTABLE_SCHEM = ${quotedSchemaName}`,
      `AND FKTABLE_NAME = ${quotedTableName}`,
      `AND FKCOLUMN_NAME = ${quotedColumnName}`
    ].join(' ');
    return sql;
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
    return `ALTER TABLE ${this.quoteTable(tableName)}
      DROP FOREIGN KEY ${this.quoteIdentifier(foreignKey)};`;
  }

  booleanValue(value) {
    if (value) {
      return 1;
    }

    return 0;
  }
}

// private methods
function wrapSingleQuote(identifier) {
  return Utils.addTicks(identifier, '\'');
}

module.exports = IBMiQueryGenerator;
