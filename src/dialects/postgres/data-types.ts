import wkx from 'wkx';
import { kSetDialectNames } from '../../dialect-toolbox';
import { addTicks, generateEnumName } from '../../utils';
import type {
  AcceptableTypeOf,
  DataTypes,
  RawTypeOf,
  StringifyOptions,
  DataType,
  BindParamOptions,
  DialectTypeMeta,
} from '../abstract/data-types';
import * as BaseTypes from '../abstract/data-types';
import range from './range';

const warn = BaseTypes.ABSTRACT.warn.bind(
  undefined,
  'https://www.postgresql.org/docs/9.4/static/datatype.html',
);

/**
 * Removes unsupported Postgres options, i.e., LENGTH, UNSIGNED and ZEROFILL, for the integer data types.
 *
 * @param dataType The base integer data type.
 * @private
 */
function removeUnsupportedIntegerOptions(dataType: DataType) {
  if (
    // use Reflect.get to avoid TS assertions
    Reflect.get(dataType, '_length')
    || Reflect.get(dataType, 'options')?.length
    || Reflect.get(dataType, '_unsigned')
    || Reflect.get(dataType, '_zerofill')
  ) {
    warn(
      `PostgresSQL does not support '${dataType.key}' with LENGTH, UNSIGNED or ZEROFILL. Plain '${dataType.key}' will be used instead.`,
    );
    Reflect.set(dataType, '_length', undefined);
    Reflect.get(dataType, 'options').length = undefined;
    Reflect.set(dataType, '_unsigned', undefined);
    Reflect.set(dataType, '_zerofill', undefined);
  }
}

/**
 * types:
 * {
 *   oids: [oid],
 *   array_oids: [oid]
 * }
 *
 * @see oid here https://github.com/lib/pq/blob/master/oid/types.go
 */

BaseTypes.UUID[kSetDialectNames]('postgres', ['uuid']);
BaseTypes.CIDR[kSetDialectNames]('postgres', ['cidr']);
BaseTypes.INET[kSetDialectNames]('postgres', ['inet']);
BaseTypes.MACADDR[kSetDialectNames]('postgres', ['macaddr']);
BaseTypes.TSVECTOR[kSetDialectNames]('postgres', ['tsvector']);
BaseTypes.JSON[kSetDialectNames]('postgres', ['json']);
BaseTypes.JSONB[kSetDialectNames]('postgres', ['jsonb']);
BaseTypes.TIME[kSetDialectNames]('postgres', ['time']);

export class DateOnly extends BaseTypes.DATEONLY {
  protected _stringify(value: AcceptableTypeOf<DataTypes['DATEONLY']>) {
    if (value === Number.POSITIVE_INFINITY) {
      return 'Infinity';
    }

    if (value === Number.NEGATIVE_INFINITY) {
      return '-Infinity';
    }

    return super._stringify(value);
  }

  protected _sanitize(
    value: RawTypeOf<DataTypes['DATEONLY']>,
    options?: { raw?: false },
  ): Date;
  protected _sanitize(
    value: RawTypeOf<DataTypes['DATEONLY']>,
    options: { raw: true },
  ): RawTypeOf<DataTypes['DATEONLY']>;
  protected _sanitize(
    value: RawTypeOf<DataTypes['DATEONLY']>,
    options?: { raw?: boolean },
  ) {
    if (
      !options?.raw
      && value !== Number.POSITIVE_INFINITY
      && value !== Number.NEGATIVE_INFINITY
    ) {
      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower === 'infinity') {
          return Number.POSITIVE_INFINITY;
        }

        if (lower === '-infinity') {
          return Number.NEGATIVE_INFINITY;
        }
      }

      return super._sanitize(value);
    }

    return value;
  }

  public static parse(value: RawTypeOf<DataTypes['DATEONLY']>) {
    if (value === 'infinity') {
      return Number.POSITIVE_INFINITY;
    }

    if (value === '-infinity') {
      return Number.NEGATIVE_INFINITY;
    }

    return value;
  }
}

BaseTypes.DATEONLY[kSetDialectNames]('postgres', ['date']);

export class DECIMAL extends BaseTypes.DECIMAL {
  static parse(value: RawTypeOf<DataTypes['DECIMAL']>) {
    return value;
  }
}

// numeric
BaseTypes.DECIMAL[kSetDialectNames]('postgres', ['numeric']);

export class STRING extends BaseTypes.STRING {
  toSql() {
    if (this._binary) {
      return 'BYTEA';
    }

    return super.toSql();
  }
}

BaseTypes.STRING[kSetDialectNames]('postgres', ['varchar']);

export class TEXT extends BaseTypes.TEXT {
  toSql() {
    if (this._length) {
      warn(
        'PostgreSQL does not support TEXT with options. Plain `TEXT` will be used instead.',
      );
      this._length = undefined;
    }

    return 'TEXT';
  }
}

BaseTypes.TEXT[kSetDialectNames]('postgres', ['text']);

export class CITEXT extends BaseTypes.CITEXT {
  static parse(value: RawTypeOf<DataTypes['CITEXT']>) {
    return value;
  }
}

BaseTypes.CITEXT[kSetDialectNames]('postgres', ['citext']);

export class CHAR extends BaseTypes.CHAR {
  toSql() {
    if (this._binary) {
      return 'BYTEA';
    }

    return super.toSql();
  }
}

BaseTypes.CHAR[kSetDialectNames]('postgres', ['char', 'bpchar']);

export class BOOLEAN extends BaseTypes.BOOLEAN {
  toSql() {
    return 'BOOLEAN';
  }

  protected _sanitize(value: RawTypeOf<DataTypes['BOOLEAN']>): any {
    if (value !== null && value !== undefined) {
      if (Buffer.isBuffer(value) && value.length === 1) {
        // Bit fields are returned as buffers
        value = value[0];
      }

      if (typeof value === 'string') {
        if (value === 'true' || value === 't') {
          return true;
        }

        if (value === 'false' || value === 'f') {
          return false;
        }

        // TODO:  instead of returning this unexpected value maybe throw?
        // Only take action on valid boolean strings.
        return value;
      }

      if (typeof value === 'number') {
        // Only take action on valid boolean integers.
        return value === 1 ? true : value === 0 ? false : value;
      }
    }

    return value;
  }
}

// BOOLEAN.parse = BOOLEAN.prototype._sanitize;
Reflect.set(BOOLEAN, 'parse', Reflect.get(BOOLEAN.prototype, '_sanitize'));

BaseTypes.BOOLEAN[kSetDialectNames]('postgres', ['bool']);

export class DATE extends BaseTypes.DATE {
  public toSql() {
    return 'TIMESTAMP WITH TIME ZONE';
  }

  public validate(value: AcceptableTypeOf<DataTypes['DATE']>) {
    if (
      value !== Number.POSITIVE_INFINITY
      && value !== Number.NEGATIVE_INFINITY
    ) {
      return super.validate(value);
    }

    return true;
  }

  protected _stringify(
    value: AcceptableTypeOf<DataTypes['DATE']>,
    options: StringifyOptions,
  ) {
    if (value === Number.POSITIVE_INFINITY) {
      return 'Number.POSITIVE_INFINITY';
    }

    if (value === Number.NEGATIVE_INFINITY) {
      return 'Number.NEGATIVE_INFINITY';
    }

    return super._stringify(value, options);
  }

  protected _sanitize(
    value: RawTypeOf<DataTypes['DATEONLY']>,
    options?: { raw?: false },
  ): Date;
  protected _sanitize(
    value: RawTypeOf<DataTypes['DATEONLY']>,
    options: { raw: true },
  ): RawTypeOf<DataTypes['DATEONLY']>;
  protected _sanitize(
    value: RawTypeOf<DataTypes['DATE']>,
    options?: { raw?: boolean },
  ) {
    if (
      !options?.raw
      && !(value instanceof Date)
      && value
      && value !== Number.POSITIVE_INFINITY
      && value !== Number.NEGATIVE_INFINITY
    ) {
      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower === 'infinity') {
          return Number.POSITIVE_INFINITY;
        }

        if (lower === '-infinity') {
          return Number.NEGATIVE_INFINITY;
        }
      }

      return new Date(value);
    }

    return value;
  }
}

BaseTypes.DATE[kSetDialectNames]('postgres', ['timestamptz']);

export class TINYINT extends BaseTypes.TINYINT {
  constructor(...args: Parameters<DataTypes['TINYINT']>) {
    super(...args);
    removeUnsupportedIntegerOptions(this);
  }
}

// int2
BaseTypes.TINYINT[kSetDialectNames]('postgres', ['int2']);

export class SMALLINT extends BaseTypes.SMALLINT {
  constructor(...args: Parameters<DataTypes['SMALLINT']>) {
    super(...args);
    removeUnsupportedIntegerOptions(this);
  }
}

// int2
BaseTypes.SMALLINT[kSetDialectNames]('postgres', ['int2']);

export class INTEGER extends BaseTypes.INTEGER {
  constructor(...args: Parameters<DataTypes['INTEGER']>) {
    super(...args);
    removeUnsupportedIntegerOptions(this);
  }

  static parse(value: string) {
    return Number.parseInt(value, 10);
  }
}

// int4
BaseTypes.INTEGER[kSetDialectNames]('postgres', ['int4']);

export class BIGINT extends BaseTypes.BIGINT {
  constructor(...args: Parameters<DataTypes['BIGINT']>) {
    super(...args);
    removeUnsupportedIntegerOptions(this);
  }
}

// int8
BaseTypes.BIGINT[kSetDialectNames]('postgres', ['int8']);

export class REAL extends BaseTypes.REAL {
  constructor(...args: Parameters<DataTypes['REAL']>) {
    super(...args);
    removeUnsupportedIntegerOptions(this);
  }
}

// float4
BaseTypes.REAL[kSetDialectNames]('postgres', ['float4']);

export class DOUBLE extends BaseTypes.DOUBLE {
  constructor(...args: Parameters<DataTypes['DOUBLE']>) {
    super(...args);
    removeUnsupportedIntegerOptions(this);
  }
}

// float8
BaseTypes.DOUBLE[kSetDialectNames]('postgres', ['float8']);

export class FLOAT extends BaseTypes.FLOAT {
  constructor(...args: Parameters<DataTypes['FLOAT']>) {
    super(...args);
    // POSTGRES does only support lengths as parameter.
    // Values between 1-24 result in REAL
    // Values between 25-53 result in DOUBLE PRECISION
    // If decimals are provided remove these and print a warning
    if (this._decimals) {
      warn(
        'PostgreSQL does not support FLOAT with decimals. Plain `FLOAT` will be used instead.',
      );
      this._length = undefined;
      this.options.length = undefined;
      this._decimals = undefined;
    }

    if (this._unsigned) {
      warn(
        'PostgreSQL does not support FLOAT unsigned. `UNSIGNED` was removed.',
      );
      this._unsigned = undefined;
    }

    if (this._zerofill) {
      warn(
        'PostgreSQL does not support FLOAT zerofill. `ZEROFILL` was removed.',
      );
      this._zerofill = undefined;
    }
  }
}

Reflect.deleteProperty(FLOAT, 'parse'); // Float has no separate type in PG

export class BLOB extends BaseTypes.BLOB {
  public toSql() {
    if (this._length) {
      warn(
        'PostgreSQL does not support BLOB (BYTEA) with options. Plain `BYTEA` will be used instead.',
      );
      this._length = undefined;
    }

    return 'BYTEA';
  }

  protected _hexify(hex: string) {
    // bytea hex format http://www.postgresql.org/docs/current/static/datatype-binary.html
    return `E'\\\\x${hex}'`;
  }
}

BaseTypes.BLOB[kSetDialectNames]('postgres', ['bytea']);

export class GEOMETRY extends BaseTypes.GEOMETRY {
  public toSql() {
    let result = this.key;
    if (this.type) {
      result += `(${this.type}`;
      if (this.srid) {
        result += `,${this.srid}`;
      }

      result += ')';
    }

    return result;
  }

  public static parse(value: string) {
    const b = Buffer.from(value, 'hex');

    return wkx.Geometry.parse(b).toGeoJSON({ shortCrs: true });
  }

  protected _stringify(value: string, options: StringifyOptions) {
    return `ST_GeomFromGeoJSON(${options.escape(JSON.stringify(value))})`;
  }

  protected _bindParam(value: string, options: BindParamOptions) {
    return `ST_GeomFromGeoJSON(${options.bindParam(value)})`;
  }
}

BaseTypes.GEOMETRY[kSetDialectNames]('postgres', ['geometry']);

export class GEOGRAPHY extends BaseTypes.GEOGRAPHY {
  public toSql() {
    let result = 'GEOGRAPHY';
    if (this.type) {
      result += `(${this.type}`;
      if (this.srid) {
        result += `,${this.srid}`;
      }

      result += ')';
    }

    return result;
  }

  public static parse(value: string) {
    const b = Buffer.from(value, 'hex');

    return wkx.Geometry.parse(b).toGeoJSON({ shortCrs: true });
  }

  protected _stringify(
    value: AcceptableTypeOf<DataTypes['GEOGRAPHY']>,
    options: StringifyOptions,
  ) {
    return `ST_GeomFromGeoJSON(${options.escape(JSON.stringify(value))})`;
  }

  bindParam(value: string, options: BindParamOptions) {
    return `ST_GeomFromGeoJSON(${options.bindParam(value)})`;
  }
}

BaseTypes.GEOGRAPHY[kSetDialectNames]('postgres', ['geography']);

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let hstore: typeof import('./hstore');

export class HSTORE extends BaseTypes.HSTORE {
  public static readonly escape = false;

  constructor() {
    super();
    if (!hstore) {
      // All datatype files are loaded at import - make sure we don't load the hstore parser before a hstore is instantiated
      hstore = require('./hstore');
    }
  }

  // TODO: Find types for pg-hstore
  private _value(value: unknown) {
    if (!hstore) {
      // All datatype files are loaded at import - make sure we don't load the hstore parser before a hstore is instantiated
      hstore = require('./hstore');
    }

    return hstore.stringify(value);
  }

  protected _stringify(value: AcceptableTypeOf<DataTypes['HSTORE']>) {
    return `'${this._value(value)}'`;
  }

  protected _bindParam(
    value: AcceptableTypeOf<DataTypes['HSTORE']>,
    options: BindParamOptions,
  ) {
    return options.bindParam(this._value(value));
  }

  static parse(value: string) {
    if (!hstore) {
      // All datatype files are loaded at import - make sure we don't load the hstore parser before a hstore is instantiated
      hstore = require('./hstore');
    }

    return hstore.parse(value);
  }
}

BaseTypes.HSTORE[kSetDialectNames]('postgres', ['hstore']);

export class RANGE extends BaseTypes.RANGE {
  public static readonly escape = false;

  private _value(
    values: Array<
      RawTypeOf<DataTypes['NUMBER'] | DATE | DataTypes['DATEONLY']>
    >,
    options: StringifyOptions,
  ) {
    if (!Array.isArray(values)) {
      return this.options.subtype.stringify(values, options);
    }

    const valueInclusivity = [true, false];
    const valuesStringified = values.map((value, index) => {
      if (
        value === null
        || value === Number.NEGATIVE_INFINITY
        || value === Number.POSITIVE_INFINITY
      ) {
        // Pass through "unbounded" bounds unchanged
        return value;
      }

      if (
        value
        && typeof value === 'object'
        && Object.prototype.hasOwnProperty.call(value, 'value')
      ) {
        if (Object.prototype.hasOwnProperty.call(value, 'inclusive')) {
          valueInclusivity[index] = Reflect.get(value, 'inclusive') as boolean;
        }

        value = Reflect.get(value, 'value');
      }

      if (this.options.subtype.stringify) {
        return this.options.subtype.stringify(value, options);
      }

      return options.escape(value as string);
    });

    // Array.map does not preserve extra array properties
    Reflect.set(valueInclusivity, 'inclusive', true);

    return range.stringify(valuesStringified);
  }

  protected _stringify(
    values: Array<
      RawTypeOf<DataTypes['NUMBER'] | DATE | DataTypes['DATEONLY']>
    >,
    options: StringifyOptions,
  ) {
    const value = this._value(values, options);
    if (!Array.isArray(values)) {
      return `'${value}'::${this.toCastType()}`;
    }

    return `'${value}'`;
  }

  protected _bindParam(
    values: Array<
      RawTypeOf<DataTypes['NUMBER'] | DATE | DataTypes['DATEONLY']>
    >,
    options: BindParamOptions,
  ) {
    const value = this._value(values, options);
    if (!Array.isArray(values)) {
      return `${options.bindParam(value ?? '')}::${this.toCastType()}`;
    }

    return options.bindParam(value);
  }

  public toSql() {
    return (
      BaseTypes.RANGE.types.postgres as Extract<
        DialectTypeMeta,
        { subtypes: any }
      >
    ).subtypes[this._subtype.toLowerCase()];
  }

  public toCastType() {
    return (
      BaseTypes.RANGE.types.postgres as Extract<
        DialectTypeMeta,
        { castTypes: any }
      >
    ).castTypes[this._subtype.toLowerCase()];
  }

  public static parse(
    value: Array<RawTypeOf<DataTypes['NUMBER'] | DATE | DataTypes['DATEONLY']>>,
    options = { parser: <T>(val: T) => val },
  ) {
    return range.parse(value, options.parser);
  }
}

BaseTypes.RANGE[kSetDialectNames]('postgres', {
  subtypes: {
    integer: 'int4range',
    decimal: 'numrange',
    date: 'tstzrange',
    dateonly: 'daterange',
    bigint: 'int8range',
  },
  castTypes: {
    integer: 'int4',
    decimal: 'numeric',
    date: 'timestamptz',
    dateonly: 'date',
    bigint: 'int8',
  },
});

// TODO: Why are base types being manipulated??
BaseTypes.ARRAY.prototype.escape = false;
BaseTypes.ARRAY.prototype._value = function _value(
  values: any[],
  options: BindParamOptions | StringifyOptions,
) {
  return values.map(value => {
    if (options && 'bindParam' in options && this.type && this.type._value) {
      return this.type._value(value, options);
    }

    if (this.type && this.type.stringify) {
      value = this.type.stringify(value, options);

      if (this.type.escape === false) {
        return value;
      }
    }

    return options.escape(value);
  });
};

BaseTypes.ARRAY.prototype._stringify = function _stringify(
  values: any[],
  options: StringifyOptions,
) {
  let str = `ARRAY[${this._value(values, options).join(',')}]`;

  if (this.type) {
    let castKey = this.toSql();

    if (this.type instanceof BaseTypes.ENUM) {
      const table = options.field.Model.getTableName();
      const useSchema = table.schema !== undefined;
      const schemaWithDelimiter = useSchema
        ? `${addTicks(table.schema, '"')}${table.delimiter}`
        : '';

      castKey = `${addTicks(
        generateEnumName(
          useSchema ? table.tableName : table,
          options.field.field,
        ),
      )}[]`;

      str += `::${schemaWithDelimiter}${castKey}`;
    } else {
      str += `::${castKey}`;
    }
  }

  return str;
};

BaseTypes.ARRAY.prototype._bindParam = function _bindParam(
  values: any[],
  options: BindParamOptions,
) {
  return options.bindParam(this._value(values, options));
};

export class ENUM<Members extends string> extends BaseTypes.ENUM<Members> {
  static parse<Members extends string>(
    this: abstract new () => ENUM<Members>,
    value: Members,
  ) {
    return value;
  }
}

BaseTypes.ENUM[kSetDialectNames]('postgres', [null]);
