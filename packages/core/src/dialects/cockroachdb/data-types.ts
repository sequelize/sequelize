import { ValidationErrorItem } from '../../errors';
import type { GeoJson } from '../../geo-json';
import { isString } from '../../utils/check';
import type { AbstractDataType, AcceptableTypeOf, ArrayOptions, BindParamOptions, DataType } from '../abstract/data-types';
import * as BaseTypes from '../abstract/data-types';
import { attributeTypeToSql } from '../abstract/data-types-utils';
import { ARRAY as PostgresArray, GEOGRAPHY as PostgresGeography, INTEGER as PostgresInteger } from '../postgres/data-types';

export class INTEGER extends PostgresInteger {
  sanitize(value: number): unknown {
    if (value > Number.MAX_SAFE_INTEGER) {
      return String(value);
    }

    return value;
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
export class ARRAY<T extends BaseTypes.AbstractDataType<any>> extends PostgresArray<T> {
  constructor(typeOrOptions: DataType | ArrayOptions) {
    super(typeOrOptions);

    if (this.options.type instanceof ARRAY) {
      ValidationErrorItem.throwDataTypeValidationError('Cockroachdb does not support nested arrays');
    }
  }

  escape(values: Array<AcceptableTypeOf<T>>) {
    const type = this.options.type;

    const mappedValues = isString(type) ? values : values.map(value => type.escape(value));

    // Types that don't need to specify their cast
    const unambiguousType = type instanceof BaseTypes.TEXT
      || type instanceof BaseTypes.INTEGER;

    const cast = mappedValues.length === 0 || !unambiguousType ? `::${attributeTypeToSql(type)}[]` : '';

    return `ARRAY[${mappedValues.join(',')}]${cast}`;
  }

  getBindParamSql(
    values: Array<AcceptableTypeOf<T>>,
    options: BindParamOptions,
  ) {
    if (isString(this.options.type)) {
      return options.bindParam(values);
    }

    const subType: AbstractDataType<any> = this.options.type;

    return options.bindParam(values.map((value: any) => {
      return subType.toBindableValue(value);
    }));
  }
}

export {
  BIGINT,
  DECIMAL,
  MEDIUMINT,
  SMALLINT,
  TINYINT,
  GEOMETRY,
  TEXT,
  DATE,
  ENUM,
  BLOB,
} from '../postgres/data-types';

export { JSONB } from '../abstract/data-types';
