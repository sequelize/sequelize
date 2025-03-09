import type { Sequelize } from '@sequelize/core';
import { AbstractDialect } from '@sequelize/core';
import type {
  BindCollector,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/dialect.js';
import { parseCommonConnectionUrlOptions } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/connection-options.js';
import { createUnspecifiedOrderedBindCollector } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import { registerHanaDbDataTypeParsers } from './_internal/data-types-db.js';
import * as DataTypes from './_internal/data-types-overrides.js';
import type { HanaClientModule, HanaConnectionOptions } from './connection-manager.js';
import { HanaConnectionManager } from './connection-manager.js';
import { HanaQueryGenerator } from './query-generator.js';
import { HanaQueryInterface } from './query-interface.js';
import { HanaQuery } from './query.js';
import { getSynchronizedTypeKeys } from '@sequelize/utils';
import {
  BOOLEAN_CONNECTION_OPTION_NAMES,
  CONNECTION_OPTION_NAMES,
  NUMBER_CONNECTION_OPTION_NAMES,
  STRING_CONNECTION_OPTION_NAMES,
} from './_internal/connection-options.js';

export interface HanaDialectOptions {
  /**
   * The @sap/hana-client library to use.
   * If not provided, the @sap/hana-client npm library will be used.
   * Must be compatible with the @sap/hana-client npm library API.
   *
   * Using this option should only be considered as a last resort,
   * as the Sequelize team cannot guarantee its compatibility.
   */
  hanaClientModule?: HanaClientModule;

  /**
   * Show warnings if there are any when executing a query
   */
  showWarnings?: boolean | undefined;
}

const DIALECT_OPTION_NAMES = getSynchronizedTypeKeys<HanaDialectOptions>({
  hanaClientModule: undefined,
  showWarnings: undefined,
});

export class HanaDialect extends AbstractDialect<HanaDialectOptions, HanaConnectionOptions> {
  static supports = AbstractDialect.extendSupport(
    {
      autoIncrement: {
        defaultValue: false,
      },
      schemas: true,
      connectionTransactionMethods: true,
      upserts: false,
      index: {
        collate: false,
        type: true,
        using: false,
      },
      dataTypes: {
        DECIMAL: { unconstrained: true },
        JSON: true,
        TIME: {
          precision: false,
        },
      },
      dropTable: {
        cascade: true,
      },
      createSchema: {
        authorization: true,
      },
      dropSchema: {
        cascade: true,
      },
      delete: {
        limit: false,
      },
    },
  );

  readonly connectionManager: HanaConnectionManager;
  readonly queryGenerator: HanaQueryGenerator;
  readonly queryInterface: HanaQueryInterface;
  readonly Query = HanaQuery;

  constructor(sequelize: Sequelize, options: HanaDialectOptions) {
    super({
      sequelize,
      options,
      dataTypeOverrides: DataTypes,
      minimumDatabaseVersion: '2.0.72',
      identifierDelimiter: '"',
      dataTypesDocumentationUrl: 'https://help.sap.com/docs/hana-cloud-database/sap-hana-cloud-sap-hana-database-sql-reference-guide/data-types',
      name: 'hana',
    });

    this.connectionManager = new HanaConnectionManager(this);
    this.queryGenerator = new HanaQueryGenerator(this);
    this.queryInterface = new HanaQueryInterface(this);

    registerHanaDbDataTypeParsers(this);
  }

  createBindCollector(): BindCollector {
    return createUnspecifiedOrderedBindCollector();
  }

  getDefaultSchema(): string {
    if (this.sequelize.options.replication.write.currentSchema) {
      return this.sequelize.options.replication.write.currentSchema;
    }

    return this.sequelize.options.replication.write.user?.toUpperCase() ?? '';
  }

  static getDefaultPort() {
    return 443;
  }

  parseConnectionUrl(url: string): HanaConnectionOptions {
    return parseCommonConnectionUrlOptions<HanaConnectionOptions>({
      url: new URL(url),
      allowedProtocols: ['hana'],
      hostname: 'host',
      port: 'port',
      pathname: 'database',
      username: 'user',
      password: 'password',
      stringSearchParams: STRING_CONNECTION_OPTION_NAMES,
      booleanSearchParams: BOOLEAN_CONNECTION_OPTION_NAMES,
      numberSearchParams: NUMBER_CONNECTION_OPTION_NAMES,
    });
  }

  static getSupportedOptions() {
    return DIALECT_OPTION_NAMES;
  }

  static getSupportedConnectionOptions() {
    return CONNECTION_OPTION_NAMES;
  }
}
