'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');
const sinon = require('sinon');

const dialect = Support.getTestDialect();
const { DatabaseError, DataTypes } = require('@sequelize/core');
const { Op } = require('@sequelize/core');

if (dialect.startsWith('postgres')) {
  describe('[POSTGRES] Query', () => {
    const taskAlias = 'AnActualVeryLongAliasThatShouldBreakthePostgresLimitOfSixtyFourCharacters';
    const teamAlias = 'Toto';
    const sponsorAlias = 'AnotherVeryLongAliasThatShouldBreakthePostgresLimitOfSixtyFourCharacters';

    const executeTest = async (options, test) => {
      const sequelize = Support.createSingleTestSequelizeInstance(options);

      const User = sequelize.define('User', { name: DataTypes.STRING }, { underscored: true });
      const Team = sequelize.define('Team', { name: DataTypes.STRING });
      const Sponsor = sequelize.define('Sponsor', { name: DataTypes.STRING });
      const Task = sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsTo(Task, { as: taskAlias, foreignKey: 'task_id' });
      User.belongsToMany(Team, {
        as: teamAlias,
        foreignKey: 'teamId',
        otherKey: 'userId',
        through: 'UserTeam',
      });
      Team.belongsToMany(Sponsor, {
        as: sponsorAlias,
        foreignKey: 'sponsorId',
        otherKey: 'teamId',
        through: 'TeamSponsor',
      });

      await sequelize.sync({ force: true });
      const sponsor = await Sponsor.create({ name: 'Company' });
      const team = await Team.create({ name: 'rocket' });
      const task = await Task.create({ title: 'SuperTask' });
      const user = await User.create({ name: 'test', task_id: task.id, updatedAt: new Date() });
      await user[`add${teamAlias}`](team);
      await team[`add${sponsorAlias}`](sponsor);

      const predicate = {
        include: [
          {
            model: Task,
            as: taskAlias,
          },
          {
            model: Team,
            as: teamAlias,
          },
        ],
      };

      return test({ User, Team, Sponsor, Task }, predicate);
    };

    it('should throw due to alias being truncated', async function () {
      const options = { ...this.sequelize.options, minifyAliases: false };

      await executeTest(options, async (db, predicate) => {
        expect((await db.User.findOne(predicate))[taskAlias]).to.not.exist;
      });
    });

    it('should be able to retrieve include due to alias minifying', async function () {
      const options = { ...this.sequelize.options, minifyAliases: true };

      await executeTest(options, async (db, predicate) => {
        expect((await db.User.findOne(predicate))[taskAlias].title).to.equal('SuperTask');
      });
    });

    it('should throw due to long alias on through table', async function () {
      const options = { ...this.sequelize.options, minifyAliases: false };

      await executeTest(options, async (db, predicate) => {
        predicate.include[1].include = [
          {
            model: db.Sponsor,
            as: sponsorAlias,
          },
        ];
        await expect(db.User.findOne(predicate)).to.eventually.be.rejected;
      });
    });

    it('should be able to retrieve includes with nested through joins due to alias minifying', async function () {
      const options = { ...this.sequelize.options, minifyAliases: true };

      await executeTest(options, async (db, predicate) => {
        predicate.include[1].include = [
          {
            model: db.Sponsor,
            as: sponsorAlias,
          },
        ];
        expect((await db.User.findOne(predicate))[teamAlias][0][sponsorAlias][0].name).to.equal(
          'Company',
        );
      });
    });

    it('should throw due to table name being truncated', async () => {
      const sequelize = Support.createSingleTestSequelizeInstance({ minifyAliases: true });

      const User = sequelize.define(
        'user_model_name_that_is_long_for_demo_but_also_surpasses_the_character_limit',
        {
          name: DataTypes.STRING,
          email: DataTypes.STRING,
        },
        {
          tableName: 'user',
        },
      );
      const Project = sequelize.define(
        'project_model_name_that_is_long_for_demo_but_also_surpasses_the_character_limit',
        {
          name: DataTypes.STRING,
        },
        {
          tableName: 'project',
        },
      );
      const Company = sequelize.define(
        'company_model_name_that_is_long_for_demo_but_also_surpasses_the_character_limit',
        {
          name: DataTypes.STRING,
        },
        {
          tableName: 'company',
        },
      );
      User.hasMany(Project, { foreignKey: 'userId' });
      Project.belongsTo(Company, { foreignKey: 'companyId' });

      await sequelize.sync({ force: true });
      const comp = await Company.create({ name: 'Sequelize' });
      const user = await User.create({ name: 'standard user' });
      await Project.create({ name: 'Manhattan', companyId: comp.id, userId: user.id });

      await User.findAll({
        include: {
          model: Project,
          include: Company,
        },
      });
    });

    it('supports alias minification with long model names in joins', async () => {
      const sequelize = Support.createSequelizeInstance({
        minifyAliases: true,
      });

      Support.destroySequelizeAfterTest(sequelize);

      const modelOne = sequelize.define(
        'modelOne',
        {},
        {
          paranoid: true,
        },
      );
      const modelTwo = sequelize.define(
        'modelTwo',
        {
          modelOneId: {
            type: DataTypes.INTEGER,
            references: { model: modelOne, key: 'id' },
          },
        },
        {
          paranoid: true,
        },
      );
      const modelThree = sequelize.define(
        'modelThree',
        {
          modelOneId: {
            type: DataTypes.INTEGER,
            references: { model: modelTwo, key: 'id' },
          },
        },
        {
          paranoid: true,
        },
      );
      const modelFour = sequelize.define(
        'modelWithVeryVeryVeryVeryVeryVeryVeryVeryVeryVeryVeryLongNamessss',
        {
          modelOneId: {
            type: DataTypes.INTEGER,
            references: { model: modelThree, key: 'id' },
          },
        },
        {
          paranoid: true,
        },
      );

      modelOne.hasMany(modelTwo);
      modelTwo.belongsTo(modelOne);
      modelTwo.hasMany(modelThree);
      modelThree.belongsTo(modelTwo);
      modelThree.hasMany(modelFour);
      modelFour.belongsTo(modelThree);

      const spy = sinon.spy();
      sequelize.afterBulkSync(() => spy());

      await sequelize.sync({ force: true });
      expect(spy).to.have.been.called;

      const results = await modelOne.findAll({
        include: {
          model: modelTwo,
          include: [
            {
              model: modelThree,
              include: [modelFour],
            },
          ],
        },
      });

      expect(results).to.be.an('array');
    });

    it('orders by a literal when subquery and minifyAliases are enabled', async () => {
      const sequelizeMinifyAliases = Support.createSingleTestSequelizeInstance({
        logQueryParameters: true,
        benchmark: true,
        minifyAliases: true,
        define: {
          timestamps: false,
        },
      });

      const Foo = sequelizeMinifyAliases.define(
        'Foo',
        {
          name: {
            field: 'my_name',
            type: DataTypes.TEXT,
          },
        },
        { timestamps: false },
      );

      await sequelizeMinifyAliases.sync({ force: true });
      await Foo.create({ name: 'record1' });
      await Foo.create({ name: 'record2' });

      const baseTest = (
        await Foo.findAll({
          subQuery: false,
          order: sequelizeMinifyAliases.literal(`"Foo".my_name`),
        })
      ).map(f => f.name);
      expect(baseTest[0]).to.equal('record1');

      const orderByAscSubquery = (
        await Foo.findAll({
          attributes: {
            include: [[sequelizeMinifyAliases.literal(`"Foo".my_name`), 'customAttribute']],
          },
          subQuery: true,
          order: [['customAttribute']],
          limit: 1,
        })
      ).map(f => f.name);
      expect(orderByAscSubquery[0]).to.equal('record1');

      const orderByDescSubquery = (
        await Foo.findAll({
          attributes: {
            include: [[sequelizeMinifyAliases.literal(`"Foo".my_name`), 'customAttribute']],
          },
          subQuery: true,
          order: [['customAttribute', 'DESC']],
          limit: 1,
        })
      ).map(f => f.name);
      expect(orderByDescSubquery[0]).to.equal('record2');
    });

    it('orders by an alias when ordering by an attribute in an included subquery, filtering by a belongsToMany, and minifyAliases are enabled', async () => {
      const sequelizeMinifyAliases = Support.createSingleTestSequelizeInstance({
        logQueryParameters: true,
        benchmark: true,
        minifyAliases: true,
        define: {
          timestamps: false,
        },
      });

      const Customer = sequelizeMinifyAliases.define(
        'customer',
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          name: {
            type: DataTypes.TEXT,
          },
        },
        { timestamps: false },
      );

      const Route = sequelizeMinifyAliases.define(
        'route',
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          date: {
            type: DataTypes.DATEONLY,
          },
        },
        { timestamps: false },
      );
      const Load = sequelizeMinifyAliases.define(
        'load',
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          routeId: {
            type: DataTypes.INTEGER,
            references: {
              model: Route,
              key: 'id',
            },
          },
        },
        { timestamps: false },
      );

      const Delivery = sequelizeMinifyAliases.define(
        'delivery',
        {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          loadId: {
            type: DataTypes.INTEGER,
            references: {
              model: Load,
              key: 'id',
            },
          },
          customerId: {
            type: DataTypes.INTEGER,
            references: {
              model: Customer,
              key: 'id',
            },
          },

          quantity: {
            type: DataTypes.INTEGER,
          },
        },
        { timestamps: false },
      );

      const CustomerDeliveries = sequelizeMinifyAliases.define(
        'customer_deliveries',
        {
          customerId: {
            type: DataTypes.INTEGER,
          },
          deliveryId: {
            type: DataTypes.INTEGER,
          },
        },
        { timestamps: false },
      );

      Route.hasMany(Load, { foreignKey: 'routeId' });
      Load.hasMany(Delivery, { foreignKey: 'loadId' });
      Customer.belongsToMany(Delivery, {
        through: 'customer_deliveries',
        foreignKey: 'customerId',
        otherKey: 'deliveryId',
      });

      await sequelizeMinifyAliases.sync({ force: true });

      await Route.create({ id: 1, date: '2025-12-12' });
      await Load.create({ id: 2, routeId: 1 });
      await Customer.create({ id: 4, name: 'Zyzz Aziz' });
      await Delivery.create({ id: 3, quantity: 10, loadId: 2 });
      await CustomerDeliveries.create({ customerId: 4, deliveryId: 3 });

      const delivery = await Delivery.findOne({
        subQuery: false,
        include: [
          {
            model: Load,
            required: true,
            attributes: ['id'],
            include: [
              {
                model: Route,
                required: true,
                attributes: ['id', 'date'],
                where: { date: { [Op.gt]: '2020-01-01' } },
              },
            ],
          },
          {
            model: Customer,
            required: true,
            where: { name: 'Zyzz Aziz' },
          },
        ],
        where: { quantity: { [Op.gt]: 0 } },
        order: [['load', 'route', 'date', 'ASC']],
      });
      expect(delivery.load.route.date).to.equal('2025-12-12');

      const deliveryWithSubquery = await Delivery.findOne({
        include: [
          {
            model: Load,
            required: true,
            attributes: ['id'],
            include: [
              {
                model: Route,
                required: true,
                attributes: ['id', 'date'],
                where: { date: { [Op.gt]: '2020-01-01' } },
              },
            ],
          },
          {
            model: Customer,
            required: true,
            where: { id: 4 },
          },
        ],
        where: { quantity: { [Op.gt]: 0 } },
        order: [['load', 'route', 'date', 'ASC']],
      });
      expect(deliveryWithSubquery.load.route.date).to.equal('2025-12-12');
    });

    it('returns the minified aliased attributes', async () => {
      const sequelizeMinifyAliases = Support.createSingleTestSequelizeInstance({
        logQueryParameters: true,
        benchmark: true,
        minifyAliases: true,
        define: {
          timestamps: false,
        },
      });

      const Foo = sequelizeMinifyAliases.define(
        'Foo',
        {
          name: {
            field: 'my_name',
            type: DataTypes.TEXT,
          },
        },
        { timestamps: false },
      );

      await sequelizeMinifyAliases.sync({ force: true });

      await Foo.findAll({
        subQuery: false,
        attributes: {
          include: [[sequelizeMinifyAliases.literal('"Foo".my_name'), 'order_0']],
        },
        order: [['order_0', 'DESC']],
      });
    });

    describe('Connection Invalidation', () => {
      if (process.env.DIALECT === 'postgres-native') {
        // native driver doesn't support statement_timeout or query_timeout
        return;
      }

      async function setUp(clientQueryTimeoutMs) {
        const sequelize = Support.createSingleTestSequelizeInstance({
          statement_timeout: 500, // ms
          query_timeout: clientQueryTimeoutMs,
          pool: {
            max: 1, // having only one helps us know whether the connection was invalidated
            idle: 60_000,
          },
        });

        return { sequelize, originalPid: await getConnectionPid(sequelize) };
      }

      async function getConnectionPid(sequelize) {
        const connection = await sequelize.pool.acquire();
        const pid = connection.processID;
        sequelize.pool.release(connection);

        return pid;
      }

      it('reuses connection after statement timeout', async () => {
        // client timeout > statement timeout means that the query should fail with a statement timeout
        const { originalPid, sequelize } = await setUp(10_000);
        await expect(sequelize.query('select pg_sleep(1)')).to.eventually.be.rejectedWith(
          DatabaseError,
          'canceling statement due to statement timeout',
        );
        expect(await getConnectionPid(sequelize)).to.equal(originalPid);
      });

      it('invalidates connection after client-side query timeout', async () => {
        // client timeout < statement timeout means that the query should fail with a read timeout
        const { originalPid, sequelize } = await setUp(250);
        await expect(sequelize.query('select pg_sleep(1)')).to.eventually.be.rejectedWith(
          DatabaseError,
          'Query read timeout',
        );
        expect(await getConnectionPid(sequelize)).to.not.equal(originalPid);
      });
    });
  });
}
