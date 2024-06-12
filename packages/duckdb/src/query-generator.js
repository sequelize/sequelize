'use strict';

import isObject from "lodash/isObject";

const { DuckDbQueryGeneratorTypeScript } = require('./query-generator-typescript.internal');

export class DuckDbQueryGenerator extends DuckDbQueryGeneratorTypeScript {
  createTableQuery(tableName, attributes, _options) {

    // TBD: handle multiple primary keys -- need to collect them for the final constraint

    const table = this.quoteTable(tableName);
    //const primaryKeys = [];

   // const pkString = primaryKeys.map(pk => this.quoteIdentifier(pk)).join(', ');

    const attrArray = [];

    for (const attr in attributes) {
      if (Object.hasOwn(attributes, attr)) {
        const dataType = attributes[attr];
        attrArray.push(`${this.quoteIdentifier(attr)} ${dataType}`);
      }
    }
    //
    // if (pkString.length > 0) {
    //   attrStr += `, PRIMARY KEY (${pkString})`;
    // }
    let attrStr = attrArray.join(', ');
    const sql = `CREATE TABLE IF NOT EXISTS ${table} (${attrStr});`;
    return sql;
  }


  attributesToSQL(attributes, options) {
    const result = {};
    for (const name in attributes) {
      const attribute = attributes[name];
      const columnName = attribute.field || attribute.columnName || name;

      // TBD: fuller implementation
      if (isObject(attribute)) {
        let sql = attribute.type.toString();

        if (attribute.allowNull === false) {
          sql += ' NOT NULL';
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
}
