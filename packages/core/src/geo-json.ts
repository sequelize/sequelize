import { isPlainObject } from '@sequelize/utils';
import util from 'node:util';
import { validator as Validator } from './utils/validator-extras.js';

export enum GeoJsonType {
  Point = 'Point',
  LineString = 'LineString',
  Polygon = 'Polygon',
  MultiPoint = 'MultiPoint',
  MultiLineString = 'MultiLineString',
  MultiPolygon = 'MultiPolygon',
  GeometryCollection = 'GeometryCollection',
}

interface BaseGeoJson<Type> {
  type: Type;
  properties?: Record<string, unknown>;
  crs?: {
    type: 'name';
    properties: {
      name: string;
    };
  };
}

export type PositionPosition = [x: number, y: number, elevation?: number];

export interface GeoJsonPoint extends BaseGeoJson<'Point'> {
  coordinates: PositionPosition | [];
}

export interface GeoJsonLineString extends BaseGeoJson<'LineString'> {
  coordinates: PositionPosition[];
}

export interface GeoJsonPolygon extends BaseGeoJson<'Polygon'> {
  coordinates: PositionPosition[][];
}

export interface GeoJsonMultiPoint extends BaseGeoJson<'MultiPoint'> {
  coordinates: PositionPosition[];
}

export interface GeoJsonMultiLineString extends BaseGeoJson<'MultiLineString'> {
  coordinates: PositionPosition[][];
}

export interface GeoJsonMultiPolygon extends BaseGeoJson<'MultiPolygon'> {
  coordinates: PositionPosition[][][];
}

export interface GeoJsonGeometryCollection extends BaseGeoJson<'GeometryCollection'> {
  geometries: GeoJson[];
}

export type GeoJson =
  | GeoJsonPoint
  | GeoJsonLineString
  | GeoJsonPolygon
  | GeoJsonMultiPoint
  | GeoJsonMultiLineString
  | GeoJsonMultiPolygon
  | GeoJsonGeometryCollection;

const geoJsonTypeArray = Object.keys(GeoJsonType);

export function assertIsGeoJson(value: unknown): asserts value is GeoJson {
  assertIsBaseGeoJson(value);

  switch (value.type) {
    case GeoJsonType.Point:
      assertIsGeoJsonPoint(value);
      break;

    case GeoJsonType.LineString:
      assertIsGeoJsonLineString(value);
      break;

    case GeoJsonType.Polygon:
      assertIsGeoJsonPolygon(value);
      break;

    case GeoJsonType.MultiPoint:
      assertIsGeoJsonMultiPoint(value);
      break;

    case GeoJsonType.MultiLineString:
      assertIsGeoJsonMultiLineString(value);
      break;

    case GeoJsonType.MultiPolygon:
      assertIsGeoJsonMultiPolygon(value);
      break;

    case GeoJsonType.GeometryCollection:
      assertIsGeoJsonGeometryCollection(value);
      break;

    default:
      throw new Error(
        `GeoJSON object ${util.inspect(value)} has an invalid or missing "type" property. Expected one of ${geoJsonTypeArray.join(', ')}`,
      );
  }
}

function validatePosition(tuple: unknown, source: GeoJson): void {
  if (!Array.isArray(tuple)) {
    throw new Error(
      `GeoJSON ${source.type} object ${util.inspect(source)} specifies an invalid position: ${util.inspect(tuple)}. Expected an array of numeric values.`,
    );
  }

  // Prevent a SQL injection attack, as coordinates are inlined in the query without escaping.
  for (const coordinate of tuple) {
    if (!Validator.isNumeric(String(coordinate))) {
      throw new Error(
        `GeoJSON ${source.type} object ${util.inspect(source)} specifies an invalid point: ${util.inspect(tuple)}. ${util.inspect(coordinate)} is not a numeric value.`,
      );
    }
  }
}

function assertIsBaseGeoJson(value: unknown): asserts value is GeoJson {
  if (!isPlainObject(value)) {
    throw new Error(
      `${util.inspect(value)} is not a valid GeoJSON object: it must be a plain object.`,
    );
  }
}

export function assertIsGeoJsonPoint(value: unknown): asserts value is GeoJsonPoint {
  assertIsBaseGeoJson(value);

  if (value.type !== 'Point') {
    throw new Error(
      `GeoJSON Point object ${util.inspect(value)} has an invalid or missing "type" property. Expected "Point".`,
    );
  }

  const coordinates = value.coordinates;
  // Some Point implementations accepts empty coordinates.
  if (Array.isArray(coordinates) && coordinates.length === 0) {
    return;
  }

  validatePosition(coordinates, value);
}

export function assertIsGeoJsonLineString(value: unknown): asserts value is GeoJsonLineString {
  assertIsBaseGeoJson(value);

  if (value.type !== 'LineString') {
    throw new Error(
      `GeoJSON LineString object ${util.inspect(value)} has an invalid or missing "type" property. Expected "LineString".`,
    );
  }

  const coordinates = value.coordinates;
  if (!Array.isArray(coordinates)) {
    throw new Error(
      `GeoJSON LineString object ${util.inspect(value)} has an invalid or missing "coordinates" property. Expected an array of positions (array of numeric values).`,
    );
  }

  for (const position of coordinates) {
    validatePosition(position, value);
  }
}

export function assertIsGeoJsonPolygon(value: unknown): asserts value is GeoJsonPolygon {
  assertIsBaseGeoJson(value);

  if (value.type !== 'Polygon') {
    throw new Error(
      `GeoJSON Polygon object ${util.inspect(value)} has an invalid or missing "type" property. Expected "Polygon".`,
    );
  }

  const coordinates = value.coordinates;
  if (!Array.isArray(coordinates)) {
    throw new Error(
      `GeoJSON Polygon object ${util.inspect(value)} has an invalid or missing "coordinates" property. Expected an array of linear ring coordinate arrays. Refer to the GeoJSON specification for more information.`,
    );
  }

  for (const ring of coordinates) {
    if (!Array.isArray(ring)) {
      throw new Error(
        `GeoJSON Polygon object ${util.inspect(value)} has an invalid or missing "coordinates" property. Expected an array of linear ring coordinate arrays. Refer to the GeoJSON specification for more information.`,
      );
    }

    for (const position of ring) {
      validatePosition(position, value);
    }
  }
}

export function assertIsGeoJsonMultiPoint(value: unknown): asserts value is GeoJsonMultiPoint {
  assertIsBaseGeoJson(value);

  if (value.type !== 'MultiPoint') {
    throw new Error(
      `GeoJSON MultiPoint object ${util.inspect(value)} has an invalid or missing "type" property. Expected "MultiPoint".`,
    );
  }

  const coordinates = value.coordinates;
  if (!Array.isArray(coordinates)) {
    throw new Error(
      `GeoJSON MultiPoint object ${util.inspect(value)} has an invalid or missing "coordinates" property. Expected an array of point coordinates.`,
    );
  }

  for (const position of coordinates) {
    validatePosition(position, value);
  }
}

export function assertIsGeoJsonMultiLineString(
  value: unknown,
): asserts value is GeoJsonMultiLineString {
  assertIsBaseGeoJson(value);

  if (value.type !== 'MultiLineString') {
    throw new Error(
      `GeoJSON MultiLineString object ${util.inspect(value)} has an invalid or missing "type" property. Expected "MultiLineString".`,
    );
  }

  const coordinates = value.coordinates;
  if (!Array.isArray(coordinates)) {
    throw new Error(
      `GeoJSON MultiLineString object ${util.inspect(value)} has an invalid or missing "coordinates" property. Expected an array of line string coordinates.`,
    );
  }

  for (const lineString of coordinates) {
    if (!Array.isArray(lineString)) {
      throw new Error(
        `GeoJSON MultiLineString object ${util.inspect(value)} has an invalid or missing "coordinates" property. Expected an array of line string coordinates.`,
      );
    }

    for (const position of lineString) {
      validatePosition(position, value);
    }
  }
}

export function assertIsGeoJsonMultiPolygon(value: unknown): asserts value is GeoJsonMultiPolygon {
  assertIsBaseGeoJson(value);

  if (value.type !== 'MultiPolygon') {
    throw new Error(
      `GeoJSON MultiPolygon object ${util.inspect(value)} has an invalid or missing "type" property. Expected "MultiPolygon".`,
    );
  }

  const coordinates = value.coordinates;
  if (!Array.isArray(coordinates)) {
    throw new Error(
      `GeoJSON MultiPolygon object ${util.inspect(value)} has an invalid or missing "coordinates" property. Expected an array of polygon coordinates.`,
    );
  }

  for (const polygon of coordinates) {
    if (!Array.isArray(polygon)) {
      throw new Error(
        `GeoJSON MultiPolygon object ${util.inspect(value)} has an invalid or missing "coordinates" property. Expected an array of polygon coordinates.`,
      );
    }

    for (const ring of polygon) {
      if (!Array.isArray(ring)) {
        throw new Error(
          `GeoJSON MultiPolygon object ${util.inspect(value)} has an invalid or missing "coordinates" property. Expected an array of polygon coordinates.`,
        );
      }

      for (const position of ring) {
        validatePosition(position, value);
      }
    }
  }
}

export function assertIsGeoJsonGeometryCollection(
  value: unknown,
): asserts value is GeoJsonGeometryCollection {
  assertIsBaseGeoJson(value);

  if (value.type !== 'GeometryCollection') {
    throw new Error(
      `GeoJSON GeometryCollection object ${util.inspect(value)} has an invalid or missing "type" property. Expected "GeometryCollection".`,
    );
  }

  const geometries = value.geometries;
  if (!Array.isArray(geometries)) {
    throw new Error(
      `GeoJSON GeometryCollection object ${util.inspect(value)} has an invalid or missing "geometries" property. Expected an array of GeoJSON geometry objects.`,
    );
  }

  for (const geometry of geometries) {
    assertIsGeoJson(geometry);
  }
}
