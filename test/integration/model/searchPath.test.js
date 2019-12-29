'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require(__dirname + '/../support');
const DataTypes = require(__dirname + '/../../../lib/data-types');

const SEARCH_PATH_ONE = 'schema_one,public';
const SEARCH_PATH_TWO = 'schema_two,public';

const current = Support.createSequelizeInstance({
  dialectOptions: {
    prependSearchPath: true
  }
});

let locationId;

describe(Support.getTestDialectTeaser('Model'), () => {
  if (current.dialect.supports.searchPath) {
    describe('SEARCH PATH', () => {
      before(function() {
        this.Restaurant = current.define('restaurant', {
          foo: DataTypes.STRING,
          bar: DataTypes.STRING
        },
        {tableName: 'restaurants'});
        this.Location = current.define('location', {
          name: DataTypes.STRING,
          type: DataTypes.ENUM('a', 'b')
        },
        {tableName: 'locations'});
        this.Employee = current.define('employee', {
          first_name: DataTypes.STRING,
          last_name: DataTypes.STRING
        },
        {tableName: 'employees'});
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
        const Restaurant = this.Restaurant;
        return current.createSchema('schema_one').then(() => {
          return current.createSchema('schema_two');
        }).then(() => {
          return Restaurant.sync({force: true, searchPath: SEARCH_PATH_ONE});
        }).then(() => {
          return Restaurant.sync({force: true, searchPath: SEARCH_PATH_TWO});
        }).catch(err => {
          expect(err).to.be.null;
        });
      });

      afterEach('drop schemas', () => {
        return current.dropSchema('schema_one').then(() => {
          return current.dropSchema('schema_two');
        });
      });

      describe('enum case', () => {
        it('able to refresh enum when searchPath is used', function () {
          return this.Location.sync({ force: true });
        });
      });

      describe('Add data via model.create, retrieve via model.findOne', () => {
        it('should be able to insert data into the table in schema_one using create', function() {
          const Restaurant = this.Restaurant;
          let restaurantId;

          return Restaurant.create({
            foo: 'one',
            location_id: locationId
          }, {searchPath: SEARCH_PATH_ONE})
            .then(() => {
              return Restaurant.findOne({
                where: {foo: 'one'}, searchPath: SEARCH_PATH_ONE
              });
            }).then(obj => {
              expect(obj).to.not.be.null;
              expect(obj.foo).to.equal('one');
              restaurantId = obj.id;
              return Restaurant.findById(restaurantId, {searchPath: SEARCH_PATH_ONE});
            }).then(obj => {
              expect(obj).to.not.be.null;
              expect(obj.foo).to.equal('one');
            });
        });

        it('should fail to insert data into schema_two using create', function() {
          const Restaurant = this.Restaurant;

          return Restaurant.create({
            foo: 'test'
          }, {searchPath: SEARCH_PATH_TWO}).catch(err => {
            expect(err).to.not.be.null;
          });
        });

        it('should be able to insert data into the table in schema_two using create', function() {
          const Restaurant = this.Restaurant;
          let restaurantId;

          return Restaurant.create({
            foo: 'two',
            location_id: locationId
          }, {searchPath: SEARCH_PATH_TWO})
            .then(() => {
              return Restaurant.findOne({
                where: {foo: 'two'}, searchPath: SEARCH_PATH_TWO
              });
            }).then(obj => {
              expect(obj).to.not.be.null;
              expect(obj.foo).to.equal('two');
              restaurantId = obj.id;
              return Restaurant.findById(restaurantId, {searchPath: SEARCH_PATH_TWO});
            }).then(obj => {
              expect(obj).to.not.be.null;
              expect(obj.foo).to.equal('two');
            });
        });


        it('should fail to find schema_one object in schema_two', function() {
          const Restaurant = this.Restaurant;

          return Restaurant.findOne({where: {foo: 'one'}, searchPath: SEARCH_PATH_TWO}).then(RestaurantObj => {
            expect(RestaurantObj).to.be.null;
          });
        });

        it('should fail to find schema_two object in schema_one', function() {
          const Restaurant = this.Restaurant;

          return Restaurant.findOne({where: {foo: 'two'}, searchPath: SEARCH_PATH_ONE}).then(RestaurantObj => {
            expect(RestaurantObj).to.be.null;
          });
        });
      });

      describe('Add data via instance.save, retrieve via model.findAll', () => {
        it('should be able to insert data into both schemas using instance.save and retrieve it via findAll', function() {
          const Restaurant = this.Restaurant;

          let restaurauntModel = Restaurant.build({bar: 'one.1'});

          return restaurauntModel.save({searchPath: SEARCH_PATH_ONE})
            .then(() => {
              restaurauntModel = Restaurant.build({bar: 'one.2'});
              return restaurauntModel.save({searchPath: SEARCH_PATH_ONE});
            }).then(() => {
              restaurauntModel = Restaurant.build({bar: 'two.1'});
              return restaurauntModel.save({searchPath: SEARCH_PATH_TWO});
            }).then(() => {
              restaurauntModel = Restaurant.build({bar: 'two.2'});
              return restaurauntModel.save({searchPath: SEARCH_PATH_TWO});
            }).then(() => {
              restaurauntModel = Restaurant.build({bar: 'two.3'});
              return restaurauntModel.save({searchPath: SEARCH_PATH_TWO});
            }).then(() => {
              return Restaurant.findAll({searchPath: SEARCH_PATH_ONE});
            }).then(restaurantsOne => {
              expect(restaurantsOne).to.not.be.null;
              expect(restaurantsOne.length).to.equal(2);
              restaurantsOne.forEach(restaurant => {
                expect(restaurant.bar).to.contain('one');
              });
              return Restaurant.findAndCountAll({searchPath: SEARCH_PATH_ONE});
            }).then(restaurantsOne => {
              expect(restaurantsOne).to.not.be.null;
              expect(restaurantsOne.rows.length).to.equal(2);
              expect(restaurantsOne.count).to.equal(2);
              restaurantsOne.rows.forEach(restaurant => {
                expect(restaurant.bar).to.contain('one');
              });
              return Restaurant.findAll({searchPath: SEARCH_PATH_TWO});
            }).then(restaurantsTwo => {
              expect(restaurantsTwo).to.not.be.null;
              expect(restaurantsTwo.length).to.equal(3);
              restaurantsTwo.forEach(restaurant => {
                expect(restaurant.bar).to.contain('two');
              });
              return Restaurant.findAndCountAll({searchPath: SEARCH_PATH_TWO});
            }).then(restaurantsTwo => {
              expect(restaurantsTwo).to.not.be.null;
              expect(restaurantsTwo.rows.length).to.equal(3);
              expect(restaurantsTwo.count).to.equal(3);
              restaurantsTwo.rows.forEach(restaurant => {
                expect(restaurant.bar).to.contain('two');
              });
            });
        });
      });

      describe('Add data via instance.save, retrieve via model.count and model.find', () => {
        it('should be able to insert data into both schemas using instance.save count it and retrieve it via findAll with where', function() {
          const Restaurant = this.Restaurant;

          let restaurauntModel = Restaurant.build({bar: 'one.1'});

          return restaurauntModel.save({searchPath: SEARCH_PATH_ONE}).then(() => {
            restaurauntModel = Restaurant.build({bar: 'one.2'});
            return restaurauntModel.save({searchPath: SEARCH_PATH_ONE});
          }).then(() => {
            restaurauntModel = Restaurant.build({bar: 'two.1'});
            return restaurauntModel.save({searchPath: SEARCH_PATH_TWO});
          }).then(() => {
            restaurauntModel = Restaurant.build({bar: 'two.2'});
            return restaurauntModel.save({searchPath: SEARCH_PATH_TWO});
          }).then(() => {
            restaurauntModel = Restaurant.build({bar: 'two.3'});
            return restaurauntModel.save({searchPath: SEARCH_PATH_TWO});
          }).then(() => {
            return Restaurant.findAll({
              where: {bar: {$like: 'one%'}},
              searchPath: SEARCH_PATH_ONE
            });
          }).then(restaurantsOne => {
            expect(restaurantsOne).to.not.be.null;
            expect(restaurantsOne.length).to.equal(2);
            restaurantsOne.forEach(restaurant => {
              expect(restaurant.bar).to.contain('one');
            });
            return Restaurant.count({searchPath: SEARCH_PATH_ONE});
          }).then(count => {
            expect(count).to.not.be.null;
            expect(count).to.equal(2);
            return Restaurant.findAll({
              where: {bar: {$like: 'two%'}},
              searchPath: SEARCH_PATH_TWO
            });
          }).then(restaurantsTwo => {
            expect(restaurantsTwo).to.not.be.null;
            expect(restaurantsTwo.length).to.equal(3);
            restaurantsTwo.forEach(restaurant => {
              expect(restaurant.bar).to.contain('two');
            });
            return Restaurant.count({searchPath: SEARCH_PATH_TWO});
          }).then(count => {
            expect(count).to.not.be.null;
            expect(count).to.equal(3);
          });
        });
      });


      describe('Get associated data in public schema via include', () => {
        beforeEach(function() {
          const Location = this.Location;

          return Location.sync({force: true})
            .then(() => {
              return Location.create({name: 'HQ'}).then(() => {
                return Location.findOne({where: {name: 'HQ'}}).then(obj => {
                  expect(obj).to.not.be.null;
                  expect(obj.name).to.equal('HQ');
                  locationId = obj.id;
                });
              });
            })
            .catch(err => {
              expect(err).to.be.null;
            });
        });

        it('should be able to insert and retrieve associated data into the table in schema_one', function() {
          const Restaurant = this.Restaurant;
          const Location = this.Location;

          return Restaurant.create({
            foo: 'one',
            location_id: locationId
          }, {searchPath: SEARCH_PATH_ONE}).then(() => {
            return Restaurant.findOne({
              where: {foo: 'one'}, include: [{
                model: Location, as: 'location'
              }], searchPath: SEARCH_PATH_ONE
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('one');
            expect(obj.location).to.not.be.null;
            expect(obj.location.name).to.equal('HQ');
          });
        });

        it('should be able to insert and retrieve associated data into the table in schema_two', function() {
          const Restaurant = this.Restaurant;
          const Location = this.Location;

          return Restaurant.create({
            foo: 'two',
            location_id: locationId
          }, {searchPath: SEARCH_PATH_TWO}).then(() => {
            return Restaurant.findOne({
              where: {foo: 'two'}, include: [{
                model: Location, as: 'location'
              }], searchPath: SEARCH_PATH_TWO
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('two');
            expect(obj.location).to.not.be.null;
            expect(obj.location.name).to.equal('HQ');
          });
        });
      });


      describe('Get schema specific associated data via include', () => {
        beforeEach(function() {
          const Employee = this.Employee;
          return Employee.sync({force: true, searchPath: SEARCH_PATH_ONE})
            .then(() => {
              return Employee.sync({force: true, searchPath: SEARCH_PATH_TWO});
            })
            .catch(err => {
              expect(err).to.be.null;
            });
        });

        it('should be able to insert and retrieve associated data into the table in schema_one', function() {
          const Restaurant = this.Restaurant;
          const Employee = this.Employee;
          let restaurantId;

          return Restaurant.create({
            foo: 'one'
          }, {searchPath: SEARCH_PATH_ONE}).then(() => {
            return Restaurant.findOne({
              where: {foo: 'one'}, searchPath: SEARCH_PATH_ONE
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('one');
            restaurantId = obj.id;
            return Employee.create({
              first_name: 'Restaurant',
              last_name: 'one',
              restaurant_id: restaurantId
            }, {searchPath: SEARCH_PATH_ONE});
          }).then(() => {
            return Restaurant.findOne({
              where: {foo: 'one'}, searchPath: SEARCH_PATH_ONE, include: [{
                model: Employee, as: 'employees'
              }]
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.employees).to.not.be.null;
            expect(obj.employees.length).to.equal(1);
            expect(obj.employees[0].last_name).to.equal('one');
            return obj.getEmployees({searchPath: SEARCH_PATH_ONE});
          }).then(employees => {
            expect(employees.length).to.equal(1);
            expect(employees[0].last_name).to.equal('one');
            return Employee.findOne({
              where: {last_name: 'one'}, searchPath: SEARCH_PATH_ONE, include: [{
                model: Restaurant, as: 'restaurant'
              }]
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.restaurant).to.not.be.null;
            expect(obj.restaurant.foo).to.equal('one');
            return obj.getRestaurant({searchPath: SEARCH_PATH_ONE});
          }).then(restaurant => {
            expect(restaurant).to.not.be.null;
            expect(restaurant.foo).to.equal('one');
          });
        });

        it('should be able to insert and retrieve associated data into the table in schema_two', function() {
          const Restaurant = this.Restaurant;
          const Employee = this.Employee;
          let restaurantId;

          return Restaurant.create({
            foo: 'two'
          }, {searchPath: SEARCH_PATH_TWO}).then(() => {
            return Restaurant.findOne({
              where: {foo: 'two'}, searchPath: SEARCH_PATH_TWO
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('two');
            restaurantId = obj.id;
            return Employee.create({
              first_name: 'Restaurant',
              last_name: 'two',
              restaurant_id: restaurantId
            }, {searchPath: SEARCH_PATH_TWO});
          }).then(() => {
            return Restaurant.findOne({
              where: {foo: 'two'}, searchPath: SEARCH_PATH_TWO, include: [{
                model: Employee, as: 'employees'
              }]
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.employees).to.not.be.null;
            expect(obj.employees.length).to.equal(1);
            expect(obj.employees[0].last_name).to.equal('two');
            return obj.getEmployees({searchPath: SEARCH_PATH_TWO});
          }).then(employees => {
            expect(employees.length).to.equal(1);
            expect(employees[0].last_name).to.equal('two');
            return Employee.findOne({
              where: {last_name: 'two'}, searchPath: SEARCH_PATH_TWO, include: [{
                model: Restaurant, as: 'restaurant'
              }]
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.restaurant).to.not.be.null;
            expect(obj.restaurant.foo).to.equal('two');
            return obj.getRestaurant({searchPath: SEARCH_PATH_TWO});
          }).then(restaurant => {
            expect(restaurant).to.not.be.null;
            expect(restaurant.foo).to.equal('two');
          });
        });
      });

      describe('concurency tests', () => {
        it('should build and persist instances to 2 schemas concurrently in any order', function() {
          const Restaurant = this.Restaurant;

          let restaurauntModelSchema1 = Restaurant.build({bar: 'one.1'});
          const restaurauntModelSchema2 = Restaurant.build({bar: 'two.1'});

          return restaurauntModelSchema1.save({searchPath: SEARCH_PATH_ONE})
            .then(() => {
              restaurauntModelSchema1 = Restaurant.build({bar: 'one.2'});
              return restaurauntModelSchema2.save({searchPath: SEARCH_PATH_TWO});
            }).then(() => {
              return restaurauntModelSchema1.save({searchPath: SEARCH_PATH_ONE});
            }).then(() => {
              return Restaurant.findAll({searchPath: SEARCH_PATH_ONE});
            }).then(restaurantsOne => {
              expect(restaurantsOne).to.not.be.null;
              expect(restaurantsOne.length).to.equal(2);
              restaurantsOne.forEach(restaurant => {
                expect(restaurant.bar).to.contain('one');
              });
              return Restaurant.findAll({searchPath: SEARCH_PATH_TWO});
            }).then(restaurantsTwo => {
              expect(restaurantsTwo).to.not.be.null;
              expect(restaurantsTwo.length).to.equal(1);
              restaurantsTwo.forEach(restaurant => {
                expect(restaurant.bar).to.contain('two');
              });
            });
        });
      });
    });
  }
});
