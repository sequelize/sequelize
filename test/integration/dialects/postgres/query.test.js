'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  dialect = Support.getTestDialect(),
  DataTypes = require('../../../../lib/data-types');

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES] Query', () => {

    const taskAlias = 'AnActualVeryLongAliasThatShouldBreakthePostgresLimitOfSixtyFourCharacters';
    const teamAlias = 'Toto';

    const executeTest = (options, test) => {
      const sequelize = Support.createSequelizeInstance(options);

      const User = sequelize.define('User', { name: DataTypes.STRING, updatedAt: DataTypes.DATE }, { underscored: true });
      const Team = sequelize.define('Team', { name: DataTypes.STRING });
      const Task = sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsTo(Task, { as: taskAlias, foreignKey: 'task_id' });
      User.belongsToMany(Team, { as: teamAlias, foreignKey: 'teamId', through: 'UserTeam' });
      Team.belongsToMany(User, { foreignKey: 'userId', through: 'UserTeam' });

      return sequelize.sync({ force: true }).then(() => {
        return Team.create({ name: 'rocket' }).then(team => {
          return Task.create({ title: 'SuperTask' }).then(task => {
            return User.create({ name: 'test', task_id: task.id, updatedAt: new Date() }).then(user => {
              return user[`add${teamAlias}`](team).then(() => {
                return User.findOne({
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
                }).then(test);
              });
            });
          });
        });
      });

    };

    it('should throw due to alias being truncated', function() {
      const options = Object.assign({}, this.sequelize.options, { minifyAliases: false });

      return executeTest(options, res => {
        expect(res[taskAlias]).to.not.exist;
      });
    });

    it('should be able to retrieve include due to alias minifying', function() {
      const options = Object.assign({}, this.sequelize.options, { minifyAliases: true });

      return executeTest(options, res => {
        expect(res[taskAlias].title).to.be.equal('SuperTask');
      });
    });
  });
}