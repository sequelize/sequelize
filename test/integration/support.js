'use strict';
var Support = require('../support');

before(function() {
  var dialect = Support.getTestDialect();

  if (dialect !== 'postgres' && dialect !== 'postgres-native') {
    return;
  }
  return Support.sequelize.query('CREATE EXTENSION IF NOT EXISTS hstore', null, {raw: true});
});

before(function() {
  var dialect = Support.getTestDialect();

  if (dialect !== 'postgres' && dialect !== 'postgres-native') {
    return;
  }
  return Support.sequelize.query('CREATE EXTENSION IF NOT EXISTS btree_gist', null, {raw: true});
});

beforeEach(function() {
  this.sequelize.test.trackRunningQueries();
  return Support.clearDatabase(this.sequelize);
});

afterEach(function () {
  try {
    this.sequelize.test.verifyNoRunningQueries();
  } catch (err) {
    err.message += " in "+this.currentTest.fullTitle();
    throw err;
  }
});

module.exports = Support;
