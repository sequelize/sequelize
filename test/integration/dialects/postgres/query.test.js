'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  dialect = Support.getTestDialect(),
  DataTypes = require('sequelize/lib/data-types');

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES] Query', () => {

    const taskAlias = 'AnActualVeryLongAliasThatShouldBreakthePostgresLimitOfSixtyFourCharacters';
    const teamAlias = 'Toto';

    const executeTest = async (options, test) => {
      const sequelize = Support.createSequelizeInstance(options);

      const User = sequelize.define('User', { name: DataTypes.STRING, updatedAt: DataTypes.DATE }, { underscored: true });
      const Team = sequelize.define('Team', { name: DataTypes.STRING });
      const Task = sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsTo(Task, { as: taskAlias, foreignKey: 'task_id' });
      User.belongsToMany(Team, { as: teamAlias, foreignKey: 'teamId', through: 'UserTeam' });
      Team.belongsToMany(User, { foreignKey: 'userId', through: 'UserTeam' });

      await sequelize.sync({ force: true });
      const team = await Team.create({ name: 'rocket' });
      const task = await Task.create({ title: 'SuperTask' });
      const user = await User.create({ name: 'test', task_id: task.id, updatedAt: new Date() });
      await user[`add${teamAlias}`](team);

      return test(await User.findOne({
        include: [
          {
            model: Task,
            as: taskAlias
          },
          {
            model: Team,
            as: teamAlias
          }
        ]
      }));
    };

    it('should throw due to alias being truncated', async function() {
      const options = { ...this.sequelize.options, minifyAliases: false };

      await executeTest(options, res => {
        expect(res[taskAlias]).to.not.exist;
      });
    });

    it('should be able to retrieve include due to alias minifying', async function() {
      const options = { ...this.sequelize.options, minifyAliases: true };

      await executeTest(options, res => {
        expect(res[taskAlias].title).to.be.equal('SuperTask');
      });
    });

    it('should throw due to table name being truncated', async () => {
      const sequelize = Support.createSequelizeInstance({ minifyAliases: true });

      const User = sequelize.define('user_model_name_that_is_long_for_demo_but_also_surpasses_the_character_limit',
        {
          name: DataTypes.STRING,
          email: DataTypes.STRING
        },
        {
          tableName: 'user'
        }
      );
      const Project = sequelize.define('project_model_name_that_is_long_for_demo_but_also_surpasses_the_character_limit',
        {
          name: DataTypes.STRING
        },
        {
          tableName: 'project'
        }
      );
      const Company = sequelize.define('company_model_name_that_is_long_for_demo_but_also_surpasses_the_character_limit',
        {
          name: DataTypes.STRING
        },
        {
          tableName: 'company'
        }
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
          include: Company
        }
      });
    });

    it('orders by a literal when subquery and minifyAliases are enabled', async () => {
      const sequelizeMinifyAliases = Support.createSequelizeInstance({
        logQueryParameters: true,
        benchmark: true,
        minifyAliases: true,
        define: {
          timestamps: false
        }
      });

      const Foo = sequelizeMinifyAliases.define('Foo', {
        name: {
          field: 'my_name',
          type: DataTypes.TEXT
        }
      }, { timestamps: false });

      await sequelizeMinifyAliases.sync({ force: true });
      await Foo.create({ name: 'record1' });
      await Foo.create({ name: 'record2' });

      const thisWorks = (await Foo.findAll({
        subQuery: false,
        order: sequelizeMinifyAliases.literal('"Foo".my_name')
      })).map(f => f.name);
      expect(thisWorks[0]).to.equal('record1');

      const thisShouldAlsoWork = (await Foo.findAll({
        attributes: {
          include: [
            [sequelizeMinifyAliases.literal('"Foo".my_name'), 'customAttribute']
          ]
        },
        subQuery: true,
        order: ['customAttribute']
      })).map(f => f.name);
      expect(thisShouldAlsoWork[0]).to.equal('record1');
    });

    it('returns the minified aliased attributes', async () => {
      const sequelizeMinifyAliases = Support.createSequelizeInstance({
        logQueryParameters: true,
        benchmark: true,
        minifyAliases: true,
        define: {
          timestamps: false
        }
      });

      const Foo = sequelizeMinifyAliases.define(
        'Foo',
        {
          name: {
            field: 'my_name',
            type: DataTypes.TEXT
          }
        },
        { timestamps: false }
      );

      await sequelizeMinifyAliases.sync({ force: true });

      await Foo.findAll({
        subQuery: false,
        attributes: {
          include: [
            [sequelizeMinifyAliases.literal('"Foo".my_name'), 'order_0']
          ]
        },
        order: [['order_0', 'DESC']]
      });
    });
  });
}
