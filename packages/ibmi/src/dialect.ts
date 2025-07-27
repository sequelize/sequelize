import type { Sequelize } from '@sequelize/core';
import { AbstractDialect } from '@sequelize/core';
import { createUnspecifiedOrderedBindCollector } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import { getSynchronizedTypeKeys } from '@sequelize/utils';
import * as DataTypes from './_internal/data-types-overrides.js';
import type { IBMiConnectionOptions, OdbcModule } from './connection-manager.js';
import { IBMiConnectionManager } from './connection-manager.js';
import { IBMiQueryGenerator } from './query-generator.js';
import { IBMiQueryInterface } from './query-interface.js';
import { IBMiQuery } from './query.js';

export interface IbmiDialectOptions {
  /**
   * The odbc library to use.
   * If not provided, the odbc npm library will be used.
   * Must be compatible with the odbc npm library API.
   *
   * Using this option should only be considered as a last resort,
   * as the Sequelize team cannot guarantee its compatibility.
   */
  odbcModule?: OdbcModule;
}

const DIALECT_OPTION_NAMES = getSynchronizedTypeKeys<IbmiDialectOptions>({
  odbcModule: undefined,
});

const CONNECTION_OPTION_NAMES = getSynchronizedTypeKeys<IBMiConnectionOptions>({
  connectionTimeout: undefined,
  loginTimeout: undefined,
  username: undefined,
  system: undefined,
  odbcConnectionString: undefined,
  dataSourceName: undefined,
  password: undefined,
});

export class IBMiDialect extends AbstractDialect<IbmiDialectOptions, IBMiConnectionOptions> {
  static readonly supports = AbstractDialect.extendSupport({
    'VALUES ()': true,
    'ON DUPLICATE KEY': false,
    connectionTransactionMethods: true,
    bulkDefault: true,
    index: {
      using: false,
      where: true,
      functionBased: true,
      collate: false,
      include: false,
    },
    constraints: {
      onUpdate: false,
    },
    groupedLimit: false,
    upserts: false,
    schemas: true,
    dataTypes: {
      COLLATE_BINARY: true,
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
    dropSchema: {
      cascade: true,
      ifExists: true,
    },
  });

  readonly connectionManager: IBMiConnectionManager;
  readonly queryGenerator: IBMiQueryGenerator;
  readonly queryInterface: IBMiQueryInterface;
  readonly Query = IBMiQuery;

  constructor(sequelize: Sequelize, options: IbmiDialectOptions) {
    console.warn(
      'The IBMi dialect is experimental and usage is at your own risk. Its development is exclusively community-driven and not officially supported by the maintainers.',
    );

    super({
      dataTypesDocumentationUrl:
        'https://www.ibm.com/support/knowledgecenter/en/ssw_ibm_i_73/db2/rbafzch2data.htm',
      identifierDelimiter: '"',
      minimumDatabaseVersion: '7.3.0',
      name: 'ibmi',
      options,
      sequelize,
      dataTypeOverrides: DataTypes,
    });

    this.connectionManager = new IBMiConnectionManager(this);
    this.queryGenerator = new IBMiQueryGenerator(this);
    this.queryInterface = new IBMiQueryInterface(this);
  }

  createBindCollector() {
    return createUnspecifiedOrderedBindCollector();
  }

  escapeBuffer(buffer: Buffer): string {
    return `BLOB(X'${buffer.toString('hex')}')`;
  }

  getDefaultSchema(): string {
    // TODO: what is the default schema in IBMi?
    return '';
  }

  parseConnectionUrl(): IBMiConnectionOptions {
    throw new Error(
      'The "url" option is not supported by the Db2 dialect. Instead, please use the "odbcConnectionString" option.',
    );
  }

  static getSupportedOptions() {
    return DIALECT_OPTION_NAMES;
  }

  static getSupportedConnectionOptions() {
    return CONNECTION_OPTION_NAMES;
  }
}
