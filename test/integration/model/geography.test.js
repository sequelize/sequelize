'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types');

var current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), function() {
  if (current.dialect.supports.GEOGRAPHY) {
    describe('GEOGRAPHY', function() {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          geography: DataTypes.GEOGRAPHY
        });

        return this.User.sync({ force: true });
      });

      it('works with aliases fields', function () {
        var Pub = this.sequelize.define('Pub', {
          location: {field: 'coordinates', type: DataTypes.GEOGRAPHY}
        })
          , point = {type: 'Point', coordinates: [39.807222, -76.984722]};

        return Pub.sync({ force: true }).then(function () {
          return Pub.create({location: point});
        }).then(function (pub) {
          expect(pub).not.to.be.null;
          expect(pub.location).to.be.deep.eql(point);
        });
      });

      it('should create a geography object', function() {
        var User = this.User;
        var point = { type: 'Point', coordinates: [39.807222,-76.984722]};

        return User.create({username: 'username', geography: point }).then(function(newUser) {
          expect(newUser).not.to.be.null;
          expect(newUser.geography).to.be.deep.eql(point);
        });
      });

      it('should update a geography object', function() {
        var User = this.User;
        var point1 = { type: 'Point', coordinates: [39.807222,-76.984722]}
          , point2 = { type: 'Point', coordinates: [49.807222,-86.984722]};
        var props = {username: 'username', geography: point1};

        return User.create(props).then(function(user) {
          return User.update({geography: point2}, {where: {username: props.username}});
        }).then(function(count) {
          return User.findOne({where: {username: props.username}});
        }).then(function(user) {
          expect(user.geography).to.be.deep.eql(point2);
        });
      });
    });

    describe('GEOGRAPHY(POINT)', function() {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          geography: DataTypes.GEOGRAPHY('POINT')
        });

        return this.User.sync({ force: true });
      });

      it('should create a geography object', function() {
        var User = this.User;
        var point = { type: 'Point', coordinates: [39.807222,-76.984722]};

        return User.create({username: 'username', geography: point }).then(function(newUser) {
          expect(newUser).not.to.be.null;
          expect(newUser.geography).to.be.deep.eql(point);
        });
      });

      it('should update a geography object', function() {
        var User = this.User;
        var point1 = { type: 'Point', coordinates: [39.807222,-76.984722]}
          , point2 = { type: 'Point', coordinates: [49.807222,-86.984722]};
        var props = {username: 'username', geography: point1};

        return User.create(props).then(function(user) {
          return User.update({geography: point2}, {where: {username: props.username}});
        }).then(function(count) {
          return User.findOne({where: {username: props.username}});
        }).then(function(user) {
          expect(user.geography).to.be.deep.eql(point2);
        });
      });
    });

    describe('GEOGRAPHY(LINESTRING)', function() {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          geography: DataTypes.GEOGRAPHY('LINESTRING')
        });

        return this.User.sync({ force: true });
      });

      it('should create a geography object', function() {
        var User = this.User;
        var point = { type: 'LineString', 'coordinates': [ [100.0, 0.0], [101.0, 1.0] ] };

        return User.create({username: 'username', geography: point }).then(function(newUser) {
          expect(newUser).not.to.be.null;
          expect(newUser.geography).to.be.deep.eql(point);
        });
      });

      it('should update a geography object', function() {
        var User = this.User;
        var point1 = { type: 'LineString', coordinates: [ [100.0, 0.0], [101.0, 1.0] ] }
          , point2 = { type: 'LineString', coordinates: [ [101.0, 0.0], [102.0, 1.0] ] };
        var props = {username: 'username', geography: point1};

        return User.create(props).then(function(user) {
          return User.update({geography: point2}, {where: {username: props.username}});
        }).then(function(count) {
          return User.findOne({where: {username: props.username}});
        }).then(function(user) {
          expect(user.geography).to.be.deep.eql(point2);
        });
      });
    });

    describe('GEOGRAPHY(POLYGON)', function() {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {
          username: DataTypes.STRING,
          geography: DataTypes.GEOGRAPHY('POLYGON')
        });

        return this.User.sync({ force: true });
      });

      it('should create a geography object', function() {
        var User = this.User;
        var point = { type: 'Polygon', coordinates: [
             [ [100.0, 0.0], [101.0, 0.0], [101.0, 1.0],
               [100.0, 1.0], [100.0, 0.0] ]
             ]};

        return User.create({username: 'username', geography: point }).then(function(newUser) {
          expect(newUser).not.to.be.null;
          expect(newUser.geography).to.be.deep.eql(point);
        });
      });

      it('should update a geography object', function() {
        var User = this.User;
        var polygon1 = { type: 'Polygon', coordinates: [
              [ [100.0, 0.0], [101.0, 0.0], [101.0, 1.0],
                [100.0, 1.0], [100.0, 0.0] ]
              ]}
          , polygon2 = { type: 'Polygon', coordinates: [
              [ [100.0, 0.0], [102.0, 0.0], [102.0, 1.0],
                [100.0, 1.0], [100.0, 0.0] ]
              ]};
        var props = {username: 'username', geography: polygon1};

        return User.create(props).then(function(user) {
          return User.update({geography: polygon2}, {where: {username: props.username}});
        }).then(function(count) {
          return User.findOne({where: {username: props.username}});
        }).then(function(user) {
          expect(user.geography).to.be.deep.eql(polygon2);
        });
      });
    });

    describe('sql injection attacks', function () {
      beforeEach(function() {
        this.Model = this.sequelize.define('Model', {
          location: DataTypes.GEOGRAPHY
        });
        return this.sequelize.sync({ force: true });
      });

      it('should properly escape the single quotes', function () {
        return this.Model.create({
          location: {
            type: "Point",
            properties: {
              exploit: "'); DELETE YOLO INJECTIONS; -- "
            },
            coordinates: [39.807222,-76.984722]
          }
        });
      });
    });
  }
});
