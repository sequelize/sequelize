'use strict';

const Support = require('../support');

const runningQueries = new Set();

before(function() {
  this.sequelize.addHook('beforeQuery', (options, query) => {
    runningQueries.add(query);
    console.log('Added to running: ', query);
  });
  this.sequelize.addHook('afterQuery', (options, query) => {
    runningQueries.delete(query);
    console.log('Removed from running: ', query);
  });
});

beforeEach(function() {
  return Support.clearDatabase(this.sequelize);
});

afterEach(function() {
  if (runningQueries.size === 0) {
    return;
  }
  let msg = `Expected 0 running queries. ${runningQueries.size} queries still running in ${this.currentTest.fullTitle()}\n`;
  msg += `Queries:\n${[...runningQueries].map(query => `${query.uuid}: ${query.sql}`).join('\n')}`;
  throw new Error(msg);
});

module.exports = Support;
