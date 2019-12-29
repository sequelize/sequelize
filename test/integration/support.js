'use strict';

const Support = require('../support');

beforeEach(function() {
  this.sequelize.test.trackRunningQueries();
  return Support.clearDatabase(this.sequelize);
});

afterEach(function() {
  try {
    this.sequelize.test.verifyNoRunningQueries();
  } catch (err) {
    err.message += ' in '+this.currentTest.fullTitle();
    throw err;
  }
});

module.exports = Support;
