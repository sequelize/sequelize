import type { GeoJsonPoint } from '@sequelize/core';
import { DataTypes, GeoJsonType } from '@sequelize/core';
import { expect } from 'chai';
import { expectsql, sequelize } from '../../support';
import { testDataTypeSql } from './_utils';

const dialectName = sequelize.dialect.name;

// TODO: extend suite to cover all data sub-types, like in geometry.test.ts
describe('GEOGRAPHY', () => {
  testDataTypeSql('GEOGRAPHY', DataTypes.GEOGRAPHY, {
    default: new Error(
      `${dialectName} does not support the GEOGRAPHY data type.\nSee https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`,
    ),
    postgres: 'GEOGRAPHY',
  });
});

describe('GEOGRAPHY values (postgres)', () => {
  if (dialectName !== 'postgres') {
    return;
  }

  const point: GeoJsonPoint = {
    type: 'Point',
    coordinates: [100, 39.5],
    crs: { type: 'name', properties: { name: 'EPSG:4326' } },
  };

  for (const type of [DataTypes.GEOGRAPHY, DataTypes.GEOGRAPHY(GeoJsonType.Point, 4326)]) {
    const normalizedType = sequelize.normalizeDataType(type);

    describe(normalizedType.toSql(), () => {
      it('escapes values as a function call', () => {
        expectsql(normalizedType.escape(point), {
          postgres: `ST_GeomFromGeoJSON('{"type":"Point","coordinates":[100,39.5],"crs":{"type":"name","properties":{"name":"EPSG:4326"}}}')`,
        });
      });

      it('binds the GeoJSON value', () => {
        const bind: unknown[] = [];
        const sql = normalizedType.getBindParamSql(point, {
          bindParam(param) {
            bind.push(param);

            return `$${bind.length}`;
          },
        });

        expect(sql).to.eq('ST_GeomFromGeoJSON($1)');
        expect(bind).to.deep.eq([point]);
      });
    });
  }
});
