'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  current = Support.sequelize,
  Promise   = current.Promise;
const SCHEMA_ONE = 'schema_one';
const SCHEMA_TWO = 'schema_two';

let locationId;

describe(Support.getTestDialectTeaser('Model'), () => {
  if (current.dialect.supports.schemas) {

    describe('global schema', () => {
      before(function() {
        current.options.schema = null;
        this.RestaurantOne = current.define('restaurant', {
          foo: DataTypes.STRING,
          bar: DataTypes.STRING
        });
        this.LocationOne = current.define('location', {
          name: DataTypes.STRING
        });
        this.RestaurantOne.belongsTo(this.LocationOne,
          {
            foreignKey: 'location_id',
            constraints: false
          });
        current.options.schema = SCHEMA_TWO;
        this.RestaurantTwo = current.define('restaurant', {
          foo: DataTypes.STRING,
          bar: DataTypes.STRING
        });
        this.LocationTwo = current.define('location', {
          name: DataTypes.STRING
        });
        this.RestaurantTwo.belongsTo(this.LocationTwo,
          {
            foreignKey: 'location_id',
            constraints: false
          });
        current.options.schema = null;
      });

      beforeEach('build restaurant tables', function() {
        return current.createSchema(SCHEMA_TWO)
          .then(() => {
            return Promise.all([
              this.RestaurantOne.sync({force: true}),
              this.RestaurantTwo.sync({force: true})
            ]);
          });
      });

      afterEach('drop schemas', () => {
        return current.dropSchema(SCHEMA_TWO);
      });

      describe('Add data via model.create, retrieve via model.findOne', () => {
        it('should be able to sync model without schema option', function() {
          expect(this.RestaurantOne._schema).to.be.null;
          expect(this.RestaurantTwo._schema).to.equal(SCHEMA_TWO);
        });

        it('should be able to insert data into default table using create', function() {
          return this.RestaurantOne.create({
            foo: 'one'
          }).then(() => {
            return this.RestaurantOne.findOne({
              where: {foo: 'one'}
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('one');
            return this.RestaurantTwo.findOne({
              where: {foo: 'one'}
            });
          }).then(obj => {
            expect(obj).to.be.null;
          });
        });

        it('should be able to insert data into schema table using create', function() {
          return this.RestaurantTwo.create({
            foo: 'two'
          }).then(() => {
            return this.RestaurantTwo.findOne({
              where: {foo: 'two'}
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('two');
            return this.RestaurantOne.findOne({
              where: {foo: 'two'}
            });
          }).then(obj => {
            expect(obj).to.be.null;
          });
        });
      });
      
      describe('Get associated data in public schema via include', () => {
        beforeEach(function() {
          return Promise.all([
            this.LocationOne.sync({force: true}),
            this.LocationTwo.sync({force: true})
          ]).then(() => {
            return this.LocationTwo.create({name: 'HQ'});
          }).then(() => {
            return this.LocationTwo.findOne({where: {name: 'HQ'}});
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.name).to.equal('HQ');
            locationId = obj.id;
            return this.LocationOne.findOne({where: {name: 'HQ'}});
          }).then(obj => {
            expect(obj).to.be.null;
          });
        });

        it('should be able to insert and retrieve associated data into the table in schema_two', function() {
          return this.RestaurantTwo.create({
            foo: 'two',
            location_id: locationId
          }).then(() => {
            return this.RestaurantTwo.findOne({
              where: {foo: 'two'}, include: [{
                model: this.LocationTwo, as: 'location'
              }]
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('two');
            expect(obj.location).to.not.be.null;
            expect(obj.location.name).to.equal('HQ');
            return this.RestaurantOne.findOne({where: {foo: 'two'}});
          }).then(obj => {
            expect(obj).to.be.null;
          });
        });
      });
    });

    describe('schemas', () => {
      before(function() {
        this.Restaurant = current.define('restaurant', {
          foo: DataTypes.STRING,
          bar: DataTypes.STRING
        },
        {tableName: 'restaurants'});
        this.Location = current.define('location', {
          name: DataTypes.STRING
        },
        {tableName: 'locations'});
        this.Employee = current.define('employee', {
          first_name: DataTypes.STRING,
          last_name: DataTypes.STRING
        },
        {tableName: 'employees'});
        this.EmployeeOne = this.Employee.schema(SCHEMA_ONE);
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
        this.RestaurantOne = this.Restaurant.schema(SCHEMA_ONE);
        this.RestaurantTwo = this.Restaurant.schema(SCHEMA_TWO);
      });


      beforeEach('build restaurant tables', function() {
        const self = this;
        return Promise.all([
          current.createSchema('schema_one'),
          current.createSchema('schema_two')
        ]).then(() => {
          return Promise.all([
            self.RestaurantOne.sync({force: true}),
            self.RestaurantTwo.sync({force: true})
          ]);
        });
      });

      afterEach('drop schemas', () => {
        return Promise.all([
          current.dropSchema('schema_one'),
          current.dropSchema('schema_two')
        ]);
      });

      describe('Add data via model.create, retrieve via model.findOne', () => {
        it('should be able to insert data into the table in schema_one using create', function() {
          const self = this;
          let restaurantId;

          return self.RestaurantOne.create({
            foo: 'one',
            location_id: locationId
          }).then(() => {
            return self.RestaurantOne.findOne({
              where: {foo: 'one'}
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('one');
            restaurantId = obj.id;
            return self.RestaurantOne.findById(restaurantId);
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('one');
            return self.RestaurantTwo.findOne({where: {foo: 'one'}}).then(RestaurantObj => {
              expect(RestaurantObj).to.be.null;
            });
          });
        });

        it('should be able to insert data into the table in schema_two using create', function() {
          const self = this;
          let restaurantId;

          return self.RestaurantTwo.create({
            foo: 'two',
            location_id: locationId
          }).then(() => {
            return self.RestaurantTwo.findOne({
              where: {foo: 'two'}
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('two');
            restaurantId = obj.id;
            return self.RestaurantTwo.findById(restaurantId);
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('two');
            return self.RestaurantOne.findOne({where: {foo: 'two'}}).then(RestaurantObj => {
              expect(RestaurantObj).to.be.null;
            });
          });
        });
      });

      describe('Persist and retrieve data', () => {
        it('should be able to insert data into both schemas using instance.save and retrieve/count it', function() {
          const self = this;

          //building and saving in random order to make sure calling
          // .schema doesn't impact model prototype
          let restaurauntModel = self.RestaurantOne.build({bar: 'one.1'});

          return restaurauntModel.save()
            .then(() => {
              restaurauntModel = self.RestaurantTwo.build({bar: 'two.1'});
              return restaurauntModel.save();
            }).then(() => {
              restaurauntModel = self.RestaurantOne.build({bar: 'one.2'});
              return restaurauntModel.save();
            }).then(() => {
              restaurauntModel = self.RestaurantTwo.build({bar: 'two.2'});
              return restaurauntModel.save();
            }).then(() => {
              restaurauntModel = self.RestaurantTwo.build({bar: 'two.3'});
              return restaurauntModel.save();
            }).then(() => {
              return self.RestaurantOne.findAll();
            }).then(restaurantsOne => {
              expect(restaurantsOne).to.not.be.null;
              expect(restaurantsOne.length).to.equal(2);
              restaurantsOne.forEach(restaurant => {
                expect(restaurant.bar).to.contain('one');
              });
              return self.RestaurantOne.findAndCountAll();
            }).then(restaurantsOne => {
              expect(restaurantsOne).to.not.be.null;
              expect(restaurantsOne.rows.length).to.equal(2);
              expect(restaurantsOne.count).to.equal(2);
              restaurantsOne.rows.forEach(restaurant => {
                expect(restaurant.bar).to.contain('one');
              });
              return self.RestaurantOne.findAll({
                where: {bar: {$like: '%.1'}}
              });
            }).then(restaurantsOne => {
              expect(restaurantsOne).to.not.be.null;
              expect(restaurantsOne.length).to.equal(1);
              restaurantsOne.forEach(restaurant => {
                expect(restaurant.bar).to.contain('one');
              });
              return self.RestaurantOne.count();
            }).then(count => {
              expect(count).to.not.be.null;
              expect(count).to.equal(2);
              return self.RestaurantTwo.findAll();
            }).then(restaurantsTwo => {
              expect(restaurantsTwo).to.not.be.null;
              expect(restaurantsTwo.length).to.equal(3);
              restaurantsTwo.forEach(restaurant => {
                expect(restaurant.bar).to.contain('two');
              });
              return self.RestaurantTwo.findAndCountAll();
            }).then(restaurantsTwo => {
              expect(restaurantsTwo).to.not.be.null;
              expect(restaurantsTwo.rows.length).to.equal(3);
              expect(restaurantsTwo.count).to.equal(3);
              restaurantsTwo.rows.forEach(restaurant => {
                expect(restaurant.bar).to.contain('two');
              });
              return self.RestaurantTwo.findAll({
                where: {bar: {$like: '%.3'}}
              });
            }).then(restaurantsTwo => {
              expect(restaurantsTwo).to.not.be.null;
              expect(restaurantsTwo.length).to.equal(1);
              restaurantsTwo.forEach(restaurant => {
                expect(restaurant.bar).to.contain('two');
              });
              return self.RestaurantTwo.count();
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
          const self = this;

          return self.RestaurantOne.create({
            foo: 'one',
            location_id: locationId
          }).then(() => {
            return self.RestaurantOne.findOne({
              where: {foo: 'one'}, include: [{
                model: self.Location, as: 'location'
              }]
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('one');
            expect(obj.location).to.not.be.null;
            expect(obj.location.name).to.equal('HQ');
          });
        });
      });


      describe('Get schema specific associated data via include', () => {
        beforeEach(function() {
          const Employee = this.Employee;
          return Promise.all([
            Employee.schema(SCHEMA_ONE).sync({force: true}),
            Employee.schema(SCHEMA_TWO).sync({force: true})
          ]);
        });

        it('should be able to insert and retrieve associated data into the table in schema_one', function() {
          const self = this;
          let restaurantId;

          return self.RestaurantOne.create({
            foo: 'one'
          }).then(() => {
            return self.RestaurantOne.findOne({
              where: {foo: 'one'}
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('one');
            restaurantId = obj.id;
            return self.EmployeeOne.create({
              first_name: 'Restaurant',
              last_name: 'one',
              restaurant_id: restaurantId
            });
          }).then(() => {
            return self.RestaurantOne.findOne({
              where: {foo: 'one'}, include: [{
                model: self.EmployeeOne, as: 'employees'
              }]
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.employees).to.not.be.null;
            expect(obj.employees.length).to.equal(1);
            expect(obj.employees[0].last_name).to.equal('one');
            return obj.getEmployees({schema: SCHEMA_ONE});
          }).then(employees => {
            expect(employees.length).to.equal(1);
            expect(employees[0].last_name).to.equal('one');
            return self.EmployeeOne.findOne({
              where: {last_name: 'one'}, include: [{
                model: self.RestaurantOne, as: 'restaurant'
              }]
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.restaurant).to.not.be.null;
            expect(obj.restaurant.foo).to.equal('one');
            return obj.getRestaurant({schema: SCHEMA_ONE});
          }).then(restaurant => {
            expect(restaurant).to.not.be.null;
            expect(restaurant.foo).to.equal('one');
          });
        });


        it('should be able to insert and retrieve associated data into the table in schema_two', function() {
          const self = this;
          let restaurantId;

          return self.RestaurantTwo.create({
            foo: 'two'
          }).then(() => {
            return self.RestaurantTwo.findOne({
              where: {foo: 'two'}
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('two');
            restaurantId = obj.id;
            return self.Employee.schema(SCHEMA_TWO).create({
              first_name: 'Restaurant',
              last_name: 'two',
              restaurant_id: restaurantId
            });
          }).then(() => {
            return self.RestaurantTwo.findOne({
              where: {foo: 'two'}, include: [{
                model: self.Employee.schema(SCHEMA_TWO), as: 'employees'
              }]
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.employees).to.not.be.null;
            expect(obj.employees.length).to.equal(1);
            expect(obj.employees[0].last_name).to.equal('two');
            return obj.getEmployees({schema: SCHEMA_TWO});
          }).then(employees => {
            expect(employees.length).to.equal(1);
            expect(employees[0].last_name).to.equal('two');
            return self.Employee.schema(SCHEMA_TWO).findOne({
              where: {last_name: 'two'}, include: [{
                model: self.RestaurantTwo, as: 'restaurant'
              }]
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.restaurant).to.not.be.null;
            expect(obj.restaurant.foo).to.equal('two');
            return obj.getRestaurant({schema: SCHEMA_TWO});
          }).then(restaurant => {
            expect(restaurant).to.not.be.null;
            expect(restaurant.foo).to.equal('two');
          });
        });
      });

      describe('concurency tests', () => {
        it('should build and persist instances to 2 schemas concurrently in any order', function() {
          const Restaurant = this.Restaurant;

          let restaurauntModelSchema1 = Restaurant.schema(SCHEMA_ONE).build({bar: 'one.1'});
          const restaurauntModelSchema2 = Restaurant.schema(SCHEMA_TWO).build({bar: 'two.1'});

          return restaurauntModelSchema1.save()
            .then(() => {
              restaurauntModelSchema1 = Restaurant.schema(SCHEMA_ONE).build({bar: 'one.2'});
              return restaurauntModelSchema2.save();
            }).then(() => {
              return restaurauntModelSchema1.save();
            }).then(() => {
              return Restaurant.schema(SCHEMA_ONE).findAll();
            }).then(restaurantsOne => {
              expect(restaurantsOne).to.not.be.null;
              expect(restaurantsOne.length).to.equal(2);
              restaurantsOne.forEach(restaurant => {
                expect(restaurant.bar).to.contain('one');
              });
              return Restaurant.schema(SCHEMA_TWO).findAll();
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
