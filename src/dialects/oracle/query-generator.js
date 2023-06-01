// Copyright (c) 2022, Oracle and/or its affiliates. All rights reserved

'use strict';

const Utils = require('../../utils');
const DataTypes = require('../../data-types');
const AbstractQueryGenerator = require('../abstract/query-generator');
const _ = require('lodash');
const util = require('util');
const Transaction = require('../../transaction');

/**
 * list of reserved words in Oracle DB 21c
 * source: https://www.oracle.com/pls/topic/lookup?ctx=dblatest&id=GUID-7B72E154-677A-4342-A1EA-C74C1EA928E6
 *
 * @private
 */
const ORACLE_RESERVED_WORDS = ['ACCESS', 'ADD', 'ALL', 'ALTER', 'AND', 'ANY', 'ARRAYLEN', 'AS', 'ASC', 'AUDIT', 'BETWEEN', 'BY', 'CHAR', 'CHECK', 'CLUSTER', 'COLUMN', 'COMMENT', 'COMPRESS', 'CONNECT', 'CREATE', 'CURRENT', 'DATE', 'DECIMAL', 'DEFAULT', 'DELETE', 'DESC', 'DISTINCT', 'DROP', 'ELSE', 'EXCLUSIVE', 'EXISTS', 'FILE', 'FLOAT', 'FOR', 'FROM', 'GRANT', 'GROUP', 'HAVING', 'IDENTIFIED', 'IMMEDIATE', 'IN', 'INCREMENT', 'INDEX', 'INITIAL', 'INSERT', 'INTEGER', 'INTERSECT', 'INTO', 'IS', 'LEVEL', 'LIKE', 'LOCK', 'LONG', 'MAXEXTENTS', 'MINUS', 'MODE', 'MODIFY', 'NOAUDIT', 'NOCOMPRESS', 'NOT', 'NOTFOUND', 'NOWAIT', 'NULL', 'NUMBER', 'OF', 'OFFLINE', 'ON', 'ONLINE', 'OPTION', 'OR', 'ORDER', 'PCTFREE', 'PRIOR', 'PRIVILEGES', 'PUBLIC', 'RAW', 'RENAME', 'RESOURCE', 'REVOKE', 'ROW', 'ROWID', 'ROWLABEL', 'ROWNUM', 'ROWS', 'SELECT', 'SESSION', 'SET', 'SHARE', 'SIZE', 'SMALLINT', 'SQLBUF', 'START', 'SUCCESSFUL', 'SYNONYM', 'SYSDATE', 'TABLE', 'THEN', 'TO', 'TRIGGER', 'UID', 'UNION', 'UNIQUE', 'UPDATE', 'USER', 'VALIDATE', 'VALUES', 'VARCHAR', 'VARCHAR2', 'VIEW', 'WHENEVER', 'WHERE', 'WITH'];
const JSON_FUNCTION_REGEX = /^\s*((?:[a-z]+_){0,2}jsonb?(?:_[a-z]+){0,2})\([^)]*\)/i;
const JSON_OPERATOR_REGEX = /^\s*(->>?|@>|<@|\?[|&]?|\|{2}|#-)/i;
const TOKEN_CAPTURE_REGEX = /^\s*((?:([`"'])(?:(?!\2).|\2{2})*\2)|[\w\d\s]+|[().,;+-])/i;

export class OracleQueryGenerator extends AbstractQueryGenerator {
  constructor(options) {
    super(options);
  }

  /**
   * Returns the value as it is stored in the Oracle DB
   *
   * @param {string} value
   */
  getCatalogName(value) {
    if (value) {
      if (this.options.quoteIdentifiers === false) {
        const quotedValue = this.quoteIdentifier(value);
        if (quotedValue === value) {
          value = value.toUpperCase();
        }
      }
    }
    return value;
  }

  /**
   * Returns the tableName and schemaName as it is stored the Oracle DB
   *
   * @param {object|string} table
   */
  getSchemaNameAndTableName(table) {
    const tableName = this.getCatalogName(table.tableName || table);
    const schemaName = this.getCatalogName(table.schema);
    return [tableName, schemaName];
  }

  createSchema(schema) {
    const quotedSchema = this.quoteIdentifier(schema);
    return [
      'DECLARE',
      'USER_FOUND BOOLEAN := FALSE;',
      'BEGIN',
      ' BEGIN',
      '   EXECUTE IMMEDIATE ',
      this.escape(`CREATE USER ${quotedSchema} IDENTIFIED BY 12345 DEFAULT TABLESPACE USERS`),
      ';',
      '   EXCEPTION WHEN OTHERS THEN',
      '     IF SQLCODE != -1920 THEN',
      '       RAISE;',
      '     ELSE',
      '       USER_FOUND := TRUE;',
      '     END IF;',
      ' END;',
      ' IF NOT USER_FOUND THEN',
      '    EXECUTE IMMEDIATE ',
      this.escape(`GRANT "CONNECT" TO ${quotedSchema}`),
      ';',
      '    EXECUTE IMMEDIATE ',
      this.escape(`GRANT CREATE TABLE TO ${quotedSchema}`),
      ';',
      '    EXECUTE IMMEDIATE ',
      this.escape(`GRANT CREATE VIEW TO ${quotedSchema}`),
      ';',
      '    EXECUTE IMMEDIATE ',
      this.escape(`GRANT CREATE ANY TRIGGER TO ${quotedSchema}`),
      ';',
      '    EXECUTE IMMEDIATE ',
      this.escape(`GRANT CREATE ANY PROCEDURE TO ${quotedSchema}`),
      ';',
      '    EXECUTE IMMEDIATE ',
      this.escape(`GRANT CREATE SEQUENCE TO ${quotedSchema}`),
      ';',
      '    EXECUTE IMMEDIATE ',
      this.escape(`GRANT CREATE SYNONYM TO ${quotedSchema}`),
      ';',
      '    EXECUTE IMMEDIATE ',
      this.escape(`ALTER USER ${quotedSchema} QUOTA UNLIMITED ON USERS`),
      ';',
      ' END IF;',
      'END;'
    ].join(' ');
  }

  showSchemasQuery() {
    return 'SELECT USERNAME AS "schema_name" FROM ALL_USERS WHERE COMMON = (\'NO\') AND USERNAME != user';
  }

  dropSchema(schema) {
    return [
      'BEGIN',
      'EXECUTE IMMEDIATE ',
      this.escape(`DROP USER ${this.quoteTable(schema)} CASCADE`),
      ';',
      'EXCEPTION WHEN OTHERS THEN',
      '  IF SQLCODE != -1918 THEN',
      '    RAISE;',
      '  END IF;',
      'END;'
    ].join(' ');
  }

  versionQuery() {
    return "SELECT VERSION_FULL FROM PRODUCT_COMPONENT_VERSION WHERE PRODUCT LIKE 'Oracle%'";
  }

  createTableQuery(tableName, attributes, options) {
    const primaryKeys = [],
      foreignKeys = Object.create(null),
      attrStr = [],
      checkStr = [];

    const values = {
      table: this.quoteTable(tableName)
    };

    // Starting by dealing with all attributes
    for (let attr in attributes) {
      if (!Object.prototype.hasOwnProperty.call(attributes, attr)) continue;
      const dataType = attributes[attr];
      attr = this.quoteIdentifier(attr);

      // ORACLE doesn't support inline REFERENCES declarations: move to the end
      if (dataType.includes('PRIMARY KEY')) {
        // Primary key
        primaryKeys.push(attr);
        if (dataType.includes('REFERENCES')) {
          const match = dataType.match(/^(.+) (REFERENCES.*)$/);
          attrStr.push(`${attr} ${match[1].replace(/PRIMARY KEY/, '')}`);

          // match[2] already has foreignKeys in correct format so we don't need to replace
          foreignKeys[attr] = match[2];
        } else {
          attrStr.push(`${attr} ${dataType.replace(/PRIMARY KEY/, '').trim()}`);
        }
      } else if (dataType.includes('REFERENCES')) {
        // Foreign key
        const match = dataType.match(/^(.+) (REFERENCES.*)$/);
        attrStr.push(`${attr} ${match[1]}`);

        // match[2] already has foreignKeys in correct format so we don't need to replace
        foreignKeys[attr] = match[2];
      } else {
        attrStr.push(`${attr} ${dataType}`);
      }
    }

    values['attributes'] = attrStr.join(', ');

    const pkString = primaryKeys.map(pk => this.quoteIdentifier(pk)).join(', ');

    if (pkString.length > 0) {
      values.attributes += `,PRIMARY KEY (${pkString})`;
    }

    // Dealing with FKs
    for (const fkey in foreignKeys) {
      if (!Object.prototype.hasOwnProperty.call(foreignKeys, fkey)) continue; 
      // Oracle default response for FK, doesn't support if defined
      if (foreignKeys[fkey].indexOf('ON DELETE NO ACTION') > -1) {
        foreignKeys[fkey] = foreignKeys[fkey].replace('ON DELETE NO ACTION', '');
      }
      values.attributes += `,FOREIGN KEY (${this.quoteIdentifier(fkey)}) ${foreignKeys[fkey]}`;
    }

    if (checkStr.length > 0) {
      values.attributes += `, ${checkStr.join(', ')}`;
    }

    // Specific case for unique indexes with Oracle, we have to set the constraint on the column, if not, no FK will be possible (ORA-02270: no matching unique or primary key for this column-list)
    if (options && options.indexes && options.indexes.length > 0) {
      const idxToDelete = [];
      options.indexes.forEach((index, idx) => {
        if ('unique' in index && (index.unique === true || index.unique.length > 0 && index.unique !== false)) {
          // If unique index, transform to unique constraint on column
          const fields = index.fields.map(field => {
            if (typeof field === 'string') {
              return field;
            } 
            return field.attribute;
            
          });

          // Now we have to be sure that the constraint isn't already declared in uniqueKeys
          let canContinue = true;
          if (options.uniqueKeys) {
            const keys = Object.keys(options.uniqueKeys);

            for (let fieldIdx = 0; fieldIdx < keys.length; fieldIdx++) {
              const currUnique = options.uniqueKeys[keys[fieldIdx]];

              if (currUnique.fields.length === fields.length) {
                // lengths are the same, possible same constraint
                for (let i = 0; i < currUnique.fields.length; i++) {
                  const field = currUnique.fields[i];

                  if (_.includes(fields, field)) {
                    canContinue = false;
                  } else {
                    // We have at least one different column, even if we found the same columns previously, we let the constraint be created
                    canContinue = true;
                    break;
                  }
                }
              }
            }

            if (canContinue) {
              const indexName = 'name' in index ? index.name : '';
              const constraintToAdd = {
                name: indexName,
                fields
              };
              if (!('uniqueKeys' in options)) {
                options.uniqueKeys = {};
              }

              options.uniqueKeys[indexName] = constraintToAdd;
              idxToDelete.push(idx);
            } else {
              // The constraint already exists, we remove it from the list
              idxToDelete.push(idx);
            }
          }
        }
      });
      idxToDelete.forEach(idx => {
        options.indexes.splice(idx, 1);
      });
    }

    if (options && !!options.uniqueKeys) {
      _.each(options.uniqueKeys, (columns, indexName) => {
        let canBeUniq = false;

        // Check if we can create the unique key
        primaryKeys.forEach(primaryKey => {
          // We can create an unique constraint if it's not on the primary key AND if it doesn't have unique in its definition
          // We replace quotes in primary key with ''
          // Primary key would be a list with double quotes in it so we remove the double quotes
          primaryKey = primaryKey.replace(/"/g, '');

          // We check if the unique indexes are already a part of primary key or not
          // If it is not then we set canbeuniq to true and add a unique constraint to these fields.
          // Else we can ignore unique constraint on these
          if (!_.includes(columns.fields, primaryKey)) {
            canBeUniq = true;
          }
        });

        columns.fields.forEach(field => {
          let currField = '';
          if (!_.isString(field)) {
            currField = field.attribute.replace(/[.,"\s]/g, '');
          } else {
            currField = field.replace(/[.,"\s]/g, '');
          }
          if (currField in attributes) {
            // If canBeUniq is false we need not replace the UNIQUE for the attribute
            // So we replace UNIQUE with '' only if there exists a primary key
            if (attributes[currField].toUpperCase().indexOf('UNIQUE') > -1 && canBeUniq) {
              // We generate the attribute without UNIQUE
              const attrToReplace = attributes[currField].replace('UNIQUE', '');
              // We replace in the final string
              values.attributes = values.attributes.replace(attributes[currField], attrToReplace);
            }
          }
        });

        // Oracle cannot have an unique AND a primary key on the same fields, prior to the primary key
        if (canBeUniq) {
          const index = options.uniqueKeys[columns.name];
          delete options.uniqueKeys[columns.name];
          indexName = indexName.replace(/[.,\s]/g, '');
          columns.name = indexName;
          options.uniqueKeys[indexName] = index;

          // Autogenerate Constraint name, if no indexName is given
          if (indexName.length === 0) {
            values.attributes += `,UNIQUE (${columns.fields.map(field => this.quoteIdentifier(field)).join(', ') })`;
          } else {
            values.attributes +=
              `, CONSTRAINT ${this.quoteIdentifier(indexName)} UNIQUE (${columns.fields.map(field => this.quoteIdentifier(field)).join(', ') })`;
          }
        }
      });
    }

    // we replace single quotes by two quotes in order for the execute statement to work
    const query = Utils.joinSQLFragments([
      'CREATE TABLE',
      values.table,
      `(${values.attributes})`
    ]);

    return Utils.joinSQLFragments([
      'BEGIN',
      'EXECUTE IMMEDIATE',
      `${this.escape(query)};`,
      'EXCEPTION WHEN OTHERS THEN',
      'IF SQLCODE != -955 THEN',
      'RAISE;',
      'END IF;',
      'END;'
    ]);
  }

  tableExistsQuery(table) {
    const [tableName, schemaName] = this.getSchemaNameAndTableName(table);
    return `SELECT TABLE_NAME FROM ALL_TABLES WHERE TABLE_NAME = ${this.escape(tableName)} AND OWNER = ${table.schema ? this.escape(schemaName) : 'USER'}`;
  }
  
  describeTableQuery(tableName, schema) {
    const currTableName = this.getCatalogName(tableName.tableName || tableName);
    schema = this.getCatalogName(schema);
    // name, type, datalength (except number / nvarchar), datalength varchar, datalength number, nullable, default value, primary ?
    return [
      'SELECT atc.COLUMN_NAME, atc.DATA_TYPE, atc.DATA_LENGTH, atc.CHAR_LENGTH, atc.DEFAULT_LENGTH, atc.NULLABLE, ucc.constraint_type ',
      'FROM all_tab_columns atc ',
      'LEFT OUTER JOIN ',
      '(SELECT acc.column_name, acc.table_name, ac.constraint_type FROM all_cons_columns acc INNER JOIN all_constraints ac ON acc.constraint_name = ac.constraint_name) ucc ',
      'ON (atc.table_name = ucc.table_name AND atc.COLUMN_NAME = ucc.COLUMN_NAME) ',
      schema
        ? `WHERE (atc.OWNER = ${this.escape(schema)}) `
        : 'WHERE atc.OWNER = USER ',
      `AND (atc.TABLE_NAME = ${this.escape(currTableName)})`,
      'ORDER BY atc.COLUMN_NAME, CONSTRAINT_TYPE DESC'
    ].join('');
  }

  renameTableQuery(before, after) {
    return Utils.joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(before),
      'RENAME TO',
      this.quoteTable(after)
    ]);
  }

  showConstraintsQuery(table) {
    const tableName = this.getCatalogName(table.tableName || table);
    return `SELECT CONSTRAINT_NAME constraint_name FROM user_cons_columns WHERE table_name = ${this.escape(tableName)}`;
  }

  showTablesQuery() {
    return 'SELECT owner as table_schema, table_name, 0 as lvl FROM all_tables where OWNER IN(SELECT USERNAME AS "schema_name" FROM ALL_USERS WHERE ORACLE_MAINTAINED = \'N\')';
  }

  dropTableQuery(tableName) {
    return Utils.joinSQLFragments([
      'BEGIN ',
      'EXECUTE IMMEDIATE \'DROP TABLE',
      this.quoteTable(tableName),
      'CASCADE CONSTRAINTS PURGE\';',
      'EXCEPTION WHEN OTHERS THEN',
      ' IF SQLCODE != -942 THEN',
      '   RAISE;',
      ' END IF;',
      'END;'
    ]);
  }

  /*
    Modifying the indexname so that it is prefixed with the schema name
    otherwise Oracle tries to add the index to the USER schema
   @overide
  */
  addIndexQuery(tableName, attributes, options, rawTablename) {
    if (typeof tableName !== 'string' && attributes.name) {
      attributes.name = `${tableName.schema}.${attributes.name}`;
    }
    return super.addIndexQuery(tableName, attributes, options, rawTablename);
  }

  addConstraintQuery(tableName, options) {
    options = options || {};

    const constraintSnippet = this.getConstraintSnippet(tableName, options);

    tableName = this.quoteTable(tableName);
    return `ALTER TABLE ${tableName} ADD ${constraintSnippet};`;
  }

  addColumnQuery(table, key, dataType) {
    dataType.field = key;

    const attribute = Utils.joinSQLFragments([
      this.quoteIdentifier(key),
      this.attributeToSQL(dataType, {
        attributeName: key,
        context: 'addColumn'
      })
    ]);

    return Utils.joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(table),
      'ADD',
      attribute
    ]);
  }

  removeColumnQuery(tableName, attributeName) {
    return Utils.joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'DROP COLUMN',
      this.quoteIdentifier(attributeName),
      ';'
    ]);
  }

  /**
   * Function to add new foreign key to the attribute 
   * Block for add and drop foreign key constraint query
   * taking the assumption that there is a single column foreign key reference always
   * i.e. we always do - FOREIGN KEY (a) reference B(a) during createTable queryGenerator
   * so there would be one and only one match for a constraint name for each column
   * and every foreign keyed column would have a different constraint name
   * Since sequelize doesn't support multiple column foreign key, added complexity to
   * add the feature isn't needed
   *
   * @param {string} definition The operation that needs to be performed on the attribute
   * @param {string|object} table The table that needs to be altered
   * @param {string} attributeName The name of the attribute which would get altered
   */
  _alterForeignKeyConstraint(definition, table, attributeName) {
    const [tableName, schemaName] = this.getSchemaNameAndTableName(table);
    const attributeNameConstant = this.escape(this.getCatalogName(attributeName));
    const schemaNameConstant = table.schema ? this.escape(this.getCatalogName(schemaName)) : 'USER';
    const tableNameConstant = this.escape(this.getCatalogName(tableName));
    const getConsNameQuery = [
      'SELECT constraint_name INTO cons_name',
      'FROM (',
      '  SELECT DISTINCT cc.owner, cc.table_name, cc.constraint_name, cc.column_name AS cons_columns',
      '  FROM all_cons_columns cc, all_constraints c',
      '  WHERE cc.owner = c.owner',
      '  AND cc.table_name = c.table_name',
      '  AND cc.constraint_name = c.constraint_name',
      '  AND c.constraint_type = \'R\'',
      '  GROUP BY cc.owner, cc.table_name, cc.constraint_name, cc.column_name',
      ')',
      'WHERE owner =',
      schemaNameConstant,
      'AND table_name =',
      tableNameConstant,
      'AND cons_columns =',
      attributeNameConstant,
      ';'
    ].join(' ');
    const secondQuery = Utils.joinSQLFragments([
      `ALTER TABLE ${this.quoteIdentifier(tableName)}`,
      'ADD FOREIGN KEY',
      `(${this.quoteIdentifier(attributeName)})`,
      definition.replace(/.+?(?=REFERENCES)/, '')
    ]);
    return [
      'BEGIN',
      getConsNameQuery,
      'EXCEPTION',
      'WHEN NO_DATA_FOUND THEN',
      ' CONS_NAME := NULL;',
      'END;',
      'IF CONS_NAME IS NOT NULL THEN',
      ` EXECUTE IMMEDIATE 'ALTER TABLE ${this.quoteTable(table)} DROP CONSTRAINT "'||CONS_NAME||'"';`,
      'END IF;',
      `EXECUTE IMMEDIATE ${this.escape(secondQuery)};`
    ].join(' ');
  }

  /**
   * Function to alter table modify
   *
   * @param {string} definition The operation that needs to be performed on the attribute
   * @param {object|string} table The table that needs to be altered
   * @param {string} attributeName The name of the attribute which would get altered
   */
  _modifyQuery(definition, table, attributeName) {
    const query = Utils.joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(table),
      'MODIFY',
      this.quoteIdentifier(attributeName),
      definition
    ]);
    const secondQuery = query.replace('NOT NULL', '').replace('NULL', '');
    return [
      'BEGIN',
      `EXECUTE IMMEDIATE ${this.escape(query)};`,
      'EXCEPTION',
      'WHEN OTHERS THEN',
      ' IF SQLCODE = -1442 OR SQLCODE = -1451 THEN',
      // We execute the statement without the NULL / NOT NULL clause if the first statement failed due to this
      `   EXECUTE IMMEDIATE ${this.escape(secondQuery)};`,
      ' ELSE',
      '   RAISE;',
      ' END IF;',
      'END;'
    ].join(' ');
  }

  changeColumnQuery(table, attributes) {
    const sql = [
      'DECLARE',
      'CONS_NAME VARCHAR2(200);',
      'BEGIN'
    ];
    for (const attributeName in attributes) {
      if (!Object.prototype.hasOwnProperty.call(attributes, attributeName)) continue;
      const definition = attributes[attributeName];
      if (definition.match(/REFERENCES/)) {
        sql.push(this._alterForeignKeyConstraint(definition, table, attributeName));
      } else {
        // Building the modify query
        sql.push(this._modifyQuery(definition, table, attributeName));
      }
    }
    sql.push('END;');
    return sql.join(' ');
  }

  renameColumnQuery(tableName, attrBefore, attributes) {
    const newName = Object.keys(attributes)[0];
    return `ALTER TABLE ${this.quoteTable(tableName)} RENAME COLUMN ${this.quoteIdentifier(attrBefore)} TO ${this.quoteIdentifier(newName)}`;
  }

  /**
   * Populates the returnAttributes array with outbind bindByPosition values
   * and also the options.outBindAttributes map with bindDef for outbind of InsertQuery
   *
   * @param {Array} returningModelAttributes
   * @param {Array} returnTypes
   * @param {number} inbindLength
   * @param {object} returnAttributes
   * @param {object} options
   *
   * @private
   */
  populateInsertQueryReturnIntoBinds(returningModelAttributes, returnTypes, inbindLength, returnAttributes, options) {
    const oracledb = this.sequelize.connectionManager.lib;
    const outBindAttributes = Object.create(null);
    const outbind = [];
    const outbindParam = this.bindParam(outbind, inbindLength);
    returningModelAttributes.forEach((element, index) => {
      // generateReturnValues function quotes identifier based on the quoteIdentifier option
      // If the identifier starts with a quote we remove it else we use it as is
      if (element.startsWith('"')) {
        element = element.substring(1, element.length - 1);
      }
      outBindAttributes[element] = Object.assign(returnTypes[index]._getBindDef(oracledb), { dir: oracledb.BIND_OUT });
      const returnAttribute = `${this.format(undefined, undefined, { context: 'INSERT' }, outbindParam)}`;
      returnAttributes.push(returnAttribute);
    });
    options.outBindAttributes = outBindAttributes;
  }

  /**
   * Override of upsertQuery, Oracle specific
   * Using PL/SQL for finding the row
   *
   * @param {object|string} tableName
   * @param {Array} insertValues
   * @param {Array} updateValues
   * @param {Array} where
   * @param {object} model
   * @param {object} options
   */
  upsertQuery(tableName, insertValues, updateValues, where, model, options) {
    const rawAttributes = model.rawAttributes;
    const updateQuery = this.updateQuery(tableName, updateValues, where, options, rawAttributes);
    // This bind is passed so that the insert query starts appending to this same bind array
    options.bind = updateQuery.bind;
    const insertQuery = this.insertQuery(tableName, insertValues, rawAttributes, options);

    const sql = [
      'DECLARE ',
      'BEGIN ',
      updateQuery.query ? [ 
        updateQuery.query,
        '; ',
        ' IF ( SQL%ROWCOUNT = 0 ) THEN ',
        insertQuery.query,
        ' :isUpdate := 0; ',
        'ELSE ',
        ' :isUpdate := 1; ',
        ' END IF; '
      ].join('') : [
        insertQuery.query,
        ' :isUpdate := 0; ',
        // If there is a conflict on insert we ignore
        'EXCEPTION WHEN OTHERS THEN',
        ' IF SQLCODE != -1 THEN',
        '   RAISE;',
        ' END IF;'
      ].join(''),
      'END;'
    ];

    const query = sql.join('');
    const result = { query };
    
    if (options.bindParam !== false) {
      result.bind = updateQuery.bind || insertQuery.bind;
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
    options = options || {};
    options.executeMany = true;
    fieldMappedAttributes = fieldMappedAttributes || {};

    const tuples = [];
    const allColumns = {};
    const inBindBindDefMap = {};
    const outBindBindDefMap = {};
    const oracledb = this.sequelize.connectionManager.lib;

    // Generating the allColumns map
    // The data is provided as an array of objects. 
    // Each object may contain differing numbers of attributes. 
    // A set of the attribute names that are used in all objects must be determined. 
    // The allColumns map contains the column names and indicates whether the value is generated or not
    // We set allColumns[key] to true if the field is an
    // auto-increment field and the value given is null and fieldMappedAttributes[key]
    // is valid for the specific column else it is set to false
    for (const fieldValueHash of fieldValueHashes) {
      _.forOwn(fieldValueHash, (value, key) => {
        allColumns[key] = fieldMappedAttributes[key] && fieldMappedAttributes[key].autoIncrement === true && value === null;
      });
    }

    // Building the inbind parameter
    // A list that would have inbind positions like [:1, :2, :3...] to be used in generating sql string
    let inBindPosition;
    // Iterating over each row of the fieldValueHashes
    for (const fieldValueHash of fieldValueHashes) {
      // Has each column for a row after coverting it to appropriate format using this.format function
      // like ['Mick', 'Broadstone', 2022-02-16T05:24:18.949Z, 2022-02-16T05:24:18.949Z],
      const tuple = [];
      // A function expression for this.bindParam/options.bindparam function
      // This function is passed to this.format function which inserts column values to the tuple list
      // using _bindParam/_stringify function in data-type.js file
      const inbindParam = options.bindParam === undefined ? this.bindParam(tuple) : options.bindParam;
      // We are iterating over each col
      // and pushing the given values to tuple list using this.format function
      // and also simultaneously generating the bindPosition
      // tempBindPostions has the inbind positions
      const tempBindPositions = Object.keys(allColumns).map(key => {
        if (allColumns[key] === true) {
          // We had set allAttributes[key] to true since at least one row for an auto increment column was null
          // If we get any other row that has this specific column as non-null we must raise an error
          // Since for an auto-increment column, either all row has to be null or all row has to be a non-null
          if (fieldValueHash[key] !== null) {
            throw Error('For an auto-increment column either all row must be null or non-null, a mix of null and non-null is not allowed!');
          }
          // Return DEFAULT for auto-increment column and if all values for the column is null in each row
          return 'DEFAULT';
        }
        // Sanitizes the values given by the user and pushes it to the tuple list using inBindParam function and
        // also generates the inbind position for the sql string for example (:1, :2, :3.....) which is a by product of the push
        return this.format(fieldValueHash[key], fieldMappedAttributes[key], { context: 'INSERT' }, inbindParam);
      });

      // Even though the bind variable positions are calculated for each row we only retain the values for the first row 
      // since the values will be identical
      if (!inBindPosition) {
        inBindPosition = tempBindPositions;
      }
      // Adding the row to the array of rows that will be supplied to executeMany()
      tuples.push(tuple);
    }

    // The columns that we are expecting to be returned from the DB like ["id1", "id2"...]
    const returnColumn = [];
    // The outbind positions for the returning columns like [:3, :4, :5....]
    const returnColumnBindPositions = [];
    // Has the columns name in which data would be inserted like ["id", "name".....]
    const insertColumns = [];
    // Iterating over the allColumns keys to get the bindDef for inbind and outbinds
    // and also to get the list of insert and return column after applying this.quoteIdentifier
    for (const key of Object.keys(allColumns)) {
      // If fieldMappenAttributes[attr] is defined we generate the bindDef 
      // and return clause else we can skip it
      if (fieldMappedAttributes[key]) {
        // BindDef for the specific column
        const bindDef = fieldMappedAttributes[key].type._getBindDef(oracledb);
        if (allColumns[key]) {
          // Binddef for outbinds
          bindDef.dir = oracledb.BIND_OUT;
          outBindBindDefMap[key] = bindDef;

          // Building the outbind parameter list
          // ReturnColumn has the column name for example "id", "usedId", quoting depends on quoteIdentifier option
          returnColumn.push(this.quoteIdentifier(key));
          // Pushing the outbind index to the returnColumnPositions to generate (:3, :4, :5)
          // The start offset depend on the tuple length (bind array size of a particular row)
          // the outbind position starts after the position where inbind position ends
          returnColumnBindPositions.push(`:${tuples[0].length + returnColumn.length}`);
        } else {
          // Binddef for inbinds
          bindDef.dir = oracledb.BIND_IN;
          inBindBindDefMap[key] = bindDef;
        }
      }
      // Quoting and pushing each insert column based on quoteIdentifier option
      insertColumns.push(this.quoteIdentifier(key));
    }
   
    // Generating the sql query
    let query = Utils.joinSQLFragments([
      'INSERT',
      'INTO',
      // Table name for the table in which data needs to inserted
      this.quoteTable(tableName),
      // Columns names for the columns of the table (example "a", "b", "c" - quoting depends on the quoteidentifier option)
      `(${insertColumns.join(',')})`,
      'VALUES',
      // InBind position for the insert query (for example :1, :2, :3....)
      `(${inBindPosition})`
    ]);

    // If returnColumn.length is > 0
    // then the returning into clause is needed
    if (returnColumn.length > 0) {
      options.outBindAttributes = outBindBindDefMap;
      query = Utils.joinSQLFragments([
        query,
        'RETURNING',
        // List of return column (for example "id", "userId"....)
        `${returnColumn.join(',')}`,
        'INTO',
        // List of outbindPosition (for example :4, :5, :6....)
        // Start offset depends on where inbindPosition end
        `${returnColumnBindPositions}`
      ]);
    }

    // Binding the bind variable to result
    const result = { query };
    // Binding the bindParam to result
    // Tuple has each row for the insert query
    result.bind = tuples;
    // Setting options.inbindAttribute
    options.inbindAttributes = inBindBindDefMap;
    return result;
  }

  truncateTableQuery(tableName) {
    return `TRUNCATE TABLE ${this.quoteTable(tableName)}`;
  }

  deleteQuery(tableName, where, options, model) {
    options = options || {};

    const table = tableName;

    where = this.getWhereConditions(where, null, model, options);
    let queryTmpl;
    // delete with limit <l> and optional condition <e> on Oracle: DELETE FROM <t> WHERE rowid in (SELECT rowid FROM <t> WHERE <e> AND rownum <= <l>)
    // Note that the condition <e> has to be in the subquery; otherwise, the subquery would select <l> arbitrary rows.
    if (options.limit) {
      const whereTmpl = where ? ` AND ${where}` : '';
      queryTmpl =
        `DELETE FROM ${this.quoteTable(table)} WHERE rowid IN (SELECT rowid FROM ${this.quoteTable(table)} WHERE rownum <= ${this.escape(options.limit)}${ 
          whereTmpl 
        })`;
    } else {
      const whereTmpl = where ? ` WHERE ${where}` : '';
      queryTmpl = `DELETE FROM ${this.quoteTable(table)}${whereTmpl}`;
    }
    return queryTmpl;
  }

  showIndexesQuery(table) {
    const [tableName, owner] = this.getSchemaNameAndTableName(table);
    const sql = [
      'SELECT i.index_name,i.table_name, i.column_name, u.uniqueness, i.descend, c.constraint_type ',
      'FROM all_ind_columns i ',
      'INNER JOIN all_indexes u ',
      'ON (u.table_name = i.table_name AND u.index_name = i.index_name) ',
      'LEFT OUTER JOIN all_constraints c ',
      'ON (c.table_name = i.table_name AND c.index_name = i.index_name) ',
      `WHERE i.table_name = ${this.escape(tableName)}`,
      ' AND u.table_owner = ',
      owner ? this.escape(owner) : 'USER',
      ' ORDER BY index_name, column_position'
    ];

    return sql.join('');
  }

  removeIndexQuery(tableName, indexNameOrAttributes) {
    let indexName = indexNameOrAttributes;

    if (typeof indexName !== 'string') {
      indexName = Utils.underscore(`${tableName }_${indexNameOrAttributes.join('_')}`);
    }

    return `DROP INDEX ${this.quoteIdentifier(indexName)}`;
  }

  attributeToSQL(attribute, options) {
    if (!_.isPlainObject(attribute)) {
      attribute = {
        type: attribute
      };
    }

    // TODO: Address on update cascade issue whether to throw error or ignore.
    // Add this to documentation when merging to sequelize-main
    // ON UPDATE CASCADE IS NOT SUPPORTED BY ORACLE.
    attribute.onUpdate = '';

    // handle self referential constraints
    if (attribute.references) {
      if (attribute.Model && attribute.Model.tableName === attribute.references.model) {
        this.sequelize.log(
          'Oracle does not support self referencial constraints, ' +
            'we will remove it but we recommend restructuring your query'
        );
        attribute.onDelete = '';
      }
    }

    let template;

    if (attribute.type instanceof DataTypes.ENUM) {
      if (attribute.type.values && !attribute.values) attribute.values = attribute.type.values;

      // enums are a special case
      template = attribute.type.toSql();
      template +=
        ` CHECK (${this.quoteIdentifier(options.attributeName)} IN(${ 
          _.map(attribute.values, value => {
            return this.escape(value);
          }).join(', ') 
        }))`;
      return template;
    } 
    if (attribute.type instanceof DataTypes.JSON) {
      template = attribute.type.toSql();
      template += ` CHECK (${this.quoteIdentifier(options.attributeName)} IS JSON)`;
      return template;
    } 
    if (attribute.type instanceof DataTypes.BOOLEAN) {
      template = attribute.type.toSql();
      template +=
        ` CHECK (${this.quoteIdentifier(options.attributeName)} IN('1', '0'))`;
      return template;
    } 
    if (attribute.autoIncrement) {
      template = ' NUMBER(*,0) GENERATED BY DEFAULT ON NULL AS IDENTITY';
    } else if (attribute.type && attribute.type.key === DataTypes.DOUBLE.key) {
      template = attribute.type.toSql();
    } else if (attribute.type) {
      // setting it to false because oracle doesn't support unsigned int so put a check to make it behave like unsigned int
      let unsignedTemplate = '';
      if (attribute.type._unsigned) {
        attribute.type._unsigned = false;
        unsignedTemplate += ` check(${this.quoteIdentifier(options.attributeName)} >= 0)`;
      }
      template = attribute.type.toString();

      // Blobs/texts cannot have a defaultValue
      if (
        attribute.type &&
        attribute.type !== 'TEXT' &&
        attribute.type._binary !== true &&
        Utils.defaultValueSchemable(attribute.defaultValue)
      ) {
        template += ` DEFAULT ${this.escape(attribute.defaultValue)}`;
      }

      if (!attribute.autoIncrement) {
        // If autoincrement, not null is set automatically
        if (attribute.allowNull === false) {
          template += ' NOT NULL';
        } else if (!attribute.primaryKey && !Utils.defaultValueSchemable(attribute.defaultValue)) {
          template += ' NULL';
        }
      }
      template += unsignedTemplate;
    } else {
      template = '';
    }

    if (attribute.unique === true && !attribute.primaryKey) {
      template += ' UNIQUE';
    }

    if (attribute.primaryKey) {
      template += ' PRIMARY KEY';
    }

    if ((!options || !options.withoutForeignKeyConstraints) && attribute.references) {
      template += ` REFERENCES ${this.quoteTable(attribute.references.model)}`;

      if (attribute.references.key) {
        template += ` (${this.quoteIdentifier(attribute.references.key) })`;
      } else {
        template += ` (${this.quoteIdentifier('id') })`;
      }

      if (attribute.onDelete && attribute.onDelete.toUpperCase() !== 'NO ACTION') {
        template += ` ON DELETE ${attribute.onDelete.toUpperCase()}`;
      }
    }

    return template;
  }
  attributesToSQL(attributes, options) {
    const result = {};

    for (const key in attributes) {
      const attribute = attributes[key];
      const attributeName = attribute.field || key;
      result[attributeName] = this.attributeToSQL(attribute, { attributeName, ...options });
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

  getConstraintsOnColumn(table, column) {
    const [tableName, schemaName] = this.getSchemaNameAndTableName(table);
    column = this.getCatalogName(column);
    const sql = [
      'SELECT CONSTRAINT_NAME FROM user_cons_columns WHERE TABLE_NAME = ',
      this.escape(tableName),
      ' and OWNER = ',
      table.schema ? this.escape(schemaName) : 'USER',
      ' and COLUMN_NAME = ',
      this.escape(column),
      ' AND POSITION IS NOT NULL ORDER BY POSITION'
    ].join('');

    return sql;
  }

  getForeignKeysQuery(table) {
    // We don't call quoteTable as we don't want the schema in the table name, Oracle seperates it on another field
    const [tableName, schemaName] = this.getSchemaNameAndTableName(table);
    const sql = [
      'SELECT DISTINCT  a.table_name "tableName", a.constraint_name "constraintName", a.owner "owner",  a.column_name "columnName",', 
      ' b.table_name "referencedTableName", b.column_name "referencedColumnName"',
      ' FROM all_cons_columns a',
      ' JOIN all_constraints c ON a.owner = c.owner AND a.constraint_name = c.constraint_name',
      ' JOIN all_cons_columns b ON c.owner = b.owner AND c.r_constraint_name = b.constraint_name',
      " WHERE c.constraint_type  = 'R'",
      ' AND a.table_name = ',
      this.escape(tableName),
      ' AND a.owner = ',
      table.schema ? this.escape(schemaName) : 'USER',
      ' ORDER BY a.table_name, a.constraint_name'
    ].join('');

    return sql;
  }

  dropForeignKeyQuery(tableName, foreignKey) {
    return this.dropConstraintQuery(tableName, foreignKey);
  }

  getPrimaryKeyConstraintQuery(table) {
    const [tableName, schemaName] = this.getSchemaNameAndTableName(table);
    const sql = [
      'SELECT cols.column_name, atc.identity_column ',
      'FROM all_constraints cons, all_cons_columns cols ',
      'INNER JOIN all_tab_columns atc ON(atc.table_name = cols.table_name AND atc.COLUMN_NAME = cols.COLUMN_NAME )',
      'WHERE cols.table_name = ',
      this.escape(tableName),
      'AND cols.owner = ',
      table.schema ? this.escape(schemaName) : 'USER ',
      "AND cons.constraint_type = 'P' ",
      'AND cons.constraint_name = cols.constraint_name ',
      'AND cons.owner = cols.owner ',
      'ORDER BY cols.table_name, cols.position'
    ].join('');

    return sql;
  }

  dropConstraintQuery(tableName, constraintName) {
    return `ALTER TABLE ${this.quoteTable(tableName)} DROP CONSTRAINT ${constraintName}`;
  }

  setIsolationLevelQuery(value, options) {
    if (options.parent) {
      return;
    }

    switch (value) {
      case Transaction.ISOLATION_LEVELS.READ_UNCOMMITTED:
      case Transaction.ISOLATION_LEVELS.READ_COMMITTED:
        return 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED;';
      case Transaction.ISOLATION_LEVELS.REPEATABLE_READ:
        // Serializable mode is equal to Snapshot Isolation (SI) 
        // defined in ANSI std.
        return 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;';
      default:
        throw new Error(`isolation level "${value}" is not supported`);
    }
  }

  getAliasToken() {
    return '';
  }

  startTransactionQuery(transaction) {
    if (transaction.parent) {
      return `SAVEPOINT ${this.quoteIdentifier(transaction.name)}`;
    }

    return 'BEGIN TRANSACTION';
  }

  commitTransactionQuery(transaction) {
    if (transaction.parent) {
      return;
    }

    return 'COMMIT TRANSACTION';
  }

  rollbackTransactionQuery(transaction) {
    if (transaction.parent) {
      return `ROLLBACK TO SAVEPOINT ${this.quoteIdentifier(transaction.name)}`;
    }

    return 'ROLLBACK TRANSACTION';
  }

  handleSequelizeMethod(smth, tableName, factory, options, prepend) {
    let str;
    if (smth instanceof Utils.Json) {
      // Parse nested object
      if (smth.conditions) {
        const conditions = this.parseConditionObject(smth.conditions).map(condition =>
          `${this.jsonPathExtractionQuery(condition.path[0], _.tail(condition.path))} = '${condition.value}'`
        );

        return conditions.join(' AND ');
      }
      if (smth.path) {

        // Allow specifying conditions using the sqlite json functions
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
    if (smth instanceof Utils.Cast) {
      if (smth.val instanceof Utils.SequelizeMethod) {
        str = this.handleSequelizeMethod(smth.val, tableName, factory, options, prepend);
        if (smth.type === 'boolean') {
          str = `(CASE WHEN ${str}='true' THEN 1 ELSE 0 END)`;
          return `CAST(${str} AS NUMBER)`;
        } if (smth.type === 'timestamptz' && /json_value\(/.test(str)) {
          str = str.slice(0, -1);
          return `${str} RETURNING TIMESTAMP WITH TIME ZONE)`;
        }
      }
    }
    return super.handleSequelizeMethod(smth, tableName, factory, options, prepend);
  }

  _checkValidJsonStatement(stmt) {
    if (typeof stmt !== 'string') {
      return false;
    }

    let currentIndex = 0;
    let openingBrackets = 0;
    let closingBrackets = 0;
    let hasJsonFunction = false;
    let hasInvalidToken = false;

    while (currentIndex < stmt.length) {
      const string = stmt.substr(currentIndex);
      const functionMatches = JSON_FUNCTION_REGEX.exec(string);
      if (functionMatches) {
        currentIndex += functionMatches[0].indexOf('(');
        hasJsonFunction = true;
        continue;
      }

      const operatorMatches = JSON_OPERATOR_REGEX.exec(string);
      if (operatorMatches) {
        currentIndex += operatorMatches[0].length;
        hasJsonFunction = true;
        continue;
      }

      const tokenMatches = TOKEN_CAPTURE_REGEX.exec(string);
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
    if (hasJsonFunction && (hasInvalidToken || openingBrackets !== closingBrackets)) {
      throw new Error(`Invalid json statement: ${stmt}`);
    }

    // return true if the statement has valid json function
    return hasJsonFunction;
  }

  jsonPathExtractionQuery(column, path) {
    let paths = _.toPath(path);
    const quotedColumn = this.isIdentifierQuoted(column) ? column : this.quoteIdentifier(column);

    paths = paths.map(subPath => {
      return /\D/.test(subPath) ? Utils.addTicks(subPath, '"') : subPath;
    });

    const pathStr = this.escape(['$'].concat(paths).join('.').replace(/\.(\d+)(?:(?=\.)|$)/g, (__, digit) => `[${digit}]`));

    return `json_value(${quotedColumn},${pathStr})`;
  }

  addLimitAndOffset(options, model) {
    let fragment = '';
    const offset = options.offset || 0,
      isSubQuery = options.hasIncludeWhere || options.hasIncludeRequired || options.hasMultiAssociation;

    let orders = {};
    if (options.order) {
      orders = this.getQueryOrders(options, model, isSubQuery);
    }

    if (options.limit || options.offset) {
      // Add needed order by clause only when it is not provided
      if (!orders.mainQueryOrder || !orders.mainQueryOrder.length || isSubQuery && (!orders.subQueryOrder || !orders.subQueryOrder.length)) {
        const tablePkFragment = `${this.quoteTable(options.tableAs || model.name)}.${this.quoteIdentifier(model.primaryKeyField)}`;
        fragment += ` ORDER BY ${tablePkFragment}`;
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

  quoteIdentifier(identifier, force = false) {
    const optForceQuote = force;
    const optQuoteIdentifiers = this.options.quoteIdentifiers !== false;
    const rawIdentifier = Utils.removeTicks(identifier, '"');
    const regExp = /^(([\w][\w\d_]*))$/g;

    if (
      optForceQuote !== true &&
      optQuoteIdentifiers === false &&
      regExp.test(rawIdentifier) &&
      !ORACLE_RESERVED_WORDS.includes(rawIdentifier.toUpperCase())
    ) {
      // In Oracle, if tables, attributes or alias are created double-quoted,
      // they are always case sensitive. If they contain any lowercase
      // characters, they must always be double-quoted otherwise it
      // would get uppercased by the DB.
      // Here, we strip quotes if we don't want case sensitivity.
      return rawIdentifier;
    }
    return Utils.addTicks(rawIdentifier, '"');
  }

  /**
 * It causes bindbyPosition like :1, :2, :3
 * We pass the val parameter so that the outBind indexes
 * starts after the inBind indexes end
 *
 * @param {Array} bind
 * @param {number} posOffset
 */
  bindParam(bind, posOffset = 0) {
    return value => {
      bind.push(value);
      return `:${bind.length + posOffset}`;
    };
  }

  /**
   * Returns the authenticate test query string
   */
  authTestQuery() {
    return 'SELECT 1+1 AS result FROM DUAL';
  }
}

/* istanbul ignore next */
function throwMethodUndefined(methodName) {
  throw new Error(`The method "${methodName}" is not defined! Please add it to your sql dialect.`);
}
