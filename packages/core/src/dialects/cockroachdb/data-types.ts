import { format } from 'node:util';
import { ValidationError } from '../../errors';
import type { GeoJson } from '../../geo-json';
import type { BindParamOptions, AbstractDataType, AcceptableTypeOf, StringifyOptions } from '../abstract/data-types';
import { ARRAY as AbstractArray } from '../abstract/data-types';
import { INTEGER as PostgresInteger, BIGINT as PostgresBigint, GEOGRAPHY as PostgresGeography } from '../postgres/data-types';

export class INTEGER extends PostgresInteger {
  $stringify(value: string): string {
    const rep = String(value);
    if (!/^[-+]?[0-9]+$/.test(rep)) {
      throw new ValidationError(
        format('%j is not a valid integer', value),
      );
    }

    return rep;
  }
}

export class BIGINT extends PostgresBigint {
  $stringify(value: string): string {
    const rep = String(value);
    if (!/^[-+]?[0-9]+$/.test(rep)) {
      throw new ValidationError(
        format('%j is not a valid integer', value),
      );
    }

    return rep;
  }
}

export class GEOGRPAHY extends PostgresGeography {
  getBindParamSql(value: GeoJson, options: BindParamOptions): string {
    return `ST_GeomFromGeoJSON(${options.bindParam(value)}::json)::geography`;
  }
}

export class ARRAY<T extends AbstractDataType<any>> extends AbstractArray<T> {
  escape(
    values: Array<AcceptableTypeOf<T>>,
    options: StringifyOptions,
  ) {
    const type = this.options.type;

    return `ARRAY[${values.map((value: any) => {
      return type.escape(value, options);
    }).join(',')}]::${type.toSql(options)}[]`;
  }

  getBindParamSql(
    values: Array<AcceptableTypeOf<T>>,
    options: BindParamOptions,
  ) {
    return options.bindParam(values.map((value: any) => {
      return this.options.type.toBindableValue(value, options);
    }));
  }
}
