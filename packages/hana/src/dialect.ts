import type { Sequelize } from '@sequelize/core';
import { AbstractDialect } from '@sequelize/core';
import type {
  BindCollector, SupportableNumericOptions,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/dialect.js';
import { createUnspecifiedOrderedBindCollector } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/sql.js';
import { registerHanaDbDataTypeParsers } from './_internal/data-types-db.js';
import * as DataTypes from './_internal/data-types-overrides.js';
import { HanaConnectionManager, HanaClientModule, HanaConnectionOptions } from './connection-manager.js';
import { HanaQueryGenerator } from './query-generator.js';
import { HanaQueryInterface } from './query-interface.js';
import { HanaQuery } from './query.js';
import { getSynchronizedTypeKeys } from '@sequelize/utils';
import { CONNECTION_OPTION_NAMES } from './_internal/connection-options.js';

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

const numericOptions: SupportableNumericOptions = {
  zerofill: false,
  unsigned: false,
};

export class HanaDialect extends AbstractDialect<HanaDialectOptions, HanaConnectionOptions> {
  static supports = AbstractDialect.extendSupport(
    {
      // DEFAULT: true,
      // 'DEFAULT VALUES': false,
      // 'VALUES ()': false,
      // 'LIMIT ON UPDATE': false,
      // 'ON DUPLICATE KEY': true,
      // 'ORDER NULLS': false,
      // UNION: true,
      // 'UNION ALL': true,
      // 'RIGHT JOIN': true,
      // EXCEPTION: false,
      // lock: false,
      // lockOf: false,
      // lockKey: false,
      // lockOuterJoinFailure: false,
      // skipLocked: false,
      // finalTable: false,
      // returnValues: false,
      autoIncrement: {
      //   identityInsert: false,
        defaultValue: false,
      //   update: true,
      },
      // bulkDefault: false,
      schemas: true,
      // multiDatabases: false,
      // transactions: true,
      connectionTransactionMethods: true,
      // settingIsolationLevelDuringTransaction: true,
      // transactionOptions: {
      //   type: false,
      // },
      // migrations: true,
      upserts: false,
      // inserts: {
      //   ignoreDuplicates: '',
      //   updateOnDuplicate: false,
      //   onConflictDoNothing: '',
      //   onConflictWhere: false,
      //   conflictFields: false,
      // },
      // constraints: {
      //   restrict: true,
      //   deferrable: false,
      //   unique: true,
      //   default: false,
      //   check: true,
      //   foreignKey: true,
      //   foreignKeyChecksDisableable: false,
      //   primaryKey: true,
      //   onUpdate: true,
      //   add: true,
      //   remove: true,
      //   removeOptions: {
      //     cascade: false,
      //     ifExists: false,
      //   },
      // },
      index: {
        collate: false,
      //   length: false,
      //   parser: false,
      //   concurrently: false,
        type: true,
        using: false,
      //   functionBased: false,
      //   operator: false,
      //   where: false,
      //   include: false,
      },
      // groupedLimit: true,
      // indexViaAlter: false,
      // alterColumn: {
      //   unique: true,
      // },
      dataTypes: {
      //   CHAR: true,
      //   COLLATE_BINARY: false,
      //   CITEXT: false,
      //   INTS: { zerofill: false, unsigned: false },
      //   FLOAT: { NaN: false, infinity: false, zerofill: false, unsigned: false, scaleAndPrecision: false },
      //   REAL: { NaN: false, infinity: false, zerofill: false, unsigned: false, scaleAndPrecision: false },
      //   DOUBLE: { NaN: false, infinity: false, zerofill: false, unsigned: false, scaleAndPrecision: false },
      //   DECIMAL: { constrained: true, unconstrained: false, NaN: false, infinity: false, zerofill: false, unsigned: false },
        DECIMAL: { unconstrained: true },
      //   CIDR: false,
      //   MACADDR: false,
      //   INET: false,
        JSON: true,
      //   JSONB: false,
      //   ARRAY: false,
      //   RANGE: false,
      //   GEOMETRY: false,
      //   GEOGRAPHY: false,
      //   HSTORE: false,
      //   TSVECTOR: false,
      //   DATETIME: {
      //     infinity: false,
      //   },
      //   DATEONLY: {
      //     infinity: false,
      //   },
        TIME: {
          precision: false,
        },
      },
      // jsonOperations: false,
      // jsonExtraction: {
      //   unquoted: false,
      //   quoted: false,
      // },
      // REGEXP: false,
      // IREGEXP: false,
      // tmpTableTrigger: false,
      // indexHints: false,
      // tableHints: false,
      // searchPath: false,
      // escapeStringConstants: false,
      // globalTimeZoneConfig: false,
      dropTable: {
        cascade: true,
      },
      // maxExecutionTimeHint: {
      //   select: false,
      // },
      // truncate: {
      //   cascade: false,
      // },
      // removeColumn: {
      //   cascade: false,
      //   ifExists: false,
      // },
      // renameTable: {
      //   changeSchema: true,
      //   changeSchemaAndTable: true,
      // },
      createSchema: {
        authorization: true,
//         charset: false,
//         collate: false,
//         comment: false,
//         ifNotExists: false,
//         replace: false,
      },
      dropSchema: {
        cascade: true,
//         ifExists: false,
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
    if (this.sequelize.options.replication.write.hanaSchema) {
      return this.sequelize.options.replication.write.hanaSchema;
    }
    return this.sequelize.options.replication.write.username?.toUpperCase() ?? '';
  }

  static getDefaultPort() {
    return 443;
  }

  parseConnectionUrl(url: string): HanaConnectionOptions {
    throw new Error('Method not implemented.');
  }

  static getSupportedOptions() {
    return DIALECT_OPTION_NAMES;
  }

  static getSupportedConnectionOptions() {
    return CONNECTION_OPTION_NAMES;
  }
}
