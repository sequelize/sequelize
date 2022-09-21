import { DataTypes, Op, fn, cast } from '@sequelize/core';
import { expect } from 'chai';
import { beforeAll2, disableDatabaseResetForSuite, getTestDialectTeaser, sequelize } from './support';

const dialectName = sequelize.dialect.name;

describe(getTestDialectTeaser('fn()'), () => {
  disableDatabaseResetForSuite();

  const vars = beforeAll2(async () => {
    const Airplane = sequelize.define('Airplane', {
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

    return { Airplane };
  });

  if (dialectName !== 'mssql' && dialectName !== 'ibmi') {
    it('accepts condition object (with cast)', async () => {
      const type = dialectName === 'mysql' ? 'unsigned' : 'int';

      const [airplane] = await vars.Airplane.findAll({
        attributes: [
          [fn('COUNT', '*'), 'count'],
          [fn('SUM', cast({
            engines: 1,
          }, type)), 'count-engines'],
          [fn('SUM', cast({
            [Op.or]: {
              engines: {
                [Op.gt]: 1,
              },
              wings: 4,
            },
          }, type)), 'count-engines-wings'],
        ],
      });

      // These values are returned as strings
      // See https://github.com/sequelize/sequelize/issues/10533#issuecomment-1254141892 for more details
      expect(airplane.get('count')).to.equal('3');
      expect(airplane.get('count-engines')).to.equal('1');
      expect(airplane.get('count-engines-wings')).to.equal('2');
    });
  }

  if (dialectName !== 'mssql' && dialectName !== 'postgres' && dialectName !== 'ibmi') {
    it('accepts condition object (auto casting)', async () => {
      const [airplane] = await vars.Airplane.findAll({
        attributes: [
          [fn('COUNT', '*'), 'count'],
          [fn('SUM', {
            engines: 1,
          }), 'count-engines'],
          [fn('SUM', {
            [Op.or]: {
              engines: {
                [Op.gt]: 1,
              },
              wings: 4,
            },
          }), 'count-engines-wings'],
        ],
      });

      // These values are returned as strings
      // See https://github.com/sequelize/sequelize/issues/10533#issuecomment-1254141892 for more details
      expect(airplane.get('count')).to.equal('3');
      expect(airplane.get('count-engines')).to.equal('1');
      expect(airplane.get('count-engines-wings')).to.equal('2');
    });
  }
});
