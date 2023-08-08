import { AbstractQueryGenerator } from "../abstract/query-generator";
import { rejectInvalidOptions } from "src/utils/check";
import { generateIndexName } from "src/utils/string";
import { REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS } from "../abstract/query-generator-typescript";
import type { TableNameWithSchema } from "../abstract/query-interface";
import type { RemoveIndexQueryOptions, TableNameOrModel } from "../abstract/query-generator-typescript";


const REMOVE_INDEX_QUERY_SUPPORTED_OPTIONS = new Set();

export class OracleQueryGeneratorTypeScript extends AbstractQueryGenerator {
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

  removeIndexQuery(
    tableName: TableNameOrModel,
    indexNameOrAttributes: string | string[],
    options: RemoveIndexQueryOptions
  ) {
    if (options) {
      rejectInvalidOptions(
        'removeIndexQuery',
        this.dialect.name,
        REMOVE_INDEX_QUERY_SUPPORTABLE_OPTIONS,
        REMOVE_INDEX_QUERY_SUPPORTED_OPTIONS,
        options
      );
    }
    let indexName: string;
    if (Array.isArray(indexNameOrAttributes)) {
      const table = this.extractTableDetails(tableName);
      indexName = generateIndexName(table, { fields: indexNameOrAttributes });
    } else {
      indexName = indexNameOrAttributes;
    }

    return `DROP INDEX ${this.quoteIdentifier(indexName)}`;
  }

  /**
   * Returns the value as it is stored in the Oracle DB
   *
   * @param {string} value
   */
  getCatalogName(value: string) {
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

  showIndexesQuery(table: TableNameWithSchema) {
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

  /**
   * Returns the tableName and schemaName as it is stored the Oracle DB
   *
   * @param {object|string} table
   */
  getSchemaNameAndTableName(table: TableNameWithSchema) {
    const tableName = this.getCatalogName(table.tableName || table);
    const schemaName = this.getCatalogName(table.schema);
    return [tableName, schemaName];
  }
}