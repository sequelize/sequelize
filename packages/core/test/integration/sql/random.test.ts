import { QueryTypes, sql } from '@sequelize/core';
import { expect } from 'chai';
import { sequelize } from '../support';

describe('sql.random', () => {
  it('generates a value between 0 and 1', async () => {
    const dummyTableName = sequelize.dialect.supports.select.dummyTable;
    const fromClause = dummyTableName
      ? ` FROM ${sequelize.queryGenerator.quoteIdentifier(dummyTableName)}`
      : '';

    const [result] = await sequelize.query<{ val: number }>(
      sql`SELECT ${sql.random} AS val ${sql.literal(fromClause)}`,
      { type: QueryTypes.SELECT },
    );

    expect(result.val).to.be.a('number');
    expect(result.val).to.be.at.least(0);
    expect(result.val).to.be.below(1);
  });
});
