import type {
  AddConstraintOptions,
  AttributeOptions,
  ConstraintDescription,
  ConstraintType,
  DataType,
  DescribeTableOptions,
  QiDropAllTablesOptions,
  QueryRawOptions,
  RemoveColumnOptions,
  RemoveConstraintOptions,
  ShowConstraintsOptions,
  TableOrModel,
} from '@sequelize/core';
import {
  AbstractQueryInterface,
  BaseError,
  QueryTypes,
  UnknownConstraintError,
} from '@sequelize/core';
import { isErrorWithStringCode } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import {
  noSchemaDelimiterParameter,
  noSchemaParameter,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/deprecations.js';
import { withSqliteForeignKeysOff } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import isEmpty from 'lodash/isEmpty';
import type { SqliteDialect } from './dialect.js';
import { SqliteQueryInterfaceInternal } from './query-interface.internal.js';
import type { SqliteColumnsDescription } from './query-interface.types.js';

export class SqliteQueryInterface<
  Dialect extends SqliteDialect = SqliteDialect,
> extends AbstractQueryInterface<Dialect> {
  readonly #internalQueryInterface: SqliteQueryInterfaceInternal;

  constructor(dialect: Dialect, internalQueryInterface?: SqliteQueryInterfaceInternal) {
    internalQueryInterface ??= new SqliteQueryInterfaceInternal(dialect);

    super(dialect, internalQueryInterface);
    this.#internalQueryInterface = internalQueryInterface;
  }

  async dropAllTables(options?: QiDropAllTablesOptions): Promise<void> {
    const skip = options?.skip || [];
    const allTables = await this.listTables(options);
    const tableNames = allTables.filter(tableName => !skip.includes(tableName.tableName));

    await withSqliteForeignKeysOff(this.sequelize, options, async () => {
      for (const table of tableNames) {
        // eslint-disable-next-line no-await-in-loop
        await this.dropTable(table, options);
      }
    });
  }

  async describeTable(
    tableName: TableOrModel,
    options?: DescribeTableOptions,
  ): Promise<SqliteColumnsDescription> {
    const table = this.queryGenerator.extractTableDetails(tableName);

    if (typeof options === 'string') {
      noSchemaParameter();
      table.schema = options;
    }

    if (typeof options === 'object' && options !== null) {
      if (options.schema) {
        noSchemaParameter();
        table.schema = options.schema;
      }

      if (options.schemaDelimiter) {
        noSchemaDelimiterParameter();
        table.delimiter = options.schemaDelimiter;
      }
    }

    const sql = this.queryGenerator.describeTableQuery(table);
    try {
      const data = (await this.sequelize.queryRaw(sql, {
        ...options,
        type: QueryTypes.DESCRIBE,
      })) as SqliteColumnsDescription;
      /*
       * If no data is returned from the query, then the table name may be wrong.
       * Query generators that use information_schema for retrieving table info will just return an empty result set,
       * it will not throw an error like built-ins do (e.g. DESCRIBE on MySql).
       */
      if (isEmpty(data)) {
        throw new Error(
          `No description found for table ${table.tableName}${table.schema ? ` in schema ${table.schema}` : ''}. Check the table name and schema; remember, they _are_ case sensitive.`,
        );
      }

      // This is handled by copying indexes over,
      // we don't use "unique" because it creates an index with a name
      // we can't control
      for (const column of Object.values(data)) {
        column.unique = false;
      }

      const indexes = await this.showIndex(tableName, options);
      for (const index of indexes) {
        for (const field of index.fields) {
          if (index.unique !== undefined) {
            data[field.attribute].unique = index.unique;
          }
        }
      }

      // Sqlite requires the foreign keys added to the column definitions
      // when describing a table as this is required in the replaceTableQuery
      const foreignKeys = await this.showConstraints(tableName, {
        ...options,
        constraintType: 'FOREIGN KEY',
      });
      for (const foreignKey of foreignKeys) {
        for (const [index, columnName] of foreignKey.columnNames!.entries()) {
          // Add constraints to column definition
          Object.assign(data[columnName], {
            references: {
              table: foreignKey.referencedTableName,
              key: foreignKey.referencedColumnNames!.at(index),
            },
            onUpdate: foreignKey.updateAction,
            onDelete: foreignKey.deleteAction,
          });
        }
      }

      return data;
    } catch (error) {
      if (
        error instanceof BaseError &&
        isErrorWithStringCode(error.cause) &&
        error.cause.code === 'ER_NO_SUCH_TABLE'
      ) {
        throw new Error(
          `No description found for table ${table.tableName}${table.schema ? ` in schema ${table.schema}` : ''}. Check the table name and schema; remember, they _are_ case sensitive.`,
        );
      }

      throw error;
    }
  }

  async addConstraint(tableName: TableOrModel, options: AddConstraintOptions): Promise<void> {
    if (!options.fields) {
      throw new Error('Fields must be specified through options.fields');
    }

    if (!options.type) {
      throw new Error('Constraint type must be specified through options.type');
    }

    const constraintSnippet = this.queryGenerator._TEMPORARY_getConstraintSnippet(
      tableName,
      options,
    );
    const describeCreateTableSql = this.queryGenerator.describeCreateTableQuery(tableName);
    const describeCreateTable = await this.sequelize.queryRaw(describeCreateTableSql, {
      ...options,
      raw: true,
      type: QueryTypes.SELECT,
    });

    if (!describeCreateTable.length || !('sql' in describeCreateTable[0])) {
      throw new Error('Unable to find constraints for table. Perhaps the table does not exist?');
    }

    let { sql: createTableSql } = describeCreateTable[0] as { sql: string };
    // Replace double quotes with backticks and ending ')' with constraint snippet
    createTableSql = createTableSql
      .replaceAll('"', '`')
      .replace(/\);?$/, `, ${constraintSnippet})`);

    const fields = await this.describeTable(tableName, options);
    const sql = this.queryGenerator._replaceTableQuery(tableName, fields, createTableSql);
    await this.#internalQueryInterface.executeQueriesSequentially(sql, { ...options, raw: true });
  }

  async removeConstraint(
    tableName: TableOrModel,
    constraintName: string,
    options?: RemoveConstraintOptions,
  ): Promise<void> {
    const describeCreateTableSql = this.queryGenerator.describeCreateTableQuery(tableName);
    const describeCreateTable = await this.sequelize.queryRaw(describeCreateTableSql, {
      ...options,
      raw: true,
      type: QueryTypes.SELECT,
    });

    if (!describeCreateTable.length || !('sql' in describeCreateTable[0])) {
      throw new Error('Unable to find constraints for table. Perhaps the table does not exist?');
    }

    const { sql: createTableSql } = describeCreateTable[0] as { sql: string };
    const constraints = await this.showConstraints(tableName, options);
    const constraint = constraints.find(c => c.constraintName === constraintName);

    if (!constraint) {
      const table = this.queryGenerator.extractTableDetails(tableName);
      throw new UnknownConstraintError({
        message: `Constraint ${constraintName} on table ${table.tableName} does not exist`,
        constraint: constraintName,
        table: table.tableName,
      });
    }

    constraint.constraintName = this.queryGenerator.quoteIdentifier(constraint.constraintName);
    let constraintSnippet = `, CONSTRAINT ${constraint.constraintName} ${constraint.constraintType} ${constraint.definition}`;

    if (constraint.constraintType === 'FOREIGN KEY') {
      constraintSnippet = `, CONSTRAINT ${constraint.constraintName} FOREIGN KEY`;
      const columns = constraint
        .columnNames!.map(columnName => this.queryGenerator.quoteIdentifier(columnName))
        .join(', ');
      const referenceTableName = this.queryGenerator.quoteTable(constraint.referencedTableName!);
      const referenceTableColumns = constraint
        .referencedColumnNames!.map(columnName => this.queryGenerator.quoteIdentifier(columnName))
        .join(', ');
      constraintSnippet += ` (${columns})`;
      constraintSnippet += ` REFERENCES ${referenceTableName} (${referenceTableColumns})`;
      constraintSnippet += constraint.updateAction ? ` ON UPDATE ${constraint.updateAction}` : '';
      constraintSnippet += constraint.deleteAction ? ` ON DELETE ${constraint.deleteAction}` : '';
    } else if (['PRIMARY KEY', 'UNIQUE'].includes(constraint.constraintType)) {
      constraintSnippet = `, CONSTRAINT ${constraint.constraintName} ${constraint.constraintType}`;
      const columns = constraint
        .columnNames!.map(columnName => this.queryGenerator.quoteIdentifier(columnName))
        .join(', ');
      constraintSnippet += ` (${columns})`;
    }

    const fields = await this.describeTable(tableName, options);
    // Replace double quotes with backticks and remove constraint snippet
    const sql = this.queryGenerator._replaceTableQuery(
      tableName,
      fields,
      createTableSql.replaceAll('"', '`').replace(constraintSnippet, ''),
    );
    await this.#internalQueryInterface.executeQueriesSequentially(sql, { ...options, raw: true });
  }

  async showConstraints(
    tableName: TableOrModel,
    options?: ShowConstraintsOptions,
  ): Promise<ConstraintDescription[]> {
    const describeCreateTableSql = this.queryGenerator.describeCreateTableQuery(tableName);
    const describeCreateTable = await this.sequelize.queryRaw(describeCreateTableSql, {
      ...options,
      raw: true,
      type: QueryTypes.SELECT,
    });

    if (!describeCreateTable.length || !('sql' in describeCreateTable[0])) {
      throw new Error('Unable to find constraints for table. Perhaps the table does not exist?');
    }

    const { sql: createTableSql } = describeCreateTable[0] as { sql: string };
    const match = /CREATE TABLE (?:`|'|")(\S+)(?:`|'|") \((.+)\)/.exec(createTableSql);
    const data: ConstraintDescription[] = [];

    if (match) {
      const [, constraintTableName, attributeSQL] = match;
      const keys = [];
      const attributes = [];
      const constraints = [];
      const sqlAttributes = attributeSQL.split(/,(?![^(]*\))/).map(attr => attr.trim());
      for (const attribute of sqlAttributes) {
        if (attribute.startsWith('CONSTRAINT')) {
          constraints.push(attribute);
        } else if (attribute.startsWith('PRIMARY KEY') || attribute.startsWith('FOREIGN KEY')) {
          keys.push(attribute);
        } else {
          attributes.push(attribute);
        }
      }

      for (const attribute of attributes) {
        const [, column, type] = attribute.match(/`(\S+)` (.+)/) || [];
        if (/\bPRIMARY KEY\b/.test(type)) {
          data.push({
            constraintSchema: '',
            constraintName: 'PRIMARY',
            constraintType: 'PRIMARY KEY',
            tableSchema: '',
            tableName: constraintTableName,
            columnNames: [column],
          });
        } else if (/\bREFERENCES\b/.test(type)) {
          const deleteAction = type.match(/ON DELETE (\w+(?: (?!ON UPDATE)\w+)?)/);
          const updateAction = type.match(/ON UPDATE (\w+(?: (?!ON DELETE)\w+)?)/);
          const [, referencedTableName, referencedColumnNames] =
            type.match(/REFERENCES `(\S+)` \(`(\S+)`\)/) || [];

          data.push({
            constraintSchema: '',
            constraintName: 'FOREIGN',
            constraintType: 'FOREIGN KEY',
            tableSchema: '',
            tableName: constraintTableName,
            columnNames: [column],
            referencedTableSchema: '',
            referencedTableName: referencedTableName ?? '',
            referencedColumnNames: [referencedColumnNames],
            deleteAction: deleteAction?.at(1) ?? '',
            updateAction: updateAction?.at(1) ?? '',
          });
        } else if (/\bUNIQUE\b/.test(type)) {
          data.push({
            constraintSchema: '',
            constraintName: 'UNIQUE',
            constraintType: 'UNIQUE',
            tableSchema: '',
            tableName: constraintTableName,
            columnNames: [column],
          });
        } else if (/\bCHECK\b/.test(type)) {
          const definition = type.match(/CHECK (.+)/);

          data.push({
            constraintSchema: '',
            constraintName: 'CHECK',
            constraintType: 'CHECK',
            tableSchema: '',
            tableName: constraintTableName,
            columnNames: [column],
            definition: definition ? (definition[1] ?? '') : '',
          });
        }
      }

      for (const constraint of constraints) {
        const [, constraintName, constraintType, definition] =
          constraint.match(/CONSTRAINT (?:`|'|")(\S+)(?:`|'|") (\w+(?: \w+)?) (.+)/) || [];
        if (/\bPRIMARY KEY\b/.test(constraint)) {
          const columnsMatch = [...definition.matchAll(/`(\S+)`/g)];

          data.push({
            constraintSchema: '',
            constraintName,
            constraintType: 'PRIMARY KEY',
            tableSchema: '',
            tableName: constraintTableName,
            columnNames: columnsMatch.map(col => col[1]),
          });
        } else if (/\bREFERENCES\b/.test(constraint)) {
          const deleteAction = definition.match(/ON DELETE (\w+(?: (?!ON UPDATE)\w+)?)/);
          const updateAction = definition.match(/ON UPDATE (\w+(?: (?!ON DELETE)\w+)?)/);
          const [, rawColumnNames, referencedTableName, rawReferencedColumnNames] =
            definition.match(
              /\(([^\s,]+(?:,\s?[^\s,]+)*)\) REFERENCES `(\S+)` \(([^\s,]+(?:,\s?[^\s,]+)*)\)/,
            ) || [];
          const columnsMatch = [...rawColumnNames.matchAll(/`(\S+)`/g)];
          const referencedColumnNames = [...rawReferencedColumnNames.matchAll(/`(\S+)`/g)];

          data.push({
            constraintSchema: '',
            constraintName,
            constraintType: 'FOREIGN KEY',
            tableSchema: '',
            tableName: constraintTableName,
            columnNames: columnsMatch.map(col => col[1]),
            referencedTableSchema: '',
            referencedTableName: referencedTableName ?? '',
            referencedColumnNames: referencedColumnNames.map(col => col[1]),
            deleteAction: deleteAction?.at(1) ?? '',
            updateAction: updateAction?.at(1) ?? '',
          });
        } else if (['CHECK', 'DEFAULT', 'UNIQUE'].includes(constraintType)) {
          const columnsMatch = [...definition.matchAll(/`(\S+)`/g)];

          data.push({
            constraintSchema: '',
            constraintName,
            constraintType: constraintType as ConstraintType,
            tableSchema: '',
            tableName: constraintTableName,
            ...(constraintType !== 'CHECK' && { columnNames: columnsMatch.map(col => col[1]) }),
            ...(constraintType !== 'UNIQUE' && { definition }),
          });
        }
      }

      for (const key of keys) {
        const [, constraintType, rawColumnNames] =
          key.match(/(\w+(?: \w+)?)\s?\(([^\s,]+(?:,\s?[^\s,]+)*)\)/) || [];
        const columnsMatch = [...rawColumnNames.matchAll(/`(\S+)`/g)];
        const columnNames = columnsMatch.map(col => col[1]);

        if (constraintType === 'PRIMARY KEY') {
          data.push({
            constraintSchema: '',
            constraintName: 'PRIMARY',
            constraintType,
            tableSchema: '',
            tableName: constraintTableName,
            columnNames,
          });
        } else if (constraintType === 'FOREIGN KEY') {
          const deleteAction = key.match(/ON DELETE (\w+(?: (?!ON UPDATE)\w+)?)/);
          const updateAction = key.match(/ON UPDATE (\w+(?: (?!ON DELETE)\w+)?)/);
          const [, referencedTableName, rawReferencedColumnNames] =
            key.match(/REFERENCES `(\S+)` \(([^\s,]+(?:,\s?[^\s,]+)*)\)/) || [];
          const referencedColumnNames = [...rawReferencedColumnNames.matchAll(/`(\S+)`/g)];

          data.push({
            constraintSchema: '',
            constraintName: 'FOREIGN',
            constraintType,
            tableSchema: '',
            tableName: constraintTableName,
            columnNames,
            referencedTableSchema: '',
            referencedTableName,
            referencedColumnNames: referencedColumnNames.map(col => col[1]),
            deleteAction: deleteAction?.at(1) ?? '',
            updateAction: updateAction?.at(1) ?? '',
          });
        }
      }
    } else {
      throw new Error(`Could not parse constraints from SQL: ${createTableSql}`);
    }

    let constraintData = data;

    if (options?.columnName) {
      constraintData = constraintData.filter(constraint =>
        constraint.columnNames?.includes(options.columnName!),
      );
      constraintData = constraintData.map(constraint => {
        if (constraint.columnNames) {
          constraint.columnNames = constraint.columnNames.filter(
            column => column === options.columnName,
          );
        }

        return constraint;
      });
    }

    if (options?.constraintName) {
      constraintData = constraintData.filter(
        constraint => constraint.constraintName === options.constraintName,
      );
    }

    if (options?.constraintType) {
      constraintData = constraintData.filter(
        constraint => constraint.constraintType === options.constraintType,
      );
    }

    return constraintData;
  }

  /**
   * A wrapper that fixes SQLite's inability to remove columns from existing tables.
   * It will create a backup of the table, drop the table afterwards and create a
   * new table with the same name but without the obsolete column.
   *
   * @param tableName
   * @param removeColumn
   * @param options
   */
  async removeColumn(
    tableName: TableOrModel,
    removeColumn: string,
    options?: RemoveColumnOptions,
  ): Promise<void> {
    const fields = await this.describeTable(tableName, options);
    delete fields[removeColumn];

    await this.#internalQueryInterface.alterTableInternal(tableName, fields, options);
  }

  /**
   * A wrapper that fixes SQLite's inability to change columns from existing tables.
   * It will create a backup of the table, drop the table afterwards and create a
   * new table with the same name but with a modified version of the respective column.
   *
   * @param tableName
   * @param columnName
   * @param dataTypeOrOptions
   * @param options
   */
  async changeColumn(
    tableName: TableOrModel,
    columnName: string,
    dataTypeOrOptions: DataType | AttributeOptions,
    options?: QueryRawOptions,
  ): Promise<void> {
    const columns = await this.describeTable(tableName, options);
    for (const column of Object.values(columns)) {
      // This is handled by copying indexes over,
      // we don't use "unique" because it creates an index with a name
      // we can't control
      delete column.unique;
    }

    Object.assign(columns[columnName], this.sequelize.normalizeAttribute(dataTypeOrOptions));

    await this.#internalQueryInterface.alterTableInternal(tableName, columns, options);
  }

  /**
   * A wrapper that fixes SQLite's inability to rename columns from existing tables.
   * It will create a backup of the table, drop the table afterwards and create a
   * new table with the same name but with a renamed version of the respective column.
   *
   * @param tableName
   * @param attrNameBefore
   * @param attrNameAfter
   * @param options
   */
  async renameColumn(
    tableName: TableOrModel,
    attrNameBefore: string,
    attrNameAfter: string,
    options?: QueryRawOptions,
  ): Promise<void> {
    const fields = await this.assertTableHasColumn(tableName, attrNameBefore, options);

    fields[attrNameAfter] = { ...fields[attrNameBefore] };
    delete fields[attrNameBefore];

    const sql = this.queryGenerator._replaceColumnQuery(
      tableName,
      attrNameBefore,
      attrNameAfter,
      fields,
    );
    await this.#internalQueryInterface.executeQueriesSequentially(sql, { ...options, raw: true });
  }
}
