import assert from 'node:assert';
import { format } from 'node:util';
import { ValidationErrorItem } from '../../errors';
import type { GeoJson } from '../../geo-json';
import type { AbstractDialect } from '../abstract';
import * as BaseTypes from '../abstract/data-types';
import { GEOGRAPHY as PostgresGeography, ARRAY as PostgresArray } from '../postgres/data-types';
import { CockroachDbQueryGenerator } from './query-generator';

function removeUnsupportedIntegerOptions(dataType: BaseTypes.BaseIntegerDataType, dialect: AbstractDialect) {
  if (dataType.options.length != null) {
    // this option only makes sense for zerofill
    dialect.warnDataTypeIssue(`${dialect.name} does not support ${dataType.getDataTypeId()} with length specified. This options is ignored.`);

    delete dataType.options.length;
  }
}

export class TINYINT extends BaseTypes.TINYINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedIntegerOptions(this, dialect);
  }

  toSql(): string {
    return 'SMALLINT';
  }
}

export class INTEGER extends BaseTypes.INTEGER {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedIntegerOptions(this, dialect);
  }

  toSql(): string {
    if (this.options.unsigned) {
      return 'BIGINT';
    }

    return 'INTEGER';
  }

  sanitize(value: number): unknown {
    if (value > Number.MAX_SAFE_INTEGER) {
      return String(value);
    }

    return value;
  }
}

export class SMALLINT extends BaseTypes.SMALLINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedIntegerOptions(this, dialect);
  }

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

  toSql(): string {
    return 'INTEGER';
  }
}

export class BIGINT extends BaseTypes.BIGINT {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    removeUnsupportedIntegerOptions(this, dialect);
  }

  $stringify(value: string): string {
    const rep = String(value);
    if (!/^[-+]?[0-9]+$/.test(rep)) {
      ValidationErrorItem.throwDataTypeValidationError(format('%j is not a valid integer', value));
    }

    return rep;
  }
}

export class GEOGRPAHY extends PostgresGeography {
  getBindParamSql(value: GeoJson, options: BaseTypes.BindParamOptions): string {
    return `ST_GeomFromGeoJSON(${options.bindParam(value)}::json)::geography`;
  }
}

export class FLOAT extends BaseTypes.FLOAT {
  protected getNumberSqlTypeName(): string {
    return 'FLOAT';
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

  toBindableValue(value: BaseTypes.AcceptableTypeOf<BaseTypes.GEOMETRY>, options: BaseTypes.StringifyOptions): string {
    return `ST_GeomFromGeoJSON(${options.dialect.escapeString(JSON.stringify(value))})`;
  }

  getBindParamSql(value: BaseTypes.AcceptableTypeOf<BaseTypes.GEOMETRY>, options: BaseTypes.BindParamOptions) {
    return `ST_GeomFromGeoJSON(${options.bindParam(value)})`;
  }
}

export class JSONB extends BaseTypes.JSONB {}

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
    if (value === Number.POSITIVE_INFINITY
      || value === Number.NEGATIVE_INFINITY) {
      // Invalid
      ValidationErrorItem.throwDataTypeValidationError(`CockroachDB does not support negative and positive infitnity values in date`);
    }

    super.validate(value);
  }

  toBindableValue(
    value: BaseTypes.AcceptedDate,
    options: BaseTypes.StringifyOptions,
  ): string {
    if (value === Number.POSITIVE_INFINITY) {
      return '294276-12-31 23:59:59.999999+00:00';
    }

    if (value === Number.NEGATIVE_INFINITY) {
      return '-4713-11-24 00:00:00+00:00';
    }

    return super.toBindableValue(value, options);
  }

  sanitize(value: unknown) {
    if (value == null) {
      return value;
    }

    if (value instanceof Date) {
      return value;
    }

    // if (typeof value === 'string') {
    //   const lower = value.toLowerCase();
    //   if (lower === 'infinity') {
    //     return '294276-12-31 23:59:59.999999+00:00';
    //   }

    //   if (lower === '-infinity') {
    //     return '-4713-11-24 00:00:00+00:00';
    //   }
    // }

    return super.sanitize(value);
  }
}

export class ARRAY<T extends BaseTypes.AbstractDataType<any>> extends PostgresArray<T> {}

export class DECIMAL extends BaseTypes.DECIMAL {
  // TODO: add check constraint >= 0 if unsigned is true
}

export class ENUM<Members extends string> extends BaseTypes.ENUM<Members> {
  // toSql(options: BaseTypes.ToSqlOptions): string {
  //  return `ENUM(${this.options.values.map(value => options.dialect.escapeString(value)).join(', ')})`;
  // }
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

    assert(queryGenerator instanceof CockroachDbQueryGenerator, 'expected queryGenerator to be PostgresQueryGenerator');

    return queryGenerator.pgEnumName(tableName, columnName);
  }
}

export class BLOB extends BaseTypes.BLOB {
  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    if (this.options.length) {
      dialect.warnDataTypeIssue(
        `${dialect.name} does not support BLOB (BYTES) with options. Plain BYTES will be used instead.`,
      );
      this.options.length = undefined;
    }
  }

  toSql() {
    return 'BYTES';
  }
}
