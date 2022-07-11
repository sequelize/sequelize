'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const dialect = Support.getTestDialect();
const { DataTypes } = require('@sequelize/core');

if (dialect.startsWith('postgres')) {
  describe('[POSTGRES] Query', () => {

    const taskAlias = 'AnActualVeryLongAliasThatShouldBreakthePostgresLimitOfSixtyFourCharacters';
    const teamAlias = 'Toto';
    const sponsorAlias = 'AnotherVeryLongAliasThatShouldBreakthePostgresLimitOfSixtyFourCharacters';

    const executeTest = async (options, test) => {
      const sequelize = Support.createSequelizeInstance(options);

      const User = sequelize.define('User', { name: DataTypes.STRING, updatedAt: DataTypes.DATE }, { underscored: true });
      const Team = sequelize.define('Team', { name: DataTypes.STRING });
      const Sponsor = sequelize.define('Sponsor', { name: DataTypes.STRING });
      const Task = sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsTo(Task, { as: taskAlias, foreignKey: 'task_id' });
      User.belongsToMany(Team, { as: teamAlias, foreignKey: 'teamId', otherKey: 'userId', through: 'UserTeam' });
      Team.belongsToMany(Sponsor, { as: sponsorAlias, foreignKey: 'sponsorId', otherKey: 'teamId', through: 'TeamSponsor' });

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
        expect((await db.User.findOne(predicate))[taskAlias].title).to.be.equal('SuperTask');
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
        expect((await db.User.findOne(predicate))[teamAlias][0][sponsorAlias][0].name).to.be.equal('Company');
      });
    });

    it('should throw due to table name being truncated', async () => {
      const sequelize = Support.createSequelizeInstance({ minifyAliases: true });

      const User = sequelize.define('user_model_name_that_is_long_for_demo_but_also_surpasses_the_character_limit',
        {
          name: DataTypes.STRING,
          email: DataTypes.STRING,
        },
        {
          tableName: 'user',
        });
      const Project = sequelize.define('project_model_name_that_is_long_for_demo_but_also_surpasses_the_character_limit',
        {
          name: DataTypes.STRING,
        },
        {
          tableName: 'project',
        });
      const Company = sequelize.define('company_model_name_that_is_long_for_demo_but_also_surpasses_the_character_limit',
        {
          name: DataTypes.STRING,
        },
        {
          tableName: 'company',
        });
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
  });
}
