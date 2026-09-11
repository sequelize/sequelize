import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import { getTestDialect, sequelize } from '../support';

const dialectName = getTestDialect();
const queryInterface = sequelize.queryInterface;

// Column comments have no `dialect.supports` flag; on PostgreSQL they are emitted as a
// separate statement, which is what these tests cover.
describe('QueryInterface#addColumn', () => {
  if (dialectName !== 'postgres') {
    return;
  }

  beforeEach(async () => {
    await queryInterface.createTable('users', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
    });
  });

  it('adds an enum column with a comment containing parentheses', async () => {
    await queryInterface.addColumn('users', 'status', {
      type: DataTypes.ENUM(['active', 'pending']),
      comment: 'Status (active/pending)',
    });

    const table = await queryInterface.describeTable('users');

    expect(table.status.special).to.deep.equal(['active', 'pending']);
    expect(table.status.comment).to.equal('Status (active/pending)');
  });

  const keywordComments = [
    { keyword: 'SERIAL', type: DataTypes.INTEGER, comment: 'legacy SERIAL id' },
    { keyword: 'PRIMARY KEY', type: DataTypes.STRING, comment: 'was PRIMARY KEY once' },
    { keyword: 'NOT NULL', type: DataTypes.STRING, comment: 'do NOT NULL this' },
  ];

  for (const { comment, keyword, type } of keywordComments) {
    it(`adds a column with a comment containing ${keyword}`, async () => {
      await queryInterface.addColumn('users', 'value', { type, comment });

      const table = await queryInterface.describeTable('users');

      expect(table.value.comment).to.equal(comment);
      expect(table.value.allowNull).to.be.true;
    });
  }
});
