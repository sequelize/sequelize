'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  dialect = Support.getTestDialect(),
  semver = require('semver');

const current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  if (current.dialect.supports.GEOMETRY) {
    describe('GEOMETRY', () => {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          geometry: DataTypes.GEOMETRY
        });

        return this.User.sync({ force: true });
      });

      it('works with aliases fields', function() {
        const Pub = this.sequelize.define('Pub', {
            location: {field: 'coordinates', type: DataTypes.GEOMETRY}
          }),
          point = {type: 'Point', coordinates: [39.807222, -76.984722]};

        return Pub.sync({ force: true }).then(() => {
          return Pub.create({location: point});
        }).then(pub => {
          expect(pub).not.to.be.null;
          expect(pub.location).to.be.deep.eql(point);
        });
      });

      it('should create a geometry object', function() {
        const User = this.User;
        const point = { type: 'Point', coordinates: [39.807222, -76.984722]};

        return User.create({username: 'username', geometry: point }).then(newUser => {
          expect(newUser).not.to.be.null;
          expect(newUser.geometry).to.be.deep.eql(point);
        });
      });

      it('should update a geometry object', function() {
        const User = this.User;
        const point1 = { type: 'Point', coordinates: [39.807222, -76.984722]},
          point2 = { type: 'Point', coordinates: [49.807222, -86.984722]};
        const props = {username: 'username', geometry: point1};

        return User.create(props).then(() => {
          return User.update({geometry: point2}, {where: {username: props.username}});
        }).then(() => {
          return User.findOne({where: {username: props.username}});
        }).then(user => {
          expect(user.geometry).to.be.deep.eql(point2);
        });
      });
    });

    describe('GEOMETRY(POINT)', () => {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          geometry: DataTypes.GEOMETRY('POINT')
        });

        return this.User.sync({ force: true });
      });

      it('should create a geometry object', function() {
        const User = this.User;
        const point = { type: 'Point', coordinates: [39.807222, -76.984722]};

        return User.create({username: 'username', geometry: point }).then(newUser => {
          expect(newUser).not.to.be.null;
          expect(newUser.geometry).to.be.deep.eql(point);
        });
      });

      it('should update a geometry object', function() {
        const User = this.User;
        const point1 = { type: 'Point', coordinates: [39.807222, -76.984722]},
          point2 = { type: 'Point', coordinates: [49.807222, -86.984722]};
        const props = {username: 'username', geometry: point1};

        return User.create(props).then(() => {
          return User.update({geometry: point2}, {where: {username: props.username}});
        }).then(() => {
          return User.findOne({where: {username: props.username}});
        }).then(user => {
          expect(user.geometry).to.be.deep.eql(point2);
        });
      });
    });

    describe('GEOMETRY(LINESTRING)', () => {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          geometry: DataTypes.GEOMETRY('LINESTRING')
        });

        return this.User.sync({ force: true });
      });

      it('should create a geometry object', function() {
        const User = this.User;
        const point = { type: 'LineString', 'coordinates': [[100.0, 0.0], [101.0, 1.0]] };

        return User.create({username: 'username', geometry: point }).then(newUser => {
          expect(newUser).not.to.be.null;
          expect(newUser.geometry).to.be.deep.eql(point);
        });
      });

      it('should update a geometry object', function() {
        const User = this.User;
        const point1 = { type: 'LineString', coordinates: [[100.0, 0.0], [101.0, 1.0]] },
          point2 = { type: 'LineString', coordinates: [[101.0, 0.0], [102.0, 1.0]] };
        const props = {username: 'username', geometry: point1};

        return User.create(props).then(() => {
          return User.update({geometry: point2}, {where: {username: props.username}});
        }).then(() => {
          return User.findOne({where: {username: props.username}});
        }).then(user => {
          expect(user.geometry).to.be.deep.eql(point2);
        });
      });
    });

    describe('GEOMETRY(POLYGON)', () => {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          geometry: DataTypes.GEOMETRY('POLYGON')
        });

        return this.User.sync({ force: true });
      });

      it('should create a geometry object', function() {
        const User = this.User;
        const point = { type: 'Polygon', coordinates: [
          [[100.0, 0.0], [101.0, 0.0], [101.0, 1.0],
            [100.0, 1.0], [100.0, 0.0]]
        ]};

        return User.create({username: 'username', geometry: point }).then(newUser => {
          expect(newUser).not.to.be.null;
          expect(newUser.geometry).to.be.deep.eql(point);
        });
      });

      it('should update a geometry object', function() {
        const User = this.User;
        const polygon1 = { type: 'Polygon', coordinates: [
            [[100.0, 0.0], [101.0, 0.0], [101.0, 1.0], [100.0, 1.0], [100.0, 0.0]]
          ]},
          polygon2 = { type: 'Polygon', coordinates: [
            [[100.0, 0.0], [102.0, 0.0], [102.0, 1.0],
              [100.0, 1.0], [100.0, 0.0]]
          ]};
        const props = {username: 'username', geometry: polygon1};

        return User.create(props).then(() => {
          return User.update({geometry: polygon2}, {where: {username: props.username}});
        }).then(() => {
          return User.findOne({where: {username: props.username}});
        }).then(user => {
          expect(user.geometry).to.be.deep.eql(polygon2);
        });
      });
    });

    describe('sql injection attacks', () => {
      beforeEach(function() {
        this.Model = this.sequelize.define('Model', {
          location: DataTypes.GEOMETRY
        });
        return this.sequelize.sync({ force: true });
      });

      it('should properly escape the single quotes', function() {
        return this.Model.create({
          location: {
            type: 'Point',
            properties: {
              exploit: "'); DELETE YOLO INJECTIONS; -- "
            },
            coordinates: [39.807222, -76.984722]
          }
        });
      });

      it('should properly escape the single quotes in coordinates', function() {

        // MySQL 5.7, those guys finally fixed this
        if (dialect === 'mysql' && semver.gte(this.sequelize.options.databaseVersion, '5.7.0')) {
          return;
        }

        return this.Model.create({
          location: {
            type: 'Point',
            properties: {
              exploit: "'); DELETE YOLO INJECTIONS; -- "
            },
            coordinates: [39.807222, "'); DELETE YOLO INJECTIONS; --"]
          }
        });
      });
    });
  }
});
