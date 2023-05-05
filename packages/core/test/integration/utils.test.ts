import { expect } from 'chai';
import { DataTypes, Op, cast, fn } from '@sequelize/core';
import { beforeAll2, getTestDialectTeaser, sequelize, setResetMode } from './support';

const dialectName = sequelize.dialect.name;

describe(getTestDialectTeaser('fn()'), () => {
  setResetMode('none');

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

  // TODO: Find a better way for CRDB
  // some dialects return the result of arithmetic functions (SUM, COUNT) as integer & floats, others as bigints & decimals.
  const arithmeticAsNumber = dialectName === 'sqlite' || dialectName === 'db2';
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
      if (dialectName === 'cockroachdb') {
        // By default ints are stored as int8 but after casting they are returned as numberic
        // int8 will be returned as a number if valid where as numeric is returned as string.
        expect(airplane.get('count')).to.equal(3);
      } else {
        expect(airplane.get('count')).to.equal(arithmeticAsNumber ? 3 : '3');
      }

      expect(airplane.get('count-engines')).to.equal(arithmeticAsNumber ? 1 : '1');
      expect(airplane.get('count-engines-wings')).to.equal(arithmeticAsNumber ? 2 : '2');
    });
  }

  if (!['mssql', 'postgres', 'ibmi', 'cockroachdb'].includes(dialectName)) {
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
      // Except for SQLite, which returns them as JS numbers, which the above issue will unify
      expect(airplane.get('count')).to.equal(arithmeticAsNumber ? 3 : '3');
      expect(airplane.get('count-engines')).to.equal(arithmeticAsNumber ? 1 : '1');
      expect(airplane.get('count-engines-wings')).to.equal(arithmeticAsNumber ? 2 : '2');
    });
  }
});
