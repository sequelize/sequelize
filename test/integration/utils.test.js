'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('./support');
const { DataTypes, Sequelize, Op } = require('@sequelize/core');

describe(Support.getTestDialectTeaser('Utils'), () => {
  before(async () => {
    await Support.clearDatabase(Support.sequelize);
  });

  describe('Sequelize.fn', () => {
    let Airplane;

    beforeEach(async function () {
      Airplane = this.sequelize.define('Airplane', {
        wings: DataTypes.INTEGER,
        engines: DataTypes.INTEGER,
      });

      await Airplane.sync({ force: true });

      await Airplane.bulkCreate([
        {
          wings: 2,
          engines: 0,
        }, {
          wings: 4,
          engines: 1,
        }, {
          wings: 2,
          engines: 2,
        },
      ]);
    });

    if (Support.getTestDialect() !== 'mssql' && Support.getTestDialect() !== 'ibmi') {
      it('accepts condition object (with cast)', async function () {
        const type = Support.getTestDialect() === 'mysql' ? 'unsigned' : 'int';

        const [airplane] = await Airplane.findAll({
          attributes: [
            [this.sequelize.fn('COUNT', '*'), 'count'],
            [Sequelize.fn('SUM', Sequelize.cast({
              engines: 1,
            }, type)), 'count-engines'],
            [Sequelize.fn('SUM', Sequelize.cast({
              [Op.or]: {
                engines: {
                  [Op.gt]: 1,
                },
                wings: 4,
              },
            }, type)), 'count-engines-wings'],
          ],
        });

        // TODO: `parseInt` should not be needed, see #10533
        expect(Number.parseInt(airplane.get('count'), 10)).to.equal(3);
        expect(Number.parseInt(airplane.get('count-engines'), 10)).to.equal(1);
        expect(Number.parseInt(airplane.get('count-engines-wings'), 10)).to.equal(2);
      });
    }

    if (Support.getTestDialect() !== 'mssql' && Support.getTestDialect() !== 'postgres' && Support.getTestDialect() !== 'ibmi') {
      it('accepts condition object (auto casting)', async function () {
        const [airplane] = await Airplane.findAll({
          attributes: [
            [this.sequelize.fn('COUNT', '*'), 'count'],
            [Sequelize.fn('SUM', {
              engines: 1,
            }), 'count-engines'],
            [Sequelize.fn('SUM', {
              [Op.or]: {
                engines: {
                  [Op.gt]: 1,
                },
                wings: 4,
              },
            }), 'count-engines-wings'],
          ],
        });

        // TODO: `parseInt` should not be needed, see #10533
        expect(airplane.get('count')).to.equal(3);
        expect(Number.parseInt(airplane.get('count-engines'), 10)).to.equal(1);
        expect(Number.parseInt(airplane.get('count-engines-wings'), 10)).to.equal(2);
      });
    }
  });
});
