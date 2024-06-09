'use strict';

const { DuckDbQueryGeneratorTypeScript } = require('./query-generator-typescript.internal');

export class DuckDbQueryGenerator extends DuckDbQueryGeneratorTypeScript {
  createTableQuery(_ignoreTableName, _ignoreAttributes, _ignoreOptions) {
    return 'TBD';
  }
}
