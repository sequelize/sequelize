'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');
const { DataTypes, EmptyResultError } = require('@sequelize/core');

const current = Support.sequelize;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('findAll', () => {
    describe('separate with limit', () => {
      it('should not throw syntax error (union)', async () => {
        // #9813 testcase
        const Project = current.define('Project', { name: DataTypes.STRING });
        const LevelTwo = current.define('LevelTwo', { name: DataTypes.STRING });
        const LevelThree = current.define('LevelThree', { type: DataTypes.INTEGER });

        Project.hasMany(LevelTwo);
        LevelTwo.belongsTo(Project);

        LevelTwo.hasMany(LevelThree, { as: 'type_ones' });
        LevelTwo.hasMany(LevelThree, { as: 'type_twos' });
        LevelThree.belongsTo(LevelTwo);

        await current.sync({ force: true });

        const [project, level21, level22] = await Promise.all([
          Project.create({ name: 'testProject' }),
          LevelTwo.create({ name: 'testL21' }),
          LevelTwo.create({ name: 'testL22' }),
        ]);

        await Promise.all([project.addLevelTwo(level21), project.addLevelTwo(level22)]);

        // one include case
        const projects0 = await Project.findAll({
          where: { name: 'testProject' },
          include: [
            {
              model: LevelTwo,
              include: [
                {
                  model: LevelThree,
                  as: 'type_ones',
                  where: { type: 0 },
                  separate: true,
                  limit: 1,
                  order: [['createdAt', 'DESC']],
                },
              ],
            },
          ],
        });

        expect(projects0).to.have.length(1);
        expect(projects0[0].levelTwos).to.have.length(2);
        expect(projects0[0].levelTwos[0].type_ones).to.have.length(0);
        expect(projects0[0].levelTwos[1].type_ones).to.have.length(0);

        // two includes case
        const projects = await Project.findAll({
          where: { name: 'testProject' },
          include: [
            {
              model: LevelTwo,
              include: [
                {
                  model: LevelThree,
                  as: 'type_ones',
                  where: { type: 0 },
                  separate: true,
                  limit: 1,
                  order: [['createdAt', 'DESC']],
                },
                {
                  model: LevelThree,
                  as: 'type_twos',
                  where: { type: 1 },
                  separate: true,
                  limit: 1,
                  order: [['createdAt', 'DESC']],
                },
              ],
            },
          ],
        });

        expect(projects).to.have.length(1);
        expect(projects[0].levelTwos).to.have.length(2);
        expect(projects[0].levelTwos[0].type_ones).to.have.length(0);
        expect(projects[0].levelTwos[1].type_ones).to.have.length(0);
      });
    });

    describe('separate with rejectOnEmpty', () => {
      it('does not reject when the main query has results and a separate include is empty', async () => {
        // #13133 testcase
        const User = current.define('User', { name: DataTypes.STRING });
        const Task = current.define('Task', { title: DataTypes.STRING });

        User.hasMany(Task, { as: 'tasks' });

        await current.sync({ force: true });

        const user = await User.create({ name: 'no tasks' });

        const byPk = await User.findByPk(user.id, {
          include: [{ association: 'tasks', separate: true }],
          rejectOnEmpty: true,
        });

        expect(byPk.name).to.equal('no tasks');
        expect(byPk.tasks).to.deep.equal([]);

        const all = await User.findAll({
          include: [{ association: 'tasks', separate: true }],
          rejectOnEmpty: true,
        });

        expect(all).to.have.length(1);
        expect(all[0].tasks).to.deep.equal([]);
      });

      it('still rejects when the main query is empty', async () => {
        const User = current.define('User', { name: DataTypes.STRING });
        const Task = current.define('Task', { title: DataTypes.STRING });

        User.hasMany(Task, { as: 'tasks' });

        await current.sync({ force: true });

        await expect(
          User.findAll({
            include: [{ association: 'tasks', separate: true }],
            rejectOnEmpty: true,
          }),
        ).to.be.rejectedWith(EmptyResultError);
      });

      it('does not apply the rejectOnEmpty option of the included model', async () => {
        const User = current.define('User', { name: DataTypes.STRING });
        const Task = current.define('Task', { title: DataTypes.STRING }, { rejectOnEmpty: true });

        User.hasMany(Task, { as: 'tasks' });

        await current.sync({ force: true });

        const user = await User.create({ name: 'no tasks' });

        const found = await User.findByPk(user.id, {
          include: [{ association: 'tasks', separate: true }],
        });

        expect(found.tasks).to.deep.equal([]);
      });

      it('does not apply a rejectOnEmpty from the default scope of the included model', async () => {
        const User = current.define('User', { name: DataTypes.STRING });
        const Task = current.define(
          'Task',
          { title: DataTypes.STRING },
          { defaultScope: { rejectOnEmpty: true } },
        );

        User.hasMany(Task, { as: 'tasks' });

        await current.sync({ force: true });

        const user = await User.create({ name: 'no tasks' });

        const found = await User.findByPk(user.id, {
          include: [{ association: 'tasks', separate: true }],
        });

        expect(found.tasks).to.deep.equal([]);
      });
    });
  });
});
