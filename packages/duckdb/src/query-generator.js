'use strict';

import isObject from "lodash/isObject";

const { DuckDbQueryGeneratorTypeScript } = require('./query-generator-typescript.internal');

export class DuckDbQueryGenerator extends DuckDbQueryGeneratorTypeScript {
  createTableQuery(tableName, attributes, _options) {

    // TBD: handle multiple primary keys -- need to collect them for the final constraint

    //console.log("attributes in createTableQuery: ", attributes);
    //console.log(" table: ", tableName);
    //console.log(" options: ", _options);

    const table = this.quoteTable(tableName);

    //const primaryKeys = [];

   // const pkString = primaryKeys.map(pk => this.quoteIdentifier(pk)).join(', ');

    let sequence_sql = '';
    const attrArray = [];

    for (const attr in attributes) {
      const columnName = this.quoteIdentifier(attr);

      if (Object.hasOwn(attributes, attr)) {
        let dataType = attributes[attr];

        const sequence_name = tableName.tableName + '_' + attr + '_seq';
        if (dataType.includes('AUTOINCREMENT')) {
          // TBD: is if not exists needed if table cleans up correctly?
          sequence_sql = 'CREATE SEQUENCE IF NOT EXISTS ' + sequence_name + ' START 1; ';
        }
        dataType = dataType.replace('AUTOINCREMENT', `DEFAULT nextval('${sequence_name}')`)
        attrArray.push(`${columnName} ${dataType}`);
      }
    }
    //
    // if (pkString.length > 0) {
    //   attrStr += `, PRIMARY KEY (${pkString})`;
    // }
    let attrStr = attrArray.join(', ');
    const sql = `${sequence_sql}CREATE TABLE IF NOT EXISTS ${table} (${attrStr});`;
    //console.log("***** createTableQuery SQL: " + sql);
    return sql;
  }


  attributesToSQL(attributes, options) {
    const result = {};
    //console.log("attributes in attributesToSQL: ", attributes);


    for (const name in attributes) {
      const attribute = attributes[name];
      const columnName = attribute.field || attribute.columnName || name;

      // TBD: fuller implementation
      if (isObject(attribute)) {
        let sql = attribute.type.toString();

        if (attribute.allowNull === false) {
          sql += ' NOT NULL';
        }
        if (attribute.autoIncrement) {
          sql += ' AUTOINCREMENT';  // this syntax is not supported, but need table name to qualify the sequence
        }
        result[columnName] = sql;
        //console.log("*** column name " + columnName + "; value sql = " + sql);
      } else {
        result[columnName] = attribute;
        //console.log("*** column name " + columnName + "; value simple = " + attribute);
      }



    }

    return result;
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
}
