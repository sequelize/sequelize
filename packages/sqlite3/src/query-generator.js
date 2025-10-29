'use strict';

import { ParameterStyle } from '@sequelize/core';
import {
  attributeTypeToSql,
  normalizeDataType,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types-utils.js';
import {
  ADD_COLUMN_QUERY_SUPPORTABLE_OPTIONS,
  CREATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.js';
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { removeNullishValuesFromHash } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/format.js';
import { EMPTY_SET } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import { defaultValueSchemable } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/query-builder-utils.js';
import { createBindParamGenerator } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import defaults from 'lodash/defaults';
import each from 'lodash/each';
import isPlainObject from 'lodash/isPlainObject';
import { SqliteQueryGeneratorTypeScript } from './query-generator-typescript.internal.js';

export class SqliteQueryGenerator extends SqliteQueryGeneratorTypeScript {
  createTableQuery(tableName, attributes, options) {
    // TODO: add support for 'uniqueKeys' by improving the createTableQuery implementation so it also generates a CREATE UNIQUE INDEX query
    if (options) {
      rejectInvalidOptions(
        'createTableQuery',
        this.dialect,
        CREATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
        EMPTY_SET,
        options,
      );
    }

    options ||= {};

    const primaryKeys = [];
    const needsMultiplePrimaryKeys =
      Object.values(attributes).filter(definition => definition.includes('PRIMARY KEY')).length > 1;
    const attrArray = [];

    for (const attr in attributes) {
      if (Object.hasOwn(attributes, attr)) {
        const dataType = attributes[attr];
        const containsAutoIncrement = dataType.includes('AUTOINCREMENT');

        let dataTypeString = dataType;
        if (dataType.includes('PRIMARY KEY')) {
          if (dataType.includes('INT')) {
            // Only INTEGER is allowed for primary key, see https://github.com/sequelize/sequelize/issues/969 (no lenght, unsigned etc)
            dataTypeString = containsAutoIncrement
              ? 'INTEGER PRIMARY KEY AUTOINCREMENT'
              : 'INTEGER PRIMARY KEY';

            if (dataType.includes(' REFERENCES')) {
              dataTypeString += dataType.slice(dataType.indexOf(' REFERENCES'));
            }
          }

          if (needsMultiplePrimaryKeys) {
            primaryKeys.push(attr);
            if (dataType.includes('NOT NULL')) {
              dataTypeString = dataType.replace(' PRIMARY KEY', '');
            } else {
              dataTypeString = dataType.replace('PRIMARY KEY', 'NOT NULL');
            }
          }
        }

        attrArray.push(`${this.quoteIdentifier(attr)} ${dataTypeString}`);
      }
    }

    const table = this.quoteTable(tableName);
    let attrStr = attrArray.join(', ');
    const pkString = primaryKeys.map(pk => this.quoteIdentifier(pk)).join(', ');

    // sqlite has a bug where using CONSTRAINT constraint_name UNIQUE during CREATE TABLE
    //  does not respect the provided constraint name
    //  and uses sqlite_autoindex_ as the name of the constraint instead.
    //  CREATE UNIQUE INDEX does not have this issue, so we're using that instead
    //
    // if (options.uniqueKeys) {
    //   each(options.uniqueKeys, (columns, indexName) => {
    //     if (columns.customIndex) {
    //       if (typeof indexName !== 'string') {
    //         indexName = generateIndexName(tableName, columns);
    //       }
    //
    //       attrStr += `, CONSTRAINT ${
    //         this.quoteIdentifier(indexName)
    //       } UNIQUE (${
    //         columns.fields.map(field => this.quoteIdentifier(field)).join(', ')
    //       })`;
    //     }
    //   });
    // }

    if (pkString.length > 0) {
      attrStr += `, PRIMARY KEY (${pkString})`;
    }

    const sql = `CREATE TABLE IF NOT EXISTS ${table} (${attrStr});`;

    return this.replaceBooleanDefaults(sql);
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

    const attribute = `${this.quoteIdentifier(key)} ${this.attributeToSQL(dataType, { context: 'addColumn' })}`;
    const sql = `ALTER TABLE ${this.quoteTable(table)} ADD ${attribute};`;

    return this.replaceBooleanDefaults(sql);
  }

  updateQuery(tableName, attrValueHash, where, options, attributes) {
    options ||= {};
    defaults(options, this.options);
    if ('bindParam' in options) {
      throw new Error('The bindParam option has been removed. Use parameterStyle instead.');
    }

    attrValueHash = removeNullishValuesFromHash(attrValueHash, options.omitNull, options);

    const modelAttributeMap = Object.create(null);
    const values = [];
    let suffix = '';
    let bind;
    let bindParam;
    const parameterStyle = options?.parameterStyle ?? ParameterStyle.BIND;

    if (parameterStyle === ParameterStyle.BIND) {
      bind = Object.create(null);
      bindParam = createBindParamGenerator(bind);
    }

    if (options.returning) {
      const returnValues = this.generateReturnValues(attributes, options);

      suffix += returnValues.returningFragment;

      // ensure that the return output is properly mapped to model fields.
      options.mapToModel = true;
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
        replacements: options.replacements,
        bindParam,
        type: modelAttributeMap[key]?.type,
        // TODO: model,
      });

      values.push(`${this.quoteIdentifier(key)}=${escapedValue}`);
    }

    let query;
    const whereOptions = { ...options, bindParam };

    if (options.limit) {
      query =
        `UPDATE ${this.quoteTable(tableName)} SET ${values.join(',')} WHERE rowid IN (SELECT rowid FROM ${this.quoteTable(tableName)} ${this.whereQuery(where, whereOptions)} LIMIT ${this.escape(options.limit, undefined, options)})${suffix}`.trim();
    } else {
      query =
        `UPDATE ${this.quoteTable(tableName)} SET ${values.join(',')} ${this.whereQuery(where, whereOptions)}${suffix}`.trim();
    }

    const result = { query };
    if (parameterStyle === ParameterStyle.BIND) {
      result.bind = bind;
    }

    return result;
  }

  attributeToSQL(attribute, options) {
    if (!isPlainObject(attribute)) {
      attribute = {
        type: attribute,
      };
    }

    const attributeString = attributeTypeToSql(attribute.type);
    let template = attributeString;

    if (attribute.allowNull === false) {
      template += ' NOT NULL';
    }

    if (defaultValueSchemable(attribute.defaultValue, this.dialect)) {
      // TODO thoroughly check that DataTypes.NOW will properly
      // get populated on all databases as DEFAULT value
      // i.e. mysql requires: DEFAULT CURRENT_TIMESTAMP
      template += ` DEFAULT ${this.escape(attribute.defaultValue, { ...options, type: attribute.type })}`;
    }

    if (attribute.unique === true) {
      template += ' UNIQUE';
    }

    if (attribute.primaryKey) {
      if (attribute.autoIncrement) {
        template += ' AUTOINCREMENT';
      }

      template += ' PRIMARY KEY';
    }

    if (attribute.references) {
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

  replaceBooleanDefaults(sql) {
    return sql
      .replaceAll(/DEFAULT '?false'?/g, 'DEFAULT 0')
      .replaceAll(/DEFAULT '?true'?/g, 'DEFAULT 1');
  }
}
