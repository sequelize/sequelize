import type { DataTypeInstance, GeoJsonPoint } from '@sequelize/core';
import { DataTypes, GeoJsonType } from '@sequelize/core';
import { expect } from 'chai';
import { expectsql, sequelize } from '../../support';
import { testDataTypeSql } from './_utils';

const dialect = sequelize.dialect;

describe('GEOMETRY', () => {
  const unsupportedError = new Error(
    `${dialect.name} does not support the GEOMETRY data type.\nSee https://sequelize.org/docs/v7/models/data-types/ for a list of supported data types.`,
  );
  testDataTypeSql('GEOMETRY', DataTypes.GEOMETRY, {
    default: unsupportedError,
    'postgres mysql mariadb': 'GEOMETRY',
  });

  testDataTypeSql(`GEOMETRY('POINT')`, DataTypes.GEOMETRY(GeoJsonType.Point), {
    default: unsupportedError,
    postgres: 'GEOMETRY(POINT)',
    'mysql mariadb': 'POINT',
  });

  testDataTypeSql(`GEOMETRY('LINESTRING')`, DataTypes.GEOMETRY(GeoJsonType.LineString), {
    default: unsupportedError,
    postgres: 'GEOMETRY(LINESTRING)',
    'mysql mariadb': 'LINESTRING',
  });

  testDataTypeSql(`GEOMETRY('POLYGON')`, DataTypes.GEOMETRY(GeoJsonType.Polygon), {
    default: unsupportedError,
    postgres: 'GEOMETRY(POLYGON)',
    'mysql mariadb': 'POLYGON',
  });

  testDataTypeSql(`GEOMETRY('POINT',4326)`, DataTypes.GEOMETRY(GeoJsonType.Point, 4326), {
    default: unsupportedError,
    postgres: 'GEOMETRY(POINT,4326)',
    mysql: 'POINT /*!80003 SRID 4326 */',
    mariadb: 'POINT REF_SYSTEM_ID=4326',
  });
});

describe('GEOMETRY values', () => {
  if (!['mysql', 'mariadb'].includes(dialect.name)) {
    return;
  }

  const point: GeoJsonPoint = { type: 'Point', coordinates: [100, 39.5] };
  const pointWithCrs: GeoJsonPoint = {
    ...point,
    crs: { type: 'name', properties: { name: 'EPSG:4326' } },
  };

  function getBindParamSql(type: DataTypeInstance, value: GeoJsonPoint) {
    const bind: unknown[] = [];
    const sql = type.getBindParamSql(value, {
      bindParam(param) {
        bind.push(param);

        return `$${bind.length}`;
      },
    });

    return { sql, bind };
  }

  const geometry = sequelize.normalizeDataType(DataTypes.GEOMETRY);
  const geometryWithSrid = sequelize.normalizeDataType(DataTypes.GEOMETRY(GeoJsonType.Point, 3857));

  it('does not specify an SRID if neither the value nor the column has one', () => {
    expectsql(geometry.escape(point), {
      default: `ST_GeomFromText('POINT(100 39.5)')`,
    });

    expect(getBindParamSql(geometry, point)).to.deep.eq({
      sql: 'ST_GeomFromText($1)',
      bind: ['POINT(100 39.5)'],
    });
  });

  it('uses the SRID of the crs field, in longitude-latitude order', () => {
    expectsql(geometry.escape(pointWithCrs), {
      mysql: `ST_GeomFromText('POINT(100 39.5)', 4326, 'axis-order=long-lat')`,
      mariadb: `ST_GeomFromText('POINT(100 39.5)', 4326)`,
    });

    expect(getBindParamSql(geometry, pointWithCrs)).to.deep.eq({
      sql:
        dialect.name === 'mysql'
          ? `ST_GeomFromText($1, $2, 'axis-order=long-lat')`
          : 'ST_GeomFromText($1, $2)',
      bind: ['POINT(100 39.5)', 4326],
    });
  });

  it('uses the SRID of the column if the value does not have a crs field', () => {
    expectsql(geometryWithSrid.escape(point), {
      mysql: `ST_GeomFromText('POINT(100 39.5)', 3857, 'axis-order=long-lat')`,
      mariadb: `ST_GeomFromText('POINT(100 39.5)', 3857)`,
    });
  });

  it('prioritizes the SRID of the crs field over the SRID of the column', () => {
    expectsql(geometryWithSrid.escape(pointWithCrs), {
      mysql: `ST_GeomFromText('POINT(100 39.5)', 4326, 'axis-order=long-lat')`,
      mariadb: `ST_GeomFromText('POINT(100 39.5)', 4326)`,
    });
  });

  it('accepts crs fields that use the URN notation', () => {
    expectsql(
      geometry.escape({
        ...point,
        crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::4326' } },
      }),
      {
        mysql: `ST_GeomFromText('POINT(100 39.5)', 4326, 'axis-order=long-lat')`,
        mariadb: `ST_GeomFromText('POINT(100 39.5)', 4326)`,
      },
    );
  });

  for (const name of ['EPSG:invalid', 'EPSG:4326invalid', 'urn:ogc:def:crs:EPSG::4326.5']) {
    it(`rejects crs fields with an invalid SRID (${name})`, () => {
      expect(() =>
        geometry.escape({
          ...point,
          crs: { type: 'name', properties: { name } },
        }),
      ).to.throw(`Invalid SRID in GeoJSON crs: ${name}`);
    });
  }
});

describe('GEOMETRY values (postgres)', () => {
  if (dialect.name !== 'postgres') {
    return;
  }

  const point: GeoJsonPoint = { type: 'Point', coordinates: [100, 39.5] };
  const pointWithCrs: GeoJsonPoint = {
    ...point,
    crs: { type: 'name', properties: { name: 'EPSG:4326' } },
  };

  for (const type of [DataTypes.GEOMETRY, DataTypes.GEOMETRY(GeoJsonType.Point, 3857)]) {
    const normalizedType = sequelize.normalizeDataType(type);

    describe(normalizedType.toSql(), () => {
      it('escapes values as a function call', () => {
        expectsql(normalizedType.escape(point), {
          postgres: `ST_GeomFromGeoJSON('{"type":"Point","coordinates":[100,39.5]}')`,
        });
      });

      it('keeps the crs field, which determines the SRID', () => {
        expectsql(normalizedType.escape(pointWithCrs), {
          postgres: `ST_GeomFromGeoJSON('{"type":"Point","coordinates":[100,39.5],"crs":{"type":"name","properties":{"name":"EPSG:4326"}}}')`,
        });
      });

      it('escapes single quotes', () => {
        expectsql(
          normalizedType.escape({ ...point, properties: { exploit: "'); DELETE YOLO; --" } }),
          {
            postgres: `ST_GeomFromGeoJSON('{"type":"Point","coordinates":[100,39.5],"properties":{"exploit":"''); DELETE YOLO; --"}}')`,
          },
        );
      });

      it('binds the GeoJSON value', () => {
        const bind: unknown[] = [];
        const sql = normalizedType.getBindParamSql(pointWithCrs, {
          bindParam(param) {
            bind.push(param);

            return `$${bind.length}`;
          },
        });

        expect(sql).to.eq('ST_GeomFromGeoJSON($1)');
        expect(bind).to.deep.eq([pointWithCrs]);
      });
    });
  }
});
