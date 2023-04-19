'use strict';

import { normalizeDataType } from '../abstract/data-types-utils';
import { joinSQLFragments } from '../../utils/join-sql-fragments.js';
import { MariaDbQueryGeneratorTypeScript } from './query-generator-typescript';

const _ = require('lodash');

export class MariaDbQueryGenerator extends MariaDbQueryGeneratorTypeScript {

  _getTechnicalSchemaNames() {
    return ['MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA', 'mysql', 'information_schema', 'performance_schema'];
  }

  addColumnQuery(table, key, dataType, options = {}) {
    const ifNotExists = options.ifNotExists ? 'IF NOT EXISTS' : '';

    dataType = {
      ...dataType,
      type: normalizeDataType(dataType.type, this.dialect),
    };

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(table),
      'ADD',
      ifNotExists,
      this.quoteIdentifier(key),
      this.attributeToSQL(dataType, {
        context: 'addColumn',
        tableName: table,
        foreignKey: key,
      }),
      ';',
    ]);
  }

  removeColumnQuery(tableName, attributeName, options = {}) {
    const ifExists = options.ifExists ? 'IF EXISTS' : '';

    return joinSQLFragments([
      'ALTER TABLE',
      this.quoteTable(tableName),
      'DROP',
      ifExists,
      this.quoteIdentifier(attributeName),
      ';',
    ]);
  }
}
