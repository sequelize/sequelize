// Copyright (c) 2025, Oracle and/or its affiliates. All rights reserved

'use strict';

import each from 'lodash/each';
import forOwn from 'lodash/forOwn';
import includes from 'lodash/includes';
import isPlainObject from 'lodash/isPlainObject';
import toPath from 'lodash/toPath';
import oracledb from 'oracledb';

import { DataTypes } from '@sequelize/core';
import { normalizeDataType } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types-utils.js';
import {
  ADD_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
  CREATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.js';
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { quoteIdentifier } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/dialect.js';
import { joinSQLFragments } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/join-sql-fragments.js';
import {
  EMPTY_OBJECT,
  EMPTY_SET,
  getObjectFromMap,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import { defaultValueSchemable } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/query-builder-utils.js';
import { OracleQueryGeneratorTypeScript } from './query-generator-typescript.internal';

const CREATE_TABLE_QUERY_SUPPORTED_OPTIONS = new Set(['uniqueKeys']);

/**
 * list of reserved words in Oracle DB 21c
 * source: https://www.oracle.com/pls/topic/lookup?ctx=dblatest&id=GUID-7B72E154-677A-4342-A1EA-C74C1EA928E6
 *
 * @private
 */
const ORACLE_RESERVED_WORDS = [
  'ACCESS',
  'ADD',
  'ALL',
  'ALTER',
  'AND',
  'ANY',
  'ARRAYLEN',
  'AS',
  'ASC',
  'AUDIT',
  'BETWEEN',
  'BY',
  'CHAR',
  'CHECK',
  'CLUSTER',
  'COLUMN',
  'COMMENT',
  'COMPRESS',
  'CONNECT',
  'CREATE',
  'CURRENT',
  'DATE',
  'DECIMAL',
  'DEFAULT',
  'DELETE',
  'DESC',
  'DISTINCT',
  'DROP',
  'ELSE',
  'EXCLUSIVE',
  'EXISTS',
  'FILE',
  'FLOAT',
  'FOR',
  'FROM',
  'GRANT',
  'GROUP',
  'HAVING',
  'IDENTIFIED',
  'IMMEDIATE',
  'IN',
  'INCREMENT',
  'INDEX',
  'INITIAL',
  'INSERT',
  'INTEGER',
  'INTERSECT',
  'INTO',
  'IS',
  'LEVEL',
  'LIKE',
  'LOCK',
  'LONG',
  'MAXEXTENTS',
  'MINUS',
  'MODE',
  'MODIFY',
  'NOAUDIT',
  'NOCOMPRESS',
  'NOT',
  'NOTFOUND',
  'NOWAIT',
  'NULL',
  'NUMBER',
  'OF',
  'OFFLINE',
  'ON',
  'ONLINE',
  'OPTION',
  'OR',
  'ORDER',
  'PCTFREE',
  'PRIOR',
  'PRIVILEGES',
  'PUBLIC',
  'RAW',
  'RENAME',
  'RESOURCE',
  'REVOKE',
  'ROW',
  'ROWID',
  'ROWLABEL',
  'ROWNUM',
  'ROWS',
  'SELECT',
  'SESSION',
  'SET',
  'SHARE',
  'SIZE',
  'SMALLINT',
  'SQLBUF',
  'START',
  'SUCCESSFUL',
  'SYNONYM',
  'SYSDATE',
  'TABLE',
  'THEN',
  'TO',
  'TRIGGER',
  'UID',
  'UNION',
  'UNIQUE',
  'UPDATE',
  'USER',
  'VALIDATE',
  'VALUES',
  'VARCHAR',
  'VARCHAR2',
  'VIEW',
  'WHENEVER',
  'WHERE',
  'WITH',
];
const JSON_FUNCTION_REGEX = /^\s*((?:[a-z]+_){0,2}jsonb?(?:_[a-z]+){0,2})\([^)]*\)/i;
const JSON_OPERATOR_REGEX = /^\s*(->>?|@>|<@|\?[|&]?|\|{2}|#-)/i;
const TOKEN_CAPTURE_REGEX = /^\s*((?:([`"'])(?:(?!\2).|\2{2})*\2)|[\w\d\s]+|[().,;+-])/i;

export class OracleQueryGenerator extends OracleQueryGeneratorTypeScript {
  listSchemasQuery() {
    return 'SELECT USERNAME AS "schema" FROM ALL_USERS WHERE COMMON = (\'NO\') AND USERNAME != user';
  }

  dropSchemaQuery(schema) {
    return [
      'BEGIN',
      'EXECUTE IMMEDIATE ',
      this.escape(`DROP USER ${this.quoteTable(schema)} CASCADE`),
      ';',
      'EXCEPTION WHEN OTHERS THEN',
      '  IF SQLCODE != -1918 THEN',
      '    RAISE;',
      '  END IF;',
      'END;',
    ].join(' ');
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

    const primaryKeys = [];
    const foreignKeys = Object.create(null);
    const attrStr = [];
    const checkStr = [];

    const values = {
      table: this.quoteTable(tableName),
    };

    // Starting by dealing with all attributes
    for (let attr in attributes) {
      if (!Object.hasOwn(attributes, attr)) {
        continue;
      }

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

    values.attributes = attrStr.join(', ');

    const pkString = primaryKeys.join(', ');

    if (pkString.length > 0) {
      values.attributes += `,PRIMARY KEY (${pkString})`;
    }

    // Dealing with FKs
    for (const fkey in foreignKeys) {
      if (!Object.hasOwn(foreignKeys, fkey)) {
        continue;
      }

      // Oracle default response for FK, doesn't support if defined
      if (foreignKeys[fkey].includes('ON DELETE NO ACTION')) {
        foreignKeys[fkey] = foreignKeys[fkey].replace('ON DELETE NO ACTION', '');
      }

      values.attributes += `,FOREIGN KEY (${fkey}) ${foreignKeys[fkey]}`;
    }

    if (checkStr.length > 0) {
      values.attributes += `, ${checkStr.join(', ')}`;
    }

    // Specific case for unique indexes with Oracle, we have to set the constraint on the column, if not, no FK will be possible (ORA-02270: no matching unique or primary key for this column-list)
    if (options && options.indexes && options.indexes.length > 0) {
      const idxToDelete = [];
      options.indexes.forEach((index, idx) => {
        if (
          'unique' in index &&
          (index.unique === true || (index.unique.length > 0 && index.unique !== false))
        ) {
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

            // eslint-disable-next-line unicorn/no-for-loop
            for (let fieldIdx = 0; fieldIdx < keys.length; fieldIdx++) {
              const currUnique = options.uniqueKeys[keys[fieldIdx]];

              if (currUnique.fields.length === fields.length) {
                let i;
                // lengths are the same, possible same constraint
                for (i = 0; i < currUnique.fields.length; i++) {
                  const field = currUnique.fields[i];

                  if (includes(fields, field)) {
                    canContinue = false;
                  } else {
                    // We have at least one different column, even if we found the same columns previously, we let the constraint be created
                    canContinue = true;
                    break;
                  }
                }

                if (i === currUnique.fields.length) {
                  break;
                }
              }
            }

            if (canContinue) {
              const indexName = 'name' in index ? index.name : '';
              const constraintToAdd = {
                name: indexName,
                fields,
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

    if (options?.uniqueKeys) {
      // only need to sort primary keys once, don't do it in place
      let sortedPrimaryKeys = [...primaryKeys];
      sortedPrimaryKeys = sortedPrimaryKeys.map(elem => {
        return elem.replaceAll('"', '');
      });
      sortedPrimaryKeys.sort();
      each(options.uniqueKeys, (columns, indexName) => {
        const sortedColumnFields = [...columns.fields];
        sortedColumnFields.sort();
        // if primary keys === unique keys, then skip adding new constraint
        const uniqueIsPrimary =
          sortedColumnFields.length === primaryKeys.length &&
          sortedColumnFields.every((value, index) => {
            return value === sortedPrimaryKeys[index];
          });
        if (uniqueIsPrimary) {
          return true;
        }

        // generate Constraint name, if no indexName is given
        if (typeof indexName !== 'string') {
          indexName = `uniq_${tableName}_${columns.fields.join('_')}`;
        }

        values.attributes += `, CONSTRAINT ${this.quoteIdentifier(indexName)} UNIQUE (${columns.fields.map(field => this.quoteIdentifier(field)).join(', ')})`;
      });
    }

    // we replace single quotes by two quotes in order for the execute statement to work
    const query = joinSQLFragments(['CREATE TABLE', values.table, `(${values.attributes})`]);

    return joinSQLFragments([
      'BEGIN',
      'EXECUTE IMMEDIATE',
      `${this.escape(query)};`,
      'EXCEPTION WHEN OTHERS THEN',
      'IF SQLCODE != -955 THEN',
      'RAISE;',
      'END IF;',
      'END;',
    ]);
  }

  tableExistsQuery(table) {
    const [tableName, schemaName] = this.getSchemaNameAndTableName(table);

    return `SELECT TABLE_NAME FROM ALL_TABLES WHERE TABLE_NAME = ${this.escape(tableName)} AND OWNER = ${table.schema ? this.escape(schemaName) : 'USER'}`;
  }

  listTablesQuery(options) {
    let query = `SELECT owner as "schema", table_name as "tableName" FROM all_tables where OWNER IN`;
    if (options && options.schema) {
      query += `(SELECT USERNAME AS "schema_name" FROM ALL_USERS WHERE ORACLE_MAINTAINED = 'N' AND USERNAME=${this.escape(options.schema)})`;
    } else {
      query += `(SELECT USERNAME AS "schema_name" FROM ALL_USERS WHERE ORACLE_MAINTAINED = 'N')`;
    }

    return query;
  }

  dropTableQuery(tableName) {
    return joinSQLFragments([
      'BEGIN ',
      "EXECUTE IMMEDIATE 'DROP TABLE",
      this.quoteTable(tableName),
      "CASCADE CONSTRAINTS PURGE';",
      'EXCEPTION WHEN OTHERS THEN',
      ' IF SQLCODE != -942 THEN',
      '   RAISE;',
      ' END IF;',
      'END;',
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

  // addConstraintQuery(tableName, options) {
  //   options = options || {};

  //   const constraintSnippet = this.getConstraintSnippet(tableName, options);

  //   tableName = this.quoteTable(tableName);
  //   return `ALTER TABLE ${tableName} ADD ${constraintSnippet};`;
  // }

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
      field: key,
      type: normalizeDataType(dataType.type, this.dialect),
    };
    dataType.field = key;

    const attribute = joinSQLFragments([
      this.quoteIdentifier(key),
      this.attributeToSQL(dataType, {
        attributeName: key,
        context: 'addColumn',
      }),
    ]);

    return joinSQLFragments(['ALTER TABLE', this.quoteTable(table), 'ADD', attribute, ';']);
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
      "  AND c.constraint_type = 'R'",
      '  GROUP BY cc.owner, cc.table_name, cc.constraint_name, cc.column_name',
      ')',
      'WHERE owner =',
      schemaNameConstant,
      'AND table_name =',
      tableNameConstant,
      'AND cons_columns =',
      attributeNameConstant,
      ';',
    ].join(' ');
    const secondQuery = joinSQLFragments([
      `ALTER TABLE ${this.quoteTable(table)}`,
      'ADD FOREIGN KEY',
      `(${this.quoteIdentifier(attributeName)})`,
      definition.replace(/.+?(?=REFERENCES)/, ''),
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
      `EXECUTE IMMEDIATE ${this.escape(secondQuery)};`,
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
    const query = joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(table),
      'MODIFY',
      this.quoteIdentifier(attributeName),
      definition,
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
      'END;',
    ].join(' ');
  }

  changeColumnQuery(table, attributes) {
    const sql = ['DECLARE', 'CONS_NAME VARCHAR2(200);', 'BEGIN'];
    for (const attributeName in attributes) {
      if (!Object.hasOwn(attributes, attributeName)) {
        continue;
      }

      const definition = attributes[attributeName];
      // eslint-disable-next-line unicorn/prefer-regexp-test
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
  populateInsertQueryReturnIntoBinds(
    returningModelAttributes,
    returnTypes,
    inbindLength,
    returnAttributes,
    options,
  ) {
    const outBindAttributes = Object.create(null);
    const outbind = {};
    const outbindParam = this.bindParam(outbind, inbindLength);
    returningModelAttributes.forEach((element, index) => {
      // generateReturnValues function quotes identifier based on the quoteIdentifier option
      // If the identifier starts with a quote we remove it else we use it as is
      if (element.startsWith('"')) {
        element = element.slice(1, -1);
      }

      outBindAttributes[element] = Object.assign(returnTypes[index]._getBindDef(oracledb), {
        dir: oracledb.BIND_OUT,
      });
      const returnAttribute = `${outbindParam(undefined)}`;
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
    const modelDefinition = model.modelDefinition;
    const rawAttributes = getObjectFromMap(modelDefinition.attributes);
    const updateQuery = this.updateQuery(tableName, updateValues, where, options, rawAttributes);
    // This bind is passed so that the insert query starts appending to this same bind array
    options.bind = updateQuery.bind;
    const insertQuery = this.insertQuery(tableName, insertValues, rawAttributes, options);

    const sql = [
      'DECLARE ',
      'BEGIN ',
      updateQuery.query
        ? [
            updateQuery.query,
            '; ',
            ' IF ( SQL%ROWCOUNT = 0 ) THEN ',
            insertQuery.query,
            ' :isUpdate := 0; ',
            'ELSE ',
            ' :isUpdate := 1; ',
            ' END IF; ',
          ].join('')
        : [
            insertQuery.query,
            ' :isUpdate := 0; ',
            // If there is a conflict on insert we ignore
            'EXCEPTION WHEN OTHERS THEN',
            ' IF SQLCODE != -1 THEN',
            '   RAISE;',
            ' END IF;',
          ].join(''),
      'END;',
    ];

    const query = sql.join('');

    if (options.bindParam !== false) {
      options.bind = updateQuery.bind || insertQuery.bind;
    }

    return query;
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

    // Generating the allColumns map
    // The data is provided as an array of objects.
    // Each object may contain differing numbers of attributes.
    // A set of the attribute names that are used in all objects must be determined.
    // The allColumns map contains the column names and indicates whether the value is generated or not
    // We set allColumns[key] to true if the field is an
    // auto-increment field and the value given is null and fieldMappedAttributes[key]
    // is valid for the specific column else it is set to false
    for (const fieldValueHash of fieldValueHashes) {
      forOwn(fieldValueHash, (value, key) => {
        allColumns[key] =
          fieldMappedAttributes[key] &&
          fieldMappedAttributes[key].autoIncrement === true &&
          value === null;
      });
    }

    // Building the inbind parameter
    // A list that would have inbind positions like [:1, :2, :3...] to be used in generating sql string
    let inBindPosition;
    // Iterating over each row of the fieldValueHashes
    for (const fieldValueHash of fieldValueHashes) {
      // Has each column for a row after coverting it to appropriate format using this.format function
      // like ['Mick', 'Broadstone', 2022-02-16T05:24:18.949Z, 2022-02-16T05:24:18.949Z],
      let tuple = [];
      const bindMap = {};
      // A function expression for this.bindParam/options.bindparam function
      // This function is passed to this.format function which inserts column values to the tuple list
      // using _bindParam/_stringify function in data-type.js file
      const inbindParam =
        options.bindParam === undefined ? this.bindParam(bindMap) : options.bindParam;
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
            throw new Error(
              'For an auto-increment column either all row must be null or non-null, a mix of null and non-null is not allowed!',
            );
          }

          // Return DEFAULT for auto-increment column and if all values for the column is null in each row
          return 'DEFAULT';
        }

        // Sanitizes the values given by the user and pushes it to the tuple list using inBindParam function and
        // also generates the inbind position for the sql string for example (:1, :2, :3.....) which is a by product of the push
        return this.escape(fieldValueHash[key] ?? null, {
          model: options.model,
          type: fieldMappedAttributes[key] ? fieldMappedAttributes[key].type : null,
          bindParam: inbindParam,
        });
      });

      // Even though the bind variable positions are calculated for each row we only retain the values for the first row
      // since the values will be identical
      if (!inBindPosition) {
        inBindPosition = tempBindPositions;
      }

      tuple = Object.values(bindMap);
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
      // If fieldMappedAttributes[attr] is defined we generate the bindDef
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
    let query = joinSQLFragments([
      'INSERT',
      'INTO',
      // Table name for the table in which data needs to inserted
      this.quoteTable(tableName),
      // Columns names for the columns of the table (example "a", "b", "c" - quoting depends on the quoteidentifier option)
      `(${insertColumns.join(',')})`,
      'VALUES',
      // InBind position for the insert query (for example :1, :2, :3....)
      `(${inBindPosition})`,
    ]);

    // If returnColumn.length is > 0
    // then the returning into clause is needed
    if (returnColumn.length > 0) {
      options.outBindAttributes = outBindBindDefMap;
      query = joinSQLFragments([
        query,
        'RETURNING',
        // List of return column (for example "id", "userId"....)
        `${returnColumn.join(',')}`,
        'INTO',
        // List of outbindPosition (for example :4, :5, :6....)
        // Start offset depends on where inbindPosition end
        `${returnColumnBindPositions}`,
      ]);
    }

    // Binding the bind variable to result
    const result = query;
    // Binding the bindParam to result
    // Tuple has each row for the insert query
    options.bind = tuples;
    // Setting options.inbindAttribute
    options.inbindAttributes = inBindBindDefMap;

    return result;
  }

  deleteQuery(tableName, where, options = EMPTY_OBJECT, model) {
    const table = tableName;

    let whereClause = this.whereQuery(where, { ...options, model });
    whereClause = whereClause.replace('WHERE', '');
    let queryTmpl;
    // delete with limit <l> and optional condition <e> on Oracle: DELETE FROM <t> WHERE rowid in (SELECT rowid FROM <t> WHERE <e> AND rownum <= <l>)
    // Note that the condition <e> has to be in the subquery; otherwise, the subquery would select <l> arbitrary rows.
    if (options.limit) {
      const whereTmpl = whereClause ? ` AND ${whereClause}` : '';
      queryTmpl = `DELETE FROM ${this.quoteTable(table)} WHERE rowid IN (SELECT rowid FROM ${this.quoteTable(table)} WHERE rownum <= ${this.escape(options.limit)}${whereTmpl})`;
    } else {
      const whereTmpl = whereClause ? ` WHERE${whereClause}` : '';
      queryTmpl = `DELETE FROM ${this.quoteTable(table)}${whereTmpl}`;
    }

    return queryTmpl;
  }

  attributeToSQL(attribute, options) {
    if (!isPlainObject(attribute)) {
      attribute = {
        type: attribute,
      };
    }

    // handle self referential constraints
    if (
      attribute.references &&
      attribute.Model &&
      attribute.Model.tableName === attribute.references.tableName
    ) {
      this.sequelize.log(
        'Oracle does not support self referencial constraints, ' +
          'we will remove it but we recommend restructuring your query',
      );
      attribute.onDelete = '';
    }

    let template;

    if (attribute.type instanceof DataTypes.ENUM) {
      // enums are a special case
      template = attribute.type.toSql({ dialect: this.dialect });
      template += ` CHECK (${this.quoteIdentifier(options.attributeName)} IN(${attribute.type.options.values
        .map(value => {
          return this.escape(value, undefined, {});
        })
        .join(', ')}))`;

      return template;
    }

    if (attribute.type instanceof DataTypes.JSON) {
      template = attribute.type.toSql();
      template += ` CHECK (${this.quoteIdentifier(options.attributeName)} IS JSON)`;

      return template;
    }

    if (attribute.type instanceof DataTypes.BOOLEAN) {
      template = attribute.type.toSql();
      template += ` CHECK (${this.quoteIdentifier(options.attributeName)} IN('1', '0'))`;

      return template;
    }

    if (attribute.autoIncrement) {
      template = ' NUMBER(*,0) GENERATED BY DEFAULT ON NULL AS IDENTITY';
    } else if (attribute.type && attribute.type === 'DOUBLE') {
      template = attribute.type.toSql();
    } else if (attribute.type) {
      // setting it to false because oracle doesn't support unsigned int so put a check to make it behave like unsigned int
      let unsignedTemplate = '';
      if (attribute.type?.options?.unsigned) {
        attribute.type.options.unsigned = false;
        unsignedTemplate += ` CHECK(${this.quoteIdentifier(options.attributeName)} >= 0)`;
      }

      template = attribute.type.toString();

      // Blobs/texts cannot have a defaultValue
      if (
        attribute.type &&
        attribute.type !== 'TEXT' &&
        attribute.type._binary !== true &&
        defaultValueSchemable(attribute.defaultValue, this.dialect)
      ) {
        template += ` DEFAULT ${this.escape(attribute.defaultValue)}`;
      }

      if (!attribute.autoIncrement) {
        // If autoincrement, not null is set automatically
        if (attribute.allowNull === false) {
          template += ' NOT NULL';
        } else if (
          !attribute.primaryKey &&
          !defaultValueSchemable(attribute.defaultValue, this.dialect)
        ) {
          template += ' NULL';
        }
      }

      template += unsignedTemplate;
    } else {
      template = '';
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
      ' AND POSITION IS NOT NULL ORDER BY POSITION',
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
      'ORDER BY cols.table_name, cols.position',
    ].join('');

    return sql;
  }

  dropConstraintQuery(tableName, constraintName) {
    return `ALTER TABLE ${this.quoteTable(tableName)} DROP CONSTRAINT ${constraintName}`;
  }

  // handleSequelizeMethod(smth, tableName, factory, options, prepend) {
  //   let str;
  //   if (smth instanceof Utils.Json) {
  //     // Parse nested object
  //     if (smth.conditions) {
  //       const conditions = this.parseConditionObject(smth.conditions).map(condition =>
  //         `${this.jsonPathExtractionQuery(condition.path[0], _.tail(condition.path))} = '${condition.value}'`
  //       );

  //       return conditions.join(' AND ');
  //     }
  //     if (smth.path) {

  //       // Allow specifying conditions using the sqlite json functions
  //       if (this._checkValidJsonStatement(smth.path)) {
  //         str = smth.path;
  //       } else {
  //         // Also support json property accessors
  //         const paths = _.toPath(smth.path);
  //         const column = paths.shift();
  //         str = this.jsonPathExtractionQuery(column, paths);
  //       }
  //       if (smth.value) {
  //         str += util.format(' = %s', this.escape(smth.value));
  //       }

  //       return str;
  //     }
  //   }
  //   if (smth instanceof Utils.Cast) {
  //     if (smth.val instanceof Utils.SequelizeMethod) {
  //       str = this.handleSequelizeMethod(smth.val, tableName, factory, options, prepend);
  //       if (smth.type === 'boolean') {
  //         str = `(CASE WHEN ${str}='true' THEN 1 ELSE 0 END)`;
  //         return `CAST(${str} AS NUMBER)`;
  //       } if (smth.type === 'timestamptz' && /json_value\(/.test(str)) {
  //         str = str.slice(0, -1);
  //         return `${str} RETURNING TIMESTAMP WITH TIME ZONE)`;
  //       }
  //     }
  //   }
  //   return super.handleSequelizeMethod(smth, tableName, factory, options, prepend);
  // }

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
      const string = stmt.slice(currentIndex);
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

  isIdentifierQuoted(identifier) {
    return /^\s*(?:([`"'])(?:(?!\1).|\1{2})*\1\.?)+\s*$/i.test(identifier);
  }

  addTicks(identifier, tickChar) {
    identifier = identifier.replaceAll(new RegExp(tickChar, 'g'), '');

    return tickChar + identifier + tickChar;
  }

  jsonPathExtractionQuery(column, path) {
    let paths = toPath(path);
    const quotedColumn = this.isIdentifierQuoted(column) ? column : this.quoteIdentifier(column);

    paths = paths.map(subPath => {
      return /\D/.test(subPath) ? this.addTicks(subPath, '"') : subPath;
    });

    const pathStr = this.escape(
      ['$']
        .concat(paths)
        .join('.')
        .replaceAll(/\.(\d+)(?:(?=\.)|$)/g, (__, digit) => `[${digit}]`),
    );
    const extractQuery = `json_value(${quotedColumn},${pathStr})`;

    return extractQuery;
  }

  booleanValue(value) {
    return value ? 1 : 0;
  }

  quoteIdentifier(identifier, force = false) {
    const optForceQuote = force;
    const optQuoteIdentifiers = this.options.quoteIdentifiers !== false;
    const regExp = /^(([\w][\w\d_]*))$/g;

    if (
      optForceQuote !== true &&
      optQuoteIdentifiers === false &&
      regExp.test(identifier) &&
      !ORACLE_RESERVED_WORDS.includes(identifier.toUpperCase())
    ) {
      // In Oracle, if tables, attributes or alias are created double-quoted,
      // they are always case sensitive. If they contain any lowercase
      // characters, they must always be double-quoted otherwise it
      // would get uppercased by the DB.
      // Here, we strip quotes if we don't want case sensitivity.
      return identifier;
    }

    return quoteIdentifier(identifier, this.dialect.TICK_CHAR_LEFT, this.dialect.TICK_CHAR_RIGHT);
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
    let i = Object.keys(bind).length;

    return value => {
      const bindName = `sequelize_${++i}`;
      bind[bindName] = value;

      return `:${Object.keys(bind).length + posOffset}`;
    };
  }
}

/* istanbul ignore next */
function throwMethodUndefined(methodName) {
  throw new Error(`The method "${methodName}" is not defined! Please add it to your sql dialect.`);
}
