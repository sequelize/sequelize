import { EMPTY_OBJECT, freezeDeep, getImmutablePojo, isFunction, isString } from '@sequelize/utils';
import cloneDeep from 'lodash/cloneDeep';
import merge from 'lodash/merge';
import type { Class } from 'type-fest';
import type { DialectName, Sequelize } from '../sequelize.js';
import { logger } from '../utils/logger.js';
import type { DeepPartial } from '../utils/types.js';
import type { AbstractConnectionManager } from './connection-manager.js';
import type { AbstractDataType } from './data-types.js';
import * as BaseDataTypes from './data-types.js';
import type { AbstractQueryGenerator } from './query-generator.js';
import type { AbstractQueryInterface } from './query-interface.js';
import type { AbstractQuery } from './query.js';

export interface SupportableNumericOptions {
  zerofill: boolean;
  /** Whether this dialect supports the unsigned option natively */
  unsigned: boolean;
}

export interface SupportableDecimalNumberOptions extends SupportableNumericOptions {
  /** Whether NaN can be inserted in a column that uses this DataType. */
  NaN: boolean;
  /** Whether Infinity/-Infinity can be inserted in a column that uses this DataType. */
  infinity: boolean;
}

export interface SupportableFloatOptions extends SupportableDecimalNumberOptions {
  /** Whether scale & precision can be specified as parameters */
  scaleAndPrecision: boolean;
}

export interface SupportableExactDecimalOptions extends SupportableDecimalNumberOptions {
  /**
   * Whether this dialect supports unconstrained numeric/decimal columns. i.e. columns where numeric values of any length can be stored.
   * The SQL standard requires that "NUMERIC" with no option be equal to "NUMERIC(0,0)", but some dialects (postgres)
   * interpret it as an unconstrained numeric.
   */
  unconstrained: boolean;

  /**
   * Whether this dialect supports constrained numeric/decimal columns. i.e. columns where numeric values of any length can be stored.
   */
  constrained: boolean;
}

export type DialectSupports = {
  DEFAULT: boolean;
  'DEFAULT VALUES': boolean;
  'VALUES ()': boolean;
  // TODO: rename to `update.limit`
  'LIMIT ON UPDATE': boolean;
  'ON DUPLICATE KEY': boolean;
  'ORDER NULLS': boolean;
  UNION: boolean;
  'UNION ALL': boolean;
  'RIGHT JOIN': boolean;
  EXCEPTION: boolean;

  forShare?: 'LOCK IN SHARE MODE' | 'FOR SHARE' | undefined;
  lock: boolean;
  lockOf: boolean;
  lockKey: boolean;
  lockOuterJoinFailure: boolean;
  skipLocked: boolean;
  finalTable: boolean;

  /* does the dialect support returning values for inserted/updated fields */
  returnValues: false | 'output' | 'returning';

  /* features specific to autoIncrement values */
  autoIncrement: {
    /* does the dialect require modification of insert queries when inserting auto increment fields */
    identityInsert: boolean;

    /* does the dialect support inserting default/null values for autoincrement fields */
    defaultValue: boolean;

    /* does the dialect support updating autoincrement fields */
    update: boolean;
  };
  /* Do we need to say DEFAULT for bulk insert */
  bulkDefault: boolean;
  /**
   * Whether this dialect has native support for schemas.
   * For the purposes of Sequelize, a Schema is considered to be a grouping of tables.
   * For instance, in MySQL, "CREATE DATABASE" creates what we consider to be a schema.
   */
  schemas: boolean;
  /**
   * Whether this dialect has native support for having multiple databases per instance (in the postgres or mssql sense).
   * For the purposes of Sequelize, a database is considered to be a grouping of schemas.
   * For instance, in MySQL, "CREATE DATABASE" creates what we consider to be a schema,
   * so we do not consider that MySQL supports this option.
   */
  multiDatabases: boolean;
  transactions: boolean;
  savepoints: boolean;
  isolationLevels: boolean;
  connectionTransactionMethods: boolean;
  settingIsolationLevelDuringTransaction: boolean;
  startTransaction: {
    useBegin: boolean;
    readOnly: boolean;
    transactionType: boolean;
  };
  migrations: boolean;
  upserts: boolean;
  inserts: {
    ignoreDuplicates: string /* dialect specific words for INSERT IGNORE or DO NOTHING */;
    updateOnDuplicate: boolean | string /* whether dialect supports ON DUPLICATE KEY UPDATE */;
    onConflictDoNothing: string /* dialect specific words for ON CONFLICT DO NOTHING */;
    onConflictWhere: boolean /* whether dialect supports ON CONFLICT WHERE */;
    conflictFields: boolean /* whether the dialect supports specifying conflict fields or not */;
  };
  constraints: {
    restrict: boolean;
    /**
     * This dialect supports marking a column's constraints as deferrable.
     * e.g. 'DEFERRABLE' and 'INITIALLY DEFERRED'
     */
    deferrable: boolean;
    unique: boolean;
    default: boolean;
    check: boolean;
    foreignKey: boolean;
    /** Whether this dialect supports disabling foreign key checks for the current session */
    foreignKeyChecksDisableable: boolean;
    primaryKey: boolean;
    onUpdate: boolean;
    add: boolean;
    remove: boolean;
    removeOptions: {
      cascade: boolean;
      ifExists: boolean;
    };
  };
  index: {
    collate: boolean;
    length: boolean;
    parser: boolean;
    concurrently: boolean;
    type: boolean;
    using: boolean | number;
    functionBased: boolean;
    operator: boolean;
    where: boolean;
    include: boolean;
  };
  groupedLimit: boolean;
  indexViaAlter: boolean;
  alterColumn: {
    /**
     * Can "ALTER TABLE x ALTER COLUMN y" add UNIQUE to the column in this dialect?
     */
    unique: boolean;
  };
  dataTypes: {
    CHAR: boolean;
    /**
     * Whether this dialect provides a binary collation on text, varchar & char columns.
     */
    COLLATE_BINARY: boolean;
    /** This dialect supports case-insensitive text */
    CITEXT: boolean;
    /** Options supportable by all int types (from tinyint to bigint) */
    INTS: SupportableNumericOptions;
    /** @deprecated */
    REAL: SupportableFloatOptions;
    /** This dialect supports 4 byte long floating point numbers */
    FLOAT: SupportableFloatOptions;
    /** This dialect supports 8 byte long floating point numbers */
    DOUBLE: SupportableFloatOptions;
    /** This dialect supports arbitrary precision numbers */
    DECIMAL: false | SupportableExactDecimalOptions;
    /** This dialect supports big integers */
    BIGINT: boolean;
    /**
     * The dialect is considered to support JSON if it provides either:
     * - A JSON data type.
     * - An SQL function that can be used as a CHECK constraint on a text column, to ensure its contents are valid JSON.
     */
    JSON: boolean;
    JSONB: boolean;
    ARRAY: boolean;
    RANGE: boolean;
    GEOMETRY: boolean;
    GEOGRAPHY: boolean;
    HSTORE: boolean;
    TSVECTOR: boolean;
    CIDR: boolean;
    INET: boolean;
    MACADDR: boolean;
    MACADDR8: boolean;
    DATETIME: {
      /** Whether "infinity" is a valid value in this dialect's DATETIME data type */
      infinity: boolean;
    };
    DATEONLY: {
      /** Whether "infinity" is a valid value in this dialect's DATEONLY data type */
      infinity: boolean;
    };
    TIME: {
      /** Whether the dialect supports TIME(precision) */
      precision: boolean;
    };
  };
  REGEXP: boolean;
  /**
   * Case-insensitive regexp operator support ('~*' in postgres).
   */
  IREGEXP: boolean;
  /** Whether this dialect supports SQL JSON functions */
  jsonOperations: boolean;
  /** Whether this dialect supports returning quoted & unquoted JSON strings  */
  jsonExtraction: {
    unquoted: boolean;
    quoted: boolean;
  };
  tmpTableTrigger: boolean;
  indexHints: boolean;
  tableHints: boolean;
  searchPath: boolean;
  /**
   * This dialect supports E-prefixed strings, e.g. "E'foo'", which
   * enables the ability to use backslash escapes inside the string.
   */
  escapeStringConstants: boolean;

  /** Whether this dialect supports changing the global timezone option */
  globalTimeZoneConfig: boolean;
  /** Whether this dialect provides a native way to generate UUID v1 values */
  uuidV1Generation: boolean;
  /** Whether this dialect provides a native way to generate UUID v4 values */
  uuidV4Generation: boolean;
  dropTable: {
    cascade: boolean;
  };
  maxExecutionTimeHint: {
    select: boolean;
  };
  truncate: {
    cascade: boolean;
    restartIdentity: boolean;
  };
  removeColumn: {
    cascade: boolean;
    ifExists: boolean;
  };
  renameTable: {
    changeSchema: boolean;
    changeSchemaAndTable: boolean;
  };
  createSchema: {
    authorization: boolean;
    charset: boolean;
    collate: boolean;
    comment: boolean;
    ifNotExists: boolean;
    replace: boolean;
  };
  dropSchema: {
    cascade: boolean;
    ifExists: boolean;
  };
  delete: {
    limit: boolean;
  };
};

type TypeParser = (...params: any[]) => unknown;

declare const OptionType: unique symbol;
declare const ConnectionOptionType: unique symbol;

export type DialectOptions<Dialect extends AbstractDialect> = Dialect[typeof OptionType];
export type ConnectionOptions<Dialect extends AbstractDialect> =
  Dialect[typeof ConnectionOptionType];

export type AbstractDialectParams<Options> = {
  dataTypeOverrides: Record<string, Class<AbstractDataType<any>>>;
  dataTypesDocumentationUrl: string;
  /**
   * The character used to delimit identifiers in SQL queries.
   *
   * This can be a string, in which case the character will be used for both the start & end of the identifier,
   * or an object with `start` and `end` properties.
   */
  identifierDelimiter: string | { start: string; end: string };
  minimumDatabaseVersion: string;
  name: DialectName;
  options: Options | undefined;
  sequelize: Sequelize;
};

export abstract class AbstractDialect<
  Options extends object = object,
  TConnectionOptions extends object = object,
> {
  declare [OptionType]: Options;
  declare [ConnectionOptionType]: TConnectionOptions;

  /**
   * List of features this dialect supports.
   *
   * Important: Dialect implementations inherit these values.
   * When changing a default, ensure the implementations still properly declare which feature they support.
   */
  static readonly supports: DialectSupports = freezeDeep({
    DEFAULT: true,
    'DEFAULT VALUES': false,
    'VALUES ()': false,
    'LIMIT ON UPDATE': false,
    'ON DUPLICATE KEY': true,
    'ORDER NULLS': false,
    UNION: true,
    'UNION ALL': true,
    'RIGHT JOIN': true,
    EXCEPTION: false,
    lock: false,
    lockOf: false,
    lockKey: false,
    lockOuterJoinFailure: false,
    skipLocked: false,
    finalTable: false,
    returnValues: false,
    autoIncrement: {
      identityInsert: false,
      defaultValue: true,
      update: true,
    },
    bulkDefault: false,
    schemas: false,
    multiDatabases: false,
    transactions: true,
    savepoints: true,
    isolationLevels: true,
    connectionTransactionMethods: false,
    settingIsolationLevelDuringTransaction: true,
    startTransaction: {
      useBegin: false,
      readOnly: false,
      transactionType: false,
    },
    migrations: true,
    upserts: true,
    inserts: {
      ignoreDuplicates: '',
      updateOnDuplicate: false,
      onConflictDoNothing: '',
      onConflictWhere: false,
      conflictFields: false,
    },
    constraints: {
      restrict: true,
      deferrable: false,
      unique: true,
      default: false,
      check: true,
      foreignKey: true,
      foreignKeyChecksDisableable: false,
      primaryKey: true,
      onUpdate: true,
      add: true,
      remove: true,
      removeOptions: {
        cascade: false,
        ifExists: false,
      },
    },
    index: {
      collate: true,
      length: false,
      parser: false,
      concurrently: false,
      type: false,
      using: true,
      functionBased: false,
      operator: false,
      where: false,
      include: false,
    },
    groupedLimit: true,
    indexViaAlter: false,
    alterColumn: {
      unique: true,
    },
    dataTypes: {
      CHAR: true,
      COLLATE_BINARY: false,
      CITEXT: false,
      INTS: { zerofill: false, unsigned: false },
      FLOAT: {
        NaN: false,
        infinity: false,
        zerofill: false,
        unsigned: false,
        scaleAndPrecision: false,
      },
      REAL: {
        NaN: false,
        infinity: false,
        zerofill: false,
        unsigned: false,
        scaleAndPrecision: false,
      },
      DOUBLE: {
        NaN: false,
        infinity: false,
        zerofill: false,
        unsigned: false,
        scaleAndPrecision: false,
      },
      DECIMAL: {
        constrained: true,
        unconstrained: false,
        NaN: false,
        infinity: false,
        zerofill: false,
        unsigned: false,
      },
      BIGINT: true,
      CIDR: false,
      MACADDR: false,
      MACADDR8: false,
      INET: false,
      JSON: false,
      JSONB: false,
      ARRAY: false,
      RANGE: false,
      GEOMETRY: false,
      GEOGRAPHY: false,
      HSTORE: false,
      TSVECTOR: false,
      DATETIME: {
        infinity: false,
      },
      DATEONLY: {
        infinity: false,
      },
      TIME: {
        precision: true,
      },
    },
    jsonOperations: false,
    jsonExtraction: {
      unquoted: false,
      quoted: false,
    },
    REGEXP: false,
    IREGEXP: false,
    tmpTableTrigger: false,
    indexHints: false,
    tableHints: false,
    searchPath: false,
    escapeStringConstants: false,
    globalTimeZoneConfig: false,
    uuidV1Generation: false,
    uuidV4Generation: false,
    dropTable: {
      cascade: false,
    },
    maxExecutionTimeHint: {
      select: false,
    },
    truncate: {
      cascade: false,
      restartIdentity: false,
    },
    removeColumn: {
      cascade: false,
      ifExists: false,
    },
    renameTable: {
      changeSchema: true,
      changeSchemaAndTable: true,
    },
    createSchema: {
      authorization: false,
      charset: false,
      collate: false,
      comment: false,
      ifNotExists: false,
      replace: false,
    },
    dropSchema: {
      cascade: false,
      ifExists: false,
    },
    delete: {
      limit: true,
    },
  });

  protected static extendSupport(supportsOverwrite: DeepPartial<DialectSupports>): DialectSupports {
    return merge(cloneDeep(this.supports) ?? {}, supportsOverwrite);
  }

  readonly sequelize: Sequelize<this>;

  abstract readonly Query: typeof AbstractQuery;
  abstract readonly queryGenerator: AbstractQueryGenerator;
  abstract readonly queryInterface: AbstractQueryInterface;
  abstract readonly connectionManager: AbstractConnectionManager<any, any>;

  /**
   * @deprecated use {@link minimumDatabaseVersion}
   */
  get defaultVersion(): string {
    return this.minimumDatabaseVersion;
  }

  /**
   * @deprecated use {@link identifierDelimiter}.start
   */
  get TICK_CHAR_LEFT(): string {
    return this.identifierDelimiter.start;
  }

  /**
   * @deprecated use {@link identifierDelimiter}.end
   */
  get TICK_CHAR_RIGHT(): string {
    return this.identifierDelimiter.end;
  }

  readonly identifierDelimiter: { readonly start: string; readonly end: string };
  readonly minimumDatabaseVersion: string;
  readonly dataTypesDocumentationUrl: string;
  readonly options: Options;
  readonly name: DialectName;

  /** dialect-specific implementation of shared data types */
  readonly #dataTypeOverrides: Map<string, Class<AbstractDataType<any>>>;
  /** base implementations of shared data types */
  readonly #baseDataTypes: Map<string, Class<AbstractDataType<any>>>;
  readonly #dataTypeParsers = new Map<unknown, TypeParser>();

  get supports(): DialectSupports {
    const Dialect = this.constructor as typeof AbstractDialect;

    return Dialect.supports;
  }

  constructor(params: AbstractDialectParams<Options>) {
    this.sequelize = params.sequelize as Sequelize<this>;
    this.name = params.name;
    this.dataTypesDocumentationUrl = params.dataTypesDocumentationUrl;
    this.options = params.options ? getImmutablePojo(params.options) : EMPTY_OBJECT;

    this.identifierDelimiter = isString(params.identifierDelimiter)
      ? Object.freeze({
          start: params.identifierDelimiter,
          end: params.identifierDelimiter,
        })
      : getImmutablePojo(params.identifierDelimiter);

    this.minimumDatabaseVersion = params.minimumDatabaseVersion;

    const baseDataTypes = new Map<string, Class<AbstractDataType<any>>>();
    for (const dataType of Object.values(BaseDataTypes) as Array<Class<AbstractDataType<any>>>) {
      // Some exports are not Data Types
      if (!isFunction(dataType)) {
        continue;
      }

      const dataTypeId: string = (dataType as unknown as typeof AbstractDataType).getDataTypeId();

      // intermediary data type
      if (!dataTypeId) {
        continue;
      }

      if (baseDataTypes.has(dataTypeId)) {
        throw new Error(
          `Internal Error: Sequelize declares more than one base implementation for DataType ID ${dataTypeId}.`,
        );
      }

      baseDataTypes.set(dataTypeId, dataType);
    }

    const dataTypeOverrides = new Map<string, Class<AbstractDataType<any>>>();
    for (const dataType of Object.values(params.dataTypeOverrides)) {
      const replacedDataTypeId: string = (
        dataType as unknown as typeof AbstractDataType
      ).getDataTypeId();

      if (dataTypeOverrides.has(replacedDataTypeId)) {
        throw new Error(
          `Dialect ${this.name} declares more than one implementation for DataType ID ${replacedDataTypeId}.`,
        );
      }

      dataTypeOverrides.set(replacedDataTypeId, dataType);
    }

    this.#dataTypeOverrides = dataTypeOverrides;
    this.#baseDataTypes = baseDataTypes;
  }

  /**
   * Returns the dialect-specific implementation of a shared data type, or null if no such implementation exists
   * (in which case you need to use the base implementation).
   *
   * @param dataType The shared data type.
   */
  getDataTypeForDialect(
    dataType: Class<AbstractDataType<any>>,
  ): Class<AbstractDataType<any>> | null {
    const typeId = (dataType as unknown as typeof AbstractDataType).getDataTypeId();
    const baseType = this.#baseDataTypes.get(typeId);

    // this is not one of our types. May be a custom type by a user. We don't replace it.
    if (baseType != null && baseType !== dataType) {
      return null;
    }

    return this.#dataTypeOverrides.get(typeId) ?? null;
  }

  readonly #printedWarnings = new Set<string>();
  warnDataTypeIssue(text: string): void {
    // TODO: log this to sequelize's log option instead (requires a logger with multiple log levels first)
    if (this.#printedWarnings.has(text)) {
      return;
    }

    this.#printedWarnings.add(text);
    logger.warn(`${text} \n>> Check: ${this.dataTypesDocumentationUrl}`);
  }

  abstract createBindCollector(): BindCollector;

  /**
   * Produces a safe representation of a Buffer for this dialect, that can be inlined in a SQL string.
   * Used mainly by DataTypes.
   *
   * @param buffer The buffer to escape
   * @returns The string, escaped for SQL.
   */
  escapeBuffer(buffer: Buffer): string {
    const hex = buffer.toString('hex');

    return `X'${hex}'`;
  }

  /**
   * Produces a safe representation of a string for this dialect, that can be inlined in a SQL string.
   * Used mainly by DataTypes.
   *
   * @param value The string to escape
   * @returns The string, escaped for SQL.
   */
  escapeString(value: string): string {
    // http://www.postgresql.org/docs/8.2/static/sql-syntax-lexical.html#SQL-SYNTAX-STRINGS
    // http://stackoverflow.com/q/603572/130598
    value = value.replaceAll("'", "''");

    return `'${value}'`;
  }

  // Keep the logic of this class synchronized with the logic in the JSON DataType.
  escapeJson(value: unknown): string {
    return this.escapeString(JSON.stringify(value));
  }

  /**
   * Whether this dialect can use \ in strings to escape string delimiters.
   *
   * @returns
   */
  canBackslashEscape(): boolean {
    return false;
  }

  /**
   * Used to register a base parser for a Database type.
   * Parsers are based on the Database Type, not the JS type.
   * Only one parser can be assigned as the parser for a Database Type.
   * For this reason, prefer neutral implementations.
   *
   * For instance, when implementing "parse" for a Date type,
   * prefer returning a String rather than a Date object.
   *
   * The {@link DataTypes.ABSTRACT#parseDatabaseValue} method will then be called on the DataType instance defined by the user,
   * which can decide on a more specific JS type (e.g. parse the date string & return a Date instance or a Temporal instance).
   *
   * You typically do not need to implement this method. This is used to provide default parsers when no DataType
   * is provided (e.g. raw queries that don't specify a model). Sequelize already provides a default parser for most types.
   * For a custom Data Type, implementing {@link DataTypes.ABSTRACT#parseDatabaseValue} is typically what you want.
   *
   * @param databaseDataTypes Dialect-specific DB data type identifiers that will use this parser.
   * @param parser The parser function to call when parsing the data type. Parameters are dialect-specific.
   */
  registerDataTypeParser(databaseDataTypes: unknown[], parser: TypeParser) {
    for (const databaseDataType of databaseDataTypes) {
      if (this.#dataTypeParsers.has(databaseDataType)) {
        throw new Error(
          `Sequelize DataType for DB DataType ${databaseDataType} already registered for dialect ${this.name}`,
        );
      }

      this.#dataTypeParsers.set(databaseDataType, parser);
    }
  }

  getParserForDatabaseDataType(databaseDataType: unknown): TypeParser | undefined {
    return this.#dataTypeParsers.get(databaseDataType);
  }

  abstract getDefaultSchema(): string;

  abstract parseConnectionUrl(url: string): TConnectionOptions;

  static getSupportedOptions(): readonly string[] {
    throw new Error(
      `Dialect ${this.name} does not implement the static method getSupportedOptions.
It must return the list of option names that can be passed to the dialect constructor.`,
    );
  }

  static getSupportedConnectionOptions(): readonly string[] {
    throw new Error(
      `Dialect ${this.name} does not implement the static method getSupportedConnectionOptions.
It must return the list of connection option names that will be passed to its ConnectionManager's getConnection.`,
    );
  }

  getSupportedOptions(): readonly string[] {
    return (this.constructor as typeof AbstractDialect).getSupportedOptions();
  }

  getSupportedConnectionOptions(): readonly string[] {
    return (this.constructor as typeof AbstractDialect).getSupportedConnectionOptions();
  }
}

export type BindCollector = {
  /**
   *
   *
   * @param bindParameterName The name of the bind parameter
   */
  collect(bindParameterName: string): string;

  /**
   * Returns either an array of orders if the bind parameters are mapped to numeric parameters (e.g. '?', $1, @1),
   * or null if no mapping was necessary because the dialect supports named parameters.
   */
  getBindParameterOrder(): string[] | null;
};
