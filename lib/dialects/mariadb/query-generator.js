'use strict';

const MySQLQueryGenerator = require('../mysql/query-generator');

class MariaDBQueryGenerator extends MySQLQueryGenerator {
  createSchema(schema, options) {
    options = Object.assign({
      charset: null,
      collate: null
    }, options || {});

    const charset = options.charset ? ` DEFAULT CHARACTER SET ${this.escape(options.charset)}` : '';
    const collate = options.collate ? ` DEFAULT COLLATE ${this.escape(options.collate)}` : '';

    return `CREATE SCHEMA IF NOT EXISTS ${this.quoteIdentifier(schema)}${charset}${collate};`;
  }

  dropSchema(schema) {
    return `DROP SCHEMA IF EXISTS ${this.quoteIdentifier(schema)};`;
  }

  showSchemasQuery(options) {
    const skip =  options.skip && Array.isArray(options.skip) && options.skip.length > 0 ? options.skip : null;
    return `SELECT SCHEMA_NAME as schema_name FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME NOT IN ('MYSQL', 'INFORMATION_SCHEMA', 'PERFORMANCE_SCHEMA'${skip ? skip.reduce( (sql, schemaName) => sql +=  `,${this.escape(schemaName)}`, '') : ''});`;
  }

  showTablesQuery() {
    return 'SELECT TABLE_NAME, TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA NOT IN (\'MYSQL\', \'INFORMATION_SCHEMA\', \'PERFORMANCE_SCHEMA\') AND TABLE_TYPE = \'BASE TABLE\'';
  }
}

module.exports = MariaDBQueryGenerator;
