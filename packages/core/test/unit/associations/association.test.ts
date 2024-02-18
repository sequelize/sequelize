import { AssociationError } from '@sequelize/core';
import { expect } from 'chai';
import { getTestDialectTeaser, sequelize } from '../../support';

describe(getTestDialectTeaser('belongsTo'), () => {
  it('should throw an AssociationError when two associations have the same alias', () => {
    const User = sequelize.define('User');
    const Task = sequelize.define('Task');

    User.belongsTo(Task, { as: 'task' });

    expect(() => {
      User.belongsTo(Task, { as: 'task' });
    }).to.throw(
      AssociationError,
      'You have defined two associations with the same name "task" on the model "User". Use another alias using the "as" parameter.',
    );
  });

  it('should throw an AssociationError when two associations have the same alias (one inferred)', () => {
    const User = sequelize.define('User');
    const Task = sequelize.define('Task');

    const association = User.belongsTo(Task);
    expect(association.as).to.eq('task');

    expect(() => {
      User.belongsTo(Task, { as: 'task' });
    }).to.throw(
      AssociationError,
      'You have defined two associations with the same name "task" on the model "User". Use another alias using the "as" parameter.',
    );
  });

  it('should throw an AssociationError when two associations have the same alias (both inferred)', () => {
    const User = sequelize.define('User');
    const Task = sequelize.define('Task');

    User.belongsTo(Task);

    expect(() => {
      User.belongsTo(Task);
    }).to.throw(
      AssociationError,
      'You have defined two associations with the same name "task" on the model "User". Use another alias using the "as" parameter.',
    );
  });
});
