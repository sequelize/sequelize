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
    const errorFunction = User.belongsTo.bind(User, Task, { as: 'task' });
    const errorMessage = 'You have defined two associations with the same name "task" on the model "User". Use another alias using the "as" parameter.';
    expect(errorFunction).to.throw(AssociationError, errorMessage);
  });
});
