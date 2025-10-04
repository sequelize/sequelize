import type { Sequelize } from '@sequelize/core';
import { AbstractDialect } from '@sequelize/core';
import { createUnspecifiedOrderedBindCollector } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import { getSynchronizedTypeKeys } from '@sequelize/utils';
import * as DataTypes from './_internal/data-types-overrides.js';
import type { Db2ConnectionOptions, IbmDbModule } from './connection-manager.js';
import { Db2ConnectionManager } from './connection-manager.js';
import { Db2QueryGenerator } from './query-generator.js';
import { Db2QueryInterface } from './query-interface.js';
import { Db2Query } from './query.js';

export interface Db2DialectOptions {
  /**
   * The ibm_db library to use.
   * If not provided, the ibm_db npm library will be used.
   * Must be compatible with the ibm_db npm library API.
   *
   * Using this option should only be considered as a last resort,
   * as the Sequelize team cannot guarantee its compatibility.
   */
  ibmDbModule?: IbmDbModule;
}

const DIALECT_OPTION_NAMES = getSynchronizedTypeKeys<Db2DialectOptions>({
  ibmDbModule: undefined,
});

const CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<Db2ConnectionOptions>({
  database: undefined,
  hostname: undefined,
  odbcOptions: undefined,
  password: undefined,
  port: undefined,
  ssl: undefined,
  sslServerCertificate: undefined,
  username: undefined,
});

export class Db2Dialect extends AbstractDialect<Db2DialectOptions, Db2ConnectionOptions> {
  static readonly supports = AbstractDialect.extendSupport({
    migrations: false,
    schemas: true,
    finalTable: true,
    autoIncrement: {
      defaultValue: false,
    },
    alterColumn: {
      unique: false,
    },
    index: {
      collate: false,
      using: false,
      where: true,
      include: true,
    },
    constraints: {
      onUpdate: false,
    },
    tmpTableTrigger: true,
    dataTypes: {
      COLLATE_BINARY: true,
      TIME: {
        precision: false,
      },
    },
    removeColumn: {
      cascade: true,
    },
    renameTable: {
      changeSchema: false,
      changeSchemaAndTable: false,
    },
    createSchema: {
      authorization: true,
    },
    connectionTransactionMethods: true,
    startTransaction: {
      useBegin: true,
    },
  });

  readonly connectionManager: Db2ConnectionManager;
  readonly queryGenerator: Db2QueryGenerator;
  readonly queryInterface: Db2QueryInterface;
  readonly Query = Db2Query;

  constructor(sequelize: Sequelize, options: Db2DialectOptions) {
    super({
      dataTypesDocumentationUrl:
        'https://www.ibm.com/support/knowledgecenter/SSEPGG_11.1.0/com.ibm.db2.luw.sql.ref.doc/doc/r0008478.html',
      identifierDelimiter: '"',
      minimumDatabaseVersion: '1.0.0',
      name: 'db2',
      options,
      sequelize,
      dataTypeOverrides: DataTypes,
    });

    this.connectionManager = new Db2ConnectionManager(this);
    this.queryGenerator = new Db2QueryGenerator(this);
    this.queryInterface = new Db2QueryInterface(this);

    this.registerDataTypeParser(['CHAR () FOR BIT DATA', 'VARCHAR () FOR BIT DATA'], value => {
      return value.toString();
    });

    this.registerDataTypeParser(['TIMESTAMP'], value => {
      // values are returned as UTC, but the UTC Offset is left unspecified.
      return `${value}+00`;
    });
  }

  createBindCollector() {
    return createUnspecifiedOrderedBindCollector();
  }

  escapeBuffer(buffer: Buffer): string {
    return `BLOB(${this.queryGenerator.escape(buffer.toString())})`;
  }

  getDefaultSchema(): string {
    return this.sequelize.options.replication.write.username?.toUpperCase() ?? '';
  }

  parseConnectionUrl(): Db2ConnectionOptions {
    throw new Error(
      'The "url" option is not supported by the Db2 dialect. Instead, please use the "odbcOptions" option.',
    );
  }

  static getSupportedOptions() {
    return DIALECT_OPTION_NAMES;
  }

  static getSupportedConnectionOptions() {
    return CONNECTION_OPTION_NAMES;
  }
}
