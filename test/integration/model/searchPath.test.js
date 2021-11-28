'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('../support');
const DataTypes = require('sequelize/lib/data-types');
const Op = Support.Sequelize.Op;

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
        { tableName: 'restaurants' });
        this.Location = current.define('location', {
          name: DataTypes.STRING,
          type: DataTypes.ENUM('a', 'b')
        },
        { tableName: 'locations' });
        this.Employee = current.define('employee', {
          first_name: DataTypes.STRING,
          last_name: DataTypes.STRING
        },
        { tableName: 'employees' });
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

      beforeEach('build restaurant tables', async function() {
        const Restaurant = this.Restaurant;

        try {
          await current.createSchema('schema_one');
          await current.createSchema('schema_two');
          await Restaurant.sync({ force: true, searchPath: SEARCH_PATH_ONE });
          await Restaurant.sync({ force: true, searchPath: SEARCH_PATH_TWO });
        } catch (err) {
          expect(err).to.be.null;
        }
      });

      afterEach('drop schemas', async () => {
        await current.dropSchema('schema_one');
        await current.dropSchema('schema_two');
      });

      describe('enum case', () => {
        it('able to refresh enum when searchPath is used', async function() {
          await this.Location.sync({ force: true });
        });
      });

      describe('Add data via model.create, retrieve via model.findOne', () => {
        it('should be able to insert data into the table in schema_one using create', async function() {
          const Restaurant = this.Restaurant;

          await Restaurant.create({
            foo: 'one',
            location_id: locationId
          }, { searchPath: SEARCH_PATH_ONE });

          const obj0 = await Restaurant.findOne({
            where: { foo: 'one' }, searchPath: SEARCH_PATH_ONE
          });

          expect(obj0).to.not.be.null;
          expect(obj0.foo).to.equal('one');
          const restaurantId = obj0.id;
          const obj = await Restaurant.findByPk(restaurantId, { searchPath: SEARCH_PATH_ONE });
          expect(obj).to.not.be.null;
          expect(obj.foo).to.equal('one');
        });

        it('should fail to insert data into schema_two using create', async function() {
          const Restaurant = this.Restaurant;

          try {
            await Restaurant.create({
              foo: 'test'
            }, { searchPath: SEARCH_PATH_TWO });
          } catch (err) {
            expect(err).to.not.be.null;
          }
        });

        it('should be able to insert data into the table in schema_two using create', async function() {
          const Restaurant = this.Restaurant;

          await Restaurant.create({
            foo: 'two',
            location_id: locationId
          }, { searchPath: SEARCH_PATH_TWO });

          const obj0 = await Restaurant.findOne({
            where: { foo: 'two' }, searchPath: SEARCH_PATH_TWO
          });

          expect(obj0).to.not.be.null;
          expect(obj0.foo).to.equal('two');
          const restaurantId = obj0.id;
          const obj = await Restaurant.findByPk(restaurantId, { searchPath: SEARCH_PATH_TWO });
          expect(obj).to.not.be.null;
          expect(obj.foo).to.equal('two');
        });


        it('should fail to find schema_one object in schema_two', async function() {
          const Restaurant = this.Restaurant;

          const RestaurantObj = await Restaurant.findOne({ where: { foo: 'one' }, searchPath: SEARCH_PATH_TWO });
          expect(RestaurantObj).to.be.null;
        });

        it('should fail to find schema_two object in schema_one', async function() {
          const Restaurant = this.Restaurant;

          const RestaurantObj = await Restaurant.findOne({ where: { foo: 'two' }, searchPath: SEARCH_PATH_ONE });
          expect(RestaurantObj).to.be.null;
        });
      });

      describe('Add data via instance.save, retrieve via model.findAll', () => {
        it('should be able to insert data into both schemas using instance.save and retrieve it via findAll', async function() {
          const Restaurant = this.Restaurant;

          let restaurauntModel = Restaurant.build({ bar: 'one.1' });

          await restaurauntModel.save({ searchPath: SEARCH_PATH_ONE });
          restaurauntModel = Restaurant.build({ bar: 'one.2' });
          await restaurauntModel.save({ searchPath: SEARCH_PATH_ONE });
          restaurauntModel = Restaurant.build({ bar: 'two.1' });
          await restaurauntModel.save({ searchPath: SEARCH_PATH_TWO });
          restaurauntModel = Restaurant.build({ bar: 'two.2' });
          await restaurauntModel.save({ searchPath: SEARCH_PATH_TWO });
          restaurauntModel = Restaurant.build({ bar: 'two.3' });
          await restaurauntModel.save({ searchPath: SEARCH_PATH_TWO });
          const restaurantsOne0 = await Restaurant.findAll({ searchPath: SEARCH_PATH_ONE });
          expect(restaurantsOne0).to.not.be.null;
          expect(restaurantsOne0.length).to.equal(2);
          restaurantsOne0.forEach(restaurant => {
            expect(restaurant.bar).to.contain('one');
          });
          const restaurantsOne = await Restaurant.findAndCountAll({ searchPath: SEARCH_PATH_ONE });
          expect(restaurantsOne).to.not.be.null;
          expect(restaurantsOne.rows.length).to.equal(2);
          expect(restaurantsOne.count).to.equal(2);
          restaurantsOne.rows.forEach(restaurant => {
            expect(restaurant.bar).to.contain('one');
          });
          const restaurantsTwo0 = await Restaurant.findAll({ searchPath: SEARCH_PATH_TWO });
          expect(restaurantsTwo0).to.not.be.null;
          expect(restaurantsTwo0.length).to.equal(3);
          restaurantsTwo0.forEach(restaurant => {
            expect(restaurant.bar).to.contain('two');
          });
          const restaurantsTwo = await Restaurant.findAndCountAll({ searchPath: SEARCH_PATH_TWO });
          expect(restaurantsTwo).to.not.be.null;
          expect(restaurantsTwo.rows.length).to.equal(3);
          expect(restaurantsTwo.count).to.equal(3);
          restaurantsTwo.rows.forEach(restaurant => {
            expect(restaurant.bar).to.contain('two');
          });
        });
      });

      describe('Add data via instance.save, retrieve via model.count and model.find', () => {
        it('should be able to insert data into both schemas using instance.save count it and retrieve it via findAll with where', async function() {
          const Restaurant = this.Restaurant;

          let restaurauntModel = Restaurant.build({ bar: 'one.1' });

          await restaurauntModel.save({ searchPath: SEARCH_PATH_ONE });
          restaurauntModel = Restaurant.build({ bar: 'one.2' });
          await restaurauntModel.save({ searchPath: SEARCH_PATH_ONE });
          restaurauntModel = Restaurant.build({ bar: 'two.1' });
          await restaurauntModel.save({ searchPath: SEARCH_PATH_TWO });
          restaurauntModel = Restaurant.build({ bar: 'two.2' });
          await restaurauntModel.save({ searchPath: SEARCH_PATH_TWO });
          restaurauntModel = Restaurant.build({ bar: 'two.3' });
          await restaurauntModel.save({ searchPath: SEARCH_PATH_TWO });

          const restaurantsOne = await Restaurant.findAll({
            where: { bar: { [Op.like]: 'one%' } },
            searchPath: SEARCH_PATH_ONE
          });

          expect(restaurantsOne).to.not.be.null;
          expect(restaurantsOne.length).to.equal(2);
          restaurantsOne.forEach(restaurant => {
            expect(restaurant.bar).to.contain('one');
          });
          const count0 = await Restaurant.count({ searchPath: SEARCH_PATH_ONE });
          expect(count0).to.not.be.null;
          expect(count0).to.equal(2);

          const restaurantsTwo = await Restaurant.findAll({
            where: { bar: { [Op.like]: 'two%' } },
            searchPath: SEARCH_PATH_TWO
          });

          expect(restaurantsTwo).to.not.be.null;
          expect(restaurantsTwo.length).to.equal(3);
          restaurantsTwo.forEach(restaurant => {
            expect(restaurant.bar).to.contain('two');
          });
          const count = await Restaurant.count({ searchPath: SEARCH_PATH_TWO });
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
          const Restaurant = this.Restaurant;
          const Location = this.Location;

          await Restaurant.create({
            foo: 'one',
            location_id: locationId
          }, { searchPath: SEARCH_PATH_ONE });

          const obj = await Restaurant.findOne({
            where: { foo: 'one' }, include: [{
              model: Location, as: 'location'
            }], searchPath: SEARCH_PATH_ONE
          });

          expect(obj).to.not.be.null;
          expect(obj.foo).to.equal('one');
          expect(obj.location).to.not.be.null;
          expect(obj.location.name).to.equal('HQ');
        });

        it('should be able to insert and retrieve associated data into the table in schema_two', async function() {
          const Restaurant = this.Restaurant;
          const Location = this.Location;

          await Restaurant.create({
            foo: 'two',
            location_id: locationId
          }, { searchPath: SEARCH_PATH_TWO });

          const obj = await Restaurant.findOne({
            where: { foo: 'two' }, include: [{
              model: Location, as: 'location'
            }], searchPath: SEARCH_PATH_TWO
          });

          expect(obj).to.not.be.null;
          expect(obj.foo).to.equal('two');
          expect(obj.location).to.not.be.null;
          expect(obj.location.name).to.equal('HQ');
        });
      });


      describe('Get schema specific associated data via include', () => {
        beforeEach(async function() {
          const Employee = this.Employee;

          try {
            await Employee.sync({ force: true, searchPath: SEARCH_PATH_ONE });
            await Employee.sync({ force: true, searchPath: SEARCH_PATH_TWO });
          } catch (err) {
            expect(err).to.be.null;
          }
        });

        it('should be able to insert and retrieve associated data into the table in schema_one', async function() {
          const Restaurant = this.Restaurant;
          const Employee = this.Employee;
          await Restaurant.create({
            foo: 'one'
          }, { searchPath: SEARCH_PATH_ONE });

          const obj1 = await Restaurant.findOne({
            where: { foo: 'one' }, searchPath: SEARCH_PATH_ONE
          });

          expect(obj1).to.not.be.null;
          expect(obj1.foo).to.equal('one');
          const restaurantId = obj1.id;

          await Employee.create({
            first_name: 'Restaurant',
            last_name: 'one',
            restaurant_id: restaurantId
          }, { searchPath: SEARCH_PATH_ONE });

          const obj0 = await Restaurant.findOne({
            where: { foo: 'one' }, searchPath: SEARCH_PATH_ONE, include: [{
              model: Employee, as: 'employees'
            }]
          });

          expect(obj0).to.not.be.null;
          expect(obj0.employees).to.not.be.null;
          expect(obj0.employees.length).to.equal(1);
          expect(obj0.employees[0].last_name).to.equal('one');
          const employees = await obj0.getEmployees({ searchPath: SEARCH_PATH_ONE });
          expect(employees.length).to.equal(1);
          expect(employees[0].last_name).to.equal('one');

          const obj = await Employee.findOne({
            where: { last_name: 'one' }, searchPath: SEARCH_PATH_ONE, include: [{
              model: Restaurant, as: 'restaurant'
            }]
          });

          expect(obj).to.not.be.null;
          expect(obj.restaurant).to.not.be.null;
          expect(obj.restaurant.foo).to.equal('one');
          const restaurant = await obj.getRestaurant({ searchPath: SEARCH_PATH_ONE });
          expect(restaurant).to.not.be.null;
          expect(restaurant.foo).to.equal('one');
        });

        it('should be able to insert and retrieve associated data into the table in schema_two', async function() {
          const Restaurant = this.Restaurant;
          const Employee = this.Employee;

          await Restaurant.create({
            foo: 'two'
          }, { searchPath: SEARCH_PATH_TWO });

          const obj1 = await Restaurant.findOne({
            where: { foo: 'two' }, searchPath: SEARCH_PATH_TWO
          });

          expect(obj1).to.not.be.null;
          expect(obj1.foo).to.equal('two');
          const restaurantId = obj1.id;

          await Employee.create({
            first_name: 'Restaurant',
            last_name: 'two',
            restaurant_id: restaurantId
          }, { searchPath: SEARCH_PATH_TWO });

          const obj0 = await Restaurant.findOne({
            where: { foo: 'two' }, searchPath: SEARCH_PATH_TWO, include: [{
              model: Employee, as: 'employees'
            }]
          });

          expect(obj0).to.not.be.null;
          expect(obj0.employees).to.not.be.null;
          expect(obj0.employees.length).to.equal(1);
          expect(obj0.employees[0].last_name).to.equal('two');
          const employees = await obj0.getEmployees({ searchPath: SEARCH_PATH_TWO });
          expect(employees.length).to.equal(1);
          expect(employees[0].last_name).to.equal('two');

          const obj = await Employee.findOne({
            where: { last_name: 'two' }, searchPath: SEARCH_PATH_TWO, include: [{
              model: Restaurant, as: 'restaurant'
            }]
          });

          expect(obj).to.not.be.null;
          expect(obj.restaurant).to.not.be.null;
          expect(obj.restaurant.foo).to.equal('two');
          const restaurant = await obj.getRestaurant({ searchPath: SEARCH_PATH_TWO });
          expect(restaurant).to.not.be.null;
          expect(restaurant.foo).to.equal('two');
        });
      });

      describe('concurency tests', () => {
        it('should build and persist instances to 2 schemas concurrently in any order', async function() {
          const Restaurant = this.Restaurant;

          let restaurauntModelSchema1 = Restaurant.build({ bar: 'one.1' });
          const restaurauntModelSchema2 = Restaurant.build({ bar: 'two.1' });

          await restaurauntModelSchema1.save({ searchPath: SEARCH_PATH_ONE });
          restaurauntModelSchema1 = Restaurant.build({ bar: 'one.2' });
          await restaurauntModelSchema2.save({ searchPath: SEARCH_PATH_TWO });
          await restaurauntModelSchema1.save({ searchPath: SEARCH_PATH_ONE });
          const restaurantsOne = await Restaurant.findAll({ searchPath: SEARCH_PATH_ONE });
          expect(restaurantsOne).to.not.be.null;
          expect(restaurantsOne.length).to.equal(2);
          restaurantsOne.forEach(restaurant => {
            expect(restaurant.bar).to.contain('one');
          });
          const restaurantsTwo = await Restaurant.findAll({ searchPath: SEARCH_PATH_TWO });
          expect(restaurantsTwo).to.not.be.null;
          expect(restaurantsTwo.length).to.equal(1);
          restaurantsTwo.forEach(restaurant => {
            expect(restaurant.bar).to.contain('two');
          });
        });
      });

      describe('Edit data via instance.update, retrieve updated instance via model.findAll', () => {
        it('should be able to update data via instance update in both schemas, and retrieve it via findAll with where', async function() {
          const Restaurant = this.Restaurant;

          const rnt = await Restaurant.create({ foo: 'one', bar: '1' }, { searchPath: SEARCH_PATH_ONE });

          await Promise.all([
            await rnt.update({ bar: 'x.1' }, { searchPath: SEARCH_PATH_ONE }),
            Restaurant.create({ foo: 'one', bar: '2' }, { searchPath: SEARCH_PATH_ONE })
              .then(rnt => rnt.update({ bar: 'x.2' }, { searchPath: SEARCH_PATH_ONE })),
            Restaurant.create({ foo: 'two', bar: '1' }, { searchPath: SEARCH_PATH_TWO })
              .then(rnt => rnt.update({ bar: 'x.1' }, { searchPath: SEARCH_PATH_TWO })),
            Restaurant.create({ foo: 'two', bar: '2' }, { searchPath: SEARCH_PATH_TWO })
              .then(rnt => rnt.update({ bar: 'x.2' }, { searchPath: SEARCH_PATH_TWO }))
          ]);

          await Promise.all([
            (async () => {
              const restaurantsOne = await Restaurant.findAll({
                where: { bar: 'x.1' },
                searchPath: SEARCH_PATH_ONE
              });

              expect(restaurantsOne.length).to.equal(1);
              expect(restaurantsOne[0].foo).to.equal('one');
              expect(restaurantsOne[0].bar).to.equal('x.1');
            })(),
            (async () => {
              const restaurantsTwo = await Restaurant.findAll({
                where: { bar: 'x.2' },
                searchPath: SEARCH_PATH_TWO
              });

              expect(restaurantsTwo.length).to.equal(1);
              expect(restaurantsTwo[0].foo).to.equal('two');
              expect(restaurantsTwo[0].bar).to.equal('x.2');
            })()
          ]);
        });
      });
    });
  }
});
