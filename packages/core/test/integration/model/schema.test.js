'use strict';

const { expect } = require('chai');
const { createSingleTestSequelizeInstance, sequelize: current } = require('../support');
const { DataTypes, Op } = require('@sequelize/core');

const SCHEMA_ONE = 'schema_one';
const SCHEMA_TWO = 'schema_two';

let locationId;

describe('Model', () => {
  if (!current.dialect.supports.schemas) {
    return;
  }

  describe('global schema', () => {
    let schemaTwoSequelize;
    beforeEach('build restaurant tables', async function () {
      schemaTwoSequelize = createSingleTestSequelizeInstance({
        schema: SCHEMA_TWO,
      });

      this.RestaurantOne = schemaTwoSequelize.define(
        'RestaurantOne',
        {
          foo: DataTypes.STRING,
          bar: DataTypes.STRING,
        },
        { schema: current.dialect.getDefaultSchema(), tableName: 'restaurants' },
      );
      this.LocationOne = schemaTwoSequelize.define(
        'LocationOne',
        {
          name: DataTypes.STRING,
        },
        { schema: current.dialect.getDefaultSchema(), tableName: 'locations' },
      );
      this.RestaurantOne.belongsTo(this.LocationOne, {
        foreignKey: 'location_id',
        foreignKeyConstraints: false,
        as: 'location',
      });

      this.RestaurantTwo = schemaTwoSequelize.define(
        'RestaurantTwo',
        {
          foo: DataTypes.STRING,
          bar: DataTypes.STRING,
        },
        { tableName: 'restaurants' },
      );
      this.LocationTwo = schemaTwoSequelize.define(
        'LocationTwo',
        {
          name: DataTypes.STRING,
        },
        { tableName: 'locations' },
      );
      this.RestaurantTwo.belongsTo(this.LocationTwo, {
        foreignKey: 'location_id',
        foreignKeyConstraints: false,
        as: 'location',
      });

      await schemaTwoSequelize.createSchema(SCHEMA_TWO);
      await schemaTwoSequelize.sync({ force: true });
    });

    describe('Add data via model.create, retrieve via model.findOne', () => {
      it('should be able to sync model without schema option', function () {
        expect(this.RestaurantOne.table.schema).to.eq(current.dialect.getDefaultSchema());
        expect(this.RestaurantTwo.table.schema).to.equal(SCHEMA_TWO);
      });

      it('should be able to insert data into default table using create', async function () {
        await this.RestaurantOne.create({
          foo: 'one',
        });

        const obj0 = await this.RestaurantOne.findOne({
          where: { foo: 'one' },
        });

        expect(obj0).to.not.be.null;
        expect(obj0.foo).to.equal('one');

        const obj = await this.RestaurantTwo.findOne({
          where: { foo: 'one' },
        });

        expect(obj).to.be.null;
      });

      it('should be able to insert data into schema table using create', async function () {
        await this.RestaurantTwo.create({
          foo: 'two',
        });

        const obj0 = await this.RestaurantTwo.findOne({
          where: { foo: 'two' },
        });

        expect(obj0).to.not.be.null;
        expect(obj0.foo).to.equal('two');

        const obj = await this.RestaurantOne.findOne({
          where: { foo: 'two' },
        });

        expect(obj).to.be.null;
      });
    });

    describe('Get associated data in public schema via include', () => {
      beforeEach(async function () {
        await Promise.all([
          this.LocationOne.sync({ force: true }),
          this.LocationTwo.sync({ force: true }),
        ]);

        await this.LocationTwo.create({ name: 'HQ' });
        const obj0 = await this.LocationTwo.findOne({ where: { name: 'HQ' } });
        expect(obj0).to.not.be.null;
        expect(obj0.name).to.equal('HQ');
        locationId = obj0.id;
        const obj = await this.LocationOne.findOne({ where: { name: 'HQ' } });
        expect(obj).to.be.null;
      });

      // TODO: fix https://github.com/sequelize/sequelize/issues/17091
      it.skip('should be able to insert and retrieve associated data into the table in schema_two', async function () {
        await this.RestaurantTwo.create({
          foo: 'two',
          location_id: locationId,
        });

        const obj0 = await this.RestaurantTwo.findOne({
          where: { foo: 'two' },
          include: [
            {
              model: this.LocationTwo,
              as: 'location',
            },
          ],
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
    beforeEach('build restaurant tables', async function () {
      this.Restaurant = current.define(
        'restaurant',
        {
          foo: DataTypes.STRING,
          bar: DataTypes.STRING,
        },
        { tableName: 'restaurants' },
      );
      this.Location = current.define(
        'location',
        {
          name: DataTypes.STRING,
        },
        { tableName: 'locations' },
      );
      this.Employee = current.define(
        'employee',
        {
          first_name: DataTypes.STRING,
          last_name: DataTypes.STRING,
        },
        { tableName: 'employees' },
      );
      this.Restaurant.belongsTo(this.Location, {
        foreignKey: 'location_id',
        foreignKeyConstraints: false,
      });
      this.Employee.belongsTo(this.Restaurant, {
        foreignKey: 'restaurant_id',
        foreignKeyConstraints: false,
      });
      this.Restaurant.hasMany(this.Employee, {
        foreignKey: 'restaurant_id',
        foreignKeyConstraints: false,
      });

      this.EmployeeOne = this.Employee.withSchema(SCHEMA_ONE);
      this.EmployeeTwo = this.Employee.withSchema(SCHEMA_TWO);
      this.RestaurantOne = this.Restaurant.withSchema(SCHEMA_ONE);
      this.RestaurantTwo = this.Restaurant.withSchema(SCHEMA_TWO);

      await Promise.all([current.createSchema(SCHEMA_ONE), current.createSchema(SCHEMA_TWO)]);

      await Promise.all([
        this.RestaurantOne.sync({ force: true }),
        this.RestaurantTwo.sync({ force: true }),
      ]);
    });

    describe('Add data via model.create, retrieve via model.findOne', () => {
      it('should be able to insert data into the table in schema_one using create', async function () {
        await this.RestaurantOne.create({
          foo: 'one',
          location_id: locationId,
        });

        const obj0 = await this.RestaurantOne.findOne({
          where: { foo: 'one' },
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

      it('should be able to insert data into the table in schema_two using create', async function () {
        await this.RestaurantTwo.create({
          foo: 'two',
          location_id: locationId,
        });

        const obj0 = await this.RestaurantTwo.findOne({
          where: { foo: 'two' },
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
      it('should be able to insert data into both schemas using instance.save and retrieve/count it', async function () {
        // building and saving in random order to make sure calling
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
        for (const restaurant of restaurantsOne1) {
          expect(restaurant.bar).to.contain('one');
        }

        const restaurantsOne0 = await this.RestaurantOne.findAndCountAll();
        expect(restaurantsOne0).to.not.be.null;
        expect(restaurantsOne0.rows.length).to.equal(2);
        expect(restaurantsOne0.count).to.equal(2);
        for (const restaurant of restaurantsOne0.rows) {
          expect(restaurant.bar).to.contain('one');
        }

        const restaurantsOne = await this.RestaurantOne.findAll({
          where: { bar: { [Op.like]: '%.1' } },
        });

        expect(restaurantsOne).to.not.be.null;
        expect(restaurantsOne.length).to.equal(1);
        for (const restaurant of restaurantsOne) {
          expect(restaurant.bar).to.contain('one');
        }

        const count0 = await this.RestaurantOne.count();
        expect(count0).to.not.be.null;
        expect(count0).to.equal(2);
        const restaurantsTwo1 = await this.RestaurantTwo.findAll();
        expect(restaurantsTwo1).to.not.be.null;
        expect(restaurantsTwo1.length).to.equal(3);
        for (const restaurant of restaurantsTwo1) {
          expect(restaurant.bar).to.contain('two');
        }

        const restaurantsTwo0 = await this.RestaurantTwo.findAndCountAll();
        expect(restaurantsTwo0).to.not.be.null;
        expect(restaurantsTwo0.rows.length).to.equal(3);
        expect(restaurantsTwo0.count).to.equal(3);
        for (const restaurant of restaurantsTwo0.rows) {
          expect(restaurant.bar).to.contain('two');
        }

        const restaurantsTwo = await this.RestaurantTwo.findAll({
          where: { bar: { [Op.like]: '%.3' } },
        });

        expect(restaurantsTwo).to.not.be.null;
        expect(restaurantsTwo.length).to.equal(1);
        for (const restaurant of restaurantsTwo) {
          expect(restaurant.bar).to.contain('two');
        }

        const count = await this.RestaurantTwo.count();
        expect(count).to.not.be.null;
        expect(count).to.equal(3);
      });
    });

    describe('Get associated data in public schema via include', () => {
      beforeEach(async function () {
        const Location = this.Location;

        await Location.sync({ force: true });
        await Location.create({ name: 'HQ' });
        const obj = await Location.findOne({ where: { name: 'HQ' } });
        expect(obj).to.not.be.null;
        expect(obj.name).to.equal('HQ');
        locationId = obj.id;
      });

      it('should be able to insert and retrieve associated data into the table in schema_one', async function () {
        await this.RestaurantOne.create({
          foo: 'one',
          location_id: locationId,
        });

        const obj = await this.RestaurantOne.findOne({
          where: { foo: 'one' },
          include: [
            {
              model: this.Location,
              as: 'location',
            },
          ],
        });

        expect(obj).to.not.be.null;
        expect(obj.foo).to.equal('one');
        expect(obj.location).to.not.be.null;
        expect(obj.location.name).to.equal('HQ');
      });
    });

    describe('Get schema specific associated data via include', () => {
      beforeEach(async function () {
        await this.EmployeeOne.sync({ force: true });
        await this.EmployeeTwo.sync({ force: true });
      });

      it('should be able to insert and retrieve associated data into the table in schema_one', async function () {
        await this.RestaurantOne.create({
          foo: 'one',
        });

        const obj1 = await this.RestaurantOne.findOne({
          where: { foo: 'one' },
        });

        expect(obj1).to.not.be.null;
        expect(obj1.foo).to.equal('one');
        const restaurantId = obj1.id;

        await this.EmployeeOne.create({
          first_name: 'Restaurant',
          last_name: 'one',
          restaurant_id: restaurantId,
        });

        const obj0 = await this.RestaurantOne.findOne({
          where: { foo: 'one' },
          include: [
            {
              model: this.EmployeeOne,
              as: 'employees',
            },
          ],
        });

        expect(obj0).to.not.be.null;
        expect(obj0.employees).to.not.be.null;
        expect(obj0.employees.length).to.equal(1);
        expect(obj0.employees[0].last_name).to.equal('one');
        const employees = await obj0.getEmployees({ schema: SCHEMA_ONE });
        expect(employees.length).to.equal(1);
        expect(employees[0].last_name).to.equal('one');

        const obj = await this.EmployeeOne.findOne({
          where: { last_name: 'one' },
          include: [
            {
              model: this.RestaurantOne,
              as: 'restaurant',
            },
          ],
        });

        expect(obj).to.not.be.null;
        expect(obj.restaurant).to.not.be.null;
        expect(obj.restaurant.foo).to.equal('one');
        const restaurant = await obj.getRestaurant({ schema: SCHEMA_ONE });
        expect(restaurant).to.not.be.null;
        expect(restaurant.foo).to.equal('one');
      });

      it('should be able to insert and retrieve associated data into the table in schema_two', async function () {
        await this.RestaurantTwo.create({
          foo: 'two',
        });

        const obj1 = await this.RestaurantTwo.findOne({
          where: { foo: 'two' },
        });

        expect(obj1).to.not.be.null;
        expect(obj1.foo).to.equal('two');
        const restaurantId = obj1.id;

        await this.EmployeeTwo.create({
          first_name: 'Restaurant',
          last_name: 'two',
          restaurant_id: restaurantId,
        });

        const obj0 = await this.RestaurantTwo.findOne({
          where: { foo: 'two' },
          include: [
            {
              model: this.EmployeeTwo,
              as: 'employees',
            },
          ],
        });

        expect(obj0).to.not.be.null;
        expect(obj0.employees).to.not.be.null;
        expect(obj0.employees.length).to.equal(1);
        expect(obj0.employees[0].last_name).to.equal('two');
        const employees = await obj0.getEmployees({ schema: SCHEMA_TWO });
        expect(employees.length).to.equal(1);
        expect(employees[0].last_name).to.equal('two');

        const obj = await this.Employee.withSchema(SCHEMA_TWO).findOne({
          where: { last_name: 'two' },
          include: [
            {
              model: this.RestaurantTwo,
              as: 'restaurant',
            },
          ],
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
      it('should build and persist instances to 2 schemas concurrently in any order', async function () {
        const Restaurant = this.Restaurant;

        let restaurauntModelSchema1 = Restaurant.withSchema(SCHEMA_ONE).build({ bar: 'one.1' });
        const restaurauntModelSchema2 = Restaurant.withSchema(SCHEMA_TWO).build({ bar: 'two.1' });

        await restaurauntModelSchema1.save();
        restaurauntModelSchema1 = Restaurant.withSchema(SCHEMA_ONE).build({ bar: 'one.2' });
        await restaurauntModelSchema2.save();
        await restaurauntModelSchema1.save();
        const restaurantsOne = await Restaurant.withSchema(SCHEMA_ONE).findAll();
        expect(restaurantsOne).to.not.be.null;
        expect(restaurantsOne.length).to.equal(2);
        for (const restaurant of restaurantsOne) {
          expect(restaurant.bar).to.contain('one');
        }

        const restaurantsTwo = await Restaurant.withSchema(SCHEMA_TWO).findAll();
        expect(restaurantsTwo).to.not.be.null;
        expect(restaurantsTwo.length).to.equal(1);
        for (const restaurant of restaurantsTwo) {
          expect(restaurant.bar).to.contain('two');
        }
      });
    });
  });
});
