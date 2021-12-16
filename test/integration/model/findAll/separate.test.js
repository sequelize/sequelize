'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('../../support');
const DataTypes = require('sequelize/lib/data-types');
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

        try {
          try {
            await current.sync({ force: true });

            const [project, level21, level22] = await Promise.all([
              Project.create({ name: 'testProject' }),
              LevelTwo.create({ name: 'testL21' }),
              LevelTwo.create({ name: 'testL22' })
            ]);

            await Promise.all([
              project.addLevelTwo(level21),
              project.addLevelTwo(level22)
            ]);

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
                      order: [['createdAt', 'DESC']]
                    }
                  ]
                }
              ]
            });

            expect(projects0).to.have.length(1);
            expect(projects0[0].LevelTwos).to.have.length(2);
            expect(projects0[0].LevelTwos[0].type_ones).to.have.length(0);
            expect(projects0[0].LevelTwos[1].type_ones).to.have.length(0);
          } catch (err) {
            expect.fail();
          }

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
                    order: [['createdAt', 'DESC']]
                  },
                  {
                    model: LevelThree,
                    as: 'type_twos',
                    where: { type: 1 },
                    separate: true,
                    limit: 1,
                    order: [['createdAt', 'DESC']]
                  }
                ]
              }
            ]
          });

          expect(projects).to.have.length(1);
          expect(projects[0].LevelTwos).to.have.length(2);
          expect(projects[0].LevelTwos[0].type_ones).to.have.length(0);
          expect(projects[0].LevelTwos[1].type_ones).to.have.length(0);
        } catch (err) {
          expect.fail();
        }
      });
    });
  });
});
