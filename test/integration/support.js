'use strict';

const Support = require('../support');

const runningQueries = new Set();

before(function() {
  this.sequelize.addHook('beforeQuery', (options, query) => {
    runningQueries.add(query);
  });
  this.sequelize.addHook('afterQuery', (options, query) => {
    runningQueries.delete(query);
  });
});

beforeEach(function() {
  return Support.clearDatabase(this.sequelize);
});

afterEach(function() {
  if (runningQueries.size === 0) {
    return;
  }
  throw new Error(`Expected 0 running queries. ${runningQueries.size} queries still running in ${this.currentTest.fullTitle()}`);
});

module.exports = Support;
