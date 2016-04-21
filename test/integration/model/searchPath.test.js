'use strict';

/* jshint -W030 */
/* jshint -W110 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types');
var SEARCH_PATH_ONE = 'schema_one,public';
var SEARCH_PATH_TWO = 'schema_two,public';

var current = Support.createSequelizeInstance({
  dialectOptions: {
    prependSearchPath: true
  }
});

var locationId;

describe(Support.getTestDialectTeaser('Model'), function() {
  if (current.dialect.supports.searchPath) {

    describe('SEARCH PATH', function() {
      before(function() {
        this.Restaurant = current.define('restaurant', {
            foo: DataTypes.STRING,
            bar: DataTypes.STRING
          },
          {tableName: "restaurants"});
        this.Location = current.define('location', {
            name: DataTypes.STRING
          },
          {tableName: "locations"});
        this.Employee = current.define('employee', {
            first_name: DataTypes.STRING,
            last_name: DataTypes.STRING
          },
          {tableName: "employees"});
        this.Restaurant.belongsTo(this.Location,
          {
            foreignKey: 'location_id',
            constraints: false
          });
        this.Employee.belongsTo(this.Restaurant,
          {
            foreignKey: 'restaurant_id',
            constraints: false
          });
        this.Restaurant.hasMany(this.Employee, {
          foreignKey: 'restaurant_id',
          constraints: false
        });
      });


      beforeEach('build restaurant tables', function() {
        var Restaurant = this.Restaurant;
        return current.createSchema('schema_one').then(function() {
          return current.createSchema('schema_two');
        }).then(function() {
          return Restaurant.sync({force: true, searchPath: SEARCH_PATH_ONE});
        }).then(function() {
          return Restaurant.sync({force: true, searchPath: SEARCH_PATH_TWO});
        }).catch(function(err) {
          expect(err).to.be.null;
        });
      });

      afterEach('drop schemas', function() {
        return current.dropSchema('schema_one').then(function() {
          return current.dropSchema('schema_two');
        });
      });

      describe('Add data via model.create, retrieve via model.findOne', function() {
        it('should be able to insert data into the table in schema_one using create', function() {
          var Restaurant = this.Restaurant;
          var restaurantId;

          return Restaurant.create({
            foo: 'one',
            location_id: locationId
          }, {searchPath: SEARCH_PATH_ONE})
            .then(function() {
              return Restaurant.findOne({
                where: {foo: 'one'}, searchPath: SEARCH_PATH_ONE
              });
            }).then(function(obj) {
              expect(obj).to.not.be.null;
              expect(obj.foo).to.equal('one');
              restaurantId = obj.id;
              return Restaurant.findById(restaurantId, {searchPath: SEARCH_PATH_ONE});
            }).then(function(obj) {
              expect(obj).to.not.be.null;
              expect(obj.foo).to.equal('one');
            });
        });

        it('should fail to insert data into schema_two using create', function() {
          var Restaurant = this.Restaurant;

          return Restaurant.create({
            foo: 'test'
          }, {searchPath: SEARCH_PATH_TWO}).catch(function(err) {
            expect(err).to.not.be.null;
          });
        });

        it('should be able to insert data into the table in schema_two using create', function() {
          var Restaurant = this.Restaurant;
          var restaurantId;

          return Restaurant.create({
            foo: 'two',
            location_id: locationId
          }, {searchPath: SEARCH_PATH_TWO})
            .then(function() {
              return Restaurant.findOne({
                where: {foo: 'two'}, searchPath: SEARCH_PATH_TWO
              });
            }).then(function(obj) {
              expect(obj).to.not.be.null;
              expect(obj.foo).to.equal('two');
              restaurantId = obj.id;
              return Restaurant.findById(restaurantId, {searchPath: SEARCH_PATH_TWO});
            }).then(function(obj) {
              expect(obj).to.not.be.null;
              expect(obj.foo).to.equal('two');
            });
        });


        it('should fail to find schema_one object in schema_two', function() {
          var Restaurant = this.Restaurant;

          return Restaurant.findOne({where: {foo: 'one'}, searchPath: SEARCH_PATH_TWO}).then(function(RestaurantObj) {
            expect(RestaurantObj).to.be.null;
          });
        });

        it('should fail to find schema_two object in schema_one', function() {
          var Restaurant = this.Restaurant;

          return Restaurant.findOne({where: {foo: 'two'}, searchPath: SEARCH_PATH_ONE}).then(function(RestaurantObj) {
            expect(RestaurantObj).to.be.null;
          });
        });
      });

      describe('Add data via instance.save, retrieve via model.findAll', function() {
        it('should be able to insert data into both schemas using instance.save and retrieve it via findAll', function() {
          var Restaurant = this.Restaurant;

          var restaurauntModel = Restaurant.build({bar: 'one.1'});

          return restaurauntModel.save({searchPath: SEARCH_PATH_ONE})
            .then(function() {
              restaurauntModel = Restaurant.build({bar: 'one.2'});
              return restaurauntModel.save({searchPath: SEARCH_PATH_ONE});
            }).then(function() {
              restaurauntModel = Restaurant.build({bar: 'two.1'});
              return restaurauntModel.save({searchPath: SEARCH_PATH_TWO});
            }).then(function() {
              restaurauntModel = Restaurant.build({bar: 'two.2'});
              return restaurauntModel.save({searchPath: SEARCH_PATH_TWO});
            }).then(function() {
              restaurauntModel = Restaurant.build({bar: 'two.3'});
              return restaurauntModel.save({searchPath: SEARCH_PATH_TWO});
            }).then(function() {
              return Restaurant.findAll({searchPath: SEARCH_PATH_ONE});
            }).then(function(restaurantsOne) {
              expect(restaurantsOne).to.not.be.null;
              expect(restaurantsOne.length).to.equal(2);
              restaurantsOne.forEach(function(restaurant) {
                expect(restaurant.bar).to.contain('one');
              });
              return Restaurant.findAndCountAll({searchPath: SEARCH_PATH_ONE});
            }).then(function(restaurantsOne) {
              expect(restaurantsOne).to.not.be.null;
              expect(restaurantsOne.rows.length).to.equal(2);
              expect(restaurantsOne.count).to.equal(2);
              restaurantsOne.rows.forEach(function(restaurant) {
                expect(restaurant.bar).to.contain('one');
              });
              return Restaurant.findAll({searchPath: SEARCH_PATH_TWO});
            }).then(function(restaurantsTwo) {
              expect(restaurantsTwo).to.not.be.null;
              expect(restaurantsTwo.length).to.equal(3);
              restaurantsTwo.forEach(function(restaurant) {
                expect(restaurant.bar).to.contain('two');
              });
              return Restaurant.findAndCountAll({searchPath: SEARCH_PATH_TWO});
            }).then(function(restaurantsTwo) {
              expect(restaurantsTwo).to.not.be.null;
              expect(restaurantsTwo.rows.length).to.equal(3);
              expect(restaurantsTwo.count).to.equal(3);
              restaurantsTwo.rows.forEach(function(restaurant) {
                expect(restaurant.bar).to.contain('two');
              });
            });
        });
      });

      describe('Add data via instance.save, retrieve via model.count and model.find', function() {
        it('should be able to insert data into both schemas using instance.save count it and retrieve it via findAll with where', function() {
          var Restaurant = this.Restaurant;

          var restaurauntModel = Restaurant.build({bar: 'one.1'});

          return restaurauntModel.save({searchPath: SEARCH_PATH_ONE}).then(function() {
            restaurauntModel = Restaurant.build({bar: 'one.2'});
            return restaurauntModel.save({searchPath: SEARCH_PATH_ONE});
          }).then(function() {
            restaurauntModel = Restaurant.build({bar: 'two.1'});
            return restaurauntModel.save({searchPath: SEARCH_PATH_TWO});
          }).then(function() {
            restaurauntModel = Restaurant.build({bar: 'two.2'});
            return restaurauntModel.save({searchPath: SEARCH_PATH_TWO});
          }).then(function() {
            restaurauntModel = Restaurant.build({bar: 'two.3'});
            return restaurauntModel.save({searchPath: SEARCH_PATH_TWO});
          }).then(function() {
            return Restaurant.findAll({
              where: {bar: {$like: 'one%'}},
              searchPath: SEARCH_PATH_ONE
            });
          }).then(function(restaurantsOne) {
            expect(restaurantsOne).to.not.be.null;
            expect(restaurantsOne.length).to.equal(2);
            restaurantsOne.forEach(function(restaurant) {
              expect(restaurant.bar).to.contain('one');
            });
            return Restaurant.count({searchPath: SEARCH_PATH_ONE});
          }).then(function(count) {
            expect(count).to.not.be.null;
            expect(count).to.equal(2);
            return Restaurant.findAll({
              where: {bar: {$like: 'two%'}},
              searchPath: SEARCH_PATH_TWO
            });
          }).then(function(restaurantsTwo) {
            expect(restaurantsTwo).to.not.be.null;
            expect(restaurantsTwo.length).to.equal(3);
            restaurantsTwo.forEach(function(restaurant) {
              expect(restaurant.bar).to.contain('two');
            });
            return Restaurant.count({searchPath: SEARCH_PATH_TWO});
          }).then(function(count) {
            expect(count).to.not.be.null;
            expect(count).to.equal(3);
          });
        });
      });


      describe('Get associated data in public schema via include', function() {
        beforeEach(function() {
          var Location = this.Location;

          return Location.sync({force: true})
            .then(function() {
              return Location.create({name: 'HQ'}).then(function() {
                return Location.findOne({where: {name: 'HQ'}}).then(function(obj) {
                  expect(obj).to.not.be.null;
                  expect(obj.name).to.equal('HQ');
                  locationId = obj.id;
                });
              });
            })
            .catch(function(err) {
              expect(err).to.be.null;
            });
        });

        it('should be able to insert and retrieve associated data into the table in schema_one', function() {
          var Restaurant = this.Restaurant;
          var Location = this.Location;

          return Restaurant.create({
            foo: 'one',
            location_id: locationId
          }, {searchPath: SEARCH_PATH_ONE}).then(function() {
            return Restaurant.findOne({
              where: {foo: 'one'}, include: [{
                model: Location, as: 'location'
              }], searchPath: SEARCH_PATH_ONE
            });
          }).then(function(obj) {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('one');
            expect(obj.location).to.not.be.null;
            expect(obj.location.name).to.equal('HQ');
          });
        });


        it('should be able to insert and retrieve associated data into the table in schema_two', function() {
          var Restaurant = this.Restaurant;
          var Location = this.Location;

          return Restaurant.create({
            foo: 'two',
            location_id: locationId
          }, {searchPath: SEARCH_PATH_TWO}).then(function() {
            return Restaurant.findOne({
              where: {foo: 'two'}, include: [{
                model: Location, as: 'location'
              }], searchPath: SEARCH_PATH_TWO
            });
          }).then(function(obj) {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('two');
            expect(obj.location).to.not.be.null;
            expect(obj.location.name).to.equal('HQ');
          });
        });
      });


      describe('Get schema specific associated data via include', function() {
        beforeEach(function() {
          var Employee = this.Employee;
          return Employee.sync({force: true, searchPath: SEARCH_PATH_ONE})
            .then(function() {
              return Employee.sync({force: true, searchPath: SEARCH_PATH_TWO});
            })
            .catch(function(err) {
              expect(err).to.be.null;
            });
        });

        it('should be able to insert and retrieve associated data into the table in schema_one', function() {
          var Restaurant = this.Restaurant;
          var Employee = this.Employee;
          var restaurantId;

          return Restaurant.create({
            foo: 'one'
          }, {searchPath: SEARCH_PATH_ONE}).then(function() {
            return Restaurant.findOne({
              where: {foo: 'one'}, searchPath: SEARCH_PATH_ONE
            });
          }).then(function(obj) {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('one');
            restaurantId = obj.id;
            return Employee.create({
              first_name: 'Restaurant',
              last_name: 'one',
              restaurant_id: restaurantId
            }, {searchPath: SEARCH_PATH_ONE});
          }).then(function() {
            return Restaurant.findOne({
              where: {foo: 'one'}, searchPath: SEARCH_PATH_ONE, include: [{
                model: Employee, as: 'employees'
              }]
            });
          }).then(function(obj) {
            expect(obj).to.not.be.null;
            expect(obj.employees).to.not.be.null;
            expect(obj.employees.length).to.equal(1);
            expect(obj.employees[0].last_name).to.equal('one');
            return obj.getEmployees({searchPath: SEARCH_PATH_ONE});
          }).then(function(employees) {
            expect(employees.length).to.equal(1);
            expect(employees[0].last_name).to.equal('one');
            return Employee.findOne({
              where: {last_name: 'one'}, searchPath: SEARCH_PATH_ONE, include: [{
                model: Restaurant, as: 'restaurant'
              }]
            });
          }).then(function(obj) {
            expect(obj).to.not.be.null;
            expect(obj.restaurant).to.not.be.null;
            expect(obj.restaurant.foo).to.equal('one');
            return obj.getRestaurant({searchPath: SEARCH_PATH_ONE});
          }).then(function(restaurant) {
            expect(restaurant).to.not.be.null;
            expect(restaurant.foo).to.equal('one');
          });
        });


        it('should be able to insert and retrieve associated data into the table in schema_two', function() {
          var Restaurant = this.Restaurant;
          var Employee = this.Employee;
          var restaurantId;

          return Restaurant.create({
            foo: 'two'
          }, {searchPath: SEARCH_PATH_TWO}).then(function() {
            return Restaurant.findOne({
              where: {foo: 'two'}, searchPath: SEARCH_PATH_TWO
            });
          }).then(function(obj) {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('two');
            restaurantId = obj.id;
            return Employee.create({
              first_name: 'Restaurant',
              last_name: 'two',
              restaurant_id: restaurantId
            }, {searchPath: SEARCH_PATH_TWO});
          }).then(function() {
            return Restaurant.findOne({
              where: {foo: 'two'}, searchPath: SEARCH_PATH_TWO, include: [{
                model: Employee, as: 'employees'
              }]
            });
          }).then(function(obj) {
            expect(obj).to.not.be.null;
            expect(obj.employees).to.not.be.null;
            expect(obj.employees.length).to.equal(1);
            expect(obj.employees[0].last_name).to.equal('two');
            return obj.getEmployees({searchPath: SEARCH_PATH_TWO});
          }).then(function(employees) {
            expect(employees.length).to.equal(1);
            expect(employees[0].last_name).to.equal('two');
            return Employee.findOne({
              where: {last_name: 'two'}, searchPath: SEARCH_PATH_TWO, include: [{
                model: Restaurant, as: 'restaurant'
              }]
            });
          }).then(function(obj) {
            expect(obj).to.not.be.null;
            expect(obj.restaurant).to.not.be.null;
            expect(obj.restaurant.foo).to.equal('two');
            return obj.getRestaurant({searchPath: SEARCH_PATH_TWO});
          }).then(function(restaurant) {
            expect(restaurant).to.not.be.null;
            expect(restaurant.foo).to.equal('two');
          });
        });
      });

      describe('concurency tests', function() {
        it('should build and persist instances to 2 schemas concurrently in any order', function() {
          var Restaurant = this.Restaurant;

          var restaurauntModelSchema1 = Restaurant.build({bar: 'one.1'});
          var restaurauntModelSchema2 = Restaurant.build({bar: 'two.1'});

          return restaurauntModelSchema1.save({searchPath: SEARCH_PATH_ONE})
            .then(function() {
              restaurauntModelSchema1 = Restaurant.build({bar: 'one.2'});
              return restaurauntModelSchema2.save({searchPath: SEARCH_PATH_TWO});
            }).then(function() {
              return restaurauntModelSchema1.save({searchPath: SEARCH_PATH_ONE});
            }).then(function() {
              return Restaurant.findAll({searchPath: SEARCH_PATH_ONE});
            }).then(function(restaurantsOne) {
              expect(restaurantsOne).to.not.be.null;
              expect(restaurantsOne.length).to.equal(2);
              restaurantsOne.forEach(function(restaurant) {
                expect(restaurant.bar).to.contain('one');
              });
              return Restaurant.findAll({searchPath: SEARCH_PATH_TWO});
            }).then(function(restaurantsTwo) {
              expect(restaurantsTwo).to.not.be.null;
              expect(restaurantsTwo.length).to.equal(1);
              restaurantsTwo.forEach(function(restaurant) {
                expect(restaurant.bar).to.contain('two');
              });
            });
        });
      });
    });
  }
});
