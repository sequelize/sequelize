'use strict';

var Support = require('../support')
  , dialect = Support.getTestDialect();

before(function() {
  if (dialect !== 'postgres' && dialect !== 'postgres-native') {
    return;
  }
  return Support.sequelize.Promise.all([
    Support.sequelize.query('CREATE EXTENSION IF NOT EXISTS hstore', {raw: true}),
    Support.sequelize.query('CREATE EXTENSION IF NOT EXISTS btree_gist', {raw: true})
  ]);
});

beforeEach(function() {
  this.sequelize.test.trackRunningQueries();
  return Support.clearDatabase(this.sequelize);
});

afterEach(function () {
  try {
    this.sequelize.test.verifyNoRunningQueries();
  } catch (err) {
    err.message += ' in '+this.currentTest.fullTitle();
    throw err;
  }
});

module.exports = Support;
