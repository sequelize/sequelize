import { DataTypes, literal } from '@sequelize/core';
import { expect } from 'chai';
import { beforeAll2, getTestDialect, sequelize, setResetMode } from '../support';

const dialect = getTestDialect();

const supportedByDialect = ['postgres'].includes(dialect);

describe('QueryInterface#select', () => {
  setResetMode('truncate');

  const qi = sequelize.queryInterface;
  const vars = beforeAll2(async () => {
    const User = sequelize.define(
      'user',
      {
        name: { type: DataTypes.TEXT },
      },
      { timestamps: false },
    );

    await User.sync({ force: true });

    return { User };
  });

  describe('limit/offset', () => {
    beforeEach(async () => {
      await vars.User.bulkCreate([{ name: 'Abraham' }, { name: 'John' }, { name: 'Jane' }]);
    });

    it('selects only the first two records', async () => {
      const result: Array<Record<string, any>> = await qi.select(vars.User, vars.User.table, {
        limit: 2,
        offset: 0,
      });

      expect(result.length).to.equal(2);
      expect(result[0].name).to.equal('Abraham');
      expect(result[1].name).to.equal('John');
    });

    it('selects only the last two records', async () => {
      const result: Array<Record<string, any>> = await qi.select(vars.User, vars.User.table, {
        limit: 2,
        offset: 1,
      });

      expect(result.length).to.equal(2);
      expect(result[0].name).to.equal('John');
      expect(result[1].name).to.equal('Jane');
    });

    it('supports literals with replacements', async () => {
      const result: Array<Record<string, any>> = await qi.select(vars.User, vars.User.table, {
        limit: literal(':limit'),
        offset: literal(':offset'),
        replacements: {
          limit: 2,
          offset: 1,
        },
      });

      expect(result.length).to.equal(2);
      expect(result[0].name).to.equal('John');
      expect(result[1].name).to.equal('Jane');
    });
  });

  if (supportedByDialect) {
    it('fetches records with alias minification', async () => {
      await vars.User.create({ name: 'Sourav' });

      const result: Array<Record<string, any>> = await qi.select(vars.User, vars.User.table, {
        minifyAliases: true,
        where: { name: 'Sourav' },
      });

      expect(result[0].name).to.equal('Sourav');
    });
  }
});
