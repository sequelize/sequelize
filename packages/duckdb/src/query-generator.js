'use strict';

import isObject from "lodash/isObject";
import { defaultValueSchemable } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/query-builder-utils.js';
import { rejectInvalidOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import {
  CREATE_TABLE_QUERY_SUPPORTABLE_OPTIONS
} from "@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/query-generator.js";
import { difference } from "lodash";

const { DuckDbQueryGeneratorTypeScript } = require('./query-generator-typescript.internal');

export class DuckDbQueryGenerator extends DuckDbQueryGeneratorTypeScript {
  createTableQuery(tableName, attributes, options) {
    // TBD: Remove exclusion in query-interface.js and add comment-on logic
    if (options) {
      rejectInvalidOptions(
          'createTableQuery',
          this.dialect,
          CREATE_TABLE_QUERY_SUPPORTABLE_OPTIONS,
          {},
          options,
      );
    }

    const table = this.quoteTable(tableName);

    let sequence_sql = '';
    const attrArray = [];
    const primaryKeys = [];

    for (const attr in attributes) {
      const columnName = this.quoteIdentifier(attr);

      if (Object.hasOwn(attributes, attr)) {
        let dataType = attributes[attr];

        const table_prefix = table
            .replaceAll('"', '')
            .replaceAll('.', '_');
        const sequence_name = table_prefix + '_' + attr + '_seq';

        if (dataType.includes('AUTOINCREMENT')) {
          sequence_sql = 'CREATE SEQUENCE IF NOT EXISTS ' + this.quoteIdentifier(sequence_name) + ' START 1; ';
          // this could be done in attributesToSQL but better keep it with sequence_name generation in case it changes
          dataType = dataType.replace('AUTOINCREMENT', `DEFAULT nextval('${sequence_name}')`)
        }

        if (dataType.includes(' PRIMARY KEY')) {
          dataType = dataType.replace(' PRIMARY KEY', '');
          primaryKeys.push(columnName);
        }

        attrArray.push(`${columnName} ${dataType}`);
      }
    }

    let attrStr = attrArray.join(', ');
    if (primaryKeys.length) {
      attrStr += `, PRIMARY KEY (${primaryKeys.join(', ')})`;
    }

    const sql = `${sequence_sql}CREATE TABLE IF NOT EXISTS ${table} (${attrStr});`;

    return sql;
  }

  attributesToSQL(attributes, options) {
    const result = {};

    for (const name in attributes) {
      const attribute = attributes[name];
      const columnName = attribute.field || attribute.columnName || name;

      if (isObject(attribute)) {
        let sql = attribute.type.toString();

        if (attribute.allowNull === false) {
          sql += ' NOT NULL';
        }

        if (attribute.autoIncrement) {
          // unsupported syntax placeholder; will be replaced in createTableQuery
          sql += ' AUTOINCREMENT';
        }

        if (defaultValueSchemable(attribute.defaultValue, this.dialect)) {
          sql += ` DEFAULT ${this.escape(attribute.defaultValue, { ...options, type: attribute.type })}`;
        }

        // primary and foregin keys are disabled due to https://duckdb.org/docs/sql/indexes#over-eager-unique-constraint-checking
        if (attribute.primaryKey) {
          // will be replaced with a PRIMARY KEY comment in createTableQuery
          sql += ' PRIMARY KEY';
        }

        result[columnName] = sql;
      } else {
        result[columnName] = attribute;
      }

    }

    return result;
  }

  // In DuckDB, an index on the column renders the column impossible to update.
  // Since updating values seems more useful than having indexes, but disabling indexes is not supported
  // in Sequelize, turning any attempt to add index into a no-op comment.
  addIndexQuery(tableName, attributes, options, rawTablename) {
    const table = this.quoteTable(tableName);
    const actualIndexQuery = super.addIndexQuery(tableName, attributes, options, rawTablename);

    return `COMMENT ON TABLE ${table} IS '${actualIndexQuery}'`;
  }

  updateQuery(tableName, values, where, options, columnDefinitions) {

    if (options?.returning) {
    // RETURNING in an UPDATE query in the presence of unique constraints triggers duckdb constraint violation
    // See https://duckdb.org/docs/sql/indexes#over-eager-unique-constraint-checking
      options.returning = false;
    }

    return super.updateQuery(tableName, values, where, options, columnDefinitions);
  }

  arithmeticQuery(
      operator,
      tableName,
      where,
      incrementAmountsByAttribute,
      extraAttributesToBeUpdated,
      options,
  ) {
    const query = super.arithmeticQuery( operator, tableName,
        where, incrementAmountsByAttribute, extraAttributesToBeUpdated, options);

    // "returning" triggers DuckDB overeager unique indexes check
    return query.replace('RETURNING *', '');
  }

  addColumnQuery(table, key, dataType, options) {

    const attributes = {};
    attributes[key] = dataType;
    const fields = this.attributesToSQL(attributes, { context: 'addColumn' });
    const attribute = `${this.quoteIdentifier(key)} ${fields[key]}`;
    let sql = `ALTER TABLE ${this.quoteTable(table)} ADD COLUMN `;

    if (options && options.ifNotExists) {
      sql += ' IF NOT EXISTS ';
    }

    sql += `${attribute};`;

    return sql;
  }

  changeColumnQuery(tableName, attributes) {
    const query = subQuery => `ALTER TABLE ${this.quoteTable(tableName)} ALTER COLUMN ${subQuery};`;
    const sql = [];
    const fields = this.attributesToSQL(attributes, { context: 'addColumn' });

    for (const attributeName in attributes) {

      const definition = fields[attributeName];
      let attrSql = '';


      if (definition.includes('DEFAULT')) {
        attrSql += query(
            `${this.quoteIdentifier(attributeName)} SET DEFAULT ${definition.match(/DEFAULT ([^;]+)/)[1]}`,
        );

      } else if (definition.includes('NOT NULL')) {
        // adding/removing constraints in ALTER TABLE is not supported
        attrSql += query(`${this.quoteIdentifier(attributeName)} TYPE ${definition.replace('NOT NULL', '')}`);
      } else {
        attrSql += query(`${this.quoteIdentifier(attributeName)} TYPE ${definition}`);
      }

      sql.push(attrSql);
    }

    return sql.join('');
  }

  renameColumnQuery(tableName, attrBefore, attributes) {
    const attrString = [];

    for (const attributeName in attributes) {
      attrString.push(
          `${this.quoteIdentifier(attrBefore)} TO ${this.quoteIdentifier(attributeName)}`,
      );
    }

    return `ALTER TABLE ${this.quoteTable(tableName)} RENAME COLUMN ${attrString.join(', ')};`;
  }
}
