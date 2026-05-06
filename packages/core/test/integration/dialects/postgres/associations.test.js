'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const dialect = Support.getTestDialect();
const { DataTypes } = require('@sequelize/core');

if (dialect.startsWith('postgres')) {
  describe('[POSTGRES Specific] associations', () => {
    describe('many-to-many', () => {
      describe('where tables have the same prefix', () => {
        it('should create a table wp_table1wp_table2s', function () {
          const Table2 = this.sequelize.define('wp_table2', { foo: DataTypes.STRING });
          const Table1 = this.sequelize.define('wp_table1', { foo: DataTypes.STRING });

          Table1.belongsToMany(Table2, { through: 'wp_table1swp_table2s' });
          Table2.belongsToMany(Table1, { through: 'wp_table1swp_table2s' });

          expect(this.sequelize.models.get('wp_table1swp_table2s')).to.exist;
        });
      });

      describe('when join table name is specified', () => {
        beforeEach(function () {
          const Table2 = this.sequelize.define('ms_table1', { foo: DataTypes.STRING });
          const Table1 = this.sequelize.define('ms_table2', { foo: DataTypes.STRING });

          Table1.belongsToMany(Table2, { through: 'table1_to_table2' });
          Table2.belongsToMany(Table1, { through: 'table1_to_table2' });
        });

        it('should not use a combined name', function () {
          expect(this.sequelize.models.get('ms_table1sms_table2s')).not.to.exist;
        });

        it('should use the specified name', function () {
          expect(this.sequelize.models.get('table1_to_table2')).to.exist;
        });
      });

      describe('correctly generates joins for nested includes', () => {
        beforeEach(async function () {
          // Shared setup for nested include tests
          this.minifiedSequelize = Support.createSequelizeInstance({
            minifyAliases: true,
            define: {
              timestamps: false,
            },
          });
          Support.destroySequelizeAfterTest(this.minifiedSequelize);

          this.CustomerLocation = this.minifiedSequelize.define(
            'CustomerLocation',
            {
              customerId: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
              },
              locationId: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                allowNull: false,
              },
              relationType: DataTypes.TEXT,
              endAt: {
                type: DataTypes.DATE(6),
                allowNull: true,
              },
            },
            {
              indexes: [
                {
                  fields: ['endAt'],
                },
              ],
            },
          );

          this.Customer = this.minifiedSequelize.define('Customer', {
            id: {
              type: DataTypes.INTEGER,
              autoIncrement: true,
              primaryKey: true,
            },
            name: DataTypes.TEXT,
          });

          this.Location = this.minifiedSequelize.define('Location', {
            id: {
              type: DataTypes.INTEGER,
              autoIncrement: true,
              primaryKey: true,
            },
            name: DataTypes.TEXT,
          });

          this.System = this.minifiedSequelize.define('System', {
            id: {
              type: DataTypes.INTEGER,
              autoIncrement: true,
              primaryKey: true,
            },
            name: DataTypes.TEXT,
            locationId: DataTypes.INTEGER,
          });

          this.FuelDelivery = this.minifiedSequelize.define('FuelDelivery', {
            id: {
              type: DataTypes.INTEGER,
              autoIncrement: true,
              primaryKey: true,
            },
            product: DataTypes.TEXT,
            systemId: DataTypes.INTEGER,
          });

          this.Location.hasMany(this.System, { as: 'systems', foreignKey: 'locationId' });
          this.System.belongsTo(this.Location, { as: 'location', foreignKey: 'locationId' });

          this.Location.belongsToMany(this.Customer, {
            as: 'customers',
            through: {
              model: this.CustomerLocation,
              scope: { endAt: null },
            },
            foreignKey: 'locationId',
            otherKey: 'customerId',
            inverse: {
              as: 'locations',
            },
          });

          this.System.hasMany(this.FuelDelivery, { as: 'fuelDeliveries', foreignKey: 'systemId' });
          this.FuelDelivery.belongsTo(this.System, { as: 'system', foreignKey: 'systemId' });

          await this.minifiedSequelize.sync({ force: true });

          this.firstCustomer = await this.Customer.create({ name: 'Propane Delivery Co' });
          this.secondCustomer = await this.Customer.create({ name: 'Kozy Operations Inc' });
          this.locationInstance = await this.Location.create({ name: 'Fuel Depot' });

          await this.CustomerLocation.create({
            customerId: this.firstCustomer.id,
            locationId: this.locationInstance.id,
            relationType: 'primary',
          });

          await this.CustomerLocation.create({
            customerId: this.secondCustomer.id,
            locationId: this.locationInstance.id,
            relationType: 'secondary',
          });

          this.systemInstance = await this.System.create({
            name: 'Kozy Operations Inc',
            locationId: this.locationInstance.id,
          });

          this.deliveryInstance = await this.FuelDelivery.create({
            product: 'Propane',
            systemId: this.systemInstance.id,
          });
        });

        it('loads customers from nested required includes', async function () {
          const delivery = await this.FuelDelivery.findByPk(this.deliveryInstance.id, {
            include: [
              {
                association: 'system',
                required: true,
                include: [
                  {
                    association: 'location',
                    required: true,
                    include: [
                      {
                        association: 'customers',
                        required: true,
                      },
                    ],
                  },
                ],
              },
            ],
          });

          expect(delivery).to.not.be.null;
          expect(delivery.system).to.not.be.undefined;
          expect(delivery.system.location).to.not.be.undefined;

          const customers = delivery.system.location.customers;
          expect(customers).to.not.be.undefined;
          expect(customers).to.have.length(2);
          expect(customers.map(customer => customer.id)).to.have.members([
            this.firstCustomer.id,
            this.secondCustomer.id,
          ]);
        });

        it('loads nested customers from the inverse association tree', async function () {
          await this.FuelDelivery.findByPk(this.deliveryInstance.id, {
            include: [
              {
                association: 'system',
                required: true,
                include: [
                  {
                    association: 'location',
                    required: true,
                    include: [
                      {
                        association: 'customers',
                        required: true,
                      },
                    ],
                  },
                ],
              },
            ],
          });

          const customer = await this.Customer.findOne({
            include: [
              {
                association: 'locations',
                include: [
                  {
                    association: 'customers',
                  },
                ],
              },
            ],
            order: [['id', 'ASC']],
          });

          expect(customer).to.not.be.null;

          const locations = customer.locations ?? [];
          expect(locations.length).to.be.greaterThan(0);

          const nestedCustomers = locations[0].customers ?? [];
          expect(nestedCustomers.length).to.be.greaterThan(0);
          expect(nestedCustomers.map(entry => entry.id)).to.include(this.firstCustomer.id);
        });

        it('supports deeply nested includes with repeated alias chains', async function () {
          const delivery = await this.FuelDelivery.findByPk(this.deliveryInstance.id, {
            include: [
              {
                association: 'system',
                include: [
                  {
                    association: 'location',
                    include: [
                      {
                        association: 'customers',
                        required: true,
                        include: [
                          {
                            association: 'locations',
                            required: false,
                            include: [
                              {
                                association: 'systems',
                                where: { name: 'Kozy Operations Inc' },
                                required: true,
                                include: [
                                  {
                                    association: 'location',
                                    include: [
                                      {
                                        association: 'customers',
                                        required: false,
                                        include: [
                                          {
                                            association: 'locations',
                                            required: false,
                                            include: [
                                              {
                                                association: 'systems',
                                                where: { name: 'Kozy Operations Inc' },
                                                required: false,
                                              },
                                            ],
                                          },
                                        ],
                                      },
                                    ],
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          });

          expect(delivery).to.not.be.null;
          expect(delivery.system).to.not.be.undefined;
          expect(delivery.system.location).to.not.be.undefined;

          const customers = delivery.system.location.customers ?? [];
          expect(customers).to.have.length(2);

          const firstCustomer = customers[0];
          expect(firstCustomer.locations).to.not.be.undefined;
          const firstLocation = firstCustomer.locations?.[0];
          expect(firstLocation).to.not.be.undefined;
          expect(firstLocation.systems).to.not.be.undefined;
          expect(firstLocation.systems?.[0]?.name).to.equal('Kozy Operations Inc');

          const deepestSystems =
            firstLocation.systems?.[0]?.location?.customers?.[0]?.locations?.[0]?.systems;
          expect(deepestSystems).to.not.be.undefined;
          expect(deepestSystems?.[0]?.name).to.equal('Kozy Operations Inc');
        });

        it('keeps nested required includes when applying a limit', async function () {
          const delivery = await this.FuelDelivery.findByPk(this.deliveryInstance.id, {
            include: [
              {
                association: 'system',
                include: [
                  {
                    association: 'location',
                    include: [
                      {
                        association: 'customers',
                        required: true,
                        include: [
                          {
                            association: 'locations',
                            required: false,
                            include: [
                              {
                                association: 'systems',
                                where: { name: 'Kozy Operations Inc' },
                                required: true,
                                include: [
                                  {
                                    association: 'location',
                                    include: [
                                      {
                                        association: 'customers',
                                        required: false,
                                        include: [
                                          {
                                            association: 'locations',
                                            required: true,
                                            include: [
                                              {
                                                association: 'systems',
                                                where: { name: 'Kozy Operations Inc' },
                                                required: false,
                                              },
                                            ],
                                          },
                                        ],
                                      },
                                    ],
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          });

          expect(delivery).to.not.be.null;
          expect(delivery.system).to.not.be.undefined;
          expect(delivery.system.location).to.not.be.undefined;

          const customers = delivery.system.location.customers ?? [];
          expect(customers).to.have.length(2);

          const firstCustomer = customers[0];
          expect(firstCustomer.locations).to.not.be.undefined;
          const firstLocation = firstCustomer.locations?.[0];
          expect(firstLocation).to.not.be.undefined;
          expect(firstLocation.systems).to.not.be.undefined;
          expect(firstLocation.systems?.[0]?.name).to.equal('Kozy Operations Inc');

          const deepestSystems =
            firstLocation.systems?.[0]?.location?.customers?.[0]?.locations?.[0]?.systems;
          expect(deepestSystems).to.not.be.undefined;
          expect(deepestSystems?.[0]?.name).to.equal('Kozy Operations Inc');
        });

        it('should still work with nested includes and no subquery', async function () {
          const customers = await this.locationInstance.getCustomers({
            subQuery: false,
            include: [
              {
                association: 'locations',
                required: false,
                include: [
                  {
                    association: 'customers',
                    required: true,
                    include: [
                      {
                        association: 'locations',
                        required: false,
                        include: [
                          {
                            association: 'customers',
                            required: false,
                            include: [
                              {
                                association: 'locations',
                                required: true,
                                include: [
                                  {
                                    association: 'customers',
                                    required: true,
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
            order: [['id', 'ASC']],
          });

          expect(customers).to.have.length(2);
          expect(customers[0].locations?.[0]?.customers?.map(customer => customer.id)).to.include(
            this.firstCustomer.id,
          );
          expect(
            customers[0].locations?.[0]?.customers?.[0]?.locations?.[0]?.customers?.map(
              customer => customer.id,
            ),
          ).to.include(this.firstCustomer.id);
          expect(
            customers[0].locations?.[0]?.customers?.[0]?.locations?.[0]?.customers?.map(
              customer => customer.id,
            ),
          ).to.include(this.secondCustomer.id);
        });
      });
    });

    describe('HasMany', () => {
      describe('addDAO / getModel', () => {
        beforeEach(async function () {
          // prevent periods from occurring in the table name since they are used to delimit (table.column)
          this.User = this.sequelize.define(`User${Support.rand()}`, { name: DataTypes.STRING });
          this.Task = this.sequelize.define(`Task${Support.rand()}`, { name: DataTypes.STRING });
          this.users = null;
          this.tasks = null;

          this.User.belongsToMany(this.Task, { as: 'Tasks', through: 'usertasks' });
          this.Task.belongsToMany(this.User, { as: 'Users', through: 'usertasks' });

          const users = [];
          const tasks = [];

          for (let i = 0; i < 5; ++i) {
            users[i] = { name: `User${Math.random()}` };
            tasks[i] = { name: `Task${Math.random()}` };
          }

          await this.sequelize.sync({ force: true });
          await this.User.bulkCreate(users);
          await this.Task.bulkCreate(tasks);
          const _users = await this.User.findAll();
          const _tasks = await this.Task.findAll();
          this.user = _users[0];
          this.task = _tasks[0];
        });

        it('should correctly add an association to the dao', async function () {
          expect(await this.user.getTasks()).to.have.length(0);
          await this.user.addTask(this.task);
          expect(await this.user.getTasks()).to.have.length(1);
        });
      });

      describe('removeDAO', () => {
        it('should correctly remove associated objects', async function () {
          const users = [];
          const tasks = [];

          // prevent periods from occurring in the table name since they are used to delimit (table.column)
          this.User = this.sequelize.define(`User${Support.rand()}`, { name: DataTypes.STRING });
          this.Task = this.sequelize.define(`Task${Support.rand()}`, { name: DataTypes.STRING });
          this.users = null;
          this.tasks = null;

          this.User.belongsToMany(this.Task, { as: 'Tasks', through: 'usertasks' });
          this.Task.belongsToMany(this.User, { as: 'Users', through: 'usertasks' });

          for (let i = 0; i < 5; ++i) {
            users[i] = { id: i + 1, name: `User${Math.random()}` };
            tasks[i] = { id: i + 1, name: `Task${Math.random()}` };
          }

          await this.sequelize.sync({ force: true });
          await this.User.bulkCreate(users);
          await this.Task.bulkCreate(tasks);
          const _users = await this.User.findAll();
          const _tasks = await this.Task.findAll();
          this.user = _users[0];
          this.task = _tasks[0];
          this.users = _users;
          this.tasks = _tasks;

          expect(await this.user.getTasks()).to.have.length(0);
          await this.user.setTasks(this.tasks);
          expect(await this.user.getTasks()).to.have.length(this.tasks.length);
          await this.user.removeTask(this.tasks[0]);
          expect(await this.user.getTasks()).to.have.length(this.tasks.length - 1);
          await this.user.removeTasks([this.tasks[1], this.tasks[2]]);
          expect(await this.user.getTasks()).to.have.length(this.tasks.length - 3);
        });
      });
    });
  });
}
