'use strict';

const Utils = require('../../utils');
const AbstractQueryGenerator = require('../abstract/query-generator');

const QueryGenerator = {
  __proto__: AbstractQueryGenerator,
  dialect: 'mysql',

  createSchema() {
    return 'SHOW TABLES';
  },

  showSchemasQuery() {
    return 'SHOW TABLES';
  },

  versionQuery() {
    return 'SELECT VERSION() as `version`';
  },

  createTableQuery(tableName, attributes, options) {
    options = Utils._.extend({
      engine: 'InnoDB',
      charset: null,
      rowFormat: null
    }, options || {});

    const query = 'CREATE TABLE IF NOT EXISTS <%= table %> (<%= attributes%>) ENGINE=<%= engine %><%= comment %><%= charset %><%= collation %><%= initialAutoIncrement %><%= rowFormat %>';
    const primaryKeys = [];
    const foreignKeys = {};
    const attrStr = [];

    for (const attr in attributes) {
      if (attributes.hasOwnProperty(attr)) {
        const dataType = attributes[attr];
        let match;

        if (Utils._.includes(dataType, 'PRIMARY KEY')) {
          primaryKeys.push(attr);

          if (Utils._.includes(dataType, 'REFERENCES')) {
             // MySQL doesn't support inline REFERENCES declarations: move to the end
            match = dataType.match(/^(.+) (REFERENCES.*)$/);
            attrStr.push(this.quoteIdentifier(attr) + ' ' + match[1].replace(/PRIMARY KEY/, ''));
            foreignKeys[attr] = match[2];
          } else {
            attrStr.push(this.quoteIdentifier(attr) + ' ' + dataType.replace(/PRIMARY KEY/, ''));
          }
        } else if (Utils._.includes(dataType, 'REFERENCES')) {
          // MySQL doesn't support inline REFERENCES declarations: move to the end
          match = dataType.match(/^(.+) (REFERENCES.*)$/);
          attrStr.push(this.quoteIdentifier(attr) + ' ' + match[1]);
          foreignKeys[attr] = match[2];
        } else {
          attrStr.push(this.quoteIdentifier(attr) + ' ' + dataType);
        }
      }
    }

    const values = {
      table: this.quoteTable(tableName),
      attributes: attrStr.join(', '),
      comment: options.comment && Utils._.isString(options.comment) ? ' COMMENT ' + this.escape(options.comment) : '',
      engine: options.engine,
      charset: options.charset ? ' DEFAULT CHARSET=' + options.charset : '',
      collation: options.collate ? ' COLLATE ' + options.collate : '',
      rowFormat: options.rowFormat ? ' ROW_FORMAT=' + options.rowFormat : '',
      initialAutoIncrement: options.initialAutoIncrement ? ' AUTO_INCREMENT=' + options.initialAutoIncrement : ''
    };
    const pkString = primaryKeys.map(pk => this.quoteIdentifier(pk)).join(', ');

    if (options.uniqueKeys) {
      Utils._.each(options.uniqueKeys, (columns, indexName) => {
        if (!columns.singleField) { // If it's a single field its handled in column def, not as an index
          if (!Utils._.isString(indexName)) {
            indexName = 'uniq_' + tableName + '_' + columns.fields.join('_');
          }
          values.attributes += ', UNIQUE ' + this.quoteIdentifier(indexName) + ' (' + Utils._.map(columns.fields, this.quoteIdentifier).join(', ') + ')';
        }
      });
    }

    if (pkString.length > 0) {
      values.attributes += ', PRIMARY KEY (' + pkString + ')';
    }

    for (const fkey in foreignKeys) {
      if (foreignKeys.hasOwnProperty(fkey)) {
        values.attributes += ', FOREIGN KEY (' + this.quoteIdentifier(fkey) + ') ' + foreignKeys[fkey];
      }
    }

    return Utils._.template(query)(values).trim() + ';';
  },

  showTablesQuery() {
    return 'SHOW TABLES;';
  },

  addColumnQuery(table, key, dataType) {
    const definition = this.attributeToSQL(dataType, {
      context: 'addColumn',
      tableName: table,
      foreignKey: key
    });
    return `ALTER TABLE ${this.quoteTable(table)} ADD ${this.quoteIdentifier(key)} ${definition};`;
  },

  removeColumnQuery(tableName, attributeName) {
    return `ALTER TABLE ${this.quoteTable(tableName)} DROP ${this.quoteIdentifier(attributeName)};`;
  },

  changeColumnQuery(tableName, attributes) {
    const attrString = [];
    const constraintString = [];

    for (const attributeName in attributes) {
      let definition = attributes[attributeName];
      if (definition.match(/REFERENCES/)) {
        const fkName = this.quoteIdentifier(tableName + '_' + attributeName + '_foreign_idx');
        const attrName = this.quoteIdentifier(attributeName);
        definition = definition.replace(/.+?(?=REFERENCES)/, '');
        constraintString.push(`${fkName} FOREIGN KEY (${attrName}) ${definition}`);
      } else {
        attrString.push('`' + attributeName + '` `' + attributeName + '` ' + definition);
      }
    }

    let finalQuery = '';
    if (attrString.length) {
      finalQuery += 'CHANGE ' + attrString.join(', ');
      finalQuery += constraintString.length ? ' ' : '';
    }
    if (constraintString.length) {
      finalQuery += 'ADD CONSTRAINT ' + constraintString.join(', ');
    }

    return `ALTER TABLE ${this.quoteTable(tableName)} ${finalQuery};`;
  },

  renameColumnQuery(tableName, attrBefore, attributes) {
    const attrString = [];

    for (const attrName in attributes) {
      const definition = attributes[attrName];
      attrString.push('`' + attrBefore + '` `' + attrName + '` ' + definition);
    }

    return `ALTER TABLE ${this.quoteTable(tableName)} CHANGE ${attrString.join(', ')};`;
  },

  upsertQuery(tableName, insertValues, updateValues, where, rawAttributes, options) {
    options.onDuplicate = 'UPDATE ';

    options.onDuplicate += Object.keys(updateValues).map(key => {
      key = this.quoteIdentifier(key);
      return key + '=VALUES(' + key +')';
    }).join(', ');

    return this.insertQuery(tableName, insertValues, rawAttributes, options);
  },

  deleteQuery(tableName, where, options) {
    options = options || {};

    const table = this.quoteTable(tableName);
    if (options.truncate === true) {
      // Truncate does not allow LIMIT and WHERE
      return 'TRUNCATE ' + table;
    }

    where = this.getWhereConditions(where);
    let limit = '';

    if (Utils._.isUndefined(options.limit)) {
      options.limit = 1;
    }

    if (options.limit) {
      limit = ' LIMIT ' + this.escape(options.limit);
    }

    let query = 'DELETE FROM ' + table;
    if (where) query += ' WHERE ' + where;
    query += limit;

    return query;
  },

  showIndexesQuery(tableName, options) {
    return 'SHOW INDEX FROM ' + this.quoteTable(tableName) + ((options || {}).database ? ' FROM `' + options.database + '`' : '');
  },

  showConstraintsQuery(tableName, constraintName) {
    let sql = [
      'SELECT CONSTRAINT_CATALOG AS constraintCatalog,',
      'CONSTRAINT_NAME AS constraintName,',
      'CONSTRAINT_SCHEMA AS constraintSchema,',
      'CONSTRAINT_TYPE AS constraintType,',
      'TABLE_NAME AS tableName,',
      'TABLE_SCHEMA AS tableSchema',
      'from INFORMATION_SCHEMA.TABLE_CONSTRAINTS',
      `WHERE table_name='${tableName}'`
    ].join(' ');

    if (constraintName) {
      sql += ` AND constraint_name = '${constraintName}'`;
    }

    return sql + ';';
  },

  removeIndexQuery(tableName, indexNameOrAttributes) {
    let indexName = indexNameOrAttributes;

    if (typeof indexName !== 'string') {
      indexName = Utils.underscore(tableName + '_' + indexNameOrAttributes.join('_'));
    }

    return `DROP INDEX ${this.quoteIdentifier(indexName)} ON ${this.quoteTable(tableName)}`;
  },

  attributeToSQL(attribute, options) {
    if (!Utils._.isPlainObject(attribute)) {
      attribute = {
        type: attribute
      };
    }

    let template = attribute.type.toString({ escape: this.escape.bind(this) });

    if (attribute.allowNull === false) {
      template += ' NOT NULL';
    }

    if (attribute.autoIncrement) {
      template += ' auto_increment';
    }

    // Blobs/texts cannot have a defaultValue
    if (attribute.type !== 'TEXT' && attribute.type._binary !== true && Utils.defaultValueSchemable(attribute.defaultValue)) {
      template += ' DEFAULT ' + this.escape(attribute.defaultValue);
    }

    if (attribute.unique === true) {
      template += ' UNIQUE';
    }

    if (attribute.primaryKey) {
      template += ' PRIMARY KEY';
    }

    if (attribute.after) {
      template += ' AFTER ' + this.quoteIdentifier(attribute.after);
    }

    if (attribute.references) {

      if (options && options.context === 'addColumn' && options.foreignKey) {
        const attrName = this.quoteIdentifier(options.foreignKey);
        const fkName = this.quoteIdentifier(`${options.tableName}_${attrName}_foreign_idx`);

        template += `, ADD CONSTRAINT ${fkName} FOREIGN KEY (${attrName})`;
      }

      template += ' REFERENCES ' + this.quoteTable(attribute.references.model);

      if (attribute.references.key) {
        template += ' (' + this.quoteIdentifier(attribute.references.key) + ')';
      } else {
        template += ' (' + this.quoteIdentifier('id') + ')';
      }

      if (attribute.onDelete) {
        template += ' ON DELETE ' + attribute.onDelete.toUpperCase();
      }

      if (attribute.onUpdate) {
        template += ' ON UPDATE ' + attribute.onUpdate.toUpperCase();
      }
    }

    return template;
  },

  attributesToSQL(attributes, options) {
    const result = {};

    for (const key in attributes) {
      const attribute = attributes[key];
      result[attribute.field || key] = this.attributeToSQL(attribute, options);
    }

    return result;
  },

  findAutoIncrementField(factory) {
    const fields = [];

    for (const name in factory.attributes) {
      if (factory.attributes.hasOwnProperty(name)) {
        const definition = factory.attributes[name];

        if (definition && definition.autoIncrement) {
          fields.push(name);
        }
      }
    }

    return fields;
  },

  quoteIdentifier(identifier) {
    if (identifier === '*') return identifier;
    return Utils.addTicks(Utils.removeTicks(identifier, '`'), '`');
  },

  /**
   * Generates an SQL query that returns all foreign keys of a table.
   *
   * @param  {String} tableName  The name of the table.
   * @param  {String} schemaName The name of the schema.
   * @return {String}            The generated sql query.
   * @private
   */
  getForeignKeysQuery(tableName, schemaName) {
    return "SELECT CONSTRAINT_NAME as constraint_name FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE where TABLE_NAME = '" + tableName + /* jshint ignore: line */
      "' AND CONSTRAINT_NAME!='PRIMARY' AND CONSTRAINT_SCHEMA='" + schemaName + "' AND REFERENCED_TABLE_NAME IS NOT NULL;"; /* jshint ignore: line */
  },

  /**
   * Generates an SQL query that returns the foreign key constraint of a given column.
   *
   * @param  {String} tableName  The name of the table.
   * @param  {String} columnName The name of the column.
   * @return {String}            The generated sql query.
   * @private
   */
  getForeignKeyQuery(table, columnName) {
    let tableName = table.tableName || table;
    if (table.schema) {
      tableName = table.schema + '.' + tableName;
    }
    return 'SELECT CONSTRAINT_NAME as constraint_name'
      + ' FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE'
      + ' WHERE (REFERENCED_TABLE_NAME = ' + wrapSingleQuote(tableName)
      + ' AND REFERENCED_COLUMN_NAME = ' + wrapSingleQuote(columnName)
      + ') OR (TABLE_NAME = ' + wrapSingleQuote(tableName)
      + ' AND COLUMN_NAME = ' + wrapSingleQuote(columnName)
      + ')';
  },

  /**
   * Generates an SQL query that removes a foreign key from a table.
   *
   * @param  {String} tableName  The name of the table.
   * @param  {String} foreignKey The name of the foreign key constraint.
   * @return {String}            The generated sql query.
   * @private
   */
  dropForeignKeyQuery(tableName, foreignKey) {
    return 'ALTER TABLE ' + this.quoteTable(tableName) + ' DROP FOREIGN KEY ' + this.quoteIdentifier(foreignKey) + ';';
  }
};

// private methods
function wrapSingleQuote(identifier){
  return Utils.addTicks(identifier, '\'');
}

module.exports = QueryGenerator;
