'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  dialect = Support.getTestDialect(),
  DataTypes = require('../../../../lib/data-types');

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES] Query', () => {

    const alias = 'AnActualVeryLongAliasThatShouldBreakthePostgresLimitOfSixtyFourCharacters';

    const executeTest = (options, test) => {
      const sequelize = Support.createSequelizeInstance(options);

      const User = sequelize.define('User', { name: DataTypes.STRING });
      const Task = sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsTo(Task, { as: alias, foreignKey: 'taskId' });


      return sequelize.sync({ force: true }).then(() => {
        return Task.create({ title: 'SuperTask' }).then(task => {
          return User.create({ name: 'test', taskId: task.id }).then(() => {
            return User.findOne({
              include: {
                model: Task,
                as: alias
              }
            }).then(test);
          });
        });
      });

    };

    it('should throw due to alias being truncated', function() {
      const options = Object.assign({}, this.sequelize.options, { minifyAliases: false });

      executeTest(options, res => {
        expect(res[alias]).to.not.exist;
      });
    });

    it('should be able to retrieve include due to alias minifying', function() {
      const options = Object.assign({}, this.sequelize.options, { minifyAliases: true });

      executeTest(options, res => {
        expect(res[alias].title).to.be.equal('SuperTask');
      });
    });
  });
}