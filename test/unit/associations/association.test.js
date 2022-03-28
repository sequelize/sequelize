'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');

const current = Support.sequelize;
const AssociationError = require('@sequelize/core/lib/errors').AssociationError;

describe(Support.getTestDialectTeaser('belongsTo'), () => {
  it('should throw an AssociationError when two associations have the same alias', () => {
    const User = current.define('User');
    const Task = current.define('Task');

    User.belongsTo(Task, { as: 'task' });

    expect(() => {
      User.belongsTo(Task, { as: 'task' });
    }).to.throw(AssociationError, 'You have defined two associations with the same name "task" on the model "User". Use another alias using the "as" parameter.');
  });

  it('should throw an AssociationError when two associations have the same alias (one inferred)', () => {
    const User = current.define('User');
    const Task = current.define('Task');

    const association = User.belongsTo(Task);
    expect(association.as).to.eq('Task');

    expect(() => {
      User.belongsTo(Task, { as: 'Task' });
    }).to.throw(AssociationError, 'You have defined two associations with the same name "Task" on the model "User". Use another alias using the "as" parameter.');
  });

  it('should throw an AssociationError when two associations have the same alias (both inferred)', () => {
    const User = current.define('User');
    const Task = current.define('Task');

    User.belongsTo(Task);

    expect(() => {
      User.belongsTo(Task);
    }).to.throw(AssociationError, 'You have defined two associations with the same name "Task" on the model "User". Use another alias using the "as" parameter.');
  });
});
