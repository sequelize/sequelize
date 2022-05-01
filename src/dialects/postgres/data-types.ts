import wkx from 'wkx';
import { kSetDialectNames } from '../../dialect-toolbox';
import type { Rangable } from '../../model.js';
import { addTicks, generateEnumName } from '../../utils';
import * as BaseTypes from '../abstract/data-types';
import type {
  AcceptableTypeOf,
  StringifyOptions,
  DataType,
  BindParamOptions,
  DialectTypeMeta,
} from '../abstract/data-types';
import { createDataTypesWarn } from '../abstract/data-types-utils.js';
import * as Hstore from './hstore';
import * as Range from './range';

const warn = createDataTypesWarn(
  'https://www.postgresql.org/docs/current/datatype.html',
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

// TODO use method instead
BaseTypes.UUID[kSetDialectNames]('postgres', ['uuid']);
BaseTypes.CIDR[kSetDialectNames]('postgres', ['cidr']);
BaseTypes.INET[kSetDialectNames]('postgres', ['inet']);
BaseTypes.MACADDR[kSetDialectNames]('postgres', ['macaddr']);
BaseTypes.TSVECTOR[kSetDialectNames]('postgres', ['tsvector']);
BaseTypes.JSON[kSetDialectNames]('postgres', ['json']);
BaseTypes.JSONB[kSetDialectNames]('postgres', ['jsonb']);
BaseTypes.TIME[kSetDialectNames]('postgres', ['time']);

// TODO: replace with a method to set which datatype is the dialect-specific version
export class DATEONLY extends BaseTypes.DATEONLY {
  stringify(value: AcceptableTypeOf<BaseTypes.DATEONLY>) {
    if (value === Number.POSITIVE_INFINITY) {
      return 'Infinity';
    }

    if (value === Number.NEGATIVE_INFINITY) {
      return '-Infinity';
    }

    return super.stringify(value);
  }

  sanitize(value: unknown, options?: { raw?: boolean }): unknown {
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

      return super.sanitize(value);
    }

    return value;
  }

  static parse(value: unknown) {
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
  // TODO: remove?
  static parse(value: unknown) {
    return value;
  }
}

// numeric
BaseTypes.DECIMAL[kSetDialectNames]('postgres', ['numeric']);

export class STRING extends BaseTypes.STRING {
  toSql() {
    if (this.options.binary) {
      return 'BYTEA';
    }

    return super.toSql();
  }
}

BaseTypes.STRING[kSetDialectNames]('postgres', ['varchar']);

export class TEXT extends BaseTypes.TEXT {
  protected _checkOptionSupport() {
    if (this.options.length) {
      warn(
        'PostgreSQL does not support TEXT with options. Plain `TEXT` will be used instead.',
      );

      this.options.length = undefined;
    }
  }
}

BaseTypes.TEXT[kSetDialectNames]('postgres', ['text']);

export class CITEXT extends BaseTypes.CITEXT {
  static parse(value: unknown) {
    return value;
  }
}

BaseTypes.CITEXT[kSetDialectNames]('postgres', ['citext']);

export class CHAR extends BaseTypes.CHAR {
  toSql() {
    if (this.options.binary) {
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

  sanitize(value: unknown): boolean | null {
    return BOOLEAN.parse(value);
  }

  static parse(value: unknown): boolean | null {
    if (value == null) {
      return null;
    }

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
    } else if (typeof value === 'number') {
      if (value === 1) {
        return true;
      }

      if (value === 0) {
        return false;
      }
    }

    throw new TypeError(`Could not parse value ${value} as a boolean`);
  }
}

BaseTypes.BOOLEAN[kSetDialectNames]('postgres', ['bool']);

export class DATE extends BaseTypes.DATE {
  toSql() {
    return 'TIMESTAMP WITH TIME ZONE';
  }

  validate(value: any) {
    if (value === Number.POSITIVE_INFINITY
        || value === Number.NEGATIVE_INFINITY) {
      // valid
      return;
    }

    super.validate(value);
  }

  stringify(
    value: AcceptableTypeOf<BaseTypes.DATE>,
    options: StringifyOptions,
  ): string {
    if (value === Number.POSITIVE_INFINITY) {
      return 'Number.POSITIVE_INFINITY';
    }

    if (value === Number.NEGATIVE_INFINITY) {
      return 'Number.NEGATIVE_INFINITY';
    }

    return super.stringify(value, options);
  }

  sanitize(value: unknown, options?: { raw?: boolean }) {
    if (options?.raw) {
      return value;
    }

    if (value == null) {
      return value;
    }

    if (value === Number.POSITIVE_INFINITY || value === Number.NEGATIVE_INFINITY) {
      return value;
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'infinity') {
        return Number.POSITIVE_INFINITY;
      }

      if (lower === '-infinity') {
        return Number.NEGATIVE_INFINITY;
      }
    }

    // @ts-expect-error
    return new Date(value);
  }
}

BaseTypes.DATE[kSetDialectNames]('postgres', ['timestamptz']);

export class TINYINT extends BaseTypes.TINYINT {
  protected _checkOptionSupport() {
    removeUnsupportedIntegerOptions(this);
  }
}

// int2
BaseTypes.TINYINT[kSetDialectNames]('postgres', ['int2']);

export class SMALLINT extends BaseTypes.SMALLINT {
  protected _checkOptionSupport() {
    removeUnsupportedIntegerOptions(this);
  }
}

// int2
BaseTypes.SMALLINT[kSetDialectNames]('postgres', ['int2']);

export class INTEGER extends BaseTypes.INTEGER {
  protected _checkOptionSupport() {
    removeUnsupportedIntegerOptions(this);
  }

  static parse(value: string) {
    return Number.parseInt(value, 10);
  }
}

// int4
BaseTypes.INTEGER[kSetDialectNames]('postgres', ['int4']);

export class BIGINT extends BaseTypes.BIGINT {
  protected _checkOptionSupport() {
    removeUnsupportedIntegerOptions(this);
  }
}

// int8
BaseTypes.BIGINT[kSetDialectNames]('postgres', ['int8']);

export class REAL extends BaseTypes.REAL {
  protected _checkOptionSupport() {
    removeUnsupportedIntegerOptions(this);
  }
}

// float4
BaseTypes.REAL[kSetDialectNames]('postgres', ['float4']);

export class DOUBLE extends BaseTypes.DOUBLE {
  protected _checkOptionSupport() {
    removeUnsupportedIntegerOptions(this);
  }
}

// float8
BaseTypes.DOUBLE[kSetDialectNames]('postgres', ['float8']);

export class FLOAT extends BaseTypes.FLOAT {
  protected _checkOptionSupport() {
    // POSTGRES does only support lengths as parameter.
    // Values between 1-24 result in REAL
    // Values between 25-53 result in DOUBLE PRECISION
    // If decimals are provided remove these and print a warning
    if (this.options.decimals) {
      warn(
        'PostgreSQL does not support FLOAT with decimals. Plain `FLOAT` will be used instead.',
      );
      this.options.length = undefined;
      this.options.decimals = undefined;
    }

    if (this.options.unsigned) {
      warn(
        'PostgreSQL does not support FLOAT unsigned. `UNSIGNED` was removed.',
      );
      this.options.unsigned = undefined;
    }

    if (this.options.zerofill) {
      warn(
        'PostgreSQL does not support FLOAT zerofill. `ZEROFILL` was removed.',
      );
      this.options.zerofill = undefined;
    }
  }
}

Reflect.deleteProperty(FLOAT, 'parse'); // Float has no separate type in PG

export class BLOB extends BaseTypes.BLOB {
  protected _checkOptionSupport() {
    if (this.options.length) {
      warn(
        'PostgreSQL does not support BLOB (BYTEA) with options. Plain `BYTEA` will be used instead.',
      );
      this.options.length = undefined;
    }
  }

  toSql() {
    return 'BYTEA';
  }

  protected _hexify(hex: string) {
    // bytea hex format http://www.postgresql.org/docs/current/static/datatype-binary.html
    return `E'\\\\x${hex}'`;
  }
}

BaseTypes.BLOB[kSetDialectNames]('postgres', ['bytea']);

export class GEOMETRY extends BaseTypes.GEOMETRY {
  toSql() {
    let result = this.key;
    if (this.options.type) {
      result += `(${this.options.type}`;
      if (this.options.srid) {
        result += `,${this.options.srid}`;
      }

      result += ')';
    }

    return result;
  }

  static parse(value: string) {
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
  toSql() {
    let result = 'GEOGRAPHY';
    if (this.options.type) {
      result += `(${this.options.type}`;
      if (this.options.srid) {
        result += `,${this.options.srid}`;
      }

      result += ')';
    }

    return result;
  }

  static parse(value: string) {
    const b = Buffer.from(value, 'hex');

    return wkx.Geometry.parse(b).toGeoJSON({ shortCrs: true });
  }

  protected _stringify(
    value: AcceptableTypeOf<BaseTypes.GEOGRAPHY>,
    options: StringifyOptions,
  ) {
    return `ST_GeomFromGeoJSON(${options.escape(JSON.stringify(value))})`;
  }

  bindParam(value: string, options: BindParamOptions) {
    return `ST_GeomFromGeoJSON(${options.bindParam(value)})`;
  }
}

BaseTypes.GEOGRAPHY[kSetDialectNames]('postgres', ['geography']);

export class HSTORE extends BaseTypes.HSTORE {
  readonly escape = false;

  // TODO: Find types for pg-hstore
  private _value(value: AcceptableTypeOf<BaseTypes.HSTORE>): string {
    if (value == null) {
      return value;
    }

    return Hstore.stringify(value);
  }

  stringify(value: AcceptableTypeOf<BaseTypes.HSTORE>) {
    return `'${this._value(value)}'`;
  }

  bindParam(
    value: AcceptableTypeOf<BaseTypes.HSTORE>,
    options: BindParamOptions,
  ): string {
    return options.bindParam(this._value(value));
  }

  static parse(value: string) {
    if (value == null) {
      return value;
    }

    return Hstore.parse(value);
  }
}

BaseTypes.HSTORE[kSetDialectNames]('postgres', ['hstore']);

export class RANGE<T extends BaseTypes.NUMBER | DATE | DATEONLY = INTEGER> extends BaseTypes.RANGE<T> {
  readonly escape = false;

  _value(values: Rangable<AcceptableTypeOf<T>>, options: StringifyOptions) {
    if (!Array.isArray(values)) {
      return this.options.subtype.stringify(values, options);
    }

    return Range.stringify(values, rangePart => {
      if (this.options.subtype.stringify) {
        return this.options.subtype.stringify(rangePart, options);
      }

      return options.escape(rangePart as string);
    });
  }

  stringify(values: Rangable<AcceptableTypeOf<T>>, options: StringifyOptions): string {
    const value = this._value(values, options);
    if (!Array.isArray(values)) {
      return `'${value}'::${this.#toCastType()}`;
    }

    return `'${value}'`;
  }

  bindParam(
    values: Rangable<AcceptableTypeOf<T>>,
    options: BindParamOptions,
  ): string {
    const value = this._value(values, options);
    if (!Array.isArray(values)) {
      return `${options.bindParam(value ?? '')}::${this.#toCastType()}`;
    }

    return options.bindParam(value);
  }

  toSql() {
    return (
      BaseTypes.RANGE.types.postgres as Extract<DialectTypeMeta,
        { subtypes: any }>
    ).subtypes[this.options.subtype.key.toLowerCase()];
  }

  #toCastType() {
    return (
      BaseTypes.RANGE.types.postgres as Extract<DialectTypeMeta,
        { castTypes: any }>
    ).castTypes[this.options.subtype.key.toLowerCase()];
  }

  static parse(value: unknown, options = { parser: <Type>(val: Type) => val }) {
    if (value === null) {
      return null;
    }

    if (typeof value !== 'string') {
      throw new TypeError(`Sequelize could not parse range "${value}" as its format is incompatible`);
    }

    return Range.parse(value, options.parser);
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

export class ARRAY<T extends BaseTypes.AbstractDataType<any>> extends BaseTypes.ARRAY<T> {
  readonly escape = false;

  _value(
    values: Array<AcceptableTypeOf<T>>,
    options: BindParamOptions | StringifyOptions,
  ) {
    const type = this.options.type;

    return values.map((value: any) => {
      if (options && 'bindParam' in options
        // TODO: clean up API for _value and declare its type
        // @ts-expect-error
        && type?._value) {
        // @ts-expect-error
        return type._value(value, options);
      }

      if (type && type.stringify) {
        value = type.stringify(value, options);

        if (type.escape === false) {
          return value;
        }
      }

      return options.escape(value);
    });
  }

  stringify(
    values: Array<AcceptableTypeOf<T>>,
    options: StringifyOptions,
  ) {
    const type = this.options.type;

    let str = `ARRAY[${this._value(values, options).join(',')}]`;

    if (!type) {
      return str;
    }

    let castKey = this.toSql(options);

    if (type instanceof BaseTypes.ENUM) {
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

    return str;
  }

  bindParam(
    values: Array<AcceptableTypeOf<T>>,
    options: BindParamOptions,
  ) {
    return options.bindParam(this._value(values, options));
  }
}

export class ENUM<Members extends string> extends BaseTypes.ENUM<Members> {
  static parse<Members extends string>(
    this: abstract new () => ENUM<Members>,
    value: Members,
  ) {
    return value;
  }
}

BaseTypes.ENUM[kSetDialectNames]('postgres', [null]);
