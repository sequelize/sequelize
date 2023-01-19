import { format } from 'node:util';
import { ValidationError } from 'src/errors';
import type { GeoJson } from 'src/geo-json';
import type { BindParamOptions } from '../abstract/data-types';
import { INTEGER, BIGINT, GEOGRAPHY } from '../postgres/data-types';

class CockroachDbInteger extends INTEGER {
  escape(): string {
    throw new Error('CockroachDb has disabled escaping so that the returned string is not wrapped in quotes');
  }

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

class CockroachDbBigInt extends BIGINT {
  escape(): string {
    throw new Error('CockroachDb has disabled escaping so that the returned string is not wrapped in quotes');
  }

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

class CockroachDbGeography extends GEOGRAPHY {
  getBindParamSql(value: GeoJson, options: BindParamOptions): string {
    return `ST_GeomFromGeoJSON(${options.bindParam(value)}::json)::geography`;
  }
}

module.exports = { INTEGER: CockroachDbInteger, BIGINT: CockroachDbBigInt, GEOGRAPHY: CockroachDbGeography };

