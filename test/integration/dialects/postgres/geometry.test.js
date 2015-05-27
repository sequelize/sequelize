'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support =  require(__dirname + '/../../support')
  , dialect = Support.getTestDialect()
  , DataTypes = require(__dirname + '/../../../../lib/data-types');

function normalizeSRID(obj) {
  obj.crs = {
    type: 'name',
    properties: {
      'name' : 'EPSG:4326'
    }
  };
  return obj;
}

var Ted = {
  username: 'Ted',
  location: normalizeSRID({ type: 'Point', coordinates: [54.5767, 1.2355] })
};

var Tim = {
  username: 'Tim',
  location: normalizeSRID({ type: 'Point', coordinates: [0.0, 0.0]})
};

var FakeTown = {
  place: 'FakeTown',
  bounds: normalizeSRID({
      type: 'Polygon',
      coordinates: [[
        [54.0, 0.0], [56.0, 0.0], [54.0, 2.0], [56.0, 2.0]
      ]]
  })
};

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] Postgis', function () {

    beforeEach(function() {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        location: DataTypes.GEOMETRY('POINT', 4326)
      });
      this.City = this.sequelize.define('City', {
        place: DataTypes.STRING,
        bounds: DataTypes.GEOMETRY('POLYGON', 4326)
      });
      this.User.hasOne(this.City);
      this.City.belongsTo(this.User);

      return this.sequelize.sync({ force: true });
    });

    it('should support GeoJSON for get and retrieval', function () {
      var self = this;
      return self.User.create(Ted).then(function () {
        return self.User.findAll();
      }).then(function (users) {
        expect(users).to.be.instanceof(Array);
        expect(users).to.have.length(1);
        expect(users[0].location).to.be.instanceof(Object);
        expect(users[0].location.coordinates).to.be.instanceof(Array);
      });
    });

    it('should support geometry columns across multiple joins', function () {
      var self = this;

      return self.User.create(Ted).bind(this)
      .then(function (user) {
        this.Ted = user;
        return self.City.create(FakeTown);
      })
      .then(function (ft) {
        return this.Ted.setCity(ft);
      })
      .then(function () {
        return self.User.findAll({
          include: [{ model: self.City }],
        });
      })
      .then(function (users) {
        expect(users).to.be.instanceof(Array);
        expect(users[0].City).to.have.property('place');
      });
    });

    it('should support updating GeoJSON', function () {
      var self = this;
      return self.User.create(Ted).then(function (ted) {
        ted.set('location', normalizeSRID({
          type: 'Point',
          coordinates: [0.1, 0.1]
        }));
        return ted.save();
      }).then(function (ted) {
        expect(ted.get('location')).to.be.instanceof(Object);
      });
    });

    it('should support $geoWithin', function () {
      var self = this;

      return self.City.create(FakeTown)
        .tap(function () {
          return self.User.create(Tim);
        })
        .tap(function () {
          return self.User.create(Ted);
        })
        .then(function (dtown) {
          return self.User.findAll({
            where: {
              location: {
                $geoWithin: { point: Tim.location, distance: 1 }
              }
            }
          });
        })
        .then(function (users) {
          expect(users).to.be.instanceof(Array);
          expect(users).to.have.length(1);
        });
    });

    it('should support $geoWithout', function () {
      var self = this;

      return self.City.create(FakeTown)
        .tap(function () {
          return self.User.create(Tim);
        })
        .tap(function () {
          return self.User.create(Ted);
        })
        .then(function (dtown) {
          return self.User.findAll({
            where: {
              location: {
                $geoWithout: { point: Tim.location, distance: 10 }
              }
            }
          });
        })
        .then(function (users) {
          expect(users).to.be.instanceof(Array);
          expect(users).to.have.length(1);
        });
    });

    it('should support $geoIn', function () {
      var self = this;

      return self.User.create(Ted).then(function () {
        return self.User.create(Tim);
      }).then(function () {
        return self.City.create(FakeTown);
      }).then(function (dtown) {
        return self.User.findAll({
          where: {
            location: {
              $geoIn: dtown.bounds
            }
          }
        });
      }).then(function (users) {
        expect(users).to.be.instanceof(Array);
        expect(users).to.have.length(1);
      });

    });

    it('should support $geoNotIn', function () {
      var self = this;

      return self.User.create(Ted).then(function () {
        return self.User.create(Tim);
      }).then(function () {
        return self.City.create(FakeTown);
      }).then(function (darlington) {
        return self.User.findAll({
          where: {
            location: {
              $geoNotIn: darlington.bounds
            }
          }
        });
      }).then(function (users) {
        expect(users).to.be.instanceof(Array);
        expect(users).to.have.length(1);
      });

    });
  });
}
