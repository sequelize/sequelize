import { DataTypes, GeoJsonType } from '@sequelize/core';
import { sequelize } from '../../support';
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
