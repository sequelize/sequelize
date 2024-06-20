import type {
  CreationOptional,
  GeoJson,
  GeoJsonGeometryCollection,
  GeoJsonLineString,
  GeoJsonMultiLineString,
  GeoJsonMultiPoint,
  GeoJsonMultiPolygon,
  GeoJsonPoint,
  GeoJsonPolygon,
  InferAttributes,
  InferCreationAttributes,
} from '@sequelize/core';
import { DataTypes, GeoJsonType, Model, QueryTypes } from '@sequelize/core';
import { expect } from 'chai';
import { beforeEach2, getTestDialectTeaser, sequelize } from '../support';

const dialect = sequelize.dialect;

async function createUserModelWithGeometry(type?: GeoJsonType) {
  class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
    declare id: CreationOptional<number>;
    declare geometry: GeoJson | null;
  }

  User.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      geometry: type ? DataTypes.GEOMETRY(type) : DataTypes.GEOMETRY,
    },
    { sequelize, timestamps: false },
  );

  await User.sync({ force: true });

  return User;
}

describe(getTestDialectTeaser('DataTypes'), () => {
  if (!sequelize.dialect.supports.dataTypes.GEOMETRY) {
    return;
  }

  describe('GEOMETRY', () => {
    const vars = beforeEach2(async () => {
      return { User: await createUserModelWithGeometry() };
    });

    it('supports inserting/updating a geometry object', async () => {
      const User = vars.User;
      const point1: GeoJsonPoint = { type: 'Point', coordinates: [39.807_222, -76.984_722] };
      const point2: GeoJsonPoint = { type: 'Point', coordinates: [49.807_222, -86.984_722] };
      const user1 = await User.create({ geometry: point1 });
      await User.update({ geometry: point2 }, { where: { id: user1.id } });
      const user2 = await User.findOne({ rejectOnEmpty: true });
      expect(user2.geometry).to.deep.include(point2);
    });

    it('works with crs field', async () => {
      const User = vars.User;

      const point: GeoJsonPoint = {
        type: 'Point',
        coordinates: [39.807_222, -76.984_722],
        crs: {
          type: 'name',
          properties: {
            name: 'EPSG:4326',
          },
        },
      };

      const pub = await User.create({ geometry: point });
      expect(pub).not.to.be.null;
      expect(pub.geometry).to.deep.eq(point);
    });

    it('correctly parses null GEOMETRY field', async () => {
      await vars.User.create({
        geometry: null,
      });

      const user = await vars.User.findOne({ rejectOnEmpty: true });
      expect(user.geometry).to.eq(null);
    });

    // TODO: fix this test, see https://github.com/sequelize/sequelize/pull/15249#discussion_r1015617763
    it.skip('correctly parses an empty GEOMETRY field', async () => {
      const User = vars.User;
      const point: GeoJsonPoint = { type: 'Point', coordinates: [] };
      await User.create({
        // insert a empty GEOMETRY type
        geometry: point,
      });

      const user = await User.findOne({ rejectOnEmpty: true });
      if (['mysql', 'mariadb'].includes(dialect.name)) {
        // MySQL will return NULL, because they lack EMPTY geometry data support.
        expect(user.geometry).to.be.eql(null);
      } else if (dialect.name === 'postgres') {
        // Empty Geometry data [0,0] as per https://trac.osgeo.org/postgis/ticket/1996
        expect(user.geometry).to.deep.eq({ type: 'Point', coordinates: [0, 0] });
      } else {
        expect(user.geometry).to.deep.eq(point);
      }
    });
  });

  describe('GEOMETRY(POINT)', () => {
    const vars = beforeEach2(async () => {
      return { User: await createUserModelWithGeometry(GeoJsonType.Point) };
    });

    it('supports inserting/updating a Point object', async () => {
      const User = vars.User;
      const point: GeoJsonPoint = { type: 'Point', coordinates: [39.807_222, -76.984_722] };

      const newUser = await User.create({ geometry: point });
      expect(newUser.geometry).to.deep.include(point);
    });

    it('works with crs field', async () => {
      const User = vars.User;
      const point: GeoJsonPoint = {
        type: 'Point',
        coordinates: [39.807_222, -76.984_722],
        crs: {
          type: 'name',
          properties: {
            name: 'EPSG:4326',
          },
        },
      };

      const newUser = await User.create({ geometry: point });
      expect(newUser).not.to.be.null;
      expect(newUser.geometry).to.deep.eq(point);
    });

    // TODO: this is not possible until we support specifying the type of a bind parameter
    //  https://github.com/sequelize/sequelize/issues/14410
    it.skip('should bind properly with sequelize.query', async () => {
      const User = vars.User;
      const point: GeoJsonPoint = { type: 'Point', coordinates: [39.807_222, -76.984_722] };

      await sequelize.query(
        `INSERT INTO ${dialect.queryGenerator.quoteTable(User.table)}(geometry) VALUES(ST_GeomFromText($geometry))`,
        {
          bind: { geometry: point },
          type: QueryTypes.INSERT,
        },
      );

      // TODO: check inserted value
    });

    it('is not a vector of SQL injection', async () => {
      // Should work and be properly escaped
      await vars.User.create({
        geometry: {
          type: 'Point',
          properties: {
            exploit: "'); DELETE YOLO INJECTIONS; -- ",
          },
          coordinates: [0, 0],
        },
      });

      await expect(
        vars.User.create({
          geometry: {
            type: 'Point',
            // @ts-expect-error -- coordinates must be number, but we're still testing against string to be safe
            coordinates: [39.807_222, "'); DELETE YOLO INJECTIONS; --"],
          },
        }),
      ).to.be.rejectedWith('specifies an invalid point');
    });
  });

  describe('GEOMETRY(LINESTRING)', () => {
    const vars = beforeEach2(async () => {
      return { User: await createUserModelWithGeometry(GeoJsonType.LineString) };
    });

    it('supports creating/updating a LineString object', async () => {
      const User = vars.User;
      const point1: GeoJsonLineString = {
        type: 'LineString',
        coordinates: [
          [100, 0],
          [101, 1],
        ],
      };
      const point2: GeoJsonLineString = {
        type: 'LineString',
        coordinates: [
          [101, 0],
          [102, 1],
        ],
      };

      const user1 = await User.create({ geometry: point1 });
      await User.update({ geometry: point2 }, { where: { id: user1.id } });
      const user = await User.findOne({ where: { id: user1.id }, rejectOnEmpty: true });
      expect(user.geometry).to.deep.include(point2);
    });

    it('works with crs field', async () => {
      const User = vars.User;
      const point: GeoJsonLineString = {
        type: 'LineString',
        coordinates: [
          [100, 0],
          [101, 1],
        ],
        crs: {
          type: 'name',
          properties: {
            name: 'EPSG:4326',
          },
        },
      };

      const newUser = await User.create({ geometry: point });
      expect(newUser.geometry).to.deep.eq(point);
    });

    it('is not a vector of SQL injection', async () => {
      // Should work and be properly escaped
      await vars.User.create({
        geometry: {
          type: 'LineString',
          properties: {
            exploit: "'); DELETE YOLO INJECTIONS; -- ",
          },
          coordinates: [
            [0, 0],
            [0, 0],
          ],
        },
      });

      await expect(
        vars.User.create({
          geometry: {
            type: 'LineString',
            coordinates: [
              // @ts-expect-error -- coordinates must be number, but we're still testing against string to be safe
              [39.807_222, "'); DELETE YOLO INJECTIONS; --"],
              [0, 0],
            ],
          },
        }),
      ).to.be.rejectedWith('specifies an invalid point');
    });
  });

  describe('GEOMETRY(POLYGON)', () => {
    const vars = beforeEach2(async () => {
      return { User: await createUserModelWithGeometry(GeoJsonType.Polygon) };
    });

    it('supports inserting/updating a Polygon object', async () => {
      const User = vars.User;
      const polygon1: GeoJsonPolygon = {
        type: 'Polygon',
        coordinates: [
          [
            [100, 0],
            [101, 0],
            [101, 1],
            [100, 1],
            [100, 0],
          ],
        ],
      };
      const polygon2: GeoJsonPolygon = {
        type: 'Polygon',
        coordinates: [
          [
            [100, 0],
            [102, 0],
            [102, 1],
            [100, 1],
            [100, 0],
          ],
        ],
      };

      const user1 = await User.create({ geometry: polygon1 });
      await User.update({ geometry: polygon2 }, { where: { id: user1.id } });
      const user = await User.findOne({ where: { id: user1.id }, rejectOnEmpty: true });
      expect(user.geometry).to.deep.include(polygon2);
    });

    it('works with crs field', async () => {
      const User = vars.User;
      const point: GeoJsonPolygon = {
        type: 'Polygon',
        coordinates: [
          [
            [100, 0],
            [101, 0],
            [101, 1],
            [100, 1],
            [100, 0],
          ],
        ],
        crs: {
          type: 'name',
          properties: {
            name: 'EPSG:4326',
          },
        },
      };

      const newUser = await User.create({ geometry: point });
      expect(newUser.geometry).to.deep.eq(point);
    });

    it('is not a vector of SQL injection', async () => {
      // Should work and be properly escaped
      await vars.User.create({
        geometry: {
          type: 'Polygon',
          properties: {
            exploit: "'); DELETE YOLO INJECTIONS; -- ",
          },
          coordinates: [
            [
              [100, 0],
              [101, 0],
              [101, 1],
              [100, 1],
              [100, 0],
            ],
          ],
        },
      });

      await expect(
        vars.User.create({
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                // @ts-expect-error -- coordinates must be number, but we're still testing against string to be safe
                [39.807_222, "'); DELETE YOLO INJECTIONS; --"],
                [0, 0],
              ],
            ],
          },
        }),
      ).to.be.rejectedWith('specifies an invalid point');
    });
  });

  describe('GEOMETRY(MULTIPOINT)', () => {
    const vars = beforeEach2(async () => {
      return { User: await createUserModelWithGeometry(GeoJsonType.MultiPoint) };
    });

    it('supports inserting/updating a MultiPoint object', async () => {
      const User = vars.User;
      const point1: GeoJsonMultiPoint = {
        type: 'MultiPoint',
        coordinates: [
          [100, 0],
          [101, 1],
        ],
      };
      const point2: GeoJsonMultiPoint = {
        type: 'MultiPoint',
        coordinates: [
          [100, 0],
          [102, 1],
        ],
      };

      const user1 = await User.create({ geometry: point1 });
      await User.update({ geometry: point2 }, { where: { id: user1.id } });
      const user = await User.findOne({ where: { id: user1.id }, rejectOnEmpty: true });
      expect(user.geometry).to.deep.include(point2);
    });

    it('works with crs field', async () => {
      const User = vars.User;
      const point: GeoJsonMultiPoint = {
        type: 'MultiPoint',
        coordinates: [
          [100, 0],
          [101, 1],
        ],
        crs: {
          type: 'name',
          properties: {
            name: 'EPSG:4326',
          },
        },
      };

      const newUser = await User.create({ geometry: point });
      expect(newUser.geometry).to.deep.eq(point);
    });

    it('is not a vector of SQL injection', async () => {
      // Should work and be properly escaped
      await vars.User.create({
        geometry: {
          type: 'MultiPoint',
          properties: {
            exploit: "'); DELETE YOLO INJECTIONS; -- ",
          },
          coordinates: [
            [100, 0],
            [101, 1],
          ],
        },
      });

      await expect(
        vars.User.create({
          geometry: {
            type: 'MultiPoint',
            coordinates: [
              // @ts-expect-error -- coordinates must be number, but we're still testing against string to be safe
              [100, "'); DELETE YOLO INJECTIONS; --"],
              [0, 0],
            ],
          },
        }),
      ).to.be.rejectedWith('specifies an invalid point');
    });
  });

  describe('GEOMETRY(MULTILINESTRING)', () => {
    const vars = beforeEach2(async () => {
      return { User: await createUserModelWithGeometry(GeoJsonType.MultiLineString) };
    });

    it('supports inserting/updating a MultiLineString object', async () => {
      const User = vars.User;
      const line1: GeoJsonMultiLineString = {
        type: 'MultiLineString',
        coordinates: [
          [
            [100, 0],
            [101, 1],
          ],
          [
            [102, 2],
            [103, 3],
          ],
        ],
      };
      const line2: GeoJsonMultiLineString = {
        type: 'MultiLineString',
        coordinates: [
          [
            [100, 0],
            [101, 1],
          ],
          [
            [102, 2],
            [104, 3],
          ],
        ],
      };

      const user1 = await User.create({ geometry: line1 });
      await User.update({ geometry: line2 }, { where: { id: user1.id } });
      const user = await User.findOne({ where: { id: user1.id }, rejectOnEmpty: true });
      expect(user.geometry).to.deep.include(line2);
    });

    it('works with crs field', async () => {
      const User = vars.User;
      const line: GeoJsonMultiLineString = {
        type: 'MultiLineString',
        coordinates: [
          [
            [100, 0],
            [101, 1],
          ],
          [
            [102, 2],
            [103, 3],
          ],
        ],
        crs: {
          type: 'name',
          properties: {
            name: 'EPSG:4326',
          },
        },
      };

      const newUser = await User.create({ geometry: line });
      expect(newUser.geometry).to.deep.eq(line);
    });

    it('is not a vector of SQL injection', async () => {
      // Should work and be properly escaped
      await vars.User.create({
        geometry: {
          type: 'MultiLineString',
          properties: {
            exploit: "'); DELETE YOLO INJECTIONS; -- ",
          },
          coordinates: [
            [
              [100, 0],
              [101, 1],
            ],
            [
              [102, 2],
              [103, 3],
            ],
          ],
        },
      });

      await expect(
        vars.User.create({
          geometry: {
            type: 'MultiLineString',
            coordinates: [
              [
                // @ts-expect-error -- coordinates must be number, but we're still testing against string to be safe
                [100, "'); DELETE YOLO INJECTIONS; --"],
                [101, 1],
              ],
              [
                [102, 2],
                [103, 3],
              ],
            ],
          },
        }),
      ).to.be.rejectedWith('specifies an invalid point');
    });
  });

  describe('GEOMETRY(MULTIPOLYGON)', () => {
    const vars = beforeEach2(async () => {
      return { User: await createUserModelWithGeometry(GeoJsonType.MultiPolygon) };
    });

    it('supports inserting/updating a MultiPolygon object', async () => {
      const User = vars.User;
      const polygon1: GeoJsonMultiPolygon = {
        type: 'MultiPolygon',
        coordinates: [
          // first polygon
          [
            // first linear ring of first polygon
            [
              [102, 2],
              [103, 2],
              [103, 3],
              [102, 3],
              [102, 2],
            ],
          ],
        ],
      };
      const polygon2: GeoJsonMultiPolygon = {
        type: 'MultiPolygon',
        coordinates: [
          // first polygon
          [
            // first linear ring of first polygon
            [
              [102, 2],
              [103, 2],
              [103, 3],
              [102, 3],
              [102, 2],
            ],
          ],
        ],
      };

      const user1 = await User.create({ geometry: polygon1 });
      await User.update({ geometry: polygon2 }, { where: { id: user1.id } });
      const user = await User.findOne({ where: { id: user1.id }, rejectOnEmpty: true });
      expect(user.geometry).to.deep.include(polygon2);
    });

    it('works with crs field', async () => {
      const User = vars.User;
      const polygon: GeoJsonMultiPolygon = {
        type: 'MultiPolygon',
        coordinates: [
          // first polygon
          [
            // first linear ring of first polygon
            [
              [102, 2],
              [103, 2],
              [103, 3],
              [102, 3],
              [102, 2],
            ],
          ],
        ],
        crs: {
          type: 'name',
          properties: {
            name: 'EPSG:4326',
          },
        },
      };

      const newUser = await User.create({ geometry: polygon });
      expect(newUser.geometry).to.deep.eq(polygon);
    });

    it('is not a vector of SQL injection', async () => {
      // Should work and be properly escaped
      await vars.User.create({
        geometry: {
          type: 'MultiPolygon',
          properties: {
            exploit: "'); DELETE YOLO INJECTIONS; -- ",
          },
          coordinates: [
            // first polygon
            [
              // first linear ring of first polygon
              [
                [102, 2],
                [103, 2],
                [103, 3],
                [102, 3],
                [102, 2],
              ],
            ],
          ],
        },
      });

      await expect(
        vars.User.create({
          geometry: {
            type: 'MultiPolygon',
            coordinates: [
              // first polygon
              [
                // first linear ring of first polygon
                [
                  [102, 2],
                  [103, 2],
                  // @ts-expect-error -- coordinates must be number, but we're still testing against string to be safe
                  ["'); DELETE YOLO INJECTIONS; --", 3],
                  [102, 3],
                  [102, 2],
                ],
              ],
            ],
          },
        }),
      ).to.be.rejectedWith('specifies an invalid point');
    });
  });

  describe('GEOMETRY(GEOMETRYCOLLECTION)', () => {
    const vars = beforeEach2(async () => {
      return { User: await createUserModelWithGeometry(GeoJsonType.GeometryCollection) };
    });

    it('supports inserting/updating a GeometryCollection object', async () => {
      const User = vars.User;
      const geometry1: GeoJsonGeometryCollection = {
        type: 'GeometryCollection',
        geometries: [
          {
            type: 'Point',
            coordinates: [100, 0],
          },
          {
            type: 'LineString',
            coordinates: [
              [101, 0],
              [102, 1],
            ],
          },
        ],
      };
      const geometry2: GeoJsonGeometryCollection = {
        type: 'GeometryCollection',
        geometries: [
          {
            type: 'Point',
            coordinates: [100, 0],
          },
          {
            type: 'LineString',
            coordinates: [
              [101, 0],
              [102, 1],
            ],
          },
          {
            type: 'Polygon',
            coordinates: [
              [
                [100, 0],
                [101, 0],
                [101, 1],
                [100, 1],
                [100, 0],
              ],
            ],
          },
        ],
      };

      const user1 = await User.create({ geometry: geometry1 });
      await User.update({ geometry: geometry2 }, { where: { id: user1.id } });
      const user = await User.findOne({ where: { id: user1.id }, rejectOnEmpty: true });
      expect(user.geometry).to.deep.include(geometry2);
    });

    it('works with crs field', async () => {
      const User = vars.User;
      const geometry: GeoJsonGeometryCollection = {
        type: 'GeometryCollection',
        geometries: [
          {
            type: 'Point',
            coordinates: [100, 0],
          },
          {
            type: 'LineString',
            coordinates: [
              [101, 0],
              [102, 1],
            ],
          },
        ],
        crs: {
          type: 'name',
          properties: {
            name: 'EPSG:4326',
          },
        },
      };

      const newUser = await User.create({ geometry });
      expect(newUser.geometry).to.deep.eq(geometry);
    });

    it('is not a vector of SQL injection', async () => {
      // Should work and be properly escaped
      await vars.User.create({
        geometry: {
          type: 'GeometryCollection',
          geometries: [
            {
              type: 'Point',
              coordinates: [100, 0],
              properties: {
                exploit: "'); DELETE YOLO INJECTIONS; -- ",
              },
            },
          ],
        },
      });

      await expect(
        vars.User.create({
          geometry: {
            type: 'GeometryCollection',
            geometries: [
              {
                type: 'Point',
                // @ts-expect-error -- coordinates must be number, but we're still testing against string to be safe
                coordinates: ["'); DELETE YOLO INJECTIONS; --", 0],
              },
            ],
          },
        }),
      ).to.be.rejectedWith('specifies an invalid point');
    });
  });
});
