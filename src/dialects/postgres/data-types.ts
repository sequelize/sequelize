import assert from 'assert';
import wkx from 'wkx';
import { setDataTypeDialectMeta } from '../../dialect-toolbox';
import type { Rangable, Range } from '../../model.js';
import * as BaseTypes from '../abstract/data-types';
import type {
  AcceptableTypeOf,
  StringifyOptions,
  BindParamOptions,
} from '../abstract/data-types';
import { createDataTypesWarn } from '../abstract/data-types-utils.js';
import * as Hstore from './hstore';
import { PostgresQueryGenerator } from './query-generator';
import * as RangeParser from './range';

const warn = createDataTypesWarn('https://www.postgresql.org/docs/current/datatype.html');

/**
 * Removes unsupported Postgres options, i.e., LENGTH, UNSIGNED and ZEROFILL, for the integer data types.
 *
 * @param dataType The base integer data type.
 * @private
 */
function removeUnsupportedIntegerOptions(dataType: BaseTypes.NUMBER) {
  if (
    dataType.options.length
    || dataType.options.unsigned
    || dataType.options.zerofill
  ) {
    warn(`PostgresSQL does not support '${dataType.constructor.name}' with LENGTH, UNSIGNED or ZEROFILL. Plain '${dataType.constructor.name}' will be used instead.`);

    delete dataType.options.length;
    delete dataType.options.unsigned;
    delete dataType.options.zerofill;
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
setDataTypeDialectMeta(BaseTypes.UUID, 'postgres', ['uuid']);
setDataTypeDialectMeta(BaseTypes.CIDR, 'postgres', ['cidr']);
setDataTypeDialectMeta(BaseTypes.INET, 'postgres', ['inet']);
setDataTypeDialectMeta(BaseTypes.MACADDR, 'postgres', ['macaddr']);
setDataTypeDialectMeta(BaseTypes.TSVECTOR, 'postgres', ['tsvector']);
setDataTypeDialectMeta(BaseTypes.JSON, 'postgres', ['json']);
setDataTypeDialectMeta(BaseTypes.JSONB, 'postgres', ['jsonb']);
setDataTypeDialectMeta(BaseTypes.TIME, 'postgres', ['time']);

export class DATEONLY extends BaseTypes.DATEONLY {
  stringify(value: AcceptableTypeOf<BaseTypes.DATEONLY>, options: StringifyOptions) {
    if (value === Number.POSITIVE_INFINITY) {
      return 'infinity';
    }

    if (value === Number.NEGATIVE_INFINITY) {
      return '-infinity';
    }

    return super.stringify(value, options);
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

setDataTypeDialectMeta(BaseTypes.DATEONLY, 'postgres', ['date']);

export class DECIMAL extends BaseTypes.DECIMAL {
  static parse(value: unknown) {
    return value;
  }
}

// numeric
setDataTypeDialectMeta(BaseTypes.DECIMAL, 'postgres', ['numeric']);

export class STRING extends BaseTypes.STRING {
  toSql() {
    if (this.options.binary) {
      return 'BYTEA';
    }

    return super.toSql();
  }
}

setDataTypeDialectMeta(BaseTypes.STRING, 'postgres', ['varchar']);

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

setDataTypeDialectMeta(BaseTypes.TEXT, 'postgres', ['text']);

export class CITEXT extends BaseTypes.CITEXT {
  static parse(value: unknown) {
    return value;
  }
}

setDataTypeDialectMeta(BaseTypes.CITEXT, 'postgres', ['citext']);

export class CHAR extends BaseTypes.CHAR {
  toSql() {
    if (this.options.binary) {
      return 'BYTEA';
    }

    return super.toSql();
  }
}

setDataTypeDialectMeta(BaseTypes.CHAR, 'postgres', ['char', 'bpchar']);

export class BOOLEAN extends BaseTypes.BOOLEAN {
  toSql() {
    return 'BOOLEAN';
  }
}

setDataTypeDialectMeta(BaseTypes.BOOLEAN, 'postgres', ['bool']);

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
      return options.escape('infinity');
    }

    if (value === Number.NEGATIVE_INFINITY) {
      return options.escape('-infinity');
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

setDataTypeDialectMeta(BaseTypes.DATE, 'postgres', ['timestamptz']);

export class TINYINT extends BaseTypes.TINYINT {
  protected _checkOptionSupport() {
    removeUnsupportedIntegerOptions(this);
  }
}

// int2
setDataTypeDialectMeta(BaseTypes.TINYINT, 'postgres', ['int2']);

export class SMALLINT extends BaseTypes.SMALLINT {
  protected _checkOptionSupport() {
    removeUnsupportedIntegerOptions(this);
  }
}

// int2
setDataTypeDialectMeta(BaseTypes.SMALLINT, 'postgres', ['int2']);

export class INTEGER extends BaseTypes.INTEGER {
  protected _checkOptionSupport() {
    removeUnsupportedIntegerOptions(this);
  }

  static parse(value: string) {
    return Number.parseInt(value, 10);
  }
}

// int4
setDataTypeDialectMeta(BaseTypes.INTEGER, 'postgres', ['int4']);

export class BIGINT extends BaseTypes.BIGINT {
  protected _checkOptionSupport() {
    removeUnsupportedIntegerOptions(this);
  }
}

// int8
setDataTypeDialectMeta(BaseTypes.BIGINT, 'postgres', ['int8']);

export class REAL extends BaseTypes.REAL {
  protected _checkOptionSupport() {
    removeUnsupportedIntegerOptions(this);
  }
}

// float4
setDataTypeDialectMeta(BaseTypes.REAL, 'postgres', ['float4']);

export class DOUBLE extends BaseTypes.DOUBLE {
  protected _checkOptionSupport() {
    removeUnsupportedIntegerOptions(this);
  }

  protected getNumberSqlTypeName(): string {
    return 'DOUBLE PRECISION';
  }
}

// float8
setDataTypeDialectMeta(BaseTypes.DOUBLE, 'postgres', ['float8']);

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
}

setDataTypeDialectMeta(BaseTypes.BLOB, 'postgres', ['bytea']);

export class GEOMETRY extends BaseTypes.GEOMETRY {
  toSql() {
    let result = 'GEOMETRY';
    if (this.options.type) {
      result += `(${this.options.type.toUpperCase()}`;
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

  stringify(value: AcceptableTypeOf<BaseTypes.GEOMETRY>, options: StringifyOptions): string {
    return `ST_GeomFromGeoJSON(${options.escape(JSON.stringify(value))})`;
  }

  bindParam(value: AcceptableTypeOf<BaseTypes.GEOMETRY>, options: BindParamOptions) {
    return `ST_GeomFromGeoJSON(${options.bindParam(value)})`;
  }
}

setDataTypeDialectMeta(BaseTypes.GEOMETRY, 'postgres', ['geometry']);

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

  stringify(
    value: AcceptableTypeOf<BaseTypes.GEOGRAPHY>,
    options: StringifyOptions,
  ) {
    return `ST_GeomFromGeoJSON(${options.escape(JSON.stringify(value))})`;
  }

  bindParam(value: AcceptableTypeOf<BaseTypes.GEOGRAPHY>, options: BindParamOptions) {
    return `ST_GeomFromGeoJSON(${options.bindParam(value)})`;
  }
}

setDataTypeDialectMeta(BaseTypes.GEOGRAPHY, 'postgres', ['geography']);

export class HSTORE extends BaseTypes.HSTORE {
  // TODO: Find types for pg-hstore
  stringify(value: AcceptableTypeOf<BaseTypes.HSTORE>): string {
    if (value == null) {
      return value;
    }

    return Hstore.stringify(value);
  }

  static parse(value: string) {
    return Hstore.parse(value);
  }
}

setDataTypeDialectMeta(BaseTypes.HSTORE, 'postgres', ['hstore']);

export class RANGE<T extends BaseTypes.NUMBER | DATE | DATEONLY = INTEGER> extends BaseTypes.RANGE<T> {
  stringify(values: Rangable<AcceptableTypeOf<T>>, options: StringifyOptions) {
    if (!Array.isArray(values)) {
      return this.options.subtype.stringify(values, options);
    }

    return RangeParser.stringify(values, rangePart => {
      return this.options.subtype.stringify(rangePart, options);
    });
  }

  escape(values: Rangable<AcceptableTypeOf<T>>, options: StringifyOptions): string {
    const value = this.stringify(values, options);
    if (!Array.isArray(values)) {
      return `'${value}'::${this.#toCastType()}`;
    }

    return `'${value}'`;
  }

  bindParam(
    values: Rangable<AcceptableTypeOf<T>>,
    options: BindParamOptions,
  ): string {
    const value = this.stringify(values, options);
    if (!Array.isArray(values)) {
      return `${options.bindParam(value ?? '')}::${this.#toCastType()}`;
    }

    return options.bindParam(value);
  }

  toSql() {
    const subTypeClass = this.options.subtype.constructor as typeof BaseTypes.AbstractDataType;

    return RANGE.typeMap.subTypes[subTypeClass.getDataTypeId().toLowerCase()];
  }

  #toCastType(): string {
    const subTypeClass = this.options.subtype.constructor as typeof BaseTypes.AbstractDataType;

    return RANGE.typeMap.castTypes[subTypeClass.getDataTypeId().toLowerCase()];
  }

  static typeMap: { subTypes: Record<string, string>, castTypes: Record<string, string> } = {
    subTypes: {
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
  };

  static parse(value: unknown, options?: { parser(val: unknown): unknown }): Range<unknown> {
    if (typeof value !== 'string') {
      throw new TypeError(`Sequelize could not parse range "${value}" as its format is incompatible`);
    }

    return RangeParser.parse(value, options?.parser ?? (val => val));
  }
}

export class ARRAY<T extends BaseTypes.AbstractDataType<any>> extends BaseTypes.ARRAY<T> {
  escape(
    values: Array<AcceptableTypeOf<T>>,
    options: StringifyOptions,
  ) {
    const type = this.options.type;

    return `ARRAY[${values.map((value: any) => {
      return type.escape(value, options);
    }).join(',')}]::${type.toSql()}[]`;
  }

  bindParam(
    values: Array<AcceptableTypeOf<T>>,
    options: BindParamOptions,
  ) {
    return options.bindParam(values.map((value: any) => {
      return this.options.type.stringify(value, options);
    }));
  }
}

export class ENUM<Members extends string> extends BaseTypes.ENUM<Members> {
  static parse<Members extends string>(
    this: abstract new () => ENUM<Members>,
    value: Members,
  ) {
    return value;
  }

  override toSql(): string {
    const context = this.usageContext;
    if (context == null) {
      throw new Error('Could not determine the name of this enum because it is not attached to an attribute or a column.');
    }

    let tableName;
    let columnName;
    if ('model' in context) {
      tableName = context.model.getTableName();

      const attribute = context.model.getAttributes()[context.attributeName];
      columnName = attribute.field ?? context.attributeName;
    } else {
      tableName = context.tableName;
      columnName = context.columnName;
    }

    const queryGenerator = context.sequelize.dialect.queryGenerator;

    assert(queryGenerator instanceof PostgresQueryGenerator, 'expected queryGenerator to be PostgresQueryGenerator');

    return queryGenerator.pgEnumName(tableName, columnName);
  }
}

setDataTypeDialectMeta(BaseTypes.ENUM, 'postgres', [null]);
