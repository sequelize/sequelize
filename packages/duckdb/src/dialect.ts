import * as DataTypes from './_internal/data-types-overrides';
import type { Sequelize } from '@sequelize/core';
import { AbstractDialect } from '@sequelize/core';
import type { DuckDbConnectionOptions } from "./connection-manager";
import { DuckDbQuery } from "./query";
import { DuckDbConnectionManager } from "./connection-manager";
import { DuckDbQueryGenerator } from "./query-generator";
import { DuckDbQueryInterface } from "./query-interface";
import { getSynchronizedTypeKeys } from "@sequelize/utils";
import { createUnspecifiedOrderedBindCollector } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';

export interface DuckDbDialectOptions {
}

const DIALECT_OPTION_NAMES = getSynchronizedTypeKeys<DuckDbDialectOptions>({
});

const CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<DuckDbConnectionOptions>({
  database: undefined,
  mode: undefined,
});

export class DuckDbDialect extends AbstractDialect<DuckDbDialectOptions, DuckDbConnectionOptions> {
  parseConnectionUrl(_url: string): DuckDbConnectionOptions {
    throw new Error(
      'The "url" option is not supported in DuckDb. Please use the "database" option instead.',
    );
  }

  static supports = AbstractDialect.extendSupport({
    DEFAULT: true,
    'DEFAULT VALUES': true,
    'UNION ALL': false,
    'RIGHT JOIN': false,
    inserts: {
      ignoreDuplicates: ' OR IGNORE',
      updateOnDuplicate: ' ON CONFLICT DO UPDATE SET',
      conflictFields: false,
      onConflictWhere: false,
    },
    index: {
      collate: false,
      length: false,
      parser: false,
      concurrently: false,
      type: false,
      using: false,
      functionBased: false,
      operator: false,
      where: false,
      include: false,
    },
    startTransaction: {
      useBegin: true,
      readOnly: false,
      transactionType: false,
    },
    autoIncrement: {
      identityInsert: false,
      defaultValue: true,
      update: false,
    },
    constraints: {
      restrict: false,
      deferrable: false,
      unique: false, // Disabled due to https://duckdb.org/docs/sql/indexes#over-eager-unique-constraint-checking
      default: false,
      check: false,
      foreignKey: false, // Disabled due to https://duckdb.org/docs/sql/indexes#over-eager-unique-constraint-checking
      foreignKeyChecksDisableable: false,
      primaryKey: false,  // Disabled due to https://duckdb.org/docs/sql/indexes#over-eager-unique-constraint-checking
      onUpdate: false,
      add: false,
      remove: false,
    },
    groupedLimit: false,
    dataTypes: {
      CHAR: true,
      COLLATE_BINARY: false,
      CITEXT: false,
      DECIMAL: {
        unconstrained: false,
        constrained: true,
        NaN: false,
        infinity: false,
      },
      JSON: true,
      TIME: {
        precision: false,
      },
    },
    jsonOperations: false,
    jsonExtraction: {
      unquoted: false,
      quoted: false,
    },
    truncate: {
      restartIdentity: false,
    },
    returnValues: 'returning',
    schemas: true,
    isolationLevels: false,
    bulkDefault: true,
    transactions: true,
    createSchema: {
      ifNotExists: true,
    },
    dropSchema: {
      cascade: true,
      ifExists: true,
    },
    renameTable: {
      changeSchema: false,
      changeSchemaAndTable: false,
    },
    delete: {
      limit: false,
    },
    savepoints: false,
  });

  readonly Query = DuckDbQuery;
  readonly connectionManager: DuckDbConnectionManager;
  readonly queryGenerator: DuckDbQueryGenerator;
  readonly queryInterface: DuckDbQueryInterface;

  constructor(sequelize: Sequelize, options: DuckDbDialectOptions) {
    super({
      identifierDelimiter: '"',
      options,
      sequelize,
      minimumDatabaseVersion: '0.10.2',
      dataTypesDocumentationUrl: 'https://duckdb.org/docs/sql/data_types/overview.html',
      dataTypeOverrides: DataTypes,
      name: "duckdb",
    });
    this.connectionManager = new DuckDbConnectionManager(this);
    this.queryGenerator = new DuckDbQueryGenerator(this);
    this.queryInterface = new DuckDbQueryInterface(this);
  }

  createBindCollector() {
    return createUnspecifiedOrderedBindCollector();
  }

  getDefaultSchema(): string {
    return 'main';
  }

  static getDefaultPort() {
    return 0;
  }

  static getSupportedOptions() {
    return DIALECT_OPTION_NAMES;
  }

  static getSupportedConnectionOptions(): readonly string[] {
    return CONNECTION_OPTION_NAMES;
  }

  escapeString(value: string): string {
    return "'" + value.replaceAll('\0', '\\0')
        .replaceAll("'", "''") + "'";
  }

  escapeBuffer(buffer: Buffer): string {
    let escaped = "";
    for (const element of buffer) {
      let hex = element.toString(16);
      if (hex.length < 2) {
        hex = `0${hex}`;
      }

      escaped += element ? `\\x${hex}` : '\\x00';;
    }

    return `'${escaped}'::BLOB`;
  }
}
