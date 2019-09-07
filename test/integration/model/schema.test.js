'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  dialect = Support.getTestDialect(),
  DataTypes = require('../../../lib/data-types'),
  current = Support.sequelize,
  Op = Support.Sequelize.Op,
  Promise = Support.Sequelize.Promise;

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
              this.RestaurantOne.sync({ force: true }),
              this.RestaurantTwo.sync({ force: true })
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
              where: { foo: 'one' }
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('one');
            return this.RestaurantTwo.findOne({
              where: { foo: 'one' }
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
              where: { foo: 'two' }
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('two');
            return this.RestaurantOne.findOne({
              where: { foo: 'two' }
            });
          }).then(obj => {
            expect(obj).to.be.null;
          });
        });
      });

      describe('Get associated data in public schema via include', () => {
        beforeEach(function() {
          return Promise.all([
            this.LocationOne.sync({ force: true }),
            this.LocationTwo.sync({ force: true })
          ]).then(() => {
            return this.LocationTwo.create({ name: 'HQ' });
          }).then(() => {
            return this.LocationTwo.findOne({ where: { name: 'HQ' } });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.name).to.equal('HQ');
            locationId = obj.id;
            return this.LocationOne.findOne({ where: { name: 'HQ' } });
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
              where: { foo: 'two' }, include: [{
                model: this.LocationTwo, as: 'location'
              }]
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('two');
            expect(obj.location).to.not.be.null;
            expect(obj.location.name).to.equal('HQ');
            return this.RestaurantOne.findOne({ where: { foo: 'two' } });
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
        { tableName: 'restaurants' });
        this.Location = current.define('location', {
          name: DataTypes.STRING
        },
        { tableName: 'locations' });
        this.Employee = current.define('employee', {
          first_name: DataTypes.STRING,
          last_name: DataTypes.STRING
        },
        { tableName: 'employees' });
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
        return Promise.all([
          current.createSchema(SCHEMA_ONE),
          current.createSchema(SCHEMA_TWO)
        ]).then(() => {
          return Promise.all([
            this.RestaurantOne.sync({ force: true }),
            this.RestaurantTwo.sync({ force: true })
          ]);
        });
      });

      afterEach('drop schemas', () => {
        return Promise.all([
          current.dropSchema(SCHEMA_ONE),
          current.dropSchema(SCHEMA_TWO)
        ]);
      });

      describe('Add data via model.create, retrieve via model.findOne', () => {
        it('should be able to insert data into the table in schema_one using create', function() {
          let restaurantId;

          return this.RestaurantOne.create({
            foo: 'one',
            location_id: locationId
          }).then(() => {
            return this.RestaurantOne.findOne({
              where: { foo: 'one' }
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('one');
            restaurantId = obj.id;
            return this.RestaurantOne.findByPk(restaurantId);
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('one');
            return this.RestaurantTwo.findOne({ where: { foo: 'one' } }).then(RestaurantObj => {
              expect(RestaurantObj).to.be.null;
            });
          });
        });

        it('should be able to insert data into the table in schema_two using create', function() {
          let restaurantId;

          return this.RestaurantTwo.create({
            foo: 'two',
            location_id: locationId
          }).then(() => {
            return this.RestaurantTwo.findOne({
              where: { foo: 'two' }
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('two');
            restaurantId = obj.id;
            return this.RestaurantTwo.findByPk(restaurantId);
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('two');
            return this.RestaurantOne.findOne({ where: { foo: 'two' } }).then(RestaurantObj => {
              expect(RestaurantObj).to.be.null;
            });
          });
        });
      });

      describe('Persist and retrieve data', () => {
        it('should be able to insert data into both schemas using instance.save and retrieve/count it', function() {
          //building and saving in random order to make sure calling
          // .schema doesn't impact model prototype
          let restaurauntModel = this.RestaurantOne.build({ bar: 'one.1' });

          return restaurauntModel.save()
            .then(() => {
              restaurauntModel = this.RestaurantTwo.build({ bar: 'two.1' });
              return restaurauntModel.save();
            }).then(() => {
              restaurauntModel = this.RestaurantOne.build({ bar: 'one.2' });
              return restaurauntModel.save();
            }).then(() => {
              restaurauntModel = this.RestaurantTwo.build({ bar: 'two.2' });
              return restaurauntModel.save();
            }).then(() => {
              restaurauntModel = this.RestaurantTwo.build({ bar: 'two.3' });
              return restaurauntModel.save();
            }).then(() => {
              return this.RestaurantOne.findAll();
            }).then(restaurantsOne => {
              expect(restaurantsOne).to.not.be.null;
              expect(restaurantsOne.length).to.equal(2);
              restaurantsOne.forEach(restaurant => {
                expect(restaurant.bar).to.contain('one');
              });
              return this.RestaurantOne.findAndCountAll();
            }).then(restaurantsOne => {
              expect(restaurantsOne).to.not.be.null;
              expect(restaurantsOne.rows.length).to.equal(2);
              expect(restaurantsOne.count).to.equal(2);
              restaurantsOne.rows.forEach(restaurant => {
                expect(restaurant.bar).to.contain('one');
              });
              return this.RestaurantOne.findAll({
                where: { bar: { [Op.like]: '%.1' } }
              });
            }).then(restaurantsOne => {
              expect(restaurantsOne).to.not.be.null;
              expect(restaurantsOne.length).to.equal(1);
              restaurantsOne.forEach(restaurant => {
                expect(restaurant.bar).to.contain('one');
              });
              return this.RestaurantOne.count();
            }).then(count => {
              expect(count).to.not.be.null;
              expect(count).to.equal(2);
              return this.RestaurantTwo.findAll();
            }).then(restaurantsTwo => {
              expect(restaurantsTwo).to.not.be.null;
              expect(restaurantsTwo.length).to.equal(3);
              restaurantsTwo.forEach(restaurant => {
                expect(restaurant.bar).to.contain('two');
              });
              return this.RestaurantTwo.findAndCountAll();
            }).then(restaurantsTwo => {
              expect(restaurantsTwo).to.not.be.null;
              expect(restaurantsTwo.rows.length).to.equal(3);
              expect(restaurantsTwo.count).to.equal(3);
              restaurantsTwo.rows.forEach(restaurant => {
                expect(restaurant.bar).to.contain('two');
              });
              return this.RestaurantTwo.findAll({
                where: { bar: { [Op.like]: '%.3' } }
              });
            }).then(restaurantsTwo => {
              expect(restaurantsTwo).to.not.be.null;
              expect(restaurantsTwo.length).to.equal(1);
              restaurantsTwo.forEach(restaurant => {
                expect(restaurant.bar).to.contain('two');
              });
              return this.RestaurantTwo.count();
            }).then(count => {
              expect(count).to.not.be.null;
              expect(count).to.equal(3);
            });
        });
      });

      describe('Get associated data in public schema via include', () => {
        beforeEach(function() {
          const Location = this.Location;

          return Location.sync({ force: true })
            .then(() => {
              return Location.create({ name: 'HQ' }).then(() => {
                return Location.findOne({ where: { name: 'HQ' } }).then(obj => {
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
          return this.RestaurantOne.create({
            foo: 'one',
            location_id: locationId
          }).then(() => {
            return this.RestaurantOne.findOne({
              where: { foo: 'one' }, include: [{
                model: this.Location, as: 'location'
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
            Employee.schema(SCHEMA_ONE).sync({ force: true }),
            Employee.schema(SCHEMA_TWO).sync({ force: true })
          ]);
        });

        it('should be able to insert and retrieve associated data into the table in schema_one', function() {
          let restaurantId;

          return this.RestaurantOne.create({
            foo: 'one'
          }).then(() => {
            return this.RestaurantOne.findOne({
              where: { foo: 'one' }
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('one');
            restaurantId = obj.id;
            return this.EmployeeOne.create({
              first_name: 'Restaurant',
              last_name: 'one',
              restaurant_id: restaurantId
            });
          }).then(() => {
            return this.RestaurantOne.findOne({
              where: { foo: 'one' }, include: [{
                model: this.EmployeeOne, as: 'employees'
              }]
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.employees).to.not.be.null;
            expect(obj.employees.length).to.equal(1);
            expect(obj.employees[0].last_name).to.equal('one');
            return obj.getEmployees({ schema: SCHEMA_ONE });
          }).then(employees => {
            expect(employees.length).to.equal(1);
            expect(employees[0].last_name).to.equal('one');
            return this.EmployeeOne.findOne({
              where: { last_name: 'one' }, include: [{
                model: this.RestaurantOne, as: 'restaurant'
              }]
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.restaurant).to.not.be.null;
            expect(obj.restaurant.foo).to.equal('one');
            return obj.getRestaurant({ schema: SCHEMA_ONE });
          }).then(restaurant => {
            expect(restaurant).to.not.be.null;
            expect(restaurant.foo).to.equal('one');
          });
        });


        it('should be able to insert and retrieve associated data into the table in schema_two', function() {
          let restaurantId;

          return this.RestaurantTwo.create({
            foo: 'two'
          }).then(() => {
            return this.RestaurantTwo.findOne({
              where: { foo: 'two' }
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.foo).to.equal('two');
            restaurantId = obj.id;
            return this.Employee.schema(SCHEMA_TWO).create({
              first_name: 'Restaurant',
              last_name: 'two',
              restaurant_id: restaurantId
            });
          }).then(() => {
            return this.RestaurantTwo.findOne({
              where: { foo: 'two' }, include: [{
                model: this.Employee.schema(SCHEMA_TWO), as: 'employees'
              }]
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.employees).to.not.be.null;
            expect(obj.employees.length).to.equal(1);
            expect(obj.employees[0].last_name).to.equal('two');
            return obj.getEmployees({ schema: SCHEMA_TWO });
          }).then(employees => {
            expect(employees.length).to.equal(1);
            expect(employees[0].last_name).to.equal('two');
            return this.Employee.schema(SCHEMA_TWO).findOne({
              where: { last_name: 'two' }, include: [{
                model: this.RestaurantTwo, as: 'restaurant'
              }]
            });
          }).then(obj => {
            expect(obj).to.not.be.null;
            expect(obj.restaurant).to.not.be.null;
            expect(obj.restaurant.foo).to.equal('two');
            return obj.getRestaurant({ schema: SCHEMA_TWO });
          }).then(restaurant => {
            expect(restaurant).to.not.be.null;
            expect(restaurant.foo).to.equal('two');
          });
        });
      });

      describe('concurency tests', () => {
        it('should build and persist instances to 2 schemas concurrently in any order', function() {
          const Restaurant = this.Restaurant;

          let restaurauntModelSchema1 = Restaurant.schema(SCHEMA_ONE).build({ bar: 'one.1' });
          const restaurauntModelSchema2 = Restaurant.schema(SCHEMA_TWO).build({ bar: 'two.1' });

          return restaurauntModelSchema1.save()
            .then(() => {
              restaurauntModelSchema1 = Restaurant.schema(SCHEMA_ONE).build({ bar: 'one.2' });
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

      describe('regressions', () => {
        it('should be able to sync model with schema', function() {
          const User = this.sequelize.define('User1', {
            name: DataTypes.STRING,
            value: DataTypes.INTEGER
          }, {
            schema: SCHEMA_ONE,
            indexes: [
              {
                name: 'test_slug_idx',
                fields: ['name']
              }
            ]
          });

          const Task = this.sequelize.define('Task2', {
            name: DataTypes.STRING,
            value: DataTypes.INTEGER
          }, {
            schema: SCHEMA_TWO,
            indexes: [
              {
                name: 'test_slug_idx',
                fields: ['name']
              }
            ]
          });

          return User.sync({ force: true }).then(() => {
            return Task.sync({ force: true });
          }).then(() => {
            return Promise.all([
              this.sequelize.queryInterface.describeTable(User.tableName, SCHEMA_ONE),
              this.sequelize.queryInterface.describeTable(Task.tableName, SCHEMA_TWO)
            ]);
          }).then(([user, task]) => {
            expect(user).to.be.ok;
            expect(task).to.be.ok;
          });
        });

        // TODO: this should work with MSSQL / MariaDB too
        // Need to fix addSchema return type
        if (dialect.match(/^postgres/)) {
          it('defaults to schema provided to sync() for references #11276', function() {
            const User = this.sequelize.define('UserXYZ', {
                uid: {
                  type: DataTypes.INTEGER,
                  primaryKey: true,
                  autoIncrement: true,
                  allowNull: false
                }
              }),
              Task = this.sequelize.define('TaskXYZ', {
              });

            Task.belongsTo(User);

            return User.sync({ force: true, schema: SCHEMA_ONE }).then(() => {
              return Task.sync({ force: true, schema: SCHEMA_ONE });
            }).then(() => {
              return User.schema(SCHEMA_ONE).create({});
            }).then(user => {
              return Task.schema(SCHEMA_ONE).create({}).then(task => {
                return task.setUserXYZ(user).then(() => {
                  return task.getUserXYZ({ schema: SCHEMA_ONE });
                });
              });
            }).then(user => {
              expect(user).to.be.ok;
            });
          });
        }
      });
    });
  }
});
