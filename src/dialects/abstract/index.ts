import cloneDeep from 'lodash/cloneDeep';
import merge from 'lodash/merge';
import type { Class } from 'type-fest';
import type { Dialect, Sequelize } from '../../sequelize.js';
import type { DeepPartial } from '../../utils/types.js';
import type { AbstractConnectionManager } from './connection-manager.js';
import { normalizeDataType } from './data-types-utils.js';
import type { AbstractDataType, DataType } from './data-types.js';
import type { AbstractQueryGenerator } from './query-generator.js';
import type { AbstractQuery } from './query.js';

export interface SupportableIntegerOptions {
  unsigned: boolean;
  zerofill: boolean;
}

export interface SupportableIeee754Options {
  /** Whether NaN can be inserted in a column that uses this DataType. */
  NaN: boolean;
  /** Whether Infinity/-Infinity can be inserted in a column that uses this DataType. */
  infinity: boolean;
}

export interface SupportableDecimalOptions extends SupportableIeee754Options {
  /**
   * Whether this dialect supports unconstrained numeric/decimal columns. i.e. columns where numeric values of any length can be stored.
   * The SQL standard requires that "NUMERIC" with no option be equal to "NUMERIC(0,0)", but some dialects (postgres)
   * interpret it as an unconstrained numeric.
   */
  unconstrained: boolean;
}

export type DialectSupports = {
  'DEFAULT': boolean,
  'DEFAULT VALUES': boolean,
  'VALUES ()': boolean,
  'LIMIT ON UPDATE': boolean,
  'ON DUPLICATE KEY': boolean,
  'ORDER NULLS': boolean,
  'UNION': boolean,
  'UNION ALL': boolean,
  'RIGHT JOIN': boolean,
  EXCEPTION: boolean,

  forShare?: 'LOCK IN SHARE MODE' | 'FOR SHARE' | undefined,
  lock: boolean,
  lockOf: boolean,
  lockKey: boolean,
  lockOuterJoinFailure: boolean,
  skipLocked: boolean,
  finalTable: boolean,

  /* does the dialect support returning values for inserted/updated fields */
  returnValues: false | {
    output: boolean,
    returning: boolean,
  },

  /* features specific to autoIncrement values */
  autoIncrement: {
    /* does the dialect require modification of insert queries when inserting auto increment fields */
    identityInsert: boolean,

    /* does the dialect support inserting default/null values for autoincrement fields */
    defaultValue: boolean,

    /* does the dialect support updating autoincrement fields */
    update: boolean,
  },
  /* Do we need to say DEFAULT for bulk insert */
  bulkDefault: boolean,
  schemas: boolean,
  transactions: boolean,
  settingIsolationLevelDuringTransaction: boolean,
  transactionOptions: {
    type: boolean,
  },
  migrations: boolean,
  upserts: boolean,
  inserts: {
    ignoreDuplicates: string, /* dialect specific words for INSERT IGNORE or DO NOTHING */
    updateOnDuplicate: boolean | string, /* whether dialect supports ON DUPLICATE KEY UPDATE */
    onConflictDoNothing: string, /* dialect specific words for ON CONFLICT DO NOTHING */
    conflictFields: boolean, /* whether the dialect supports specifying conflict fields or not */
  },
  constraints: {
    restrict: boolean,
    addConstraint: boolean,
    dropConstraint: boolean,
    unique: boolean,
    default: boolean,
    check: boolean,
    foreignKey: boolean,
    primaryKey: boolean,
    onUpdate: boolean,
  },
  index: {
    collate: boolean,
    length: boolean,
    parser: boolean,
    concurrently: boolean,
    type: boolean,
    using: boolean | number,
    functionBased: boolean,
    operator: boolean,
    where: boolean,
  },
  groupedLimit: boolean,
  indexViaAlter: boolean,
  alterColumn: {
    /**
     * Can "ALTER TABLE x ALTER COLUMN y" add UNIQUE to the column in this dialect?
     */
    unique: boolean,
  },
  dataTypes: {
    CHAR: {
      /**
       * Whether this dialect provides a valid substitute for CHAR BINARY.
       * CHAR BINARY *must* be blank padded.
       */
      BINARY: boolean,
    },
    /** This dialect supports case-insensitive text */
    CITEXT: boolean,
    /** This dialect supports 1 byte long signed ints */
    TINYINT: false | SupportableIntegerOptions,
    /** This dialect supports 2 byte long signed ints */
    SMALLINT: false | SupportableIntegerOptions,
    /** This dialect supports 3 byte long signed ints */
    MEDIUMINT: false | SupportableIntegerOptions,
    /** This dialect supports 4 byte long signed ints */
    INTEGER: false | SupportableIntegerOptions,
    /** This dialect supports 8 byte long signed ints */
    BIGINT: false | SupportableIntegerOptions,
    REAL: SupportableIeee754Options,
    FLOAT: SupportableIeee754Options,
    DOUBLE: SupportableIeee754Options,
    DECIMAL: SupportableDecimalOptions,
    JSON: boolean,
    JSONB: boolean,
    ARRAY: boolean,
    RANGE: boolean,
    GEOMETRY: boolean,
    GEOGRAPHY: boolean,
    REGEXP: boolean,
    /**
     * Case-insensitive regexp operator support ('~*' in postgres).
     */
    IREGEXP: boolean,
    HSTORE: boolean,
    TSVECTOR: boolean,
    CIDR: boolean,
    INET: boolean,
    MACADDR: boolean,
    DATETIME: {
      /** Whether "infinity" is a valid value in this dialect's DATETIME data type */
      infinity: boolean,
    },
    DATEONLY: {
      /** Whether "infinity" is a valid value in this dialect's DATEONLY data type */
      infinity: boolean,
    },
  },
  tmpTableTrigger: boolean,
  indexHints: boolean,
  searchPath: boolean,
  /**
   * This dialect supports marking a column's constraints as deferrable.
   * e.g. 'DEFERRABLE' and 'INITIALLY DEFERRED'
   */
  deferrableConstraints: boolean,

  /**
   * This dialect supports E-prefixed strings, e.g. "E'foo'", which
   * enables the ability to use backslash escapes inside of the string.
   */
  escapeStringConstants: boolean,

  /**
   * Whether this dialect supports date & time values with a precision down to at least the millisecond.
   */
  milliseconds: boolean,
};

export abstract class AbstractDialect {
  /**
   * List of features this dialect supports.
   *
   * Important: Dialect implementations inherit these values.
   * When changing a default, ensure the implementations still properly declare which feature they support.
   */
  static readonly supports: DialectSupports = {
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
    transactions: true,
    settingIsolationLevelDuringTransaction: true,
    transactionOptions: {
      type: false,
    },
    migrations: true,
    upserts: true,
    inserts: {
      ignoreDuplicates: '',
      updateOnDuplicate: false,
      onConflictDoNothing: '',
      conflictFields: false,
    },
    constraints: {
      restrict: true,
      addConstraint: true,
      dropConstraint: true,
      unique: true,
      default: false,
      check: true,
      foreignKey: true,
      primaryKey: true,
      onUpdate: true,
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
    },
    groupedLimit: true,
    indexViaAlter: false,
    alterColumn: {
      unique: true,
    },
    dataTypes: {
      CHAR: {
        BINARY: false,
      },
      CITEXT: false,
      TINYINT: false,
      SMALLINT: { unsigned: false, zerofill: false },
      MEDIUMINT: false,
      INTEGER: { unsigned: false, zerofill: false },
      BIGINT: { unsigned: false, zerofill: false },
      FLOAT: { NaN: false, infinity: false },
      REAL: { NaN: false, infinity: false },
      DOUBLE: { NaN: false, infinity: false },
      DECIMAL: { unconstrained: false, NaN: false, infinity: false },
      CIDR: false,
      MACADDR: false,
      INET: false,
      JSON: false,
      JSONB: false,
      ARRAY: false,
      RANGE: false,
      GEOMETRY: false,
      REGEXP: false,
      IREGEXP: false,
      GEOGRAPHY: false,
      HSTORE: false,
      TSVECTOR: false,
      DATETIME: {
        infinity: false,
      },
      DATEONLY: {
        infinity: false,
      },
    },
    deferrableConstraints: false,
    tmpTableTrigger: false,
    indexHints: false,
    searchPath: false,
    escapeStringConstants: false,
    milliseconds: false,
  };

  protected static extendSupport(supportsOverwrite: DeepPartial<DialectSupports>): DialectSupports {
    return merge(cloneDeep(this.supports), supportsOverwrite);
  }

  readonly sequelize: Sequelize;

  abstract readonly defaultVersion: string;
  abstract readonly Query: typeof AbstractQuery;
  abstract readonly name: Dialect;
  abstract readonly TICK_CHAR: string;
  abstract readonly TICK_CHAR_LEFT: string;
  abstract readonly TICK_CHAR_RIGHT: string;
  abstract readonly queryGenerator: AbstractQueryGenerator;
  abstract readonly connectionManager: AbstractConnectionManager<any>;
  abstract readonly DataTypes: Record<string, Class<AbstractDataType<any>>>;

  #dataTypeOverridesCache: Map<string, Class<AbstractDataType<any>>> | undefined;
  #dataTypeParsers = new Map<unknown, AbstractDataType<any>>();

  /**
   * A map that lists the dialect-specific data-type extensions.
   *
   * e.g. in
   */
  get dataTypeOverrides(): Map<string, Class<AbstractDataType<any>>> {
    if (this.#dataTypeOverridesCache) {
      return this.#dataTypeOverridesCache;
    }

    const dataTypes = this.DataTypes;

    const overrides = new Map();
    for (const dataType of Object.values(dataTypes)) {
      const replacedDataTypeId: string = (dataType as unknown as typeof AbstractDataType).getDataTypeId();

      if (overrides.has(replacedDataTypeId)) {
        throw new Error(`Dialect ${this.name} declares more than one implementation for DataType ID ${replacedDataTypeId}.`);
      }

      overrides.set(replacedDataTypeId, dataType);
    }

    this.#dataTypeOverridesCache = overrides;

    return overrides;
  }

  get supports(): DialectSupports {
    const Dialect = this.constructor as typeof AbstractDialect;

    return Dialect.supports;
  }

  constructor(sequelize: Sequelize) {
    this.sequelize = sequelize;
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
    value = value.replace(/'/g, '\'\'');

    return `'${value}'`;
  }

  /**
   * Whether this dialect can use \ in strings to escape string delimiters.
   *
   * @returns
   */
  canBackslashEscape(): boolean {
    return false;
  }

  getDefaultPort(): number {
    // @ts-expect-error untyped constructor
    return this.constructor.getDefaultPort();
  }

  /**
   * Used to register a base parser for a Database type.
   * See {@link AbstractDataType#parse} for more information.
   *
   * @param dataType The DataType whose {@link AbstractDataType#parse} method will be used to parse this Database data type value.
   * @param databaseDataTypes Dialect-specific DB data type identifiers that will use this dataType's {@link AbstractDataType#parse} method as their parser.
   */
  registerDataTypeParser(dataType: DataType, databaseDataTypes: unknown[]) {
    dataType = normalizeDataType(dataType, this);

    for (const databaseDataType of databaseDataTypes) {
      if (this.#dataTypeParsers.has(databaseDataType)) {
        throw new Error(`Sequelize DataType for DB DataType ${databaseDataType} already registered for dialect ${this.name}`);
      }

      this.#dataTypeParsers.set(databaseDataType, dataType);
    }
  }

  getParserForDatabaseDataType(databaseDataType: unknown): AbstractDataType<any> | undefined {
    return this.#dataTypeParsers.get(databaseDataType);
  }

  static getDefaultPort(): number {
    throw new Error(`getDefaultPort not implemented in ${this.name}`);
  }
}

export type BindCollector = {
  /**
   *
   *
   * @param {string} bindParameterName The name of the bind parameter
   * @returns {string}
   */
  collect(bindParameterName: string): string,

  /**
   * Returns either an array of orders if the bind parameters are mapped to numeric parameters (e.g. '?', $1, @1),
   * or null if no mapping was necessary because the dialect supports named parameters.
   */
  getBindParameterOrder(): string[] | null,
};
