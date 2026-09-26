import { DataTypes, QueryTypes, Sequelize } from '@sequelize/core';
import { MySqlDialect, MySqlQuery } from '@sequelize/mysql';
import { expect } from 'chai';

// The driver names its metadata object `ResultSetHeader`, and the insert path keys off that.
class ResultSetHeader {
  declare insertId: number;
  declare affectedRows: number;
}

describe('MySqlQuery#formatResults', () => {
  const sequelize = new Sequelize({ dialect: MySqlDialect });

  const User = sequelize.define(
    'User',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: DataTypes.STRING,
    },
    { timestamps: false },
  );

  function insert(options: Record<string, unknown>, affectedRows: number) {
    const query = new MySqlQuery({}, sequelize, {
      type: QueryTypes.INSERT,
      model: User,
      plain: false,
      raw: false,
      ...options,
    });

    return query.formatResults(
      Object.assign(new ResultSetHeader(), { insertId: 10, affectedRows }),
    );
  }

  it('synthesises a contiguous id range for a plain bulkCreate', () => {
    expect(insert({}, 3)).to.deep.equal([[{ id: 10 }, { id: 11 }, { id: 12 }], 3]);
  });

  // Three submitted rows of which one collided and was updated: MySQL counts that row twice,
  // so a range built from affectedRows would hand out four ids for three rows.
  it('returns the raw insertId when updateOnDuplicate is set', () => {
    expect(insert({ updateOnDuplicate: ['name'] }, 4)).to.deep.equal([10, 4]);
  });

  // Three submitted rows of which one collided and was ignored: that row is not counted at all,
  // so a range built from affectedRows would cover only two of the three.
  it('returns the raw insertId when ignoreDuplicates is set', () => {
    expect(insert({ ignoreDuplicates: true }, 2)).to.deep.equal([10, 2]);
  });
});
