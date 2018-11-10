'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types');

const current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  if (current.dialect.supports.GEOGRAPHY) {
    describe('GEOGRAPHY', () => {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          geography: DataTypes.GEOGRAPHY
        });

        return this.User.sync({ force: true });
      });

      it('works with aliases fields', function() {
        const Pub = this.sequelize.define('Pub', {
            location: {field: 'coordinates', type: DataTypes.GEOGRAPHY}
          }),
          point = {type: 'Point', coordinates: [39.807222, -76.984722]};

        return Pub.sync({ force: true }).then(() => {
          return Pub.create({location: point});
        }).then(pub => {
          expect(pub).not.to.be.null;
          expect(pub.location).to.be.deep.eql(point);
        });
      });

      it('should create a geography object', function() {
        const User = this.User;
        const point = { type: 'Point', coordinates: [39.807222, -76.984722]};

        return User.create({username: 'username', geography: point }).then(newUser => {
          expect(newUser).not.to.be.null;
          expect(newUser.geography).to.be.deep.eql(point);
        });
      });

      it('should update a geography object', function() {
        const User = this.User;
        const point1 = { type: 'Point', coordinates: [39.807222, -76.984722]},
          point2 = { type: 'Point', coordinates: [49.807222, -86.984722]};
        const props = {username: 'username', geography: point1};

        return User.create(props).then(() => {
          return User.update({geography: point2}, {where: {username: props.username}});
        }).then(() => {
          return User.findOne({where: {username: props.username}});
        }).then(user => {
          expect(user.geography).to.be.deep.eql(point2);
        });
      });
    });

    describe('GEOGRAPHY(POINT)', () => {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          geography: DataTypes.GEOGRAPHY('POINT')
        });

        return this.User.sync({ force: true });
      });

      it('should create a geography object', function() {
        const User = this.User;
        const point = { type: 'Point', coordinates: [39.807222, -76.984722]};

        return User.create({username: 'username', geography: point }).then(newUser => {
          expect(newUser).not.to.be.null;
          expect(newUser.geography).to.be.deep.eql(point);
        });
      });

      it('should update a geography object', function() {
        const User = this.User;
        const point1 = { type: 'Point', coordinates: [39.807222, -76.984722]},
          point2 = { type: 'Point', coordinates: [49.807222, -86.984722]};
        const props = {username: 'username', geography: point1};

        return User.create(props).then(() => {
          return User.update({geography: point2}, {where: {username: props.username}});
        }).then(() => {
          return User.findOne({where: {username: props.username}});
        }).then(user => {
          expect(user.geography).to.be.deep.eql(point2);
        });
      });
    });

    describe('GEOGRAPHY(LINESTRING)', () => {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          geography: DataTypes.GEOGRAPHY('LINESTRING')
        });

        return this.User.sync({ force: true });
      });

      it('should create a geography object', function() {
        const User = this.User;
        const point = { type: 'LineString', 'coordinates': [[100.0, 0.0], [101.0, 1.0]] };

        return User.create({username: 'username', geography: point }).then(newUser => {
          expect(newUser).not.to.be.null;
          expect(newUser.geography).to.be.deep.eql(point);
        });
      });

      it('should update a geography object', function() {
        const User = this.User;
        const point1 = { type: 'LineString', coordinates: [[100.0, 0.0], [101.0, 1.0]] },
          point2 = { type: 'LineString', coordinates: [[101.0, 0.0], [102.0, 1.0]] };
        const props = {username: 'username', geography: point1};

        return User.create(props).then(() => {
          return User.update({geography: point2}, {where: {username: props.username}});
        }).then(() => {
          return User.findOne({where: {username: props.username}});
        }).then(user => {
          expect(user.geography).to.be.deep.eql(point2);
        });
      });
    });

    describe('GEOGRAPHY(POLYGON)', () => {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          geography: DataTypes.GEOGRAPHY('POLYGON')
        });

        return this.User.sync({ force: true });
      });

      it('should create a geography object', function() {
        const User = this.User;
        const point = { type: 'Polygon', coordinates: [
          [[100.0, 0.0], [101.0, 0.0], [101.0, 1.0],
            [100.0, 1.0], [100.0, 0.0]]
        ]};

        return User.create({username: 'username', geography: point }).then(newUser => {
          expect(newUser).not.to.be.null;
          expect(newUser.geography).to.be.deep.eql(point);
        });
      });

      it('should update a geography object', function() {
        const User = this.User;
        const polygon1 = { type: 'Polygon', coordinates: [
            [[100.0, 0.0], [101.0, 0.0], [101.0, 1.0], [100.0, 1.0], [100.0, 0.0]]
          ]},
          polygon2 = { type: 'Polygon', coordinates: [
            [[100.0, 0.0], [102.0, 0.0], [102.0, 1.0],
              [100.0, 1.0], [100.0, 0.0]]
          ]};
        const props = {username: 'username', geography: polygon1};

        return User.create(props).then(() => {
          return User.update({geography: polygon2}, {where: {username: props.username}});
        }).then(() => {
          return User.findOne({where: {username: props.username}});
        }).then(user => {
          expect(user.geography).to.be.deep.eql(polygon2);
        });
      });
    });

    if (current.dialect.name === 'postgres') {
      describe('GEOGRAPHY(POLYGON, SRID)', () => {
        beforeEach(function() {
          this.User = this.sequelize.define('User', {
            username: DataTypes.STRING,
            geography: DataTypes.GEOGRAPHY('POLYGON', 4326)
          });

          return this.User.sync({ force: true });
        });

        it('should create a geography object', function() {
          const User = this.User;
          const point = { type: 'Polygon', coordinates: [
            [[100.0, 0.0], [101.0, 0.0], [101.0, 1.0],
              [100.0, 1.0], [100.0, 0.0]]
          ]};

          return User.create({username: 'username', geography: point }).then(newUser => {
            expect(newUser).not.to.be.null;
            expect(newUser.geography).to.be.deep.eql(point);
          });
        });

        it('should update a geography object', function() {
          const User = this.User;
          const polygon1 = { type: 'Polygon', coordinates: [
              [[100.0, 0.0], [101.0, 0.0], [101.0, 1.0], [100.0, 1.0], [100.0, 0.0]]
            ]},
            polygon2 = { type: 'Polygon', coordinates: [
              [[100.0, 0.0], [102.0, 0.0], [102.0, 1.0],
                [100.0, 1.0], [100.0, 0.0]]
            ]};
          const props = {username: 'username', geography: polygon1};

          return User.create(props).then(() => {
            return User.update({geography: polygon2}, {where: {username: props.username}});
          }).then(() => {
            return User.findOne({where: {username: props.username}});
          }).then(user => {
            expect(user.geography).to.be.deep.eql(polygon2);
          });
        });
      });
    }

    describe('sql injection attacks', () => {
      beforeEach(function() {
        this.Model = this.sequelize.define('Model', {
          location: DataTypes.GEOGRAPHY
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
    });
  }
});
