import type {
  CreationOptional,
  GeoJson,
  GeoJsonLineString,
  GeoJsonPoint,
  GeoJsonPolygon,
  InferAttributes,
  InferCreationAttributes,
} from '@sequelize/core';
import { DataTypes, GeoJsonType, Model } from '@sequelize/core';
import { expect } from 'chai';
import semver from 'semver/preload.js';
import { beforeEach2, getTestDialectTeaser, sequelize } from '../support';

const dialect = sequelize.dialect;

async function createUserModelWithGeometry(type?: GeoJsonType) {
  class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
    declare id: CreationOptional<number>;
    declare geometry: GeoJson | null;
  }

  User.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    geometry: type ? DataTypes.GEOMETRY(type) : DataTypes.GEOMETRY,
  }, { sequelize, timestamps: false });

  await User.sync({ force: true });

  return User;
}

// !TODO: add bind value test
// !TODO: add test for MultiX types
// !TODO: add SQL injection test to each type

describe(getTestDialectTeaser('Model'), () => {
  if (!sequelize.dialect.supports.dataTypes.GEOMETRY) {
    return;
  }

  describe('GEOMETRY', () => {
    const vars = beforeEach2(async () => {
      return { User: await createUserModelWithGeometry() };
    });

    it('should update a geometry object', async () => {
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
        type: 'Point', coordinates: [39.807_222, -76.984_722],
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

    it('correctly parses an empty GEOMETRY field', async () => {
      // mysql does not support empty points
      const runTests = dialect.name === 'mysql' ? false
        : dialect.name !== 'postgres' ? true
        : await (
          sequelize.query('SELECT PostGIS_Lib_Version();')
            .then(result => {
              // @ts-expect-error -- not worth it to type the output of this query.
              if (result[0][0] && semver.lte(result[0][0].postgis_lib_version, '2.1.7')) {
                return true;
              }

              return false;
            })
        );

      if (!runTests) {
        return;
      }

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

    it('is not a vector for SQL injection', async () => {
      // Should work and be properly escaped
      await vars.User.create({
        geometry: {
          type: 'Point',
          properties: {
            exploit: '\'); DELETE YOLO INJECTIONS; -- ',
          },
          coordinates: [0, 0],
        },
      });

      await expect(vars.User.create({
        geometry: {
          // @ts-expect-error
          type: 'Point',
          // @ts-expect-error
          coordinates: [39.807_222, '\'); DELETE YOLO INJECTIONS; --'],
        },
      })).to.be.rejectedWith('has an invalid or missing "coordinates" property');
    });
  });

  describe('GEOMETRY(POINT)', () => {
    const vars = beforeEach2(async () => {
      return { User: await createUserModelWithGeometry(GeoJsonType.Point) };
    });

    it('should create a geometry object', async () => {
      const User = vars.User;
      const point: GeoJsonPoint = { type: 'Point', coordinates: [39.807_222, -76.984_722] };

      const newUser = await User.create({ geometry: point });
      expect(newUser.geometry).to.deep.include(point);
    });

    it('works with crs field', async () => {
      const User = vars.User;
      const point: GeoJsonPoint = {
        type: 'Point', coordinates: [39.807_222, -76.984_722],
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
  });

  describe('GEOMETRY(LINESTRING)', () => {
    const vars = beforeEach2(async () => {
      return { User: await createUserModelWithGeometry(GeoJsonType.LineString) };
    });

    it('should create a geometry object', async () => {
      const User = vars.User;
      const point: GeoJsonLineString = { type: 'LineString', coordinates: [[100, 0], [101, 1]] };

      const newUser = await User.create({ geometry: point });
      expect(newUser).not.to.be.null;
      expect(newUser.geometry).to.deep.include(point);
    });

    it('should update a geometry object', async () => {
      const User = vars.User;
      const point1: GeoJsonLineString = { type: 'LineString', coordinates: [[100, 0], [101, 1]] };
      const point2: GeoJsonLineString = { type: 'LineString', coordinates: [[101, 0], [102, 1]] };

      const user1 = await User.create({ geometry: point1 });
      await User.update({ geometry: point2 }, { where: { id: user1.id } });
      const user = await User.findOne({ where: { id: user1.id }, rejectOnEmpty: true });
      expect(user.geometry).to.deep.include(point2);
    });

    it('works with crs field', async () => {
      const User = vars.User;
      const point: GeoJsonLineString = {
        type: 'LineString', coordinates: [[100, 0], [101, 1]],
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
  });

  describe('GEOMETRY(POLYGON)', () => {
    const vars = beforeEach2(async () => {
      return { User: await createUserModelWithGeometry(GeoJsonType.Polygon) };
    });

    it('should create a geometry object', async () => {
      const User = vars.User;
      const point: GeoJsonPolygon = {
        type: 'Polygon', coordinates: [
          [
            [100, 0], [101, 0],
            [101, 1], [100, 1],
            [100, 0],
          ],
        ],
      };

      const newUser = await User.create({ geometry: point });
      expect(newUser.geometry).to.deep.include(point);
    });

    it('works with crs field', async () => {
      const User = vars.User;
      const point: GeoJsonPolygon = {
        type: 'Polygon',
        coordinates: [
          [
            [100, 0], [101, 0], [101, 1],
            [100, 1], [100, 0],
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

    it('should update a geometry object', async () => {
      const User = vars.User;
      const polygon1: GeoJsonPolygon = {
        type: 'Polygon',
        coordinates: [
          [[100, 0], [101, 0], [101, 1], [100, 1], [100, 0]],
        ],
      };
      const polygon2: GeoJsonPolygon = {
        type: 'Polygon',
        coordinates: [
          [[100, 0], [102, 0], [102, 1], [100, 1], [100, 0]],
        ],
      };
      const props = { username: 'username', geometry: polygon1 };

      const user1 = await User.create(props);
      await User.update({ geometry: polygon2 }, { where: { id: user1.id } });
      const user = await User.findOne({ where: { id: user1.id }, rejectOnEmpty: true });
      expect(user.geometry).to.deep.include(polygon2);
    });
  });
});
