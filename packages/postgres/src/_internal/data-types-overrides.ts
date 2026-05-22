import type { AbstractDialect, Rangable } from '@sequelize/core';
import { attributeTypeToSql } from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types-utils.js';
import type {
  AbstractDataType,
  AcceptableTypeOf,
  AcceptedDate,
  BindParamOptions,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import * as BaseTypes from '@sequelize/core/_non-semver-use-at-your-own-risk_/abstract-dialect/data-types.js';
import { inspect, isBigInt, isNumber, isString } from '@sequelize/utils';
import identity from 'lodash/identity.js';
import assert from 'node:assert';
import wkx from 'wkx';
import { PostgresQueryGenerator } from '../query-generator';
import { stringifyHstore } from './hstore.js';
import { buildRangeParser, stringifyRange } from './range.js';

function removeUnsupportedIntegerOptions(
  dataType: BaseTypes.BaseIntegerDataType,
  dialect: AbstractDialect,
) {
  if (dataType.options.length != null) {
    // this option only makes sense for zerofill
    dialect.warnDataTypeIssue(
      `${dialect.name} does not support ${dataType.getDataTypeId()} with length specified. This options is ignored.`,
    );

    delete dataType.options.length;
  }
}

export class DATEONLY extends BaseTypes.DATEONLY {
  toBindableValue(value: AcceptableTypeOf<BaseTypes.DATEONLY>) {
    if (value === Number.POSITIVE_INFINITY) {
      return 'infinity';
    }

    if (value === Number.NEGATIVE_INFINITY) {
      return '-infinity';
    }

    return super.toBindableValue(value);
  }

  sanitize(value: unknown): unknown {
    if (value === Number.POSITIVE_INFINITY || value === Number.NEGATIVE_INFINITY) {
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

    return super.sanitize(value);
  }
}

export class DECIMAL extends BaseTypes.DECIMAL {
  // TODO: add check constraint >= 0 if unsigned is true
}

export class TEXT extends BaseTypes.TEXT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    if (this.options.length) {
      dialect.warnDataTypeIssue(
        `${dialect.name} does not support TEXT with options. Plain TEXT will be used instead.`,
      );

      this.options.length = undefined;
    }
  }
}

export class DATE extends BaseTypes.DATE {
  toSql() {
    if (this.options.precision != null) {
      return `TIMESTAMP(${this.options.precision}) WITH TIME ZONE`;
    }

    return 'TIMESTAMP WITH TIME ZONE';
  }

  validate(value: any) {
    if (value === Number.POSITIVE_INFINITY || value === Number.NEGATIVE_INFINITY) {
      // valid
      return;
    }

    super.validate(value);
  }

  toBindableValue(value: AcceptedDate): string {
    if (value === Number.POSITIVE_INFINITY) {
      return 'infinity';
    }

    if (value === Number.NEGATIVE_INFINITY) {
      return '-infinity';
    }

    return super.toBindableValue(value);
  }

  sanitize(value: unknown) {
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

    return super.sanitize(value);
  }
}

export class TINYINT extends BaseTypes.TINYINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedIntegerOptions(this, dialect);
  }

  // TODO: add >= 0 =< 2^8-1 check when the unsigned option is true
  // TODO: add >= -2^7 =< 2^7-1 check when the unsigned option is false

  toSql(): string {
    return 'SMALLINT';
  }
}

export class SMALLINT extends BaseTypes.SMALLINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedIntegerOptions(this, dialect);
  }

  // TODO: add >= 0 =< 2^16-1 check when the unsigned option is true

  toSql(): string {
    if (this.options.unsigned) {
      return 'INTEGER';
    }

    return 'SMALLINT';
  }
}

export class MEDIUMINT extends BaseTypes.MEDIUMINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedIntegerOptions(this, dialect);
  }

  // TODO: add >= 0 =< 2^24-1 check when the unsigned option is true
  // TODO: add >= -2^23 =< 2^23-1 check when the unsigned option is false

  toSql(): string {
    return 'INTEGER';
  }
}

export class INTEGER extends BaseTypes.INTEGER {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedIntegerOptions(this, dialect);
  }

  // TODO: add >= 0 =< 2^32-1 check when the unsigned option is true

  toSql(): string {
    if (this.options.unsigned) {
      return 'BIGINT';
    }

    return 'INTEGER';
  }
}

export class BIGINT extends BaseTypes.BIGINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedIntegerOptions(this, dialect);
  }
}

export class DOUBLE extends BaseTypes.DOUBLE {
  // TODO: add check constraint >= 0 if unsigned is true
}

export class FLOAT extends BaseTypes.FLOAT {
  // TODO: add check constraint >= 0 if unsigned is true

  protected getNumberSqlTypeName(): string {
    // REAL is postgres' single precision float. FLOAT(p) is an alias for either REAL of DOUBLE PRECISION based on (p).
    return 'REAL';
  }
}

export class BLOB extends BaseTypes.BLOB {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    if (this.options.length) {
      dialect.warnDataTypeIssue(
        `${dialect.name} does not support BLOB (BYTEA) with options. Plain BYTEA will be used instead.`,
      );
      this.options.length = undefined;
    }
  }

  toSql() {
    return 'BYTEA';
  }
}

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

  parse(value: string) {
    const b = Buffer.from(value, 'hex');

    return wkx.Geometry.parse(b).toGeoJSON({ shortCrs: true });
  }

  toBindableValue(value: AcceptableTypeOf<BaseTypes.GEOMETRY>): string {
    return `ST_GeomFromGeoJSON(${this._getDialect().escapeString(JSON.stringify(value))})`;
  }

  getBindParamSql(value: AcceptableTypeOf<BaseTypes.GEOMETRY>, options: BindParamOptions) {
    return `ST_GeomFromGeoJSON(${options.bindParam(value)})`;
  }
}

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

  toBindableValue(value: AcceptableTypeOf<BaseTypes.GEOGRAPHY>) {
    return `ST_GeomFromGeoJSON(${this._getDialect().escapeString(JSON.stringify(value))})`;
  }

  getBindParamSql(value: AcceptableTypeOf<BaseTypes.GEOGRAPHY>, options: BindParamOptions) {
    return `ST_GeomFromGeoJSON(${options.bindParam(value)})`;
  }
}

export class HSTORE extends BaseTypes.HSTORE {
  toBindableValue(value: AcceptableTypeOf<BaseTypes.HSTORE>): string {
    if (value == null) {
      return value;
    }

    return stringifyHstore(value);
  }
}

const defaultRangeParser = buildRangeParser(identity);

export class RANGE<
  T extends BaseTypes.BaseNumberDataType | DATE | DATEONLY = INTEGER,
> extends BaseTypes.RANGE<T> {
  toBindableValue(values: Rangable<AcceptableTypeOf<T>>): string {
    if (!Array.isArray(values)) {
      throw new TypeError('Range values must be an array');
    }

    return stringifyRange(values, rangePart => {
      let out = this.options.subtype.toBindableValue(rangePart);

      if (isNumber(out) || isBigInt(out)) {
        out = String(out);
      }

      if (!isString(out)) {
        throw new Error(
          'DataTypes.RANGE only accepts types that are represented by either strings, numbers or bigints.',
        );
      }

      return out;
    });
  }

  escape(values: Rangable<AcceptableTypeOf<T>>): string {
    const value = this.toBindableValue(values);
    const dialect = this._getDialect();

    return `${dialect.escapeString(value)}::${this.toSql()}`;
  }

  getBindParamSql(values: Rangable<AcceptableTypeOf<T>>, options: BindParamOptions): string {
    const value = this.toBindableValue(values);

    return `${options.bindParam(value)}::${this.toSql()}`;
  }

  parseDatabaseValue(value: unknown): unknown {
    // node-postgres workaround: The SQL Type-based parser is not called by node-postgres for values returned by Model.findOrCreate.
    if (typeof value === 'string') {
      value = defaultRangeParser(value);
    }

    if (!Array.isArray(value)) {
      throw new Error(
        `DataTypes.RANGE received a non-range value from the database: ${inspect(value)}`,
      );
    }

    return value.map(part => {
      return {
        ...part,
        value: this.options.subtype.parseDatabaseValue(part.value),
      };
    });
  }

  toSql() {
    const subTypeClass = this.options.subtype.constructor as typeof BaseTypes.AbstractDataType;

    return RANGE.typeMap[subTypeClass.getDataTypeId().toLowerCase()];
  }

  static typeMap: Record<string, string> = {
    integer: 'int4range',
    decimal: 'numrange',
    date: 'tstzrange',
    dateonly: 'daterange',
    bigint: 'int8range',
  };
}

export class ARRAY<T extends BaseTypes.AbstractDataType<any>> extends BaseTypes.ARRAY<T> {
  escape(values: Array<AcceptableTypeOf<T>>) {
    const type = this.options.type;

    const mappedValues = isString(type) ? values : values.map(value => type.escape(value));

    // Types that don't need to specify their cast
    const unambiguousType = type instanceof BaseTypes.TEXT || type instanceof BaseTypes.INTEGER;

    const cast =
      mappedValues.length === 0 || !unambiguousType ? `::${attributeTypeToSql(type)}[]` : '';

    return `ARRAY[${mappedValues.join(',')}]${cast}`;
  }

  getBindParamSql(values: Array<AcceptableTypeOf<T>>, options: BindParamOptions) {
    if (isString(this.options.type)) {
      return options.bindParam(values);
    }

    const subType: AbstractDataType<any> = this.options.type;

    return options.bindParam(
      values.map((value: any) => {
        return subType.toBindableValue(value);
      }),
    );
  }
}

export class ENUM<Members extends string> extends BaseTypes.ENUM<Members> {
  override toSql(): string {
    const context = this.usageContext;
    if (context == null) {
      throw new Error(
        'Could not determine the name of this enum because it is not attached to an attribute or a column.',
      );
    }

    let tableName;
    let columnName;
    if ('model' in context) {
      tableName = context.model.table;

      const attribute = context.model.getAttributes()[context.attributeName];
      columnName = attribute.field ?? context.attributeName;
    } else {
      tableName = context.tableName;
      columnName = context.columnName;
    }

    const queryGenerator = context.sequelize.dialect.queryGenerator;

    assert(
      queryGenerator instanceof PostgresQueryGenerator,
      'expected queryGenerator to be PostgresQueryGenerator',
    );

    return queryGenerator.pgEnumName(tableName, columnName);
  }
}
