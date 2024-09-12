const { expect } = require('chai');
const { sequelize } = require('../../support');

describe('QueryGenerator#getWhereConditions', () => {
  const queryGenerator = sequelize.queryInterface.queryGenerator;

  it('throws if called with invalid arguments', () => {
    const User = sequelize.define('User');

    expect(() => {
      queryGenerator.getWhereConditions(new Date(), User.getTableName(), User);
    }).to.throw('Unsupported where option value');
  });

  it('ignores undefined', () => {
    const User = sequelize.define('User');

    expect(queryGenerator.getWhereConditions(undefined, User.getTableName(), User)).to.eq('');
  });

  it('ignores null', () => {
    const User = sequelize.define('User');

    expect(queryGenerator.getWhereConditions(null, User.getTableName(), User)).to.eq('');
  });
});
