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
import { beforeEach2, getTestDialectTeaser, sequelize } from '../support';

async function createUserModelWithGeography(type?: GeoJsonType, srid?: number) {
  class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
    declare id: CreationOptional<number>;
    declare geography: GeoJson | null;
  }

  User.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      geography: type ? DataTypes.GEOGRAPHY(type, srid) : DataTypes.GEOGRAPHY,
    },
    { sequelize, timestamps: false },
  );

  await User.sync({ force: true });

  return User;
}

describe(getTestDialectTeaser('DataTypes'), () => {
  if (!sequelize.dialect.supports.dataTypes.GEOGRAPHY) {
    return;
  }

  describe('GEOGRAPHY', () => {
    const vars = beforeEach2(async () => {
      return { User: await createUserModelWithGeography() };
    });

    it('should create a geography object', async () => {
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

      const newUser = await vars.User.create({ geography: point });
      expect(newUser).not.to.be.null;
      expect(newUser.geography).to.deep.eq(point);
    });

    it('should update a geography object', async () => {
      const point2: GeoJsonPoint = {
        type: 'Point',
        coordinates: [49.807_222, -86.984_722],
        crs: {
          type: 'name',
          properties: {
            name: 'EPSG:4326',
          },
        },
      };

      const user = await vars.User.create({
        geography: {
          type: 'Point',
          coordinates: [39.807_222, -76.984_722],
          crs: {
            type: 'name',
            properties: {
              name: 'EPSG:4326',
            },
          },
        },
      });

      await vars.User.update({ geography: point2 }, { where: { id: user.id } });
      await user.reload();
      expect(user.geography).to.deep.eq(point2);
    });

    it('should properly escape single quotes', async () => {
      await vars.User.create({
        geography: {
          type: 'Point',
          properties: {
            exploit: "'); DELETE YOLO INJECTIONS; -- ",
          },
          coordinates: [39.807_222, -76.984_722],
        },
      });
    });
  });

  describe('GEOGRAPHY(POINT)', () => {
    const vars = beforeEach2(async () => {
      return { User: await createUserModelWithGeography(GeoJsonType.Point) };
    });

    it('should create a geography object', async () => {
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

      const newUser = await vars.User.create({ geography: point });
      expect(newUser).not.to.be.null;
      expect(newUser.geography).to.deep.eq(point);
    });

    it('should update a geography object', async () => {
      const point2: GeoJsonPoint = {
        type: 'Point',
        coordinates: [49.807_222, -86.984_722],
        crs: {
          type: 'name',
          properties: {
            name: 'EPSG:4326',
          },
        },
      };

      const user = await vars.User.create({
        geography: {
          type: 'Point',
          coordinates: [39.807_222, -76.984_722],
          crs: {
            type: 'name',
            properties: {
              name: 'EPSG:4326',
            },
          },
        },
      });

      await vars.User.update({ geography: point2 }, { where: { id: user.id } });
      await user.reload();

      expect(user.geography).to.deep.eq(point2);
    });
  });

  describe('GEOGRAPHY(LINESTRING)', () => {
    const vars = beforeEach2(async () => {
      return { User: await createUserModelWithGeography(GeoJsonType.LineString) };
    });

    it('should create a geography object', async () => {
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

      const newUser = await vars.User.create({ geography: point });
      expect(newUser).not.to.be.null;
      expect(newUser.geography).to.deep.eq(point);
    });

    it('should update a geography object', async () => {
      const point1: GeoJsonLineString = {
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
      const point2: GeoJsonLineString = {
        type: 'LineString',
        coordinates: [
          [101, 0],
          [102, 1],
        ],
        crs: {
          type: 'name',
          properties: {
            name: 'EPSG:4326',
          },
        },
      };

      const user = await vars.User.create({ geography: point1 });
      await vars.User.update({ geography: point2 }, { where: { id: user.id } });
      await user.reload();

      expect(user.geography).to.deep.eq(point2);
    });
  });

  describe('GEOGRAPHY(POLYGON)', () => {
    const vars = beforeEach2(async () => {
      return { User: await createUserModelWithGeography(GeoJsonType.Polygon) };
    });

    it('should create a geography object', async () => {
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

      const newUser = await vars.User.create({ geography: point });
      expect(newUser).not.to.be.null;
      expect(newUser.geography).to.deep.eq(point);
    });

    it('should update a geography object', async () => {
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
        crs: {
          type: 'name',
          properties: {
            name: 'EPSG:4326',
          },
        },
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
        crs: {
          type: 'name',
          properties: {
            name: 'EPSG:4326',
          },
        },
      };

      const user = await vars.User.create({ geography: polygon1 });
      await vars.User.update({ geography: polygon2 }, { where: { id: user.id } });
      await user.reload();
      expect(user.geography).to.deep.eq(polygon2);
    });
  });

  if (sequelize.dialect.name === 'postgres') {
    describe('GEOGRAPHY(POLYGON, SRID)', () => {
      const vars = beforeEach2(async () => {
        return { User: await createUserModelWithGeography(GeoJsonType.Polygon, 4326) };
      });

      it('should create a geography object', async () => {
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

        const newUser = await vars.User.create({ geography: point });
        expect(newUser).not.to.be.null;
        expect(newUser.geography).to.deep.eq(point);
      });

      it('should update a geography object', async () => {
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
          crs: {
            type: 'name',
            properties: {
              name: 'EPSG:4326',
            },
          },
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
          crs: {
            type: 'name',
            properties: {
              name: 'EPSG:4326',
            },
          },
        };

        const user = await vars.User.create({ geography: polygon1 });
        await vars.User.update({ geography: polygon2 }, { where: { id: user.id } });
        await user.reload();

        expect(user.geography).to.deep.eq(polygon2);
      });
    });
  }
});
