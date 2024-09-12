'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  dialect = Support.getTestDialect(),
  DataTypes = require('sequelize/lib/data-types'),
  current = Support.sequelize,
  Op = Support.Sequelize.Op;

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

      beforeEach('build restaurant tables', async function() {
        await current.createSchema(SCHEMA_TWO);

        await Promise.all([
          this.RestaurantOne.sync({ force: true }),
          this.RestaurantTwo.sync({ force: true })
        ]);
      });

      afterEach('drop schemas', async () => {
        await current.dropSchema(SCHEMA_TWO);
      });

      describe('Add data via model.create, retrieve via model.findOne', () => {
        it('should be able to sync model without schema option', function() {
          expect(this.RestaurantOne._schema).to.be.null;
          expect(this.RestaurantTwo._schema).to.equal(SCHEMA_TWO);
        });

        it('should be able to insert data into default table using create', async function() {
          await this.RestaurantOne.create({
            foo: 'one'
          });

          const obj0 = await this.RestaurantOne.findOne({
            where: { foo: 'one' }
          });

          expect(obj0).to.not.be.null;
          expect(obj0.foo).to.equal('one');

          const obj = await this.RestaurantTwo.findOne({
            where: { foo: 'one' }
          });

          expect(obj).to.be.null;
        });

        it('should be able to insert data into schema table using create', async function() {
          await this.RestaurantTwo.create({
            foo: 'two'
          });

          const obj0 = await this.RestaurantTwo.findOne({
            where: { foo: 'two' }
          });

          expect(obj0).to.not.be.null;
          expect(obj0.foo).to.equal('two');

          const obj = await this.RestaurantOne.findOne({
            where: { foo: 'two' }
          });

          expect(obj).to.be.null;
        });
      });

      describe('Get associated data in public schema via include', () => {
        beforeEach(async function() {
          await Promise.all([
            this.LocationOne.sync({ force: true }),
            this.LocationTwo.sync({ force: true })
          ]);

          await this.LocationTwo.create({ name: 'HQ' });
          const obj0 = await this.LocationTwo.findOne({ where: { name: 'HQ' } });
          expect(obj0).to.not.be.null;
          expect(obj0.name).to.equal('HQ');
          locationId = obj0.id;
          const obj = await this.LocationOne.findOne({ where: { name: 'HQ' } });
          expect(obj).to.be.null;
        });

        it('should be able to insert and retrieve associated data into the table in schema_two', async function() {
          await this.RestaurantTwo.create({
            foo: 'two',
            location_id: locationId
          });

          const obj0 = await this.RestaurantTwo.findOne({
            where: { foo: 'two' }, include: [{
              model: this.LocationTwo, as: 'location'
            }]
          });

          expect(obj0).to.not.be.null;
          expect(obj0.foo).to.equal('two');
          expect(obj0.location).to.not.be.null;
          expect(obj0.location.name).to.equal('HQ');
          const obj = await this.RestaurantOne.findOne({ where: { foo: 'two' } });
          expect(obj).to.be.null;
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


      beforeEach('build restaurant tables', async function() {
        await Promise.all([
          current.createSchema(SCHEMA_ONE),
          current.createSchema(SCHEMA_TWO)
        ]);

        await Promise.all([
          this.RestaurantOne.sync({ force: true }),
          this.RestaurantTwo.sync({ force: true })
        ]);
      });

      afterEach('drop schemas', async () => {
        await Promise.all([
          current.dropSchema(SCHEMA_ONE),
          current.dropSchema(SCHEMA_TWO)
        ]);
      });

      describe('Add data via model.create, retrieve via model.findOne', () => {
        it('should be able to insert data into the table in schema_one using create', async function() {
          await this.RestaurantOne.create({
            foo: 'one',
            location_id: locationId
          });

          const obj0 = await this.RestaurantOne.findOne({
            where: { foo: 'one' }
          });

          expect(obj0).to.not.be.null;
          expect(obj0.foo).to.equal('one');
          const restaurantId = obj0.id;
          const obj = await this.RestaurantOne.findByPk(restaurantId);
          expect(obj).to.not.be.null;
          expect(obj.foo).to.equal('one');
          const RestaurantObj = await this.RestaurantTwo.findOne({ where: { foo: 'one' } });
          expect(RestaurantObj).to.be.null;
        });

        it('should be able to insert data into the table in schema_two using create', async function() {
          await this.RestaurantTwo.create({
            foo: 'two',
            location_id: locationId
          });

          const obj0 = await this.RestaurantTwo.findOne({
            where: { foo: 'two' }
          });

          expect(obj0).to.not.be.null;
          expect(obj0.foo).to.equal('two');
          const restaurantId = obj0.id;
          const obj = await this.RestaurantTwo.findByPk(restaurantId);
          expect(obj).to.not.be.null;
          expect(obj.foo).to.equal('two');
          const RestaurantObj = await this.RestaurantOne.findOne({ where: { foo: 'two' } });
          expect(RestaurantObj).to.be.null;
        });
      });

      describe('Persist and retrieve data', () => {
        it('should be able to insert data into both schemas using instance.save and retrieve/count it', async function() {
          //building and saving in random order to make sure calling
          // .schema doesn't impact model prototype
          let restaurauntModel = this.RestaurantOne.build({ bar: 'one.1' });

          await restaurauntModel.save();
          restaurauntModel = this.RestaurantTwo.build({ bar: 'two.1' });
          await restaurauntModel.save();
          restaurauntModel = this.RestaurantOne.build({ bar: 'one.2' });
          await restaurauntModel.save();
          restaurauntModel = this.RestaurantTwo.build({ bar: 'two.2' });
          await restaurauntModel.save();
          restaurauntModel = this.RestaurantTwo.build({ bar: 'two.3' });
          await restaurauntModel.save();
          const restaurantsOne1 = await this.RestaurantOne.findAll();
          expect(restaurantsOne1).to.not.be.null;
          expect(restaurantsOne1.length).to.equal(2);
          restaurantsOne1.forEach(restaurant => {
            expect(restaurant.bar).to.contain('one');
          });
          const restaurantsOne0 = await this.RestaurantOne.findAndCountAll();
          expect(restaurantsOne0).to.not.be.null;
          expect(restaurantsOne0.rows.length).to.equal(2);
          expect(restaurantsOne0.count).to.equal(2);
          restaurantsOne0.rows.forEach(restaurant => {
            expect(restaurant.bar).to.contain('one');
          });

          const restaurantsOne = await this.RestaurantOne.findAll({
            where: { bar: { [Op.like]: '%.1' } }
          });

          expect(restaurantsOne).to.not.be.null;
          expect(restaurantsOne.length).to.equal(1);
          restaurantsOne.forEach(restaurant => {
            expect(restaurant.bar).to.contain('one');
          });
          const count0 = await this.RestaurantOne.count();
          expect(count0).to.not.be.null;
          expect(count0).to.equal(2);
          const restaurantsTwo1 = await this.RestaurantTwo.findAll();
          expect(restaurantsTwo1).to.not.be.null;
          expect(restaurantsTwo1.length).to.equal(3);
          restaurantsTwo1.forEach(restaurant => {
            expect(restaurant.bar).to.contain('two');
          });
          const restaurantsTwo0 = await this.RestaurantTwo.findAndCountAll();
          expect(restaurantsTwo0).to.not.be.null;
          expect(restaurantsTwo0.rows.length).to.equal(3);
          expect(restaurantsTwo0.count).to.equal(3);
          restaurantsTwo0.rows.forEach(restaurant => {
            expect(restaurant.bar).to.contain('two');
          });

          const restaurantsTwo = await this.RestaurantTwo.findAll({
            where: { bar: { [Op.like]: '%.3' } }
          });

          expect(restaurantsTwo).to.not.be.null;
          expect(restaurantsTwo.length).to.equal(1);
          restaurantsTwo.forEach(restaurant => {
            expect(restaurant.bar).to.contain('two');
          });
          const count = await this.RestaurantTwo.count();
          expect(count).to.not.be.null;
          expect(count).to.equal(3);
        });
      });

      describe('Get associated data in public schema via include', () => {
        beforeEach(async function() {
          const Location = this.Location;

          try {
            await Location.sync({ force: true });
            await Location.create({ name: 'HQ' });
            const obj = await Location.findOne({ where: { name: 'HQ' } });
            expect(obj).to.not.be.null;
            expect(obj.name).to.equal('HQ');
            locationId = obj.id;
          } catch (err) {
            expect(err).to.be.null;
          }
        });

        it('should be able to insert and retrieve associated data into the table in schema_one', async function() {
          await this.RestaurantOne.create({
            foo: 'one',
            location_id: locationId
          });

          const obj = await this.RestaurantOne.findOne({
            where: { foo: 'one' }, include: [{
              model: this.Location, as: 'location'
            }]
          });

          expect(obj).to.not.be.null;
          expect(obj.foo).to.equal('one');
          expect(obj.location).to.not.be.null;
          expect(obj.location.name).to.equal('HQ');
        });
      });


      describe('Get schema specific associated data via include', () => {
        beforeEach(async function() {
          const Employee = this.Employee;

          await Promise.all([
            Employee.schema(SCHEMA_ONE).sync({ force: true }),
            Employee.schema(SCHEMA_TWO).sync({ force: true })
          ]);
        });

        it('should be able to insert and retrieve associated data into the table in schema_one', async function() {
          await this.RestaurantOne.create({
            foo: 'one'
          });

          const obj1 = await this.RestaurantOne.findOne({
            where: { foo: 'one' }
          });

          expect(obj1).to.not.be.null;
          expect(obj1.foo).to.equal('one');
          const restaurantId = obj1.id;

          await this.EmployeeOne.create({
            first_name: 'Restaurant',
            last_name: 'one',
            restaurant_id: restaurantId
          });

          const obj0 = await this.RestaurantOne.findOne({
            where: { foo: 'one' }, include: [{
              model: this.EmployeeOne, as: 'employees'
            }]
          });

          expect(obj0).to.not.be.null;
          expect(obj0.employees).to.not.be.null;
          expect(obj0.employees.length).to.equal(1);
          expect(obj0.employees[0].last_name).to.equal('one');
          const employees = await obj0.getEmployees({ schema: SCHEMA_ONE });
          expect(employees.length).to.equal(1);
          expect(employees[0].last_name).to.equal('one');

          const obj = await this.EmployeeOne.findOne({
            where: { last_name: 'one' }, include: [{
              model: this.RestaurantOne, as: 'restaurant'
            }]
          });

          expect(obj).to.not.be.null;
          expect(obj.restaurant).to.not.be.null;
          expect(obj.restaurant.foo).to.equal('one');
          const restaurant = await obj.getRestaurant({ schema: SCHEMA_ONE });
          expect(restaurant).to.not.be.null;
          expect(restaurant.foo).to.equal('one');
        });


        it('should be able to insert and retrieve associated data into the table in schema_two', async function() {
          await this.RestaurantTwo.create({
            foo: 'two'
          });

          const obj1 = await this.RestaurantTwo.findOne({
            where: { foo: 'two' }
          });

          expect(obj1).to.not.be.null;
          expect(obj1.foo).to.equal('two');
          const restaurantId = obj1.id;

          await this.Employee.schema(SCHEMA_TWO).create({
            first_name: 'Restaurant',
            last_name: 'two',
            restaurant_id: restaurantId
          });

          const obj0 = await this.RestaurantTwo.findOne({
            where: { foo: 'two' }, include: [{
              model: this.Employee.schema(SCHEMA_TWO), as: 'employees'
            }]
          });

          expect(obj0).to.not.be.null;
          expect(obj0.employees).to.not.be.null;
          expect(obj0.employees.length).to.equal(1);
          expect(obj0.employees[0].last_name).to.equal('two');
          const employees = await obj0.getEmployees({ schema: SCHEMA_TWO });
          expect(employees.length).to.equal(1);
          expect(employees[0].last_name).to.equal('two');

          const obj = await this.Employee.schema(SCHEMA_TWO).findOne({
            where: { last_name: 'two' }, include: [{
              model: this.RestaurantTwo, as: 'restaurant'
            }]
          });

          expect(obj).to.not.be.null;
          expect(obj.restaurant).to.not.be.null;
          expect(obj.restaurant.foo).to.equal('two');
          const restaurant = await obj.getRestaurant({ schema: SCHEMA_TWO });
          expect(restaurant).to.not.be.null;
          expect(restaurant.foo).to.equal('two');
        });
      });

      describe('concurency tests', () => {
        it('should build and persist instances to 2 schemas concurrently in any order', async function() {
          const Restaurant = this.Restaurant;

          let restaurauntModelSchema1 = Restaurant.schema(SCHEMA_ONE).build({ bar: 'one.1' });
          const restaurauntModelSchema2 = Restaurant.schema(SCHEMA_TWO).build({ bar: 'two.1' });

          await restaurauntModelSchema1.save();
          restaurauntModelSchema1 = Restaurant.schema(SCHEMA_ONE).build({ bar: 'one.2' });
          await restaurauntModelSchema2.save();
          await restaurauntModelSchema1.save();
          const restaurantsOne = await Restaurant.schema(SCHEMA_ONE).findAll();
          expect(restaurantsOne).to.not.be.null;
          expect(restaurantsOne.length).to.equal(2);
          restaurantsOne.forEach(restaurant => {
            expect(restaurant.bar).to.contain('one');
          });
          const restaurantsTwo = await Restaurant.schema(SCHEMA_TWO).findAll();
          expect(restaurantsTwo).to.not.be.null;
          expect(restaurantsTwo.length).to.equal(1);
          restaurantsTwo.forEach(restaurant => {
            expect(restaurant.bar).to.contain('two');
          });
        });
      });

      describe('regressions', () => {
        it('should be able to sync model with schema', async function() {
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

          await User.sync({ force: true });
          await Task.sync({ force: true });

          const [user, task] = await Promise.all([
            this.sequelize.queryInterface.describeTable(User.tableName, SCHEMA_ONE),
            this.sequelize.queryInterface.describeTable(Task.tableName, SCHEMA_TWO)
          ]);

          expect(user).to.be.ok;
          expect(task).to.be.ok;
        });

        // TODO: this should work with MSSQL / MariaDB too
        // Need to fix addSchema return type
        if (dialect.match(/^postgres/)) {
          it('defaults to schema provided to sync() for references #11276', async function() {
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

            await User.sync({ force: true, schema: SCHEMA_ONE });
            await Task.sync({ force: true, schema: SCHEMA_ONE });
            const user0 = await User.schema(SCHEMA_ONE).create({});
            const task = await Task.schema(SCHEMA_ONE).create({});
            await task.setUserXYZ(user0);
            const user = await task.getUserXYZ({ schema: SCHEMA_ONE });
            expect(user).to.be.ok;
          });
        }
      });
    });
  }
});
