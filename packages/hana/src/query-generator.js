import { table } from 'console';
import {
  attributeTypeToSql,
  normalizeDataType,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types-utils.js';
import { BaseSqlExpression } from '@sequelize/core/_non-semver-use-at-your-own-risk_/expression-builders/base-sql-expression.js';
import { Literal } from '@sequelize/core/_non-semver-use-at-your-own-risk_/expression-builders/literal.js';
import { joinSQLFragments } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/join-sql-fragments.js';
import { EMPTY_OBJECT } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import {
  ADD_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
  CREATE_SCHEMA_QUERY_SUPPORTABLE_OPTIONS,
  CREATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.js';
import { REMOVE_COLUMN_QUERY_SUPPORTABLE_OPTIONS } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator-typescript.js';

import each from 'lodash/each';
import isPlainObject from 'lodash/isPlainObject';
import { defaultValueSchemable } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/query-builder-utils.js';
import { forOwn } from 'lodash';

import { DataTypes } from '@sequelize/core';
import { find } from '@sequelize/utils';

import { HanaQueryGeneratorTypeScript } from './query-generator-typescript.internal.js';
import { HanaQueryGeneratorInternal } from './query-generator.internal.js';

const ADD_COLUMN_QUERY_SUPPORTED_OPTIONS = new Set();
const CREATE_SCHEMA_QUERY_SUPPORTED_OPTIONS = new Set();
const CREATE_TABLE_QUERY_SUPPORTED_OPTIONS = new Set(['comment', 'uniqueKeys']);
const REMOVE_COLUMN_QUERY_SUPPORTED_OPTIONS = new Set();

export class HanaQueryGenerator extends HanaQueryGeneratorTypeScript {
  #internals;

  constructor(dialect, internals = new HanaQueryGeneratorInternal(dialect)) {
    super(dialect, internals);

    this.#internals = internals;
  }
  // createSchemaQuery(schemaName, options) {
  //   // https://help.sap.com/docs/hana-cloud-database/sap-hana-cloud-sap-hana-database-sql-reference-guide/create-schema-statement-data-definition
  //   if (options) {
  //     rejectInvalidOptions(
  //       'createSchemaQuery',
  //       this.dialect,
  //       CREATE_SCHEMA_QUERY_SUPPORTABLE_OPTIONS,
  //       CREATE_SCHEMA_QUERY_SUPPORTED_OPTIONS,
  //       options,
  //     );
  //   }

  //   return `CREATE SCHEMA ${this.quoteIdentifier(schemaName)};`;
  // }

  // dropSchemaQuery(schemaName) {
  //   // https://help.sap.com/docs/HANA_SERVICE_CF/7c78579ce9b14a669c1f3295b0d8ca16/20d7891d751910149164f0d4ca73639d.html
  //   // https://help.sap.com/docs/hana-cloud-database/sap-hana-cloud-sap-hana-database-sql-reference-guide/drop-schema-statement-data-definition
  //   return `DROP SCHEMA ${this.quoteIdentifier(schemaName)};`;
  // }

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
    // todo
    // https://help.sap.com/docs/hana-cloud-database/sap-hana-cloud-sap-hana-database-sql-reference-guide/create-table-statement-data-definition

    options = {
      tableType: 'COLUMN',
      ...options
    };
    const primaryKeys = [];
    const foreignKeys = {};
    const attrStr = [];

    const quotedTable = this.quoteTable(tableName);

    for (const attr in attributes) {
      if (!Object.hasOwn(attributes, attr)) {
        continue;
      }

      const quotedAttr = this.quoteIdentifier(attr);
      let dataType = attributes[attr];
      let match;

      let commentClause = '';
      const commentIndex = dataType.indexOf('COMMENT ');
      if (commentIndex !== -1) {
        commentClause = dataType.slice(commentIndex);

        // remove comment related substring from dataType
        dataType = dataType.slice(0, commentIndex);
      }

      if (dataType.includes('PRIMARY KEY')) {
        primaryKeys.push(attr);

        if (dataType.includes('REFERENCES')) {
          match = dataType.match(/^(.+) (REFERENCES.*)$/);
          attrStr.push(`${this.quoteIdentifier(attr)} ${match[1].replace('PRIMARY KEY', '')} ${commentClause}`);
          foreignKeys[attr] = match[2];
        } else {
          attrStr.push(`${this.quoteIdentifier(attr)} ${dataType.replace('PRIMARY KEY', '')} ${commentClause}`);
        }
      } else if (dataType.includes('REFERENCES')) {
        match = dataType.match(/^(.+) (REFERENCES.*)$/);
        attrStr.push(`${this.quoteIdentifier(attr)} ${match[1]} ${commentClause}`);
        foreignKeys[attr] = match[2];
      } else {
        attrStr.push(`${this.quoteIdentifier(attr)} ${dataType} ${commentClause}`);
      }
    }
    const table = this.quoteTable(tableName);
    let attributesClause = attrStr.join(', ');

    // todo  delete this - start
    attributesClause = attrStr.map(
      x=>x.replace(/\bAUTOINCREMENT\b/,
      'GENERATED BY DEFAULT AS IDENTITY (START WITH 1 INCREMENT BY 1)')
    )
    .map(x => x.replace(/ENUM\((".*?")(,\s*(".*?"))+\)/, (s) => {
      const enums = [];
      const regex = /"(.*?)"/g;
      let match = regex.exec(s);
      while(match !== null) {
        enums.push(match[1]);
        match = regex.exec(s);
      }
      const maxLength = Math.max(...enums.map(x=>x.length), 255);
      return `NVARCHAR(${maxLength})`;
    }))
    .join(', ');
    // delete this - end
    const pkString = primaryKeys.map(pk => this.quoteIdentifier(pk)).join(', ');

    if (options.uniqueKeys) {
      //todo
      each(options.uniqueKeys, (columns, indexName) => {
        if (typeof indexName !== 'string') {
          indexName = `uniq_${tableName}_${columns.fields.join('_')}`;
        }

        attributesClause += `, CONSTRAINT ${
          this.quoteIdentifier(indexName)
        } UNIQUE (${
          columns.fields.map(field => this.quoteIdentifier(field))
            .join(', ')
        })`;
      });
    }

    if (pkString.length > 0) {
      attributesClause += `, PRIMARY KEY (${pkString})`;
    }

    for (const fkey in foreignKeys) {
      if (Object.hasOwn(foreignKeys, fkey)) {
        attributesClause += `, FOREIGN KEY (${this.quoteIdentifier(fkey)}) ${foreignKeys[fkey]}`;
      }
    }

    const createTableSql = joinSQLFragments([
      'CREATE',
      options.tableType,
      'TABLE',
      table,
      `(${attributesClause})`,
      options.comment && typeof options.comment === 'string' && `COMMENT ${this.escape(options.comment)}`,
      ';',
    ]);

    const tableDetails = this.extractTableDetails(tableName);

    return joinSQLFragments([
      'DO BEGIN',
      '  IF NOT EXISTS (',
      '    SELECT * FROM SYS.TABLES',
      `    WHERE TABLE_NAME = ${this.escape(tableDetails.tableName)}`,
      `      AND SCHEMA_NAME = ${tableDetails.schema ? this.escape(tableDetails.schema) : 'CURRENT_SCHEMA'}`,
      '  ) THEN',
      `    ${createTableSql}`,
      '  END IF;',
      'END;',
    ]);
  }

  addColumnQuery(table, key, dataType, options) {
    if (options) {
      rejectInvalidOptions(
        'addColumnQuery',
        this.dialect,
        ADD_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
        ADD_COLUMN_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    dataType = {
      ...dataType,
      type: normalizeDataType(dataType.type, this.dialect),
    };

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(table),
      'ADD',
      '(',
      this.quoteIdentifier(key),
      this.attributeToSQL(dataType, {
        context: 'addColumn',
        tableName: table,
        foreignKey: key,
      }),
      ')',
      ';',
    ]);
  }

  changeColumnQuery(tableName, attributes) {
    //todo
    const attrString = [];
    const constraintString = [];

    for (const attributeName in attributes) {
      let definition = attributes[attributeName];
      if (definition.includes('REFERENCES')) {
        const attrName = this.quoteIdentifier(attributeName);
        definition = definition.replace(/.+?(?=REFERENCES)/, '');
        constraintString.push(`FOREIGN KEY (${attrName}) ${definition}`);
      } else {
        attrString.push(`${this.quoteIdentifier(attributeName)} ${definition}`);
      }
    }

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      attrString.length && `ALTER (${attrString.join(', ')})`,
      constraintString.length && `ADD ${constraintString.join(', ')}`,
      ';',
    ]);
  }

  renameColumnQuery(tableName, attrBefore, attributes) {
    const attrAfter = Object.keys(attributes)[0];
    return joinSQLFragments([
      'RENAME COLUMN',
      `${this.quoteTable(tableName)}.${this.quoteIdentifier(attrBefore)}`,
      'TO',
      this.quoteIdentifier(attrAfter),
    ]);
  }

  removeColumnQuery(tableName, columnName, options) {
    if (options) {
      rejectInvalidOptions(
        'removeColumnQuery',
        this.dialect,
        REMOVE_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
        REMOVE_COLUMN_QUERY_SUPPORTED_OPTIONS,
        options,
      );
    }

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'DROP',
      '(',
      this.quoteIdentifier(columnName),
      ')',
    ]);
  }

  insertQuery(table, valueHash, modelAttributes, options) {
    const query = super.insertQuery(table, valueHash, modelAttributes, options);
    console.log('------insert query-------', query.query)
    if (options.type === 'UPSERT') {
      query.query = query.query.replace(/^INSERT INTO/, 'UPSERT');
    }

    let primaryKey = 'id';
    let primaryKeyGeneratedByDb = true;
    for (const columnName in valueHash) {
      let modelAttribute = null;
      if (modelAttributes) {
        modelAttribute = find(Object.values(modelAttributes), attribute => {
          return attribute.columnName === columnName;
        });
      }

      if (modelAttribute) {
        if (modelAttribute.primaryKey) {
          primaryKey = modelAttribute.columnName;
          if (valueHash[columnName] !== null) {
            primaryKeyGeneratedByDb = false;
          }
          break;
        }
      }
    }

    if (primaryKeyGeneratedByDb === false) {
      return query;
    }

//     query.query = `\
// DO ()
// BEGIN
//   ${query.query}
//   --SELECT * FROM ${this.quoteTable(table)} WHERE ID=CURRENT_IDENTITY_VALUE();
//   SELECT CURRENT_IDENTITY_VALUE() from DUMMY;
// END;`
    const parameterList = [];
    let regex = /\$\w+\b/g;
    let match = regex.exec(query.query);
    while(match != null) {
      parameterList.push(match);
      match = regex.exec(query.query);
    }

    const columnNames = [];
    for (const key in valueHash) {
      if (Object.hasOwn(valueHash, key)) {
        const value = valueHash[key] ?? null;
        // fields.push(this.quoteIdentifier(key));

        if (modelAttributes?.[key] && modelAttributes[key].autoIncrement === true && value == null) {
          continue;
        }

        if (value instanceof BaseSqlExpression) {
          /*
            BaseSqlExpression (e.g. Cast), *may* have already been escaped in the query:
          1. { intVal: new Cast( cast(new Literal('1-2'), 'integer') , 'integer' ) }
            INSERT INTO "Users" ("intVal","createdAt","updatedAt") VALUES (CAST(CAST(1-2 AS INTEGER) AS INTEGER),$sequelize_1,$sequelize_2);
          2. { intVal: new Cast('1', type) }
            INSERT INTO "Users" ("intVal","createdAt","updatedAt") VALUES (CAST($sequelize_1 AS INTEGER),$sequelize_2,$sequelize_3);
          */
          const bind = Object.create(null);
          const dummyOption = {
            type: options?.type,
            bindParam: this.bindParam(bind),
          };
          const dummyEscaped = this.escape(value, dummyOption);
          const valueStringHasDollarSequelizeParameter = Object.keys(bind).length > 0;
          let foundParameter = false;
          if (valueStringHasDollarSequelizeParameter) {
            foundParameter = true;
          } else {
            if (value instanceof Literal && options?.bind) {
              if (Array.isArray(options.bind)) {
                if (/^\$\d+$/.test(dummyEscaped)) {
                  // found $1, $2, ...
                  foundParameter = true;
                }
              } else {
                const match = dummyEscaped.match(/^\$(\w+)$/);
                if (match) {
                  const parameterName = match[1];
                  if (Object.hasOwn(options.bind, parameterName)) {
                    // found $sequelize_1, $sequelize_2, ...
                    foundParameter = true;
                  }
                }
              }
            }
          }
          if (!foundParameter) {
            continue;
          }
        }
        columnNames.push(key);
      }
    }
    const blockParameters = [];
    // parameterList.forEach((parameterMatch, index) => {
    for(let index = parameterList.length - 1; index >= 0; index--) {
      const parameterMatch = parameterList[index];
      const columnName = columnNames[index];
      const modelAttribute = modelAttributes?.[columnName];
      const type =
        modelAttribute?.type ??
        (typeof valueHash[columnName] === 'boolean' ? 'BOOLEAN' : 'NVARCHAR(5000)');
      query.query = query.query.substring(0, parameterMatch.index) + `:${columnName}`
        + query.query.substring(parameterMatch.index + parameterMatch[0].length);
      blockParameters.unshift(`IN ${columnName} ${type} => ${parameterMatch[0]}`);
    }
    // });

query.query = `\
DO (${blockParameters.join(', ')})
BEGIN
  DECLARE CURRENT_IDENTITY_VALUE_RESULT BIGINT;
  ${query.query}
  SELECT CURRENT_IDENTITY_VALUE() INTO CURRENT_IDENTITY_VALUE_RESULT FROM DUMMY;
  IF
    -2147483648 <= :CURRENT_IDENTITY_VALUE_RESULT AND :CURRENT_IDENTITY_VALUE_RESULT <= 2147483647
  THEN
    SELECT TO_INTEGER(:CURRENT_IDENTITY_VALUE_RESULT) as "${primaryKey}" FROM DUMMY;
  ELSE
    SELECT TO_BIGINT(:CURRENT_IDENTITY_VALUE_RESULT) as "${primaryKey}" FROM DUMMY;
  END IF;
END;`

    return query;
  }

  bulkInsertQuery(tableName, fieldValueHashes, options, fieldMappedAttributes) {
    options = options || {};
    fieldMappedAttributes = fieldMappedAttributes || {};

    const tuples = [];
    const serials = {};
    const allAttributes = [];
    let onDuplicateKeyUpdate = '';

    for (const fieldValueHash of fieldValueHashes) {
      forOwn(fieldValueHash, (value, key) => {
        const modelAttribute = fieldMappedAttributes[key];
        if (!allAttributes.includes(key) &&
          !(modelAttribute && modelAttribute.autoIncrement === true && value === null)
        ) {
          allAttributes.push(key);
        }

        if (
          fieldMappedAttributes[key]
          && fieldMappedAttributes[key].autoIncrement === true
        ) {
          serials[key] = true;
        }
      });
    }

    for (const fieldValueHash of fieldValueHashes) {
      const values = allAttributes.map(key => {
        if (
          this.dialect.supports.bulkDefault
          && serials[key] === true
        ) {
          // fieldValueHashes[key] ?? 'DEFAULT'
          return fieldValueHash[key] != null ? fieldValueHash[key] : 'DEFAULT';
        }

        return this.escape(fieldValueHash[key] ?? null, {
          // model // TODO: make bulkInsertQuery accept model instead of fieldValueHashes
          // bindParam // TODO: support bind params
          type: fieldMappedAttributes[key]?.type,
          replacements: options.replacements,
        });
      });

      tuples.push(`${values.join(',')}`);
    }

    const attributes = allAttributes.map(attr => this.quoteIdentifier(attr)).join(',');
    const selectStatements = [];
    for (const tuple of tuples) {
      selectStatements.push(joinSQLFragments([
        'SELECT',
        tuple,
        'FROM',
        'DUMMY',
        //';',
      ]))
    }

    return joinSQLFragments([
      'INSERT',
      'INTO',
      this.quoteTable(tableName),
      `(${attributes})`,
      '(',
      selectStatements.join(' UNION ALL '),
      ')',
      ';',
    ]);
  }

  deleteQuery(tableName, where, options = EMPTY_OBJECT, model) {
    let query = `DELETE FROM ${this.quoteTable(tableName)}`;

    const escapeOptions = { ...options, model };
    const whereSql = this.whereQuery(where, escapeOptions);
    if (whereSql) {
      query += ` ${whereSql}`;
    }

    if (options.limit) {
      query += ` LIMIT ${this.escape(options.limit, escapeOptions)}`;
    }

    return query;
  }

  attributeToSQL(attribute, options) {
    if (!isPlainObject(attribute)) {
      attribute = {
        type: attribute,
      };
    }

    const attributeString = attributeTypeToSql(attribute.type, {
      escape: this.escape.bind(this),
      dialect: this.dialect,
    });
    let template = attributeString;

    if (attribute.allowNull === false) {
      template += ' NOT NULL';
    } else if (attribute.allowNull === true && options && options.context === 'changeColumn') {
      template += ' NULL';
    }

    if (attribute.autoIncrement) {
      template += ' GENERATED BY DEFAULT AS IDENTITY';
    }

    if (defaultValueSchemable(attribute.defaultValue, this.dialect)) {
      template += ` DEFAULT ${this.escape(attribute.defaultValue, { type: attribute.type })}`;
    }

    if (attribute.unique === true) {
      template += ' UNIQUE';
    }

    if (attribute.primaryKey) {
      template += ' PRIMARY KEY';
    }

    if (attribute.references) {
      let schema;

      if (options.schema) {
        schema = options.schema;
      } else if (
        (!attribute.references.table || typeof attribute.references.table === 'string')
        && options.table
        && options.table.schema
      ) {
        schema = options.table.schema;
      }

      const referencesTable = this.extractTableDetails(attribute.references.table, { schema });

      let referencesKey;

      if (!options.withoutForeignKeyConstraints) {
        if (attribute.references.key) {
          referencesKey = this.quoteIdentifiers(attribute.references.key);
        } else {
          referencesKey = this.quoteIdentifier('id');
        }

        template += ` REFERENCES ${this.quoteTable(referencesTable)} (${referencesKey})`;

        if (attribute.onDelete && attribute.onDelete.toUpperCase() !== 'NO ACTION') {
          // HANA does not support NO ACTION option for ON DELETE clause.
          template += ` ON DELETE ${attribute.onDelete.toUpperCase()}`;
        }

        if (attribute.onUpdate && attribute.onUpdate.toUpperCase() !== 'NO ACTION') {
          // HANA does not support NO ACTION option for ON UPDATE clause.
          template += ` ON UPDATE ${attribute.onUpdate.toUpperCase()}`;
        }
      }
    }

    if (attribute.comment && typeof attribute.comment === 'string') {
      template += ` COMMENT ${this.escape(attribute.comment)}`;
    }

    return template;
  }

  attributesToSQL(attributes, options) {
    //todo
    const result = {};

    for (const key in attributes) {
      const attribute = attributes[key];
      result[attribute.field || key] = this.attributeToSQL(attribute, { key, ...options });
    }

    return result;
  }
}
