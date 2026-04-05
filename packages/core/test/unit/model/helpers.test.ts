import { expect } from 'chai';
import { beforeAll2, sequelize } from '../../support';

describe('Model#hasAlias', () => {
  const vars = beforeAll2(() => {
    const User = sequelize.define('user');
    const Task = sequelize.define('task');
    Task.belongsTo(User, { as: 'owner' });

    return { Task };
  });

  it('returns true if a model has an association with the specified alias', () => {
    const { Task } = vars;

    expect(Task.hasAlias('owner')).to.equal(true);
  });

  it('returns false if a model does not have an association with the specified alias', () => {
    const { Task } = vars;

    expect(Task.hasAlias('notOwner')).to.equal(false);
  });
});
