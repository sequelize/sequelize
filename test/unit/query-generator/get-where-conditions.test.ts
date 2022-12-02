import { expect } from 'chai';
import { sequelize } from '../../support';

describe('QueryGenerator#getWhereConditions', () => {
  const queryGenerator = sequelize.queryInterface.queryGenerator;

  it('throws if called with invalid arguments', () => {
    const User = sequelize.define('User');

    expect(() => {
      // TODO: https://github.com/sequelize/sequelize/pull/14020 - remove expect-error
      // @ts-expect-error
      queryGenerator.getWhereConditions(new Date(), User.getTableName(), User);
    }).to.throw('Unsupported where option value');
  });
});
