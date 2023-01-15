'use strict';

/* eslint-disable no-console -- the point of this file is to debug :) */

// See https://github.com/papb/sequelize-sscce as another option for running SSCCEs.

const { expect } = require('chai'); // You can use `expect` on your SSCCE!
const { createSequelizeInstance } = require('./dev/sscce-helpers');
const { Model, DataTypes } = require('./packages/core');

const sequelize = createSequelizeInstance({ benchmark: true });

class User extends Model {}

User.init({
  username: DataTypes.STRING,
  birthday: DataTypes.DATE,
}, { sequelize, modelName: 'user' });

(async () => {
  await sequelize.sync({ force: true });

  const jane = await User.create({
    username: 'janedoe',
    birthday: new Date(1980, 6, 20),
  });

  console.log('\nJane:', jane.toJSON());

  await sequelize.close();

  expect(jane.username).to.equal('janedoe');
})();

/* eslint-enable no-console -- the point of this file is to debug :) */
