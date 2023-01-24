import { format } from 'node:util';
import { ValidationError } from '../../errors';
import type { GeoJson } from '../../geo-json';
import type { BindParamOptions } from '../abstract/data-types';
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

