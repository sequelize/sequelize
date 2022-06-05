'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes } = require('@sequelize/core');

const dialect = Support.getTestDialect();
const semver = require('semver');

const current = Support.sequelize;

// NOTE: tests use `.to.deep.include` instead of `.to.deep.equal` when
//   they are testing a subset of the test case; e.g., testing that `point`
//   exists in `.location` and not caring that location has additional properties
describe(Support.getTestDialectTeaser('Model'), () => {
  if (current.dialect.supports.GEOMETRY) {
    describe('GEOMETRY', () => {

      beforeEach(async function () {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          geometry: DataTypes.GEOMETRY,
        });

        await this.User.sync({ force: true });
      });

      it('works with aliases fields', async function () {
        const Pub = this.sequelize.define('Pub', {
          location: { field: 'coordinates', type: DataTypes.GEOMETRY },
        });
        const point = { type: 'Point', coordinates: [39.807_222, -76.984_722] };

        await Pub.sync({ force: true });
        const pub = await Pub.create({ location: point });
        expect(pub).not.to.be.null;
        expect(pub.location).to.deep.include(point);
      });

      it('should create a geometry object', async function () {
        const User = this.User;
        const point = { type: 'Point', coordinates: [39.807_222, -76.984_722] };

        const newUser = await User.create({ username: 'username', geometry: point });
        expect(newUser).not.to.be.null;
        expect(newUser.geometry).to.deep.include(point);
      });

      it('should update a geometry object', async function () {
        const User = this.User;
        const point1 = { type: 'Point', coordinates: [39.807_222, -76.984_722] };
        const point2 = { type: 'Point', coordinates: [49.807_222, -86.984_722] };
        const props = { username: 'username', geometry: point1 };

        await User.create(props);
        await User.update({ geometry: point2 }, { where: { username: props.username } });
        const user = await User.findOne({ where: { username: props.username } });
        expect(user.geometry).to.deep.include(point2);
      });

      it('works with crs field', async function () {
        const Pub = this.sequelize.define('Pub', {
          location: { field: 'coordinates', type: DataTypes.GEOMETRY },
        });
        const point = {
          type: 'Point', coordinates: [39.807_222, -76.984_722],
          crs: {
            type: 'name',
            properties: {
              name: 'EPSG:4326',
            },
          },
        };

        await Pub.sync({ force: true });
        const pub = await Pub.create({ location: point });
        expect(pub).not.to.be.null;
        expect(pub.location).to.deep.include(point);
      });
    });

    describe('GEOMETRY(POINT)', () => {
      beforeEach(async function () {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          geometry: DataTypes.GEOMETRY('POINT'),
        });

        await this.User.sync({ force: true });
      });

      it('should create a geometry object', async function () {
        const User = this.User;
        const point = { type: 'Point', coordinates: [39.807_222, -76.984_722] };

        const newUser = await User.create({ username: 'username', geometry: point });
        expect(newUser).not.to.be.null;
        expect(newUser.geometry).to.deep.include(point);
      });

      it('should update a geometry object', async function () {
        const User = this.User;
        const point1 = { type: 'Point', coordinates: [39.807_222, -76.984_722] };
        const point2 = { type: 'Point', coordinates: [49.807_222, -86.984_722] };
        const props = { username: 'username', geometry: point1 };

        await User.create(props);
        await User.update({ geometry: point2 }, { where: { username: props.username } });
        const user = await User.findOne({ where: { username: props.username } });
        expect(user.geometry).to.deep.include(point2);
      });

      it('works with crs field', async function () {
        const User = this.User;
        const point = {
          type: 'Point', coordinates: [39.807_222, -76.984_722],
          crs: {
            type: 'name',
            properties: {
              name: 'EPSG:4326',
            },
          },
        };

        const newUser = await User.create({ username: 'username', geometry: point });
        expect(newUser).not.to.be.null;
        expect(newUser.geometry).to.deep.include(point);
      });
    });

    describe('GEOMETRY(LINESTRING)', () => {
      beforeEach(async function () {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          geometry: DataTypes.GEOMETRY('LINESTRING'),
        });

        await this.User.sync({ force: true });
      });

      it('should create a geometry object', async function () {
        const User = this.User;
        const point = { type: 'LineString', coordinates: [[100, 0], [101, 1]] };

        const newUser = await User.create({ username: 'username', geometry: point });
        expect(newUser).not.to.be.null;
        expect(newUser.geometry).to.deep.include(point);
      });

      it('should update a geometry object', async function () {
        const User = this.User;
        const point1 = { type: 'LineString', coordinates: [[100, 0], [101, 1]] };
        const point2 = { type: 'LineString', coordinates: [[101, 0], [102, 1]] };
        const props = { username: 'username', geometry: point1 };

        await User.create(props);
        await User.update({ geometry: point2 }, { where: { username: props.username } });
        const user = await User.findOne({ where: { username: props.username } });
        expect(user.geometry).to.deep.include(point2);
      });

      it('works with crs field', async function () {
        const User = this.User;
        const point = {
          type: 'LineString', coordinates: [[100, 0], [101, 1]],
          crs: {
            type: 'name',
            properties: {
              name: 'EPSG:4326',
            },
          },
        };

        const newUser = await User.create({ username: 'username', geometry: point });
        expect(newUser).not.to.be.null;
        expect(newUser.geometry).to.deep.include(point);
      });

    });

    describe('GEOMETRY(POLYGON)', () => {
      beforeEach(async function () {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          geometry: DataTypes.GEOMETRY('POLYGON'),
        });

        await this.User.sync({ force: true });
      });

      it('should create a geometry object', async function () {
        const User = this.User;
        const point = {
          type: 'Polygon', coordinates: [
            [[100, 0], [101, 0], [101, 1], [100, 1], [100, 0]],
          ],
        };

        const newUser = await User.create({ username: 'username', geometry: point });
        expect(newUser).not.to.be.null;
        expect(newUser.geometry).to.deep.include(point);
      });

      it('works with crs field', async function () {
        const User = this.User;
        const point = {
          type: 'Polygon', coordinates: [
            [[100, 0], [101, 0], [101, 1],
              [100, 1], [100, 0]]],
          crs: {
            type: 'name',
            properties: {
              name: 'EPSG:4326',
            },
          },
        };

        const newUser = await User.create({ username: 'username', geometry: point });
        expect(newUser).not.to.be.null;
        expect(newUser.geometry).to.deep.equal(point);
      });

      it('should update a geometry object', async function () {
        const User = this.User;
        const polygon1 = {
          type: 'Polygon', coordinates: [
            [[100, 0], [101, 0], [101, 1], [100, 1], [100, 0]],
          ],
        };
        const polygon2 = {
          type: 'Polygon', coordinates: [
            [[100, 0], [102, 0], [102, 1], [100, 1], [100, 0]],
          ],
        };
        const props = { username: 'username', geometry: polygon1 };

        await User.create(props);
        await User.update({ geometry: polygon2 }, { where: { username: props.username } });
        const user = await User.findOne({ where: { username: props.username } });
        expect(user.geometry).to.deep.include(polygon2);
      });
    });

    describe('sql injection attacks', () => {
      beforeEach(async function () {
        this.Model = this.sequelize.define('Model', {
          location: DataTypes.GEOMETRY,
        });
        await this.sequelize.sync({ force: true });
      });

      it.skip('should properly escape the single quotes', async function () {
        await this.Model.create({
          location: {
            type: 'Point',
            properties: {
              exploit: '\'); DELETE YOLO INJECTIONS; -- ',
            },
            coordinates: [39.807_222, -76.984_722],
          },
        });
      });

      it.skip('should properly escape the single quotes in coordinates', async function () {
        // MySQL 5.7, those guys finally fixed this
        if (dialect === 'mysql' && semver.gte(this.sequelize.options.databaseVersion, '5.7.0')) {
          return;
        }

        await this.Model.create({
          location: {
            type: 'Point',
            properties: {
              exploit: '\'); DELETE YOLO INJECTIONS; -- ',
            },
            coordinates: [39.807_222, '\'); DELETE YOLO INJECTIONS; --'],
          },
        });
      });
    });
  }
});
