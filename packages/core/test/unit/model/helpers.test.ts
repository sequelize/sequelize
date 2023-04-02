import { expect } from 'chai';
import { sequelize } from '../../support';

describe('Model', () => {
  describe('hasAlias', () => {
    const User = sequelize.define('user');
    const Task = sequelize.define('task');
    Task.belongsTo(User, { as: 'owner' });

    it('returns true if a model has an association with the specified alias', () => {
      expect(Task.hasAlias('owner')).to.equal(true);
    });

    it('returns false if a model does not have an association with the specified alias', () => {
      expect(Task.hasAlias('notOwner')).to.equal(false);
    });
  });
});
